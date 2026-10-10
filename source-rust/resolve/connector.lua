-- Only Resolve SDK transport lives in Lua. Editor and track selection are Rust.
local directory=...
local json=assert(loadfile(directory..'/json.lua.txt'))()
local ffi=require('ffi')
local windows=ffi.os=='Windows'
local resolve=resolve or (fu and fu:GetResolve()) or (fusion and fusion:GetResolve()) or (app and app:GetResolve())
assert(resolve,'Open Icon Studio from Resolve’s Scripts menu.')
local fusion=fu or fusion or resolve:Fusion()
assert(fusion and fusion.UIManager,'Resolve UI Manager is unavailable.')
local ui=fusion.UIManager
local dispatcher=bmd.UIDispatcher(ui)
local timer=ui:Timer{ID='IconStudioRustTimer',Interval=50,SingleShot=false}
local channel=directory..'/ipc/'..tostring(os.time())..'-'..tostring(math.random(100000,999999))
bmd.createdir(directory..'/ipc')
bmd.createdir(channel)
-- LuaJIT's stdio uses the ANSI codepage on Windows; use wide Win32 file APIs.
if windows then
 ffi.cdef[[int MultiByteToWideChar(unsigned int,unsigned long,const char*,int,wchar_t*,int); void* CreateFileW(const wchar_t*,unsigned long,unsigned long,void*,unsigned long,unsigned long,void*); int ReadFile(void*,void*,unsigned long,unsigned long*,void*); int WriteFile(void*,const void*,unsigned long,unsigned long*,void*); int CloseHandle(void*); int MoveFileExW(const wchar_t*,const wchar_t*,unsigned long); int DeleteFileW(const wchar_t*);]]
