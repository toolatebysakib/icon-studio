"""Launch/connect Icon Studio. The previous Icon Studio script is kept separately."""
from pathlib import Path
import runpy, sys, os

if sys.platform == 'win32':
    utility = Path(os.environ.get('APPDATA', str(Path.home()/'AppData/Roaming'))) / 'Blackmagic Design/DaVinci Resolve/Support/Fusion/Scripts/Utility'
else:
    utility = Path.home()/'Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion/Scripts/Utility'
script_file = globals().get('__file__')
if script_file:
    utility = Path(script_file).resolve().parent
application = utility/'_IconStudioAppConnector'
instance = globals().get('resolve')
if instance is None:
    try:
        instance = globals()['fusion'].GetResolve()
    except Exception:
        import DaVinciResolveScript
        instance = DaVinciResolveScript.scriptapp('Resolve')
if instance is None:
    raise RuntimeError('Open this connector from Resolve > Workspace > Scripts > Utility.')
runpy.run_path(str(application/'bridge.py.txt'))['launch'](instance)
