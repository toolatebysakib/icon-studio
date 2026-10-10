#!/bin/bash
set -euo pipefail
source_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
utility="$HOME/Library/Application Support/Blackmagic Design/DaVinci Resolve/Fusion/Scripts/Utility"
test -f "$source_dir/_IconStudioRust/IconStudio" || { echo 'Download the Mac package and extract the complete ZIP.'; exit 1; }
mkdir -p "$utility"
cp "$source_dir/Icon Studio.lua" "$utility/Icon Studio.lua"
mkdir -p "$utility/_IconStudioRust"
cp -R "$source_dir/_IconStudioRust/." "$utility/_IconStudioRust/"
chmod +x "$utility/_IconStudioRust/IconStudio"
if test -f "$utility/Icon Studio.py"; then mv "$utility/Icon Studio.py" "$utility/Icon Studio.py.pre-rust.bak"; fi
echo 'Installed. Open Resolve → Workspace → Scripts → Utility → Icon Studio.'
