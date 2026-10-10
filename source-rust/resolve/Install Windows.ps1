$ErrorActionPreference='Stop'
$utility=Join-Path $env:APPDATA 'Blackmagic Design\DaVinci Resolve\Support\Fusion\Scripts\Utility'
$source=Join-Path $PSScriptRoot '_IconStudioRust'
if(!(Test-Path -LiteralPath (Join-Path $source 'IconStudio.exe'))){throw 'Extract the complete ZIP before installing.'}
New-Item -ItemType Directory -Path $utility -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'Icon Studio.lua') -Destination $utility -Force
Copy-Item -LiteralPath $source -Destination $utility -Recurse -Force
$legacy=Join-Path $utility 'Icon Studio.py'
if(Test-Path -LiteralPath $legacy){Move-Item -LiteralPath $legacy -Destination ($legacy+'.pre-rust.bak') -Force}
Write-Output 'Installed. Open Resolve → Workspace → Scripts → Utility → Icon Studio.'
