-- Icon Studio by Sakib. Native Rust app + Resolve LuaJIT connector.
local source=debug.getinfo(1,'S').source
local utility=source:sub(1,1)=='@' and source:sub(2):match('^(.*)[/\\]') or nil
local is_windows=package.config:sub(1,1)=='\\'
if not utility then
 utility=is_windows and (os.getenv('APPDATA')..'/Blackmagic Design/DaVinci Resolve/Support/Fusion/Scripts/Utility') or (os.getenv('HOME')..'/Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion/Scripts/Utility')
end
local directory=utility..'/_IconStudioRust'
local entry=directory..'/connector.lua.txt'
local file=io.open(entry,'rb')
if not file then error('Icon Studio is not installed completely. Run the installer from the extracted ZIP.') end
local code=file:read('*a');file:close()
assert(loadstring(code,'@'..entry))(directory)
