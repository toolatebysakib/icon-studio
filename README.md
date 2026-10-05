# Icon Studio by Sakib

[Open Icon Studio](https://iconeditor.pages.dev/) · [Download for Resolve](https://github.com/toolatebysakib/icon-studio/releases/latest/download/icon-studio-resolve.zip) · [Download the icon library](https://github.com/toolatebysakib/icon-studio/releases/latest/download/icon-library.zip)

An icon composer for the web and DaVinci Resolve Studio. Includes PNG/SVG export, drag-and-drop imports, batch styling and renaming, palettes, effects, local AI background removal, and portable visual presets.

The Resolve companion adds native file dragging, Media Pool and timeline insertion, generated PNGs stored in selected folders, an archive organized by project, and project-specific looks. New projects inherit the latest look; returning projects restore their own look and workspace by their stable Resolve project ID.

Version 3.1 adds a compact Resolve window, an Always on Top toggle, responsive tool labels, batch Media Pool imports, and configurable Shift+Space quick search with five shortcut presets and custom recording with up to 25 results on both platforms.

## Resolve

Download and extract the complete Resolve ZIP. Run the Windows or Mac installer, then open **Workspace > Scripts > Utility > Icon Studio**. Select raw-library and generated-output folders in **Settings**. [Detailed instructions](resolve/README.md).

Requires Resolve Studio 19.0.2+ and Python scripting support. Resolve 21 includes Python. Windows Resolve integration is validated during development; the Mac installer and paths are reviewed but native Mac behavior needs testing on a Mac. PNG clip duration follows Resolve's Standard Still Duration preference.

## Offline library

The `icons/` folder contains 24,981 SVG files, including Lucide, Tabler, Google Material Symbols, Flat Color Icons and the website's starter collection. `manifest.json` describes the files. Collection licenses and sources are included. The downloadable pack is approximately 12 MB rather than hundreds of megabytes.

## Build the website

```sh
npm ci
npm run dev
npm test
npm run build
```

The development-only `qa.html` page validates SVG sanitization, PNG rendering, transparency, recoloring, archives, AI background removal and effects. It is excluded from the production build. The local AI model and runtime are included in `public/`.

Deploy the generated `dist/` to the existing Cloudflare Pages project `iconeditor`, production branch `main`, using Wrangler 4 and environment credentials:

```sh
npx wrangler pages deploy dist --project-name iconeditor --branch main
```

No account credentials are included. Source images are processed locally. Blackmagic's proprietary runtimes and SDK binaries are installed by Resolve and are not redistributed here. Third-party licenses are preserved in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) and `public/licenses/`.
