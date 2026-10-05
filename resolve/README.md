# Icon Studio by Sakib for DaVinci Resolve

Requires DaVinci Resolve Studio 19.0.2+ on Windows or macOS. Resolve 21 includes its own Python runtime. Older versions require a compatible 64-bit Python installation for Python scripts. The editor and PNG renderer are identical to the website.

## Install

Extract the entire ZIP. On Windows, run `Install Windows.ps1` with PowerShell. On macOS, run `bash "Install Mac.command"` in Terminal. Both installers use the current user's Resolve Utility folder. The Mac package uses Resolve's own Electron runtime, so no Windows binaries are included and it supports the architecture supplied by Resolve.

Open `Workspace > Scripts > Utility > Icon Studio`. Select **Settings**, choose one folder for the raw icon library and another for generated PNGs, then download the library.

An alternate Workflow Integration installation is available by copying the `app` folder to the system Workflow Integration Plugins directory as `com.sakib.iconstudio`. This mode loads the SDK module supplied by the installed version of Resolve. Restart Resolve and select `Workspace > Workflow Integrations > Icon Studio by Sakib`.

## Create and use icons

Use **Download PNG**, **Media Pool**, or **Timeline** underneath the canvas. The PNG is saved before Resolve imports it. Timeline settings control the video track and insertion at the playhead or timeline end. PNG duration follows Resolve's Standard Still Duration preference; trim the clip in Resolve. Timeline placement does not ripple existing edits; use an empty video track for overlays.

Drag the canvas directly to the Media Pool, timeline, Explorer, or Finder. Dragging generates a real PNG in the chosen output folder, then starts a native file drag. The drop target controls placement and copying.

The **Archive** button lists generated files by project. You can reveal them on disk, reuse them in Resolve, edit a previous icon, or export a ZIP. Archives include existing generated PNG files only. They exclude raw library downloads, caches, and editable workspace data. Moving or removing a generated file outside the panel removes it from the archive list, and can also make the corresponding Resolve media offline.

## Project looks

Save or apply a look using **Looks**. It becomes the active project's look and the starting look for projects that have never been opened in Icon Studio. Returning to an existing project restores its saved workspace and look, using Resolve's stable project ID instead of its name. New projects do not change old projects. Rename a Resolve project and its existing history remains associated with it.

Looks can be exported and imported between the website and Resolve. Background removal is excluded from visual style presets because it belongs to each source image.

AI background removal runs locally with U2NetP and ONNX Runtime. No source images are sent to a server. For difficult images, use edge detection or a selected background color instead.

## Storage and compatibility

Settings, editable workspace state, project looks, archive references and a bounded preview cache live in the user application-data directory under `Icon Studio by Sakib`. Generated PNGs live in the user-selected output folder, grouped by project. The library lives in the user-selected raw folder.

The Utility launcher uses a token-protected loopback connection to its own Resolve script. It does not change Resolve's external scripting preferences. Workflow Integration mode uses Blackmagic's locally installed SDK; proprietary SDK binaries are not included in this download.

Windows Resolve integration is tested during development. The macOS installer and launcher are reviewed for paths, quoting and architecture, but require a real Mac to validate native dragging and Resolve behavior.