end
local function wide(s)
 local n=ffi.C.MultiByteToWideChar(65001,0,s,#s,nil,0);local buf=ffi.new('wchar_t[?]',n+1);ffi.C.MultiByteToWideChar(65001,0,s,#s,buf,n);return buf
end
local function read(path)
 if not windows then local f=io.open(path,'rb');if not f then return nil end;local s=f:read('*a');f:close();return s end
 local h=ffi.C.CreateFileW(wide(path),0x80000000,7,nil,3,0,nil);if h==ffi.cast('void*',-1) then return nil end
 local buffer=ffi.new('char[?]',2000001);local size=ffi.new('unsigned long[1]');local ok=ffi.C.ReadFile(h,buffer,2000000,size,nil);ffi.C.CloseHandle(h);if ok==0 then return nil end;return ffi.string(buffer,size[0])
end
local function remove(path) if windows then ffi.C.DeleteFileW(wide(path)) else os.remove(path) end end
local function write(path,s)
 local tmp=path..'.tmp'
 if windows then local h=ffi.C.CreateFileW(wide(tmp),0x40000000,0,nil,2,0,nil);assert(h~=ffi.cast('void*',-1),'Cannot write bridge response');local size=ffi.new('unsigned long[1]');assert(ffi.C.WriteFile(h,s,#s,size,nil)~=0,'Cannot write bridge response');ffi.C.CloseHandle(h);assert(ffi.C.MoveFileExW(wide(tmp),wide(path),1)~=0,'Cannot publish response')
 else local f=assert(io.open(tmp,'wb'));f:write(s);f:close();assert(os.rename(tmp,path)) end
end
local function current(expected)
 local project=resolve:GetProjectManager():GetCurrentProject()
 if expected then assert(project and project:GetUniqueId()==expected,'Resolve project changed. Try again.') end
 return project
end
local function numeric(v) assert(type(v)=='number' and v==v and math.abs(v)<math.huge,'Invalid timeline range');return v end
local function frames(tc,fps)
 local p={};for value in tc:gmatch('%d+') do p[#p+1]=tonumber(value) end
 assert(#p==4,'Unsupported Resolve timecode')
 local f=math.floor(fps+.5);local result=((p[1]*3600+p[2]*60+p[3])*f)+p[4]
 if tc:find(';',1,true) and (f==30 or f==60) then local minutes=p[1]*60+p[2];result=result-(f==60 and 4 or 2)*(minutes-math.floor(minutes/10)) end
 return result
end
local function pool_import(project,files)
 assert(type(files)=='table' and #files>=1 and #files<=200,'Select up to 200 icons')
 for _,path in ipairs(files) do assert(type(path)=='string' and path:lower():sub(-4)=='.png' and read(path),'Generated PNG is missing') end
 local pool=project:GetMediaPool();local clipinfo={};for _,path in ipairs(files) do clipinfo[#clipinfo+1]={FilePath=path} end
 local clips=pool:ImportMedia(clipinfo)
 if not clips or #clips==0 then clips=pool:ImportMedia(files) end
 assert(clips and #clips>0,'Resolve could not import these PNGs')
 return pool,clips
end
local function snapshot(timeline)
 local tracks={}
 for index=1,timeline:GetTrackCount('video') do
  local ranges={};for _,clip in ipairs(timeline:GetItemListInTrack('video',index) or {}) do local first=numeric(clip:GetStart());local last=numeric(clip:GetEnd());assert(last>=first,'Invalid clip range');ranges[#ranges+1]={first,last} end
  tracks[#tracks+1]={index=index,locked=timeline:GetIsTrackLocked('video',index)==true,enabled=timeline:GetIsTrackEnabled('video',index)~=false,ranges=ranges}
 end
 return tracks
end
local function append(timeline,pool,clip,frame,duration,track)
 return pool:AppendToTimeline{{mediaPoolItem=clip,startFrame=0,endFrame=duration-1,mediaType=1,trackIndex=track,recordFrame=frame}}
end
local transactions={}
local function clean(t)
 if not t then return end
 if #(t.timeline:GetItemListInTrack('video',t.staging) or {})==0 then t.timeline:DeleteTrack('video',t.staging) end
 t.timeline:SetCurrentTimecode(t.timecode)
end
local function cancel(id)
 local t=transactions[id];if t then t.timeline:DeleteClips(t.staged,false);clean(t);transactions[id]=nil end
end
local function request(method,args)
 if method=='context' then local p=current();return {connected=true,project=p and {id=p:GetUniqueId(),name=p:GetName()} or json.null} end
 if method=='cancel' then cancel(args.transaction);return true end
 local p=current(args.expectedProjectId)
 if method=='import' then local _,clips=pool_import(p,args.files);return {imported=#clips} end
 if method=='stage' then
  local timeline=p:GetCurrentTimeline();assert(timeline,'Open a timeline first')
  local pool,clips=pool_import(p,{args.file});local tracks=snapshot(timeline);local timecode=timeline:GetCurrentTimecode()
  local fps=tonumber(timeline:GetSetting('timelineFrameRate') or p:GetSetting('timelineFrameRate') or 24)
  local frame=frames(timecode,fps);local duration=math.max(1,math.floor((tonumber(args.duration) or 5)*fps+.5));local staging=#tracks+1
  assert(timeline:AddTrack('video'),'Resolve could not add a video track')
  local staged=append(timeline,pool,clips[1],frame,duration,staging)
  if not staged or #staged==0 then timeline:DeleteTrack('video',staging);timeline:SetCurrentTimecode(timecode);error('Resolve could not place this icon. It is in the Media Pool.') end
  local ok,actual=pcall(function() local d=numeric(staged[1]:GetDuration());assert(d>0,'Invalid still duration');return d end)
  if not ok then timeline:DeleteClips(staged,false);if #(timeline:GetItemListInTrack('video',staging) or {})==0 then timeline:DeleteTrack('video',staging) end;timeline:SetCurrentTimecode(timecode);error(actual) end
  local id=tostring(os.time())..'-'..tostring(math.random(100000,999999))
  transactions[id]={timeline=timeline,pool=pool,clip=clips[1],frame=frame,duration=actual,staging=staging,staged=staged,timecode=timecode,projectId=p:GetUniqueId(),created=os.time()}
  return {transaction=id,tracks=tracks,frame=frame,duration=actual}
 end
 if method=='finish' then
  local t=assert(transactions[args.transaction],'Timeline transaction expired');assert(p:GetUniqueId()==t.projectId and p:GetCurrentTimeline():GetUniqueId()==t.timeline:GetUniqueId(),'Resolve timeline changed')
  local track=tonumber(args.track);assert(track and track>=1 and track<=t.staging,'Invalid target track')
  local placed=t.staged
  if track~=t.staging then
   assert(not t.timeline:GetIsTrackLocked('video',track),'Target track is locked')
   local attempted=append(t.timeline,t.pool,t.clip,t.frame,t.duration,track)
   if attempted and #attempted>0 then
    if t.timeline:DeleteClips(t.staged,false) then placed=attempted else t.timeline:DeleteClips(attempted,false);track=t.staging end
   else track=t.staging end
  end
  clean(t);transactions[args.transaction]=nil
  return {imported=1,added=#placed,trackIndex=track,recordFrame=t.frame,duration=t.duration}
 end
 if method=='manual' then
  local timeline=p:GetCurrentTimeline();assert(timeline,'Open a timeline first');local pool,clips=pool_import(p,{args.file});local options=args.options;local fps=tonumber(timeline:GetSetting('timelineFrameRate') or p:GetSetting('timelineFrameRate') or 24);local duration=math.max(1,math.floor((tonumber(options.duration) or 5)*fps+.5));local tc=timeline:GetCurrentTimecode();local frame=options.position=='end' and timeline:GetEndFrame() or frames(tc,fps);local track=math.max(1,math.min(99,tonumber(options.track) or 2))
  while timeline:GetTrackCount('video')<track do assert(timeline:AddTrack('video'),'Cannot add a video track') end
  assert(not timeline:GetIsTrackLocked('video',track),'Target track is locked')
  local clips=append(timeline,pool,clips[1],frame,duration,track);timeline:SetCurrentTimecode(tc);assert(clips and #clips>0,'Resolve could not place this icon');return {imported=1,added=#clips,trackIndex=track}
 end
 error('Unknown connector command')
end
local function quote(s) if windows then return '"'..s:gsub('"','')..'"' else return "'"..s:gsub("'","'\\''").."'" end end
local executable=directory..(windows and '/IconStudio.exe' or '/IconStudio')
assert(read(executable),'Native Rust executable is missing. Run the installer.')
if windows then os.execute('start "" /B '..quote(executable)..' --bridge '..quote(channel)) else os.execute(quote(executable)..' --bridge '..quote(channel)..' >/dev/null 2>&1 &') end
local launched=os.time();local last_id
function dispatcher.On.Timeout(event)
 if event.who~=timer.ID then return end
 if read(channel..'/closed') then timer:Stop();dispatcher:ExitLoop();return end
 if os.time()-launched>35 and not read(channel..'/ready') then timer:Stop();dispatcher:ExitLoop();print('Icon Studio could not start. Check that WebView2 is installed and the full ZIP was extracted.');return end
 for id,t in pairs(transactions) do if os.time()-t.created>30 then pcall(cancel,id) end end
 local raw=read(channel..'/request.json');if not raw then return end
 local parsed,data=pcall(json.decode,raw);if not parsed or type(data)~='table' or data.id==last_id then return end
 last_id=data.id;remove(channel..'/request.json')
 local ok,result=pcall(request,data.method,data.args or {})
 write(channel..'/response.json',json.encode(ok and {id=data.id,ok=true,result=result} or {id=data.id,ok=false,error=tostring(result)}))
end
timer:Start();dispatcher:RunLoop();timer:Stop()
for id in pairs(transactions) do pcall(cancel,id) end
for _,name in ipairs({'ready','closed','request.json','response.json'}) do remove(channel..'/'..name) end
