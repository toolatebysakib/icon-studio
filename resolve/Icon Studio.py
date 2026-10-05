"""Workspace > Scripts > Utility > Icon Studio"""
from pathlib import Path
import runpy

def start():
    application=Path(__file__).resolve().parent/'_IconStudio'
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
