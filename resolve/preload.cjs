const { contextBridge, ipcRenderer } = require("electron");
const invoke = (method, ...args) =>
  ipcRenderer.invoke("icon-studio:" + method, ...args);
contextBridge.exposeInMainWorld("iconStudioDesktop", {
  context: () => invoke("context"),
  settings: () => invoke("settings"),
  setAlwaysOnTop: (value) => invoke("setAlwaysOnTop", value),
  batchImport: (ids, projectId) => invoke("batchImport", ids, projectId),
  chooseFolder: (key) => invoke("chooseFolder", key),
  updateSettings: (patch) => invoke("updateSettings", patch),
  saveWorkspace: (id, value) => invoke("saveWorkspace", id, value),
  loadWorkspace: (id) => invoke("loadWorkspace", id),
  setProjectLook: (id, look) => invoke("setProjectLook", id, look),
  prepareIcon: (value) => invoke("prepareIcon", value),
  generate: (id) => invoke("generate", id),
  attachSvg: (id, svg) => invoke("attachSvg", id, svg),
  saveExport: (value) => invoke("saveExport", value),
  archiveAction: (kind, id) => invoke("archiveAction", kind, id),
  downloadGenerated: (id) => invoke("downloadGenerated", id),
  archiveList: (id, offset) => invoke("archiveList", id, offset),
  exportArchive: (id) => invoke("exportArchive", id),
  reveal: (id) => invoke("reveal", id),
  dragPrepared: (id) => ipcRenderer.send("icon-studio:dragPrepared", id),
  dragArchive: (id) => ipcRenderer.send("icon-studio:dragArchive", id),
  readIcon: (name) => invoke("readIcon", name),
  searchIcons: (q, prefix, limit) => invoke("searchIcons", q, prefix, limit),
  downloadLibrary: () => invoke("downloadLibrary"),
});
