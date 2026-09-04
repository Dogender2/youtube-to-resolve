"""
Silnik: wyszukiwanie, listowanie formatow i pobieranie z YouTube.

Uzywamy yt-dlp jako ZEWNETRZNEJ binarki (subprocess), a nie biblioteki Pythona.
Dzieki temu nie zalezymy od tego, czy Python Resolve ma zainstalowany pakiet yt-dlp
- wystarczy, ze binarka istnieje w systemie.
"""
from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from . import config as cfg

# Znaczniki do parsowania strumienia yt-dlp (patrz: download()).
_MARK_FILE = "@@FILE@@"
_MARK_PROG = "@@P@@"
_ANSI = re.compile(r"\x1b\[[0-9;]*m")


class EngineError(RuntimeError):
    pass


# --- Modele danych -------------------------------------------------------------
@dataclass
class SearchResult:
    id: str
    title: str
    url: str
    duration: float | None
    duration_str: str
    uploader: str
    thumbnail: str


@dataclass
class VideoDetails:
    id: str
    title: str
    duration: float | None
    duration_str: str
    uploader: str
    thumbnail: str
    heights: list[int]          # dostepne wysokosci wideo, malejaco (np. [2160,1440,1080,...])
    has_audio: bool
    raw_formats: list = field(default_factory=list, repr=False)


@dataclass
class DownloadSpec:
    mode: str                    # 'video' albo 'audio'
    height: int | None = None    # dla wideo: maksymalna wysokosc (np. 1080)
    container: str = "mp4"       # dla wideo: mp4 / mkv
    audio_format: str = "m4a"    # dla audio: m4a / mp3 / wav / opus / flac

    def ytdlp_args(self) -> list[str]:
        if self.mode == "audio":
            return [
                "-f", "bestaudio/best",
                "-x", "--audio-format", self.audio_format,
                "--audio-quality", "0",
            ]
        h = self.height or 1080
        # Najlepsze wideo <= h + najlepsze audio; jesli sie nie da, wez cokolwiek.
        return [
            "-f", f"bv*[height<={h}]+ba/b[height<={h}]/b",
            "--merge-output-format", self.container,
        ]


@dataclass
class ProgressUpdate:
    percent: float | None
    percent_str: str
    speed: str
    eta: str


