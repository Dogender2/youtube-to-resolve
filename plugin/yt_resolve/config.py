"""
Konfiguracja: lokalizacja narzedzi (yt-dlp, ffmpeg) i ustawienia uzytkownika.

Trzymamy to w jednym miejscu, zeby reszta kodu nie martwila sie sciezkami.
Wazne: gdy skrypt uruchamia sie WEWNATRZ Resolve, zmienna PATH bywa okrojona,
dlatego binarek szukamy takze w typowych lokalizacjach (Homebrew itd.).
"""
from __future__ import annotations

import json
import os
import shutil
from dataclasses import asdict, dataclass
from pathlib import Path

# --- Sciezki w obrebie pluginu -------------------------------------------------
PKG_DIR = Path(__file__).resolve().parent      # .../plugin/yt_resolve
PLUGIN_DIR = PKG_DIR.parent                     # .../plugin
PROJECT_DIR = PLUGIN_DIR.parent                 # katalog repo
BUNDLED_BIN = PLUGIN_DIR / "bin"                # opcjonalne dolaczone binarki

# Typowe miejsca, gdzie moga lezec yt-dlp / ffmpeg na macOS
_COMMON_BIN_DIRS = [
    "/opt/homebrew/bin",   # Homebrew (Apple Silicon)
    "/usr/local/bin",      # Homebrew (Intel)
    "/opt/local/bin",      # MacPorts
    "/usr/bin",
]


def find_binary(name: str) -> str | None:
    """Znajdz binarke: najpierw dolaczona do pluginu, potem PATH, potem typowe katalogi."""
    bundled = BUNDLED_BIN / name
    if bundled.is_file() and os.access(bundled, os.X_OK):
        return str(bundled)
    which = shutil.which(name)
    if which:
        return which
    for d in _COMMON_BIN_DIRS:
        p = Path(d) / name
        if p.is_file() and os.access(p, os.X_OK):
            return str(p)
    return None


def ytdlp_path() -> str | None:
    return find_binary("yt-dlp")


def ffmpeg_path() -> str | None:
    return find_binary("ffmpeg")


def ffmpeg_dir() -> str | None:
    p = ffmpeg_path()
    return str(Path(p).parent) if p else None


# --- Ustawienia uzytkownika ----------------------------------------------------
DEFAULT_DOWNLOAD_DIR = Path.home() / "Movies" / "YouTube to Resolve"
SETTINGS_PATH = (
    Path.home()
    / "Library" / "Application Support" / "YouTubeToResolve" / "settings.json"
)


@dataclass
class Settings:
    download_dir: str = str(DEFAULT_DOWNLOAD_DIR)
    per_project_subfolder: bool = True   # tworz podfolder o nazwie projektu Resolve
    import_bin_name: str = ""            # pusty = aktualny bin; inaczej podfolder w Media Pool
    default_container: str = "mp4"       # docelowy kontener wideo
    max_results: int = 15

    @classmethod
    def load(cls) -> "Settings":
        try:
            data = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
            known = {k: v for k, v in data.items() if k in cls.__dataclass_fields__}
            return cls(**known)
        except Exception:
            return cls()

    def save(self) -> None:
        SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
        SETTINGS_PATH.write_text(json.dumps(asdict(self), indent=2), encoding="utf-8")
