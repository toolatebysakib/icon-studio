// Development-only layout fixture. It does not access Resolve or the filesystem.
import { library } from "./library";
let pinned = false;
const project = { id: "layout-validation", name: "Layout validation project" };
const settings = () =>
  Promise.resolve({
    rawFolder: "Layout fixture",
    outputFolder: "Layout fixture",
    libraryCount: 24981,
    track: 2,
    position: "playhead",
    alwaysOnTop: pinned,
  });
window.iconStudioDesktop = {
  context: async () => ({ connected: true, project }),
  settings,
  loadWorkspace: async () => null,
  saveWorkspace: async () => true,
  setProjectLook: async () => true,
  setAlwaysOnTop: async (value) => (pinned = value),
  searchIcons: async (query) =>
    library.filter(
      (icon) =>
        !icon.isAnimated &&
        `${icon.name} ${icon.title}`.toLowerCase().includes(query),
    ),
  readIcon: async (name) =>
    library.find((icon) => icon.fullName === name)?.rawSvg || null,
  prepareIcon: async (value) => ({ ...value, id: value.name }),
  generate: async (id) => ({ id }),
  batchImport: async (ids) => ({ imported: ids.length }),
  archiveAction: async () => true,
  downloadGenerated: async () => true,
  dragPrepared: () => {},
  dragArchive: () => {},
  archiveList: async () => ({ projects: [project], files: [] }),
  chooseFolder: settings,
  updateSettings: settings,
  downloadLibrary: async () => ({ count: 24981 }),
  saveExport: async () => true,
};
await import("./main.jsx");
