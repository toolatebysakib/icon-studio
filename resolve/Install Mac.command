#!/bin/bash
set -euo pipefail
source_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
utility_dir="${1:-$HOME/Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion/Scripts/Utility}"
if [ ! -f "$source_dir/app/main.cjs" ]; then
  printf '%s\n' 'Extract the complete ZIP before installing.'
  exit 1
fi
mkdir -p "$utility_dir/_IconStudio"
if [ -f "$utility_dir/Icon Studio.lua" ]; then mv "$utility_dir/Icon Studio.lua" "$utility_dir/Icon Studio.lua.rust.bak"; fi
cp "$source_dir/Icon Studio.py" "$utility_dir/Icon Studio.py"
cp -R "$source_dir/app/." "$utility_dir/_IconStudio/"
printf '%s\n' "Installed Icon Studio in $utility_dir" 'Open Resolve > Workspace > Scripts > Utility > Icon Studio.'
