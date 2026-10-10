"""Workspace > Scripts > Utility > Icon Studio"""
from pathlib import Path
import runpy

def start():
    # Resolve executes Utility scripts with runpy, so __file__ is not guaranteed.
    # Prefer it when available, then use the documented per-user Utility paths.
    script_file = globals().get('__file__')
    candidates = []
    if script_file:
        candidates.append(Path(script_file).resolve().parent / '_IconStudio')
    candidates.extend([
        Path.home() / 'AppData/Roaming/Blackmagic Design/DaVinci Resolve/Support/Fusion/Scripts/Utility/_IconStudio',
        Path.home() / 'Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion/Scripts/Utility/_IconStudio',
    ])
    application = next((path for path in candidates if (path / 'bridge.py.txt').is_file()), candidates[0])
    bridge=application/'bridge.py.txt'
    if not bridge.exists():
        raise RuntimeError('Icon Studio installation is incomplete. Run Install Windows.ps1 or Install Mac.command.')
    instance=globals().get('resolve')
    if instance is None:
        try:instance=globals()['fusion'].GetResolve()
        except Exception:
            import DaVinciResolveScript
            instance=DaVinciResolveScript.scriptapp('Resolve')
    if instance is None:raise RuntimeError('Run Icon Studio inside DaVinci Resolve.')
    runpy.run_path(str(bridge))['launch'](instance,application)

start()
