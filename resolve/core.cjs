const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function safeName(value) {
  let s = String(value || "untitled")
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/[. ]+$/, "")
    .trim()
    .slice(0, 100);
  if (!s) s = "untitled";
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(s)) s = "_" + s;
  return s;
}
function inside(root, file) {
  const rel = path.relative(path.resolve(root), path.resolve(file));
  return (
    rel === "" ||
    (!rel.startsWith(".." + path.sep) && rel !== ".." && !path.isAbsolute(rel))
  );
}
function atomicWrite(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + "." + crypto.randomUUID() + ".tmp";
  try {
    fs.writeFileSync(tmp, value);
    fs.renameSync(tmp, file);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}
function blank() {
  return {
    version: 1,
    settings: {
      rawFolder: "",
      outputFolder: "",
      duration: 5,
      track: 2,
      position: "playhead",
      libraryCount: 0,
    },
    projects: {},
    lastLook: null,
    files: [],
  };
}
function loadState(file) {
  try {
    const v = JSON.parse(fs.readFileSync(file, "utf8"));
    if (v.version !== 1) throw Error();
    return {
      ...blank(),
      ...v,
      settings: { ...blank().settings, ...v.settings },
    };
  } catch {
    return blank();
  }
}
class StudioStore {
  constructor(directory) {
    this.directory = directory;
    this.file = path.join(directory, "state.json");
    this.state = loadState(this.file);
    this.prepared = new Map();
  }
  persist() {
    atomicWrite(this.file, JSON.stringify(this.state, null, 2));
  }
  ensureProject(project) {
    if (!project?.id) throw Error("Open a Resolve project first.");
    if (!this.state.projects[project.id]) {
      this.state.projects[project.id] = {
        id: project.id,
        name: project.name,
        look: this.state.lastLook,
        workspace: null,
      };
      this.persist();
    } else if (this.state.projects[project.id].name !== project.name) {
      this.state.projects[project.id].name = project.name;
      this.persist();
    }
    return this.state.projects[project.id];
  }
  saveWorkspace(id, workspace) {
    const project = this.state.projects[id];
    if (!project) throw Error("Unknown project");
    if (
      workspace?.version !== 2 ||
      !Array.isArray(workspace.items) ||
      workspace.items.length > 200
    )
      throw Error("Invalid workspace");
    project.workspace = workspace;
    this.persist();
    return true;
  }
  setLook(id, look) {
    const project = this.state.projects[id];
    if (!project) throw Error("Unknown project");
    project.look = look;
    this.state.lastLook = look;
    this.persist();
    return true;
  }
  updateSettings(patch) {
    const s = this.state.settings;
    for (const key of ["duration", "track", "position"])
      if (Object.hasOwn(patch, key)) s[key] = patch[key];
    s.duration = Math.max(0.1, Math.min(3600, Number(s.duration) || 5));
    s.track = Math.max(1, Math.min(99, Math.floor(Number(s.track) || 2)));
    if (!["playhead", "end"].includes(s.position)) s.position = "playhead";
    this.persist();
    return { ...s };
  }
  chooseFolder(key, folder) {
    if (!["rawFolder", "outputFolder"].includes(key))
      throw Error("Invalid folder setting");
    if (!path.isAbsolute(folder) || !fs.statSync(folder).isDirectory())
      throw Error("Choose an existing folder");
    fs.accessSync(folder, fs.constants.R_OK | fs.constants.W_OK);
    this.state.settings[key] = path.resolve(folder);
    if (key === "rawFolder") this.state.settings.libraryCount = 0;
    this.persist();
    return { ...this.state.settings };
  }
  prepare({ name, item, projectId, bytes }, currentProject) {
    if (currentProject.id !== projectId)
      throw Error("Resolve project changed.");
    this.ensureProject(currentProject);
    if (!this.state.settings.outputFolder)
      throw Error("Choose a generated icons folder in Settings.");
    const png = Buffer.from(bytes);
    if (
      png.length > 25 * 1024 * 1024 ||
      !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    )
      throw Error("Invalid PNG");
    const digest = crypto
      .createHash("sha256")
      .update(png)
      .digest("hex")
      .slice(0, 20);
    const id = crypto
      .createHash("sha256")
      .update(projectId + "|" + safeName(name) + "|" + digest)
      .digest("hex")
      .slice(0, 24);
    if (this.prepared.has(id)) return this.prepared.get(id);
    const file = path.join(
      this.directory,
      "preview",
      `${safeName(name)}-${id.slice(0, 8)}.png`,
    );
    atomicWrite(file, png);
    const record = {
      id,
      path: file,
      name: safeName(name),
      projectId,
      item,
      hash: digest,
    };
    this.prepared.set(id, record);
    this.trimPrepared();
    return record;
  }
  trimPrepared() {
    while (this.prepared.size > 80) {
      const [key, value] = this.prepared.entries().next().value;
      this.prepared.delete(key);
      try {
        fs.unlinkSync(value.path);
      } catch {}
    }
  }
  generate(id, currentProject) {
    const temp = this.prepared.get(id);
    if (!temp) throw Error("Preview changed. Try again.");
    if (temp.projectId !== currentProject.id)
      throw Error("Resolve project changed.");
    const output = this.state.settings.outputFolder;
    if (!output) throw Error("Choose a generated icons folder in Settings.");
    const existing = this.state.files.find(
      (v) =>
        v.projectId === temp.projectId &&
        v.hash === temp.hash &&
        v.name === temp.name &&
        inside(output, v.path) &&
        fs.existsSync(v.path),
    );
    if (existing) return existing;
    const folder = path.join(
      output,
      safeName(currentProject.name) +
        "-" +
        crypto
          .createHash("sha256")
          .update(currentProject.id)
          .digest("hex")
          .slice(0, 8),
    );
    fs.mkdirSync(folder, { recursive: true });
    let filename = temp.name + ".png",
      n = 2;
    while (fs.existsSync(path.join(folder, filename)))
      filename = `${temp.name}-${n++}.png`;
    const file = path.join(folder, filename);
    fs.copyFileSync(temp.path, file, fs.constants.COPYFILE_EXCL);
    const record = {
      ...temp,
      id: crypto.randomUUID(),
      path: file,
      projectName: currentProject.name,
      createdAt: new Date().toISOString(),
    };
    this.state.files.push(record);
    this.persist();
    return record;
  }
  findFile(id) {
    const file = this.state.files.find((v) => v.id === id);
    if (!file || !fs.existsSync(file.path))
      throw Error("Generated file is missing from disk.");
    return file;
  }
  attachSvg(id, svg, currentProject) {
    const file = this.findFile(id);
    if (file.projectId !== currentProject.id)
      throw Error("Resolve project changed.");
    if (
      typeof svg !== "string" ||
      Buffer.byteLength(svg) > 5 * 1024 * 1024 ||
      !/<svg[\s>]/i.test(svg)
    )
      throw Error("Invalid SVG export.");
    const base = file.path.replace(/\.png$/i, "");
    let target = file.svgPath || base + ".svg",
      n = 2;
    while (fs.existsSync(target) && fs.readFileSync(target, "utf8") !== svg)
      target = `${base}-${n++}.svg`;
    if (!fs.existsSync(target)) atomicWrite(target, svg);
    file.svgPath = target;
    file.svgPaths = [...new Set([...(file.svgPaths || []), target])];
    this.persist();
    return file;
  }
  archive(projectId = "") {
    const files = this.state.files.filter(
      (v) => (!projectId || v.projectId === projectId) && fs.existsSync(v.path),
    );
    return {
      projects: Object.values(this.state.projects).map(({ id, name }) => ({
        id,
        name,
      })),
      files,
    };
  }
  archiveEntries(projectId = "") {
    const entries = {};
    for (const file of this.archive(projectId).files) {
      const project =
        safeName(file.projectName) +
        "-" +
        crypto
          .createHash("sha256")
          .update(file.projectId)
          .digest("hex")
          .slice(0, 8);
      entries[`${project}/${path.basename(file.path)}`] = fs.readFileSync(
        file.path,
      );
      for (const svgPath of file.svgPaths ||
        (file.svgPath ? [file.svgPath] : []))
        if (fs.existsSync(svgPath))
          entries[`${project}/${path.basename(svgPath)}`] =
            fs.readFileSync(svgPath);
    }
    return entries;
  }
}
function timecodeToFrames(timecode, rate) {
  const parts = String(timecode).split(/[:;]/).map(Number);
  if (parts.length !== 4 || parts.some((v) => !Number.isFinite(v)))
    throw Error("Resolve returned an unsupported timecode");
  const fps = Math.round(rate);
  let frame = (parts[0] * 3600 + parts[1] * 60 + parts[2]) * fps + parts[3];
  if (String(timecode).includes(";") && (fps === 30 || fps === 60)) {
    const drop = fps === 60 ? 4 : 2,
      totalMinutes = parts[0] * 60 + parts[1];
    frame -= drop * (totalMinutes - Math.floor(totalMinutes / 10));
  }
  return frame;
}
module.exports = {
  StudioStore,
  safeName,
  inside,
  atomicWrite,
  timecodeToFrames,
};
