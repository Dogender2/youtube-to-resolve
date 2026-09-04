"""
Most do DaVinci Resolve: podlaczenie do aplikacji i import plikow do projektu.

Gdy skrypt jest uruchamiany z menu Workspace -> Scripts, modul
'DaVinciResolveScript' jest dostepny od reki. Fallback (ladowanie po sciezce)
zostawiamy na wypadek uruchomienia z zewnatrz (Studio to pozwala).
"""
from __future__ import annotations

import importlib.util
import os
import sys
from pathlib import Path


class ResolveError(RuntimeError):
    pass


def _load_module():
    try:
        import DaVinciResolveScript as bmd  # dostepne wewnatrz Resolve
        return bmd
    except ImportError:
        pass

    if sys.platform.startswith("darwin"):
        base = "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules/"
        lib = "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so"
    elif sys.platform.startswith("win"):
        base = os.path.expandvars(r"%PROGRAMDATA%\Blackmagic Design\DaVinci Resolve\Support\Developer\Scripting\Modules\\")
        lib = r"C:\Program Files\Blackmagic Design\DaVinci Resolve\fusionscript.dll"
    else:
        base = "/opt/resolve/Developer/Scripting/Modules/"
        lib = "/opt/resolve/libs/Fusion/fusionscript.so"

    os.environ.setdefault("RESOLVE_SCRIPT_LIB", lib)
    module_file = Path(base) / "DaVinciResolveScript.py"
    if not module_file.is_file():
        raise ResolveError(
            "Nie znaleziono modulu DaVinciResolveScript. Czy DaVinci Resolve jest zainstalowany?"
        )
    spec = importlib.util.spec_from_file_location("DaVinciResolveScript", str(module_file))
    mod = importlib.util.module_from_spec(spec)
    sys.modules["DaVinciResolveScript"] = mod
    spec.loader.exec_module(mod)
    return mod


def get_resolve():
    bmd = _load_module()
    resolve = bmd.scriptapp("Resolve")
    if not resolve:
        raise ResolveError(
            "Nie udalo sie polaczyc z DaVinci Resolve. Czy program jest uruchomiony?"
        )
    return resolve


def current_project(resolve=None):
    resolve = resolve or get_resolve()
    proj = resolve.GetProjectManager().GetCurrentProject()
    if not proj:
        raise ResolveError("Brak otwartego projektu w DaVinci Resolve.")
    return proj


def _ensure_bin(media_pool, name: str):
    """Zwraca (tworzac w razie potrzeby) podfolder w Media Pool o danej nazwie."""
    root = media_pool.GetRootFolder()
    try:
        for sub in (root.GetSubFolderList() or []):
            if sub.GetName() == name:
                return sub
    except Exception:
        pass  # gdyby API sie roznilo - po prostu sprobuj utworzyc
    return media_pool.AddSubFolder(root, name)


def import_paths(paths, bin_name: str = "", resolve=None):
    """
    Importuje pliki do biezacego projektu. Domyslnie do aktualnie wybranego bina;
    jesli podano bin_name, importuje do (utworzonego jesli trzeba) podfolderu.
    Zwraca (lista MediaPoolItem, nazwa_projektu).
    """
    resolve = resolve or get_resolve()
    proj = current_project(resolve)
    media_pool = proj.GetMediaPool()

    if bin_name:
        folder = _ensure_bin(media_pool, bin_name)
        if folder:
            media_pool.SetCurrentFolder(folder)

    paths = [str(p) for p in paths]
    items = media_pool.ImportMedia(paths)
    if not items:
        raise ResolveError(
            "Resolve nie zaimportowal pliku (moze nieobslugiwany format lub zla sciezka)."
        )
    return items, proj.GetName()
