"""Resolve-internal bridge. No external scripting preference changes are required."""
import json, os, sys, socket, threading, queue, secrets, subprocess, time
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
    if method!='insert': raise ValueError('Unknown operation')
    if project is None: raise ValueError('Open a Resolve project first.')
    if project.GetUniqueId()!=args.get('expectedProjectId'): raise ValueError('Resolve project changed.')
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
    options=args['options'];track=max(1,min(99,int(options.get('track',2))))
    while timeline.GetTrackCount('video')<track:
        if not timeline.AddTrack('video'): raise ValueError('Resolve could not add the target track.')
    if timeline.GetIsTrackLocked('video',track): raise ValueError('The target video track is locked.')
    settings=timeline.GetSettings() if hasattr(timeline,'GetSettings') else {}
    fps=float(settings.get('timelineFrameRate') or project.GetSetting('timelineFrameRate') or 24)
    frame=timeline.GetEndFrame() if options.get('position')=='end' else timecode_frames(timeline.GetCurrentTimecode(),fps)
    duration=max(1,round(max(.1,min(3600,float(options.get('duration',5))))*fps))
    added=pool.AppendToTimeline([{'mediaPoolItem':clips[0],'startFrame':0,'endFrame':duration-1,'mediaType':1,'trackIndex':track,'recordFrame':frame}])
    if not added: raise ValueError('Resolve could not add the icon to the timeline.')
    return {'imported':1,'added':len(added),'recordFrame':frame}

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
