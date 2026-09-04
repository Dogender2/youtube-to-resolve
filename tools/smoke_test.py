"""
Szybki test silnika BEZ Resolve: wyszukiwanie, formaty i probne pobranie audio.
Uruchom:  python3 tools/smoke_test.py
"""
import sys
import tempfile
from pathlib import Path

# dodaj katalog 'plugin' do sciezki, zeby zaimportowac pakiet yt_resolve
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "plugin"))

from yt_resolve import config, engine  # noqa: E402


def main() -> None:
    print("yt-dlp :", config.ytdlp_path())
    print("ffmpeg :", config.ffmpeg_path())
    if not config.ytdlp_path():
        print("!! Brak yt-dlp - przerwij i zainstaluj: brew install yt-dlp ffmpeg")
        return

    print("\n== SZUKANIE: 'lofi hip hop radio' (5 wynikow) ==")
    for r in engine.search("lofi hip hop radio", max_results=5):
        print(f"  [{r.duration_str:>7}]  {r.title[:55]:55}  {r.uploader[:18]:18}  {r.id}")

    print("\n== FORMATY: 'Me at the zoo' (jNQXAC9IVRw) ==")
    det = engine.get_formats("https://www.youtube.com/watch?v=jNQXAC9IVRw")
    print(f"  tytul: {det.title} | dlugosc: {det.duration_str}")
    print(f"  wysokosci: {det.heights}  | audio: {det.has_audio}")

    print("\n== PROBNE POBRANIE: audio (m4a) ==")
    tmp = Path(tempfile.mkdtemp(prefix="ytr_"))

    def prog(p: engine.ProgressUpdate) -> None:
        sys.stdout.write(f"\r  {p.percent_str:>8}  {p.speed:>12}  ETA {p.eta:>6}   ")
        sys.stdout.flush()

    spec = engine.DownloadSpec(mode="audio", audio_format="m4a")
    path = engine.download(
        "https://www.youtube.com/watch?v=jNQXAC9IVRw", spec, tmp, progress_cb=prog
    )
    print(f"\n  OK -> {path}")


if __name__ == "__main__":
    main()