# --- Pomocnicze ----------------------------------------------------------------
def _fmt_duration(seconds) -> str:
    if not seconds:
        return "--:--"
    seconds = int(seconds)
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def _thumb_url(entry: dict, vid: str) -> str:
    thumbs = entry.get("thumbnails")
    if isinstance(thumbs, list) and thumbs:
        # wez srednia miniature (jesli sa), inaczej ostatnia
        mid = thumbs[len(thumbs) // 2]
        if isinstance(mid, dict) and mid.get("url"):
            return mid["url"]
    if vid:
        return f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg"
    return ""


def _require_ytdlp() -> str:
    p = cfg.ytdlp_path()
    if not p:
        raise EngineError(
            "Nie znaleziono 'yt-dlp'. Zainstaluj: brew install yt-dlp "
            "(albo wskaz binarke w pluginie /bin)."
        )
    return p


def quality_label(h: int) -> str:
    names = {
        4320: "4320p (8K)", 2160: "2160p (4K)", 1440: "1440p (2K)",
        1080: "1080p (Full HD)", 720: "720p (HD)", 480: "480p",
        360: "360p", 240: "240p", 144: "144p",
    }
    return names.get(h, f"{h}p")


# --- API silnika ---------------------------------------------------------------
def search(query: str, max_results: int = 15) -> list[SearchResult]:
    """Zwraca liste wynikow wyszukiwania YouTube (szybko, bez pelnych formatow)."""
    ytdlp = _require_ytdlp()
    args = [
        ytdlp, f"ytsearch{max_results}:{query}",
        "--flat-playlist", "--dump-json",
        "--no-warnings", "--ignore-errors",
    ]
    proc = subprocess.run(args, capture_output=True, text=True)
    results: list[SearchResult] = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except json.JSONDecodeError:
            continue
        vid = d.get("id") or ""
        results.append(SearchResult(
            id=vid,
            title=d.get("title") or "(bez tytulu)",
            url=d.get("url") or (f"https://www.youtube.com/watch?v={vid}" if vid else ""),
            duration=d.get("duration"),
            duration_str=_fmt_duration(d.get("duration")),
            uploader=d.get("channel") or d.get("uploader") or "",
            thumbnail=_thumb_url(d, vid),
        ))
    if not results and proc.returncode != 0:
        raise EngineError(f"yt-dlp blad wyszukiwania (kod {proc.returncode}):\n{proc.stderr[:500]}")
    return results


def get_formats(url: str) -> VideoDetails:
    """Pobiera pelne info o jednym filmie: dostepne jakosci wideo i czy jest audio."""
    ytdlp = _require_ytdlp()
    args = [ytdlp, "-J", "--no-warnings", "--no-playlist", url]
    proc = subprocess.run(args, capture_output=True, text=True)
    if proc.returncode != 0 or not proc.stdout.strip():
        raise EngineError(f"Nie udalo sie pobrac formatow (kod {proc.returncode}):\n{proc.stderr[:500]}")
    data = json.loads(proc.stdout)
    formats = data.get("formats") or []
    heights: set[int] = set()
    has_audio = False
    for f in formats:
        v, a = f.get("vcodec"), f.get("acodec")
        if v and v != "none" and f.get("height"):
            heights.add(int(f["height"]))
        if a and a != "none":
            has_audio = True
    return VideoDetails(
        id=data.get("id") or "",
        title=data.get("title") or "(bez tytulu)",
        duration=data.get("duration"),
        duration_str=_fmt_duration(data.get("duration")),
        uploader=data.get("channel") or data.get("uploader") or "",
        thumbnail=_thumb_url(data, data.get("id") or ""),
        heights=sorted(heights, reverse=True),
        has_audio=has_audio,
        raw_formats=formats,
    )


def _parse_progress(line: str) -> ProgressUpdate | None:
    line = _ANSI.sub("", line)
    try:
        seg = line.split(_MARK_PROG, 1)[1]
        parts = seg.split("|")
        pct = parts[0].strip() if len(parts) > 0 else ""
        spd = parts[1].strip() if len(parts) > 1 else ""
        eta = parts[2].strip() if len(parts) > 2 else ""
        m = re.search(r"([\d.]+)\s*%", pct)
        val = float(m.group(1)) if m else None
        return ProgressUpdate(percent=val, percent_str=pct, speed=spd, eta=eta)
    except Exception:
        return None


def download(
    url: str,
    spec: DownloadSpec,
    dest_dir: str | Path,
    progress_cb: Callable[[ProgressUpdate], None] | None = None,
    log_cb: Callable[[str], None] | None = None,
) -> str:
    """
    Pobiera film/audio do dest_dir. Zwraca sciezke do gotowego pliku.

    Postep raportujemy przez progress_cb. Uzywamy --progress-template z wlasnymi
    znacznikami, a finalna sciezke wyciagamy przez --print after_move:filepath.
    Oba strumienie laczymy (stderr -> stdout) i rozrozniamy po znacznikach.
    """
    ytdlp = _require_ytdlp()
    dest = Path(dest_dir)
    dest.mkdir(parents=True, exist_ok=True)
    outtmpl = str(dest / "%(title).150B [%(id)s].%(ext)s")

    # UWAGA: samo --print przelacza yt-dlp w tryb cichy i wygasza postep.
    # Dlatego wymuszamy postep: --progress (+ --no-simulate, by realnie pobrac).
    args = [
        ytdlp, "--no-warnings", "--newline", "--no-playlist",
        "--no-simulate", "--progress",
        "-o", outtmpl,
        "--progress-template",
        f"download:{_MARK_PROG}%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s",
        "--print", f"after_move:{_MARK_FILE}%(filepath)s",
    ]
    fdir = cfg.ffmpeg_dir()
    if fdir:
        args += ["--ffmpeg-location", fdir]
    args += spec.ytdlp_args()
    args += [url]

    proc = subprocess.Popen(
        args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1,
    )
    final_path: str | None = None
    try:
        assert proc.stdout is not None
        for raw in proc.stdout:
            line = raw.rstrip("\n")
            if line.startswith(_MARK_FILE):
                final_path = line[len(_MARK_FILE):].strip()
            elif _MARK_PROG in line:
                pu = _parse_progress(line)
                if pu and progress_cb:
                    progress_cb(pu)
            elif log_cb and line.strip():
                log_cb(_ANSI.sub("", line))
    finally:
        proc.wait()

    if proc.returncode != 0:
        raise EngineError(f"yt-dlp zakonczyl sie kodem {proc.returncode}.")
    if not final_path:
        raise EngineError("Pobrano, ale nie udalo sie ustalic sciezki pliku wynikowego.")
    return final_path
