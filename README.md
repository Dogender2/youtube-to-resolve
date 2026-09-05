# YouTube → DaVinci Resolve

A DaVinci Resolve **Studio** Workflow Integration plugin: search YouTube, download
audio/video in the format & quality you pick, and auto-import it into the current
project — right inside Resolve.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey)

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/B5C626DPA9)

> ⚠️ **Use responsibly.** Downloading from YouTube can violate YouTube's Terms of
> Service and copyright. Only download material you have the rights to (your own,
> Creative Commons, or licensed). You are responsible for how you use this tool.

*Interface is English by default with an EN/PL switch. — Interfejs po angielsku, z przełącznikiem EN/PL. **Polski opis niżej.***

---

## 🇬🇧 English

### What it does
- Search YouTube from a panel docked in Resolve.
- Browse results (thumbnail, title, duration, channel).
- Per result: choose **Audio** or **Video**, then format/quality from what YouTube offers.
- Live download progress (%, speed, ETA).
- The finished file is imported into the **current bin** of the open project.

Files are saved to your `Videos`/`Movies` folder → `YouTube to Resolve/<project>/` by
default. You can pick a different **download folder** in Settings (⚙); the choice is
remembered between launches, just like the language.

### Requirements
- **DaVinci Resolve Studio** (Workflow Integrations is a Studio-only feature).
- **yt-dlp** and **ffmpeg** on your system:
  - macOS: `brew install yt-dlp ffmpeg`
  - Windows: `winget install yt-dlp.yt-dlp` and `winget install Gyan.FFmpeg`
    (or `scoop install yt-dlp ffmpeg`)

### Install — macOS
```bash
git clone https://github.com/Dogender2/youtube-to-resolve.git
cd youtube-to-resolve
bash install.sh
```
Then restart DaVinci Resolve → **Workspace → Workflow Integrations → YouTube → Resolve**.

### Install — Windows
```powershell
git clone https://github.com/Dogender2/youtube-to-resolve.git
cd youtube-to-resolve
powershell -ExecutionPolicy Bypass -File .\install.ps1
```
Run PowerShell **as Administrator** if writing to `ProgramData` is blocked. Then restart
Resolve → **Workspace → Workflow Integrations → YouTube → Resolve**.

> **Note:** `WorkflowIntegration.node` (Blackmagic's proprietary native bridge) is **not**
> shipped in this repo. The installer copies it automatically from your local Resolve
> install — which also guarantees the correct OS/architecture build.
>
> Windows support is implemented but has only been tested on macOS so far — please
> [open an issue](../../issues) if something misbehaves.

### Usage
1. Open the plugin, type a query, hit **Search**.
2. Click the ⬇ icon on a result, choose **Audio**/**Video** + quality, hit **Download**.
3. When it finishes it lands in the current bin of your open project. Optionally set a
   target bin name in the top bar (empty = current bin).

### How it works
It's an Electron app loaded by Resolve. The main process runs `yt-dlp`/`ffmpeg` via
`child_process` and imports files through Resolve's JavaScript API
(`WorkflowIntegration.GetResolve()`); the UI runs in a sandboxed renderer and talks to
the backend over a `contextBridge` IPC. Note: video downloads fetch two streams
(video, then audio) and merge them, so the progress bar fills twice.

### License
MIT — see [LICENSE](LICENSE).

### Support
If this saved you money on a paid plugin, you can buy me a coffee 🙂

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/B5C626DPA9)

---

## 🇵🇱 Polski

### Co to robi
- Wyszukiwanie YouTube z panelu osadzonego w Resolve.
- Lista wyników (miniaturka, tytuł, długość, kanał).
- Dla każdego wyniku: wybór **Audio** lub **Wideo**, a potem format/jakość z dostępnych na YT.
- Pasek postępu na żywo (%, prędkość, ETA).
- Gotowy plik trafia do **bieżącego bina** otwartego projektu.

Pliki zapisywane są domyślnie w folderze `Wideo`/`Filmy` → `YouTube to Resolve/<projekt>/`.
Możesz wybrać inny **folder pobierania** w Ustawieniach (⚙); wybór jest zapamiętywany
między uruchomieniami — tak jak język.

### Wymagania
- **DaVinci Resolve Studio** (Workflow Integrations to funkcja Studio).
- **yt-dlp** i **ffmpeg** w systemie:
  - macOS: `brew install yt-dlp ffmpeg`
  - Windows: `winget install yt-dlp.yt-dlp` oraz `winget install Gyan.FFmpeg`
    (albo `scoop install yt-dlp ffmpeg`)

### Instalacja — macOS
```bash
git clone https://github.com/Dogender2/youtube-to-resolve.git
cd youtube-to-resolve
bash install.sh
```
Uruchom ponownie DaVinci Resolve → **Workspace → Workflow Integrations → YouTube → Resolve**.

### Instalacja — Windows
```powershell
git clone https://github.com/Dogender2/youtube-to-resolve.git
cd youtube-to-resolve
powershell -ExecutionPolicy Bypass -File .\install.ps1
```
Uruchom PowerShell **jako Administrator**, jeśli zapis do `ProgramData` jest blokowany.
Potem zrestartuj Resolve → **Workspace → Workflow Integrations → YouTube → Resolve**.

> **Uwaga:** `WorkflowIntegration.node` (własnościowy mostek Blackmagic) **nie** jest
> dołączony do repo. Instalator kopiuje go automatycznie z Twojej lokalnej instalacji
> Resolve (dzięki temu zawsze pasuje do systemu/architektury).
>
> Wersja na Windows jest przygotowana, ale testowana była tylko na macOS — jeśli coś
> nie zadziała, [zgłoś issue](../../issues).

### Użycie
1. Otwórz wtyczkę, wpisz zapytanie, kliknij **Szukaj**.
2. Kliknij ikonę ⬇ przy wyniku, wybierz **Audio**/**Wideo** + jakość, kliknij **Pobierz**.
3. Po zakończeniu plik ląduje w bieżącym binie otwartego projektu. Opcjonalnie podaj
   nazwę bina na górnym pasku (puste = bieżący bin).

### Jak to działa
To aplikacja Electron ładowana przez Resolve. Proces główny uruchamia `yt-dlp`/`ffmpeg`
przez `child_process` i importuje pliki przez API JavaScript Resolve
(`WorkflowIntegration.GetResolve()`); interfejs działa w sandboxie i rozmawia z backendem
przez mostek IPC (`contextBridge`). Uwaga: pobieranie wideo ściąga dwa strumienie (obraz,
potem dźwięk) i je scala, więc pasek postępu wypełnia się dwa razy.

### Licencja
MIT — zobacz [LICENSE](LICENSE).

### Wsparcie
Jeśli zaoszczędziło Ci to kasy na płatnej wtyczce, możesz postawić mi kawę 🙂

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/B5C626DPA9)
