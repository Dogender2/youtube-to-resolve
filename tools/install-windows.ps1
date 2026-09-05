# =====================================================================
#  YouTube -> Resolve  —  one-file Windows installer
#
#  What it does (no manual setup needed):
#   1. Gets the plugin (local repo if present, else downloads from GitHub)
#   2. Downloads the LATEST yt-dlp + ffmpeg into the plugin's bin\
#   3. Copies WorkflowIntegration.node from your local Resolve install
#   4. Installs the plugin into ProgramData
#
#  Run:  right-click this file -> "Run with PowerShell"  (it asks for admin)
# =====================================================================
$ErrorActionPreference = 'Stop'
try { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12 } catch {}

$PluginId  = 'com.bartoszkwiatek.yt2resolve'
$RepoZip   = 'https://github.com/Dogender2/youtube-to-resolve/archive/refs/heads/main.zip'
$YtdlpUrl  = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
$FfmpegUrl = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip'

# --- Ensure administrator (writing into ProgramData needs it) ---
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    if ($PSCommandPath) {
        Write-Host 'Requesting administrator rights...'
        Start-Process powershell "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
        exit
    }
    throw 'Please run this installer as Administrator (right-click PowerShell -> Run as administrator).'
}

function Say($m) { Write-Host "==> $m" -ForegroundColor Green }
function Get-File($url, $out) { Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing }

$work = Join-Path $env:TEMP ('yt2r_' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force -Path $work | Out-Null

try {
    # --- 1) Plugin source: local repo if we're inside it, otherwise download ---
    $pluginSrc = Join-Path $work $PluginId
    $localPlugin = $null
    if ($PSScriptRoot) {
        $cand = Join-Path (Split-Path $PSScriptRoot -Parent) $PluginId   # tools\.. = repo root
        if (Test-Path (Join-Path $cand 'manifest.xml')) { $localPlugin = $cand }
    }
    if ($localPlugin) {
        Say 'Using local plugin files...'
        Copy-Item -Recurse -Force $localPlugin $pluginSrc
    } else {
        Say 'Downloading the plugin from GitHub...'
        $zip = Join-Path $work 'repo.zip'
        Get-File $RepoZip $zip
        Expand-Archive $zip -DestinationPath $work -Force
        $extracted = Join-Path $work "youtube-to-resolve-main\$PluginId"
        if (-not (Test-Path $extracted)) { throw 'Plugin folder not found in the downloaded archive.' }
        Copy-Item -Recurse -Force $extracted $pluginSrc
    }

    $binDir = Join-Path $pluginSrc 'bin'
    New-Item -ItemType Directory -Force -Path $binDir | Out-Null

    # --- 2) WorkflowIntegration.node from the local Resolve install ---
    Say 'Locating the Resolve native bridge...'
    $nodeSrc = Join-Path $env:PROGRAMDATA 'Blackmagic Design\DaVinci Resolve\Support\Developer\Workflow Integrations\Examples\SamplePlugin\WorkflowIntegration.node'
    if (-not (Test-Path $nodeSrc)) {
        throw "WorkflowIntegration.node not found. Install DaVinci Resolve Studio (it includes the Developer package), then run this again."
    }
    Copy-Item $nodeSrc (Join-Path $pluginSrc 'WorkflowIntegration.node') -Force

    # Reuse an already-installed ffmpeg so we don't re-download ~30 MB on every update.
    $pluginsRoot = Join-Path $env:PROGRAMDATA 'Blackmagic Design\DaVinci Resolve\Support\Workflow Integration Plugins'
    $dest = Join-Path $pluginsRoot $PluginId
    if (Test-Path (Join-Path $dest 'bin\ffmpeg.exe')) {
        Copy-Item (Join-Path $dest 'bin\ffmpeg.exe') (Join-Path $binDir 'ffmpeg.exe') -Force
        if (Test-Path (Join-Path $dest 'bin\ffprobe.exe')) { Copy-Item (Join-Path $dest 'bin\ffprobe.exe') (Join-Path $binDir 'ffprobe.exe') -Force }
    }

    # --- 3) yt-dlp: always grab the latest (this is what fixes most 403 errors) ---
    Say 'Downloading the latest yt-dlp...'
    Get-File $YtdlpUrl (Join-Path $binDir 'yt-dlp.exe')

    # --- 4) ffmpeg: download once if we don't already have it ---
    if (-not (Test-Path (Join-Path $binDir 'ffmpeg.exe'))) {
        Say 'Downloading ffmpeg (one-time, ~30 MB)...'
        $ffZip = Join-Path $work 'ffmpeg.zip'
        Get-File $FfmpegUrl $ffZip
        $ffOut = Join-Path $work 'ff'
        Expand-Archive $ffZip -DestinationPath $ffOut -Force
        $ffexe = Get-ChildItem $ffOut -Recurse -Filter 'ffmpeg.exe' | Select-Object -First 1
        if (-not $ffexe) { throw 'ffmpeg.exe not found in the downloaded archive.' }
        Copy-Item $ffexe.FullName (Join-Path $binDir 'ffmpeg.exe') -Force
        $ffprobe = Get-ChildItem $ffOut -Recurse -Filter 'ffprobe.exe' | Select-Object -First 1
        if ($ffprobe) { Copy-Item $ffprobe.FullName (Join-Path $binDir 'ffprobe.exe') -Force }
    }

    # --- 5) Install the plugin ---
    Say 'Installing the plugin...'
    New-Item -ItemType Directory -Force -Path $pluginsRoot | Out-Null
    if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
    Copy-Item -Recurse -Force $pluginSrc $dest

    Say 'Done!'
    Write-Host ''
    Write-Host "Installed to: $dest"
    Write-Host 'Next: restart DaVinci Resolve -> Workspace -> Workflow Integrations -> YouTube -> Resolve'
}
catch {
    Write-Host ''
    Write-Host "INSTALL FAILED: $($_.Exception.Message)" -ForegroundColor Red
}
finally {
    Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
}

Write-Host ''
Read-Host 'Press Enter to close'
