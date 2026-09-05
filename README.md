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

> 🧩 **Needs two free tools — `yt-dlp` and `ffmpeg`.** On **Windows the one-click installer sets
> them up for you**; on macOS install them once (see **Requirements**). The plugin shows a red
> banner if they're missing.

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

> **Keep `yt-dlp` up to date.** YouTube changes often, and an outdated yt-dlp causes
> `HTTP 403` download errors. Update with `yt-dlp -U` (Windows) or `brew upgrade yt-dlp` (macOS).

### Install — macOS
```bash
git clone https://github.com/Dogender2/youtube-to-resolve.git
cd youtube-to-resolve
bash install.sh
```
Then restart DaVinci Resolve → **Workspace → Workflow Integrations → YouTube → Resolve**.

### Install — Windows (one click)
Download **[`install-windows.bat`](install-windows.bat)**, double-click it, and approve the admin
prompt. It downloads the plugin, `yt-dlp` and `ffmpeg`, and installs everything. Then restart
Resolve → **Workspace → Workflow Integrations → YouTube → Resolve**.

Prefer PowerShell? Paste this into an **Administrator** PowerShell window:
```powershell
iwr -useb https://raw.githubusercontent.com/Dogender2/youtube-to-resolve/main/tools/install-windows.ps1 | iex
```

<details><summary>Manual install from a clone (advanced)</summary>

Install `yt-dlp` + `ffmpeg` yourself (see Requirements), then:
```powershell
git clone https://github.com/Dogender2/youtube-to-resolve.git
cd youtube-to-resolve
powershell -ExecutionPolicy Bypass -File .\install.ps1
```
</details>

> **Note:** `WorkflowIntegration.node` (Blackmagic's proprietary native bridge) is **not**
> shipped in this repo. The installer copies it automatically from your local Resolve
> install — which also guarantees the correct OS/architecture build.
>
> Tested on macOS and Windows — please [open an issue](../../issues) if anything misbehaves.

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

### Uninstall
Delete the plugin folder, then restart DaVinci Resolve.

**macOS:**
```bash
rm -rf "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Workflow Integration Plugins/com.bartoszkwiatek.yt2resolve"
```

**Windows** (PowerShell):
```powershell
Remove-Item -Recurse -Force "$env:PROGRAMDATA\Blackmagic Design\DaVinci Resolve\Support\Workflow Integration Plugins\com.bartoszkwiatek.yt2resolve"
```

If you hit a permission error, add `sudo` (macOS) or run PowerShell as Administrator.

`yt-dlp` and `ffmpeg` were installed separately — remove them with `brew uninstall yt-dlp ffmpeg`
or `winget uninstall yt-dlp.yt-dlp` if you no longer need them. Files already downloaded to your
Videos/Movies folder are left untouched.

### Troubleshooting
- **`HTTP 403 Forbidden` / "unable to download video data"** → your `yt-dlp` is out of date.
  Update it: `yt-dlp -U` (Windows) or `brew upgrade yt-dlp` (macOS), then retry. (The plugin also
  auto-retries once with a different YouTube player client.)
- **Red "Extra tools required" banner / "tools missing"** → install `yt-dlp` and `ffmpeg`
  (see Requirements).
- **"Downloaded, but import failed" (Windows)** → usually antivirus briefly locking the freshly
  written file. The plugin now waits for the file and retries a few times; if it still happens,
  add your download folder to **Windows Defender exclusions** (or pick a download folder that isn't
  real-time scanned).

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

> **Aktualizuj `yt-dlp`.** YouTube często coś zmienia, a nieaktualny yt-dlp powoduje błędy
> `HTTP 403`. Zaktualizuj: `yt-dlp -U` (Windows) albo `brew upgrade yt-dlp` (macOS).

### Instalacja — macOS
```bash
git clone https://github.com/Dogender2/youtube-to-resolve.git
cd youtube-to-resolve
bash install.sh
```
Uruchom ponownie DaVinci Resolve → **Workspace → Workflow Integrations → YouTube → Resolve**.

### Instalacja — Windows (jednym kliknięciem)
Pobierz **[`install-windows.bat`](install-windows.bat)**, kliknij dwukrotnie i zatwierdź prośbę o
uprawnienia administratora. Instalator pobierze wtyczkę, `yt-dlp` i `ffmpeg` i wszystko zainstaluje.
Potem zrestartuj Resolve → **Workspace → Workflow Integrations → YouTube → Resolve**.

Wolisz PowerShell? Wklej to w oknie PowerShell **jako Administrator**:
```powershell
iwr -useb https://raw.githubusercontent.com/Dogender2/youtube-to-resolve/main/tools/install-windows.ps1 | iex
```

<details><summary>Instalacja ręczna z klona (zaawansowane)</summary>

Zainstaluj samodzielnie `yt-dlp` + `ffmpeg` (patrz Wymagania), potem:
```powershell
git clone https://github.com/Dogender2/youtube-to-resolve.git
cd youtube-to-resolve
powershell -ExecutionPolicy Bypass -File .\install.ps1
```
</details>

> **Uwaga:** `WorkflowIntegration.node` (własnościowy mostek Blackmagic) **nie** jest
> dołączony do repo. Instalator kopiuje go automatycznie z Twojej lokalnej instalacji
> Resolve (dzięki temu zawsze pasuje do systemu/architektury).
>
> Testowana na macOS i Windows — jeśli coś nie działa, [zgłoś issue](../../issues).

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

### Odinstalowanie
Usuń folder wtyczki i uruchom ponownie DaVinci Resolve.

**macOS:**
```bash
rm -rf "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Workflow Integration Plugins/com.bartoszkwiatek.yt2resolve"
```

**Windows** (PowerShell):
```powershell
Remove-Item -Recurse -Force "$env:PROGRAMDATA\Blackmagic Design\DaVinci Resolve\Support\Workflow Integration Plugins\com.bartoszkwiatek.yt2resolve"
```

Jeśli dostaniesz błąd uprawnień, dodaj `sudo` (macOS) albo uruchom PowerShell jako Administrator.

`yt-dlp` i `ffmpeg` instalowałeś osobno — usuń je przez `brew uninstall yt-dlp ffmpeg`
albo `winget uninstall yt-dlp.yt-dlp`, jeśli już ich nie potrzebujesz. Pliki pobrane wcześniej
do folderu Wideo/Filmy zostają nietknięte.

### Rozwiązywanie problemów
- **`HTTP 403 Forbidden` / „unable to download video data"** → `yt-dlp` jest nieaktualny.
  Zaktualizuj: `yt-dlp -U` (Windows) albo `brew upgrade yt-dlp` (macOS) i spróbuj ponownie.
  (Wtyczka próbuje też automatycznie raz jeszcze z innym klientem YouTube.)
- **Czerwony baner „Wymagane dodatkowe programy" / „brak narzędzi"** → zainstaluj `yt-dlp` i `ffmpeg`
  (patrz Wymagania).
- **„Pobrano, ale import się nie udał" (Windows)** → zwykle antywirus na moment blokuje świeżo
  zapisany plik. Wtyczka teraz czeka na plik i ponawia kilka razy; jeśli nadal się zdarza, dodaj
  folder pobierania do **wykluczeń Windows Defender** (albo ustaw folder poza skanowaniem w czasie
  rzeczywistym).

### Licencja
MIT — zobacz [LICENSE](LICENSE).

### Wsparcie
Jeśli zaoszczędziło Ci to kasy na płatnej wtyczce, możesz postawić mi kawę 🙂

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/B5C626DPA9)
