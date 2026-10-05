param([string]$UtilityFolder = (Join-Path $env:APPDATA 'Blackmagic Design\DaVinci Resolve\Support\Fusion\Scripts\Utility'))
$ErrorActionPreference='Stop'
$source = Join-Path $PSScriptRoot 'app'
if (-not (Test-Path -LiteralPath (Join-Path $source 'main.cjs'))) {throw 'The app folder is missing. Extract the complete ZIP first.'}
$utility = [System.IO.Path]::GetFullPath($UtilityFolder)
New-Item -ItemType Directory -Path $utility -Force | Out-Null
$target = Join-Path $utility '_IconStudio'
New-Item -ItemType Directory -Path $target -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Icon Studio.py') -Destination (Join-Path $utility 'Icon Studio.py') -Force
Get-ChildItem -LiteralPath $source | ForEach-Object { Copy-Item -LiteralPath $_.FullName -Destination $target -Recurse -Force }
Write-Host ('Installed Icon Studio in ' + $utility)
Write-Host 'Open Resolve > Workspace > Scripts > Utility > Icon Studio.'
