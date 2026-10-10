# Icon Studio by Sakib

[Open the website](https://iconeditor.pages.dev/) · [Download for Resolve](https://github.com/toolatebysakib/icon-studio/releases/latest/download/icon-studio-resolve.zip) · [Download the expanded library](https://github.com/toolatebysakib/icon-studio/releases/download/v4.0.0/icon-library-rust.zip)

The website uses Rust/WASM. The Resolve companion retains the previous Electron/Python application and connector, with the expanded compressed icon library. The experimental native Rust companion source is retained for reference; the current Resolve download uses the previous app.

## Library

382,085 named icons across 235 open-source collections, including 52,523 multicolor icons. The complete compressed download is about 101 MB. Search metadata is bundled in the Resolve app; artwork is fetched one chunk at a time until downloaded through Settings. Offline artwork remains compressed, with at most six decompressed chunks cached. Collection licenses and credits are included in the library ZIP and source-rust/assets/library/LICENSES.txt.

Explore starts with 18 everyday icons. The entire expanded library remains searchable and browsable by collection. A small announcement runs for five days after this update; dismissal is remembered. Resolve offers a download button in the side card until the library is installed.

## Resolve

Extract the complete Resolve ZIP. Run Install Windows.ps1 or Install Mac.command. Open Workspace > Scripts > Utility > Icon Studio. Close an already-open panel before reopening it after an update. Select raw-library and generated-output folders in Settings, then download the offline library. The installer preserves the native Rust launcher as a backup and restores the former Python launcher. Existing looks, project archives and settings are kept.

The previous connector supports Media Pool and timeline insertion, native PNG file dragging, batch editing/import, project-specific looks and generated-file archives. Automatic timeline placement chooses a track above all overlapping clips and creates one when needed. See [Resolve instructions](resolve/README.md).

## Source

- `src/`, `resolve/`: current Resolve editor, native file/IPC integration and Python Resolve connector.
- `source-rust/web/`, `source-rust/core/`, `source-rust/assets/`: current website and shared Rust implementation.
- `source-rust/desktop/`: retained experimental companion source, not shipped in the current Resolve download.

Build the Resolve editor with `npm ci` and `npm run build`. Build the website using the Rust build script in source-rust/. Published releases exclude credentials and proprietary Resolve SDK binaries. Resolve supplies its own Python/Electron runtime. Native macOS behavior needs testing on a Mac.
