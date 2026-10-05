"""Resolve-internal bridge. No external scripting preference changes are required."""
import json, os, sys, socket, threading, queue, secrets, subprocess, time, math
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

def timecode_frames(code, rate):
    parts=[int(part) for part in code.replace(';',':').split(':')]
    fps=round(float(rate))
    frame=((parts[0]*3600+parts[1]*60+parts[2])*fps)+parts[3]
    if ';' in code and fps in (30,60):
        minutes=parts[0]*60+parts[1]
        frame-=(4 if fps==60 else 2)*(minutes-minutes//10)
    return frame

def request(resolve, method, args):
    project=resolve.GetProjectManager().GetCurrentProject()
    if method=='context': return {'project':{'id':project.GetUniqueId(),'name':project.GetName()} if project else None,'connected':True}
    if method not in ('insert','batch'): raise ValueError('Unknown operation')
    if project is None: raise ValueError('Open a Resolve project first.')
    if project.GetUniqueId()!=args.get('expectedProjectId'): raise ValueError('Resolve project changed.')
    if method=='batch':
        files=args.get('files',[])
        if not isinstance(files,list) or not 1<=len(files)<=200: raise ValueError('Select up to 200 icons.')
        paths=[Path(file) for file in files]
        if any(not file.is_absolute() or file.suffix.lower()!='.png' or not file.is_file() for file in paths): raise ValueError('Choose existing generated PNG files.')
        pool=project.GetMediaPool()
        clips=pool.ImportMedia([{'FilePath':str(file)} for file in paths])
        if not clips: clips=pool.ImportMedia([str(file) for file in paths])
        if not clips: raise ValueError('Resolve could not import these PNGs.')
        return {'imported':len(clips)}
    file=Path(args['file'])
    if not file.is_absolute() or file.suffix.lower()!='.png' or not file.is_file(): raise ValueError('Choose an existing PNG file.')
    pool=project.GetMediaPool()
    clips=pool.ImportMedia([{'FilePath':str(file)}])
    if not clips: clips=pool.ImportMedia([str(file)])
    if not clips: raise ValueError('Resolve could not import this PNG.')
    if args['kind']=='pool': return {'imported':len(clips)}
    if args['kind']!='timeline': raise ValueError('Invalid operation')
    timeline=project.GetCurrentTimeline()
    if timeline is None: raise ValueError('Open a timeline first. The icon is in the Media Pool.')
    options=args['options']
    settings=timeline.GetSettings() if hasattr(timeline,'GetSettings') else {}
    fps=float(settings.get('timelineFrameRate') or project.GetSetting('timelineFrameRate') or 24)
    frame=timeline.GetEndFrame() if options.get('trackMode')=='manual' and options.get('position')=='end' else timecode_frames(timeline.GetCurrentTimecode(),fps)
    duration=max(1,round(max(.1,min(3600,float(options.get('duration',5))))*fps))
    if options.get('trackMode')!='manual': return automatic_insert(timeline,pool,clips[0],frame,duration)
    track=max(1,min(99,int(options.get('track',2))))
    while timeline.GetTrackCount('video')<track:
        if not timeline.AddTrack('video'): raise ValueError('Resolve could not add the target track.')
    if timeline.GetIsTrackLocked('video',track): raise ValueError('The target video track is locked.')
    added=pool.AppendToTimeline([{'mediaPoolItem':clips[0],'startFrame':0,'endFrame':duration-1,'mediaType':1,'trackIndex':track,'recordFrame':frame}])
    if not added: raise ValueError('Resolve could not add the icon to the timeline.')
    return {'imported':1,'added':len(added),'recordFrame':frame}

def snapshot_tracks(timeline):
    tracks=[]
    for index in range(1,timeline.GetTrackCount('video')+1):
        ranges=[]
        for item in timeline.GetItemListInTrack('video',index) or []:
            start,end=float(item.GetStart()),float(item.GetEnd())
            if not math.isfinite(start) or not math.isfinite(end) or end<start:
                raise ValueError("Resolve could not read a video clip's timeline range.")
            ranges.append({'start':start,'end':end})
        tracks.append({'index':index,'ranges':ranges,'locked':bool(timeline.GetIsTrackLocked('video',index)),'enabled':timeline.GetIsTrackEnabled('video',index) is not False})
    return tracks

def choose_track(tracks,frame,duration):
    end=frame+duration
    highest=max((track['index'] for track in tracks if any(clip['start']<end and clip['end']>frame for clip in track['ranges'])),default=0)
    return next((track['index'] for track in tracks if track['index']>highest and not track['locked'] and track['enabled']),len(tracks)+1)

def append_icon(pool,clip,frame,duration,track):
    return pool.AppendToTimeline([{'mediaPoolItem':clip,'startFrame':0,'endFrame':duration-1,'mediaType':1,'trackIndex':track,'recordFrame':frame}])

def automatic_insert(timeline,pool,clip,frame,requested_duration):
    original_timecode=timeline.GetCurrentTimecode()
    tracks=snapshot_tracks(timeline);staging_track=len(tracks)+1
    if not timeline.AddTrack('video'): raise ValueError('Resolve could not create a video track.')
    # Measure the actual still length safely; Resolve can ignore PNG source ranges.
    try:
        staged=append_icon(pool,clip,frame,requested_duration,staging_track)
        if not staged: raise ValueError('Resolve could not place the icon. It is in the Media Pool.')
        duration=float(staged[0].GetDuration())
        if not math.isfinite(duration) or duration<=0:
            timeline.DeleteClips(staged,False)
            raise ValueError("Resolve could not determine the icon's duration.")
        track=choose_track(tracks,frame,duration)
        def result(items,index): return {'imported':1,'added':len(items),'recordFrame':frame,'trackIndex':index,'duration':duration}
        if track==staging_track: return result(staged,track)
        placed=append_icon(pool,clip,frame,duration,track)
        if not placed: return result(staged,staging_track)
        if not timeline.DeleteClips(staged,False):
            timeline.DeleteClips(placed,False)
            return result(staged,staging_track)
        return result(placed,track)
    finally:
        try:
            if not (timeline.GetItemListInTrack('video',staging_track) or []): timeline.DeleteTrack('video',staging_track)
        finally:
            timeline.SetCurrentTimecode(original_timecode)

def electron_path():
    if sys.platform=='win32':
        roots=[Path(os.environ.get('PROGRAMFILES','C:/Program Files'))/'Blackmagic Design/DaVinci Resolve',Path('C:/Program Files/Blackmagic Design/DaVinci Resolve')]
        candidates=[root/'Electron/electron.exe' for root in roots]
    else:
        apps=[Path('/Applications/DaVinci Resolve/DaVinci Resolve.app'),Path('/Applications/DaVinci Resolve Studio/DaVinci Resolve Studio.app'),Path('/Applications/DaVinci Resolve.app'),Path('/Applications/DaVinci Resolve Studio.app')]
        candidates=[]
        for app in apps:
            candidates.extend([app/'Contents/Frameworks/Electron.app/Contents/MacOS/Electron',app/'Contents/Libraries/Electron.app/Contents/MacOS/Electron',app/'Contents/MacOS/Electron.app/Contents/MacOS/Electron'])
            if app.exists(): candidates.extend(app.glob('Contents/**/Electron.app/Contents/MacOS/Electron'))
    for candidate in candidates:
        if candidate.is_file(): return candidate
    raise RuntimeError('Resolve’s bundled Electron runtime was not found. Use Workspace → Workflow Integrations → Icon Studio by Sakib.')

def launch(resolve, directory):
    directory=Path(directory);token=secrets.token_urlsafe(32);tasks=queue.Queue();closed=threading.Event()
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*args): pass
        def do_POST(self):
            if self.headers.get('Authorization')!='Bearer '+token:
                self.send_error(403);return
            length=int(self.headers.get('Content-Length','0'))
            if length>100000 or length<1:self.send_error(413);return
            try:
                data=json.loads(self.rfile.read(length));done=queue.Queue(1)
                tasks.put((data,done));result=done.get(timeout=14)
            except Exception as error:result={'ok':False,'error':str(error)}
            content=json.dumps(result).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(content)));self.end_headers();self.wfile.write(content)
    server=ThreadingHTTPServer(('127.0.0.1',0),Handler);server.daemon_threads=True
    thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
    env=os.environ.copy();env['ICON_STUDIO_BRIDGE_URL']='http://127.0.0.1:'+str(server.server_port);env['ICON_STUDIO_BRIDGE_TOKEN']=token
    flags=subprocess.CREATE_NO_WINDOW if sys.platform=='win32' else 0
    child=subprocess.Popen([str(electron_path()),str(directory)],env=env,creationflags=flags)
    try:
        while child.poll() is None and not closed.is_set():
            try:data,done=tasks.get(timeout=.1)
            except queue.Empty:continue
            try:
                if data.get('method')=='close':closed.set();result=True
                else:result=request(resolve,data.get('method'),data.get('args',{}))
                done.put({'ok':True,'result':result})
            except Exception as error:done.put({'ok':False,'error':str(error)})
    finally:server.shutdown();server.server_close()
