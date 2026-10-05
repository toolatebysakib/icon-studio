const { contextBridge, ipcRenderer } = require("electron");
const invoke = (method, ...args) =>
  ipcRenderer.invoke("icon-studio:" + method, ...args);
contextBridge.exposeInMainWorld("iconStudioDesktop", {
  context: () => invoke("context"),
  settings: () => invoke("settings"),
  chooseFolder: (key) => invoke("chooseFolder", key),
  updateSettings: (patch) => invoke("updateSettings", patch),
  saveWorkspace: (id, value) => invoke("saveWorkspace", id, value),
  loadWorkspace: (id) => invoke("loadWorkspace", id),
  setProjectLook: (id, look) => invoke("setProjectLook", id, look),
  prepareIcon: (value) => invoke("prepareIcon", value),
  generate: (id) => invoke("generate", id),
  archiveAction: (kind, id) => invoke("archiveAction", kind, id),
  downloadGenerated: (id) => invoke("downloadGenerated", id),
  archiveList: (id) => invoke("archiveList", id),
  exportArchive: (id) => invoke("exportArchive", id),
  reveal: (id) => invoke("reveal", id),
  dragPrepared: (id) => ipcRenderer.send("icon-studio:dragPrepared", id),
  dragArchive: (id) => ipcRenderer.send("icon-studio:dragArchive", id),
  readIcon: (name) => invoke("readIcon", name),
  searchIcons: (q, prefix) => invoke("searchIcons", q, prefix),
  downloadLibrary: () => invoke("downloadLibrary"),
});
