# Icon Studio by Sakib

[Website](https://iconeditor.pages.dev/) Â· [Windows installer](https://github.com/toolatebysakib/icon-studio/releases/latest/download/IconStudio-Setup.exe) Â· [Classic Resolve script](https://github.com/toolatebysakib/icon-studio/releases/latest/download/icon-studio-resolve.zip)

Icon Studio has one Rust/WASM editor shared by the website and the new Rust desktop app. The desktop app runs independently and connects to Resolve through the previous Python SDK implementation. The classic Electron/Python Resolve panel remains available, unchanged by the new installation. The experimental Rust/Lua companion is retained as source, and is not the new app's connector.

## Windows installation

Download **IconStudio-Setup.exe**, double-click, and install. No administrator access is needed. The installer adds a desktop shortcut and **Workspace â†’ Scripts â†’ Utility â†’ Icon Studio App** in Resolve. Restart Resolve if its Scripts menu has not refreshed. Launch the app independently, or open that new Scripts menu item to connect it for the current Resolve session. Your classic **Icon Studio** menu item stays available.

The app requires 64-bit Windows 10 or newer. Its installer checks Microsoft WebView2 and installs Microsoft's runtime when needed. The installer does not have a Windows publisher certificate yet, so SmartScreen may show an unknown-publisher warning. Update verification uses a separate Ed25519 signature and SHA-256 checks; it does not remove SmartScreen warnings.

Existing classic folders, project looks, workspaces and generated-file records are copied on first launch when their settings format is compatible. The classic settings file is preserved. New app data is kept in `%APPDATA%\Icon Studio App by Sakib`; uninstalling retains that data and exported files. Generated PNGs and SVGs go into project subfolders. The app remains usable without Resolve; Media Pool and Timeline actions require an active Resolve connection.

## Library and editor

382,085 named icons from 235 open-source collections, including 52,523 multicolor icons, are searchable through a compact name index. Artwork loads by compressed chunk. Download selected collections, or the complete approximately 101 MB library from Settings, for offline use. Collection license and credit notices are included. Explore starts with 18 everyday icons.

Shift+Space opens quick search; the five shortcut presets and custom capture are in Settings. The editor includes batch styling and rename rules, gradient palettes, saved looks, full-window themes, PNG/SVG export, background removal and generated-file archives. Native drag exports actual PNG files. Resolve insertion and batch Media Pool imports use the stable Python connector; automatic track selection places icons above overlapping clips.

## Connected updates

The website and new app use the same compiled editor. Each published release produces a signed `app-release.json` feed and a versioned editor ZIP on Cloudflare. The app checks this feed in the background and shows a small update card. Editor updates save the workspace and reload; the last verified editor remains available offline. Native or connector changes download a verified installer, close the app, install and reopen it. Resolve itself is not stopped. Reopen the connector after a connector update to load its new code.

The classic Resolve panel remains a legacy option and does not load the new shared editor automatically. Use **Icon Studio App** for the connected update path.

`work/release-connected.ps1` in the maintainer workspace is the single release command. It builds the shared editor, packages and signs the update feed, publishes GitHub assets when needed, and deploys Cloudflare. An editor-only release retains the exact previous native installer descriptor. The private update-signing key is not in this repository; retain it securely for future releases. A new key requires shipping a native app with the matching public key.

## Source and build

- `app/`: current Rust desktop host, installer, verified updater and stable Python Resolve connector.
- `web/`, `core/`, `assets/`: shared Rust/WASM editor, rendering, search and UI assets.
- `desktop/`: retained experimental Rust/Lua companion.

Install Rust, `wasm32-unknown-unknown`, matching wasm-bindgen CLI, and NSIS for Windows packaging. Build `icon-studio-web` for WASM and `icon-studio-app` for the desktop. Windows GNU builds must use `-C link-self-contained=no` with the matching MinGW compiler/runtime. `build.ps1 -Web -App` configures the bundled workspace toolchain. Include Microsoft's `WebView2Loader.dll` beside the Windows executable. The installer includes that loader and all editor assets, but the full icon artwork is downloaded separately.

The source supports macOS WKWebView and includes a universal Mac build workflow. The new single-file installer and automatic native updates shipped in this release are Windows features. Mac runtime behavior is not verified here. The classic Resolve ZIP retains its Mac installer.

App code is MIT licensed. Icon artwork and third-party dependencies retain their individual licenses. See `assets/THIRD-PARTY-NOTICES.md`, `assets/licenses/` and `assets/library/LICENSES.txt`.
