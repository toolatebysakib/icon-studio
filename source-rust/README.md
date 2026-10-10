# Icon Studio by Sakib — Rust edition

A shared Rust icon editor for the browser and DaVinci Resolve. The browser compiles Rust to WebAssembly; the desktop host is Rust with the operating system's WebView. A LuaJIT connector runs Resolve SDK calls on Resolve's UI dispatcher. React, Electron and Python are not runtime dependencies of this edition.

## Install in Resolve

Extract **the complete ZIP**. On Windows, run `Install Windows.cmd`. On macOS, run `Install Mac.command`. Open **Workspace → Scripts → Utility → Icon Studio**. Choose separate raw-library and generated-output folders in Settings. Download the collections you want there. Generated PNGs and their SVG sources are stored in a project subfolder under your output folder; the archive lists those actual files. Existing project workspaces, generated-file records, output settings and project looks are preserved.

The Mac binary is universal (Intel and Apple Silicon). It is built on a macOS runner. Native Resolve behavior on Windows and macOS is left for the user's testing; compilation does not confirm integration behavior. Resolve Studio is needed for the UI dispatcher used by this connector.

## Use

Shift+Space opens quick search. Settings includes five shortcut presets and custom recording. Search shows up to 25 results, with arrow-key navigation and Enter to add. The icon library defaults to colorful collections; use its collection menu to browse all families. SVG, PNG, JPG and WebP files can be imported, dropped or pasted. Select collection icons for batch styling, renaming, export, and Resolve Media Pool import. Gradient palettes work for backgrounds and foregrounds. Looks are portable preset files; Resolve restores project looks and new projects inherit the last applied/saved look.

Timeline insertion automatically selects an enabled, unlocked track above every clip overlapping the icon's full duration, creating a track when needed. Still duration follows Resolve's Standard Still Duration. Manual track settings remain available. The Lua connector stages only the new icon on a new top track to measure its actual duration, then Rust selects a clear track. The original playhead is restored.

## Icon storage

The upstream catalog is pinned to `@iconify/json 2.2.541`. It contains **382,085 named icons**, **366,739 unique SVG bodies**, **52,523 multicolor icons** and **235 collections**, using **99.5 MB of gzip data** plus about 1.6 MB of catalog, attribution and ZIP overhead. Static collections are filtered using their declared open-source SPDX licenses; animated and noncommercial collections are excluded. Icons are stored as independently gzip-compressed collection JSON files (large collections are split into small chunks), rather than hundreds of thousands of small SVG files. The browser loads collection artwork on demand. The full searchable name index is compressed separately (1.36 MB). The catalog records exact counts, per-pack sizes, SHA-256 hashes, authors, source links, and licenses. `library/LICENSES.txt` and `library/licenses/` retain notices and license texts. Counts describe named icons and separately report unique SVG artwork; aliases and invented variants do not inflate the total.

## Build

Install Rust, the `wasm32-unknown-unknown` target, and `wasm-bindgen-cli` matching Cargo.lock. If using the source ZIP, also download the full library ZIP and copy its `icon-studio-library-v2/` contents into `assets/library/`. The GitHub source checkout already includes these collections. Run:

```sh
cargo build -p icon-studio-web --release --target wasm32-unknown-unknown
wasm-bindgen --target web --out-dir dist/pkg target/wasm32-unknown-unknown/release/icon_studio_web.wasm
cargo build -p icon-studio-desktop --release
```

Copy `assets/*` into `dist/`, and place that web folder beside `IconStudio.exe` / `IconStudio` for native packaging. `build.ps1` supports the workspace-local Windows toolchain; CI uses standard Rust installs. The small `platform.mjs` module adapts browser APIs and the external ONNX runtime. Editor UI, state, search, SVG rendering, naming, image preprocessing/masking, and native operations are Rust. CSS styles the DOM. Lua is retained only for Resolve's supported SDK boundary.

App code is MIT licensed. Icon collections retain their individual licenses, including share-alike or copyleft terms where declared; they are separately distributed artwork, not relicensed as application code.
