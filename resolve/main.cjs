const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  nativeImage,
  protocol,
  net,
} = require("electron");
const fs = require("node:fs"),
  path = require("node:path"),
  http = require("node:http"),
  crypto = require("node:crypto");
const { StudioStore, inside, atomicWrite, safeName } = require("./core.cjs");
const actions = require("./resolve-actions.cjs");
let zip;
try {
  zip = require("./vendor/fflate.cjs");
} catch {
  zip = require("fflate");
}
const ID = "com.sakib.iconstudio";
protocol.registerSchemesAsPrivileged([
  {
    scheme: "iconstudio",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);
let window,
  store,
  workflow,
  resolve,
  iconIndex = [],
  iconIndexFolder = "";
const bridgeUrl = process.env.ICON_STUDIO_BRIDGE_URL,
  bridgeToken = process.env.ICON_STUDIO_BRIDGE_TOKEN;
function bridgeCall(method, args = {}) {
  return new Promise((done, fail) => {
    const body = JSON.stringify({ method, args });
    const req = http.request(
      bridgeUrl,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + bridgeToken,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (part) => {
          data += part;
          if (data.length > 2e6) req.destroy(Error("Invalid bridge response"));
        });
        res.on("end", () => {
          try {
            const v = JSON.parse(data);
            v.ok
              ? done(v.result)
              : fail(Error(v.error || "Resolve operation failed"));
          } catch (error) {
            fail(error);
          }
        });
      },
    );
    req.setTimeout(15000, () =>
      req.destroy(Error("Resolve is not responding.")),
    );
    req.on("error", fail);
    req.end(body);
  });
}
function connect() {
  if (bridgeUrl) return;
  const roots =
    process.platform === "win32"
      ? [
          path.join(
            process.env.PROGRAMDATA || "C:/ProgramData",
            "Blackmagic Design/DaVinci Resolve/Support/Developer/Workflow Integrations",
          ),
        ]
      : [
          "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Workflow Integrations",
          "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Support/Developer/Workflow Integrations",
        ];
  const candidates = [
    path.join(__dirname, "WorkflowIntegration.node"),
    ...roots.flatMap((root) =>
      ["SamplePlugin", "SamplePromisePlugin", "CompatibleSamplePlugin"].map(
        (folder) =>
          path.join(root, "Examples", folder, "WorkflowIntegration.node"),
      ),
    ),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const module = require(file);
      if (module.Initialize(ID)) {
        workflow = module;
        module.SetAPITimeout?.(15);
        resolve = module.GetResolve();
        return;
      }
    } catch {}
  }
}
async function current() {
  if (bridgeUrl) return bridgeCall("context");
  if (!resolve) connect();
  if (!resolve)
    throw Error(
      "Open Icon Studio from Resolve → Workspace → Scripts → Utility.",
    );
  return actions.context(resolve);
}
async function insert(kind, file) {
  if (!["pool", "timeline"].includes(kind)) throw Error("Invalid operation");
  const ctx = await current();
  if (!ctx.project) throw Error("Open a Resolve project first.");
  if (bridgeUrl)
    return bridgeCall("insert", {
      kind,
      file: file.path,
      options: store.state.settings,
      expectedProjectId: ctx.project.id,
    });
  return actions.importFile(
    resolve,
    file.path,
    store.state.settings,
    kind,
    ctx.project.id,
  );
}
function trusted(event) {
  if (!window || event.sender !== window.webContents)
    throw Error("Untrusted sender");
}
function index() {
  const folder = store.state.settings.rawFolder;
  if (!folder) {
    iconIndex = [];
    return [];
  }
  if (iconIndexFolder !== folder) {
    iconIndexFolder = folder;
    try {
      const data = JSON.parse(
        fs.readFileSync(
          path.join(folder, "icon-studio-library/manifest.json"),
          "utf8",
        ),
      );
      iconIndex = data.icons
        .filter(
          (icon) =>
            typeof icon.fullName === "string" &&
            typeof icon.file === "string" &&
            inside(
              path.join(folder, "icon-studio-library"),
              path.join(folder, "icon-studio-library", icon.file),
            ),
        )
        .slice(0, 50000);
    } catch {
      iconIndex = [];
    }
  }
  return iconIndex;
}
function nativeDrag(event, file) {
  trusted(event);
  const image = nativeImage.createFromPath(file.path).resize({ width: 80 });
  event.sender.startDrag({ file: file.path, icon: image });
}
function register(name, handler) {
  ipcMain.handle("icon-studio:" + name, async (event, ...args) => {
    trusted(event);
    return handler(...args);
  });
}
function handlers() {
  register("context", async () => {
    const ctx = await current();
    const project = ctx.project ? store.ensureProject(ctx.project) : null;
    return { ...ctx, look: project?.look || store.state.lastLook };
  });
  register("settings", () => ({
    ...store.state.settings,
    libraryCount: index().length,
  }));
  register("updateSettings", (patch) => store.updateSettings(patch));
  register("chooseFolder", async (key) => {
    if (!["rawFolder", "outputFolder"].includes(key))
      throw Error("Invalid folder");
    const result = await dialog.showOpenDialog(window, {
      title:
        key === "rawFolder"
          ? "Choose raw icon library folder"
          : "Choose generated icons folder",
      properties: ["openDirectory", "createDirectory"],
    });
    if (!result.canceled) {
      store.chooseFolder(key, result.filePaths[0]);
      iconIndexFolder = "";
    }
    return store.state.settings;
  });
  register("saveWorkspace", (id, value) => store.saveWorkspace(id, value));
  register(
    "loadWorkspace",
    (id) => store.state.projects[id]?.workspace || null,
  );
  register("setProjectLook", (id, look) => store.setLook(id, look));
  register("prepareIcon", async (value) => {
    const ctx = await current();
    if (!ctx.project) throw Error("Open a Resolve project first.");
    return store.prepare(value, ctx.project);
  });
  register("generate", async (id) => {
    const ctx = await current();
    if (!ctx.project) throw Error("Open a Resolve project first.");
    return store.generate(id, ctx.project);
  });
  register("attachSvg", async (id, svg) => {
    const ctx = await current();
    if (!ctx.project) throw Error("Open a Resolve project first.");
    return store.attachSvg(id, svg, ctx.project);
  });
  register("saveExport", async ({ name, bytes }) => {
    const filename = safeName(name),
      extension = path.extname(filename).slice(1).toLowerCase();
    const data = Buffer.from(bytes);
    if (
      !["png", "svg", "zip", "iconlooks", "iconstudio", "json"].includes(
        extension,
      ) ||
      data.length > 100 * 1024 * 1024
    )
      throw Error("Invalid export.");
    const target = await dialog.showSaveDialog(window, {
      defaultPath: path.join(
        store.state.settings.outputFolder || app.getPath("documents"),
        filename,
      ),
      filters: [{ name: "Icon Studio export", extensions: [extension] }],
    });
    if (!target.canceled) atomicWrite(target.filePath, data);
    return !target.canceled;
  });
  register("archiveAction", (kind, id) => insert(kind, store.findFile(id)));
  register("downloadGenerated", async (id) => {
    const file = store.findFile(id);
    const target = await dialog.showSaveDialog(window, {
      defaultPath: file.path,
      filters: [{ name: "PNG image", extensions: ["png"] }],
    });
    if (
      !target.canceled &&
      path.resolve(target.filePath) !== path.resolve(file.path)
    )
      fs.copyFileSync(file.path, target.filePath);
    return !target.canceled;
  });
  register("archiveList", (id) => {
    const result = store.archive(id);
    return {
      ...result,
      files: result.files
        .slice()
        .reverse()
        .slice(0, 500)
        .map((file) => ({
          ...file,
          thumbnail: nativeImage
            .createFromPath(file.path)
            .resize({ width: 128 })
            .toDataURL(),
        })),
    };
  });
  register("exportArchive", async (id) => {
    const entries = store.archiveEntries(id);
    if (!Object.keys(entries).length)
      throw Error("No generated files on disk.");
    const target = await dialog.showSaveDialog(window, {
      defaultPath: "Icon Studio Archive.zip",
      filters: [{ name: "ZIP archive", extensions: ["zip"] }],
    });
    if (!target.canceled)
      atomicWrite(
        target.filePath,
        Buffer.from(zip.zipSync(entries, { level: 6 })),
      );
    return !target.canceled;
  });
  register("reveal", (id) => shell.showItemInFolder(store.findFile(id).path));
  ipcMain.on("icon-studio:dragPrepared", async (event, id) => {
    try {
      trusted(event);
      const preview = store.prepared.get(id);
      if (!preview) throw Error("Preview changed");
      const ctx = await current();
      if (!ctx.project) throw Error("Open a project");
      const file = store.generate(id, ctx.project);
      nativeDrag(event, file);
    } catch (error) {
      dialog.showErrorBox("Icon Studio", error.message);
    }
  });
  ipcMain.on("icon-studio:dragArchive", (event, id) => {
    try {
      nativeDrag(event, store.findFile(id));
    } catch (error) {
      dialog.showErrorBox("Icon Studio", error.message);
    }
  });
  register("searchIcons", (query, prefix) => {
    const q = String(query || "").toLowerCase();
    const root = path.join(
      store.state.settings.rawFolder,
      "icon-studio-library",
    );
    return index()
      .filter(
        (icon) =>
          (!prefix || prefix === icon.prefix) &&
          (!q || `${icon.name} ${icon.title}`.toLowerCase().includes(q)),
      )
      .slice(0, q ? 180 : 96)
      .map((icon) => ({
        ...icon,
        rawSvg: fs.readFileSync(path.join(root, icon.file), "utf8"),
      }));
  });
  register("readIcon", (name) => {
    const icon = index().find((icon) => icon.fullName === name);
    if (!icon) return null;
    const root = path.join(
        store.state.settings.rawFolder,
        "icon-studio-library",
      ),
      file = path.join(root, icon.file);
    if (!inside(root, file)) throw Error("Invalid icon path");
    return fs.readFileSync(file, "utf8");
  });
  register("downloadLibrary", async () => {
    const folder = store.state.settings.rawFolder;
    if (!folder) throw Error("Choose a raw icon library folder first.");
    const config = JSON.parse(
      fs.readFileSync(path.join(__dirname, "library-release.json"), "utf8"),
    );
    const response = await fetch(config.url, {
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw Error("Icon library download failed.");
    const declared = Number(response.headers.get("content-length"));
    if (declared > 80 * 1024 * 1024) throw Error("Icon library is too large.");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (
      bytes.length > 80 * 1024 * 1024 ||
      crypto.createHash("sha256").update(bytes).digest("hex") !== config.sha256
    )
      throw Error("Icon library checksum did not match.");
    const entries = zip.unzipSync(bytes),
      root = path.join(folder, "icon-studio-library");
    let total = 0;
    for (const [name, data] of Object.entries(entries)) {
      total += data.length;
      if (total > 350 * 1024 * 1024)
        throw Error("Library exceeds its size limit.");
      const target = path.join(folder, name);
      if (
        !name.startsWith("icon-studio-library/") ||
        !inside(root, target) ||
        !/\.(svg|json|txt|md)$/.test(name)
      )
        throw Error("Invalid library archive.");
    }
    // Validate everything before writing to the user-selected directory.
    for (const [name, data] of Object.entries(entries))
      atomicWrite(path.join(folder, name), Buffer.from(data));
    iconIndexFolder = "";
    store.state.settings.libraryCount = index().length;
    store.persist();
    return { count: index().length };
  });
}
app.setName("Icon Studio by Sakib");
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    window?.show();
    window?.focus();
  });
  app.whenReady().then(() => {
    store = new StudioStore(
      path.join(app.getPath("appData"), "Icon Studio by Sakib"),
    );
    connect();
    handlers();
    protocol.handle("iconstudio", (request) => {
      const url = new URL(request.url),
        root = path.join(__dirname, "ui"),
        file = path.join(root, decodeURIComponent(url.pathname));
      if (url.host !== "app" || !inside(root, file))
        return new Response("Not found", { status: 404 });
      return net.fetch(require("node:url").pathToFileURL(file).href);
    });
    window = new BrowserWindow({
      width: 1320,
      height: 880,
      minWidth: 860,
      minHeight: 640,
      title: "Icon Studio by Sakib",
      backgroundColor: "#1e1f25",
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, "preload.cjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
    window.setMenu(null);
    window.webContents.setWindowOpenHandler(({ url }) => {
      if (/^https:\/\/(github\.com|iconeditor\.pages\.dev)\//.test(url))
        shell.openExternal(url);
      return { action: "deny" };
    });
    window.webContents.on("will-navigate", (event, url) => {
      if (!url.startsWith("iconstudio://app/")) event.preventDefault();
    });
    window.webContents.session.setPermissionRequestHandler(
      (_webContents, permission, callback) =>
        callback(permission === "clipboard-sanitized-write"),
    );
    window.loadURL("iconstudio://app/index.html");
    window.on("closed", () => {
      window = null;
      app.quit();
    });
  });
  app.on("will-quit", () => {
    try {
      workflow?.CleanUp();
    } catch {}
    if (bridgeUrl) bridgeCall("close").catch(() => {});
  });
  app.on("window-all-closed", () => app.quit());
}
