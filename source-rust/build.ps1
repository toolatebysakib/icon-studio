param([switch]$Desktop,[switch]$Web,[switch]$Tests)
$ErrorActionPreference='Stop'
$workspace=Split-Path -Parent $PSScriptRoot
$env:CARGO_HOME=Join-Path $workspace 'toolchain/cargo'
$env:RUSTUP_HOME=Join-Path $workspace 'toolchain/rustup'
$compiler=Get-Item (Join-Path $workspace 'toolchain/mingw64')
$env:PATH="$env:CARGO_HOME/bin;$($compiler.FullName)/bin;$env:PATH"
$env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER='x86_64-w64-mingw32-gcc.exe'
$env:CARGO_TARGET_X86_64_PC_WINDOWS_GNU_RUSTFLAGS='-C link-self-contained=yes'
Push-Location $PSScriptRoot
try {
 if($Tests){cargo test -p icon-studio-core; if($LASTEXITCODE){throw 'Core tests failed'}}
 if($Web){New-Item -ItemType Directory -Force web/assets | Out-Null; Copy-Item assets/platform.mjs web/assets/platform.mjs -Force; cargo build -p icon-studio-web --target wasm32-unknown-unknown --release; if($LASTEXITCODE){throw 'Web build failed'}; wasm-bindgen --target web --out-dir dist/pkg target/wasm32-unknown-unknown/release/icon_studio_web.wasm; if($LASTEXITCODE){throw 'WASM binding failed'}; Copy-Item assets/* dist -Recurse -Force
  $libraryOutput=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'dist/library'))
  foreach($file in Get-ChildItem -LiteralPath $libraryOutput -Filter '*.json.gz'){
   if($file.DirectoryName -ne $libraryOutput){throw 'Unexpected library output path'}
   if(!(Test-Path -LiteralPath (Join-Path $PSScriptRoot ('assets/library/'+$file.Name)))){Remove-Item -LiteralPath $file.FullName}
  }
 }
 if($Desktop){cargo build -p icon-studio-desktop --release; if($LASTEXITCODE){throw 'Desktop build failed'}}
} finally {Pop-Location}
