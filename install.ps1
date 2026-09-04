# Windows installer — "YouTube -> Resolve" Workflow Integration Plugin.
# Run in PowerShell (as Administrator if writing to ProgramData is blocked):
#   powershell -ExecutionPolicy Bypass -File .\install.ps1
$ErrorActionPreference = 'Stop'

$PluginName = 'com.bartoszkwiatek.yt2resolve'
$Here       = Split-Path -Parent $MyInvocation.MyCommand.Path
$PluginSrc  = Join-Path $Here $PluginName

$ProgramData = $env:PROGRAMDATA
$PluginsRoot = Join-Path $ProgramData 'Blackmagic Design\DaVinci Resolve\Support\Workflow Integration Plugins'
$Dest        = Join-Path $PluginsRoot $PluginName

$NodeName = 'WorkflowIntegration.node'
$NodeSrc  = Join-Path $ProgramData 'Blackmagic Design\DaVinci Resolve\Support\Developer\Workflow Integrations\Examples\SamplePlugin\WorkflowIntegration.node'
$NodeDst  = Join-Path $PluginSrc $NodeName

if (-not (Test-Path $PluginSrc)) { throw "Plugin folder not found: $PluginSrc" }

# WorkflowIntegration.node is Blackmagic's proprietary module — NOT shipped in the repo.
# Copy it from the local Resolve install (also guarantees the right OS/arch build).
if (-not (Test-Path $NodeDst)) {
    if (Test-Path $NodeSrc) {
        Copy-Item $NodeSrc $NodeDst
        Write-Host "Copied $NodeName from the local Resolve install."
    } else {
        throw "Could not find $NodeName in Resolve:`n  $NodeSrc`nInstall DaVinci Resolve Studio (with the Developer package) and retry."
    }
}

New-Item -ItemType Directory -Force -Path $PluginsRoot | Out-Null
if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
Copy-Item -Recurse -Force $PluginSrc $Dest

Write-Host "OK - installed (copy): $Dest"
Write-Host ""
Write-Host "Next: restart DaVinci Resolve -> Workspace -> Workflow Integrations -> YouTube -> Resolve"
