const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path");
const {
  StudioStore,
  inside,
  timecodeToFrames,
} = require("../resolve/core.cjs");
const { importFile } = require("../resolve/resolve-actions.cjs");
test("projects inherit the latest look and restore previous project looks by stable ID", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "iconstudio-"));
  try {
    const store = new StudioStore(dir);
    store.ensureProject({ id: "one", name: "First" });
    store.setLook("one", { bgColor1: "#112233" });
    assert.deepEqual(store.ensureProject({ id: "two", name: "Second" }).look, {
      bgColor1: "#112233",
    });
    store.setLook("two", { bgColor1: "#445566" });
    assert.equal(
      store.ensureProject({ id: "one", name: "Renamed First" }).look.bgColor1,
      "#112233",
    );
    assert.equal(new StudioStore(dir).state.projects.one.name, "Renamed First");
    assert.equal(
      store.ensureProject({ id: "three", name: "Third" }).look.bgColor1,
      "#445566",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("archives contain generated files only and reject invalid PNGs or project races", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "iconstudio-"));
  try {
    const output = path.join(dir, "output");
    fs.mkdirSync(output);
    const store = new StudioStore(path.join(dir, "state"));
    store.chooseFolder("outputFolder", output);
    const project = { id: "p", name: "My Project" };
    store.ensureProject(project);
    assert.throws(
      () =>
        store.prepare(
          { name: "bad", projectId: "p", bytes: Buffer.from("bad") },
          project,
        ),
      /Invalid PNG/,
    );
    assert.throws(
      () =>
        store.prepare(
          { name: "a", projectId: "wrong", bytes: Buffer.alloc(8) },
          project,
        ),
      /changed/,
    );
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    const preview = store.prepare(
      { name: "../../icon", projectId: "p", bytes: png, item: {} },
      project,
    );
    assert.equal(store.archive().files.length, 0);
    const file = store.generate(preview.id, project);
    assert.equal(store.archive().files.length, 1);
    assert.equal(Object.keys(store.archiveEntries()).length, 1);
    assert.ok(inside(output, file.path));
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle r="8"/></svg>';
    assert.throws(
      () => store.attachSvg(file.id, svg, { id: "other" }),
      /changed/,
    );
    store.attachSvg(file.id, svg, project);
    assert.equal(Object.keys(store.archiveEntries()).length, 2);
    store.attachSvg(file.id, svg, project);
    assert.equal(Object.keys(store.archiveEntries()).length, 2);
    store.attachSvg(file.id, svg.replace('r="8"', 'r="10"'), project);
    assert.equal(Object.keys(store.archiveEntries()).length, 3);
    assert.ok(inside(output, file.svgPath));
    fs.unlinkSync(file.svgPath);
    assert.equal(Object.keys(store.archiveEntries()).length, 2);
    fs.unlinkSync(file.path);
    assert.equal(store.archive().files.length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
test("native import honors playhead, selected track, duration and project identity", () => {
  let submitted;
  const timeline = {
    GetSettings: () => ({ timelineFrameRate: "24" }),
    GetTrackCount: () => 2,
    GetIsTrackLocked: () => false,
    GetCurrentTimecode: () => "01:00:01:00",
  };
  const pool = {
    ImportMedia: () => [{}],
    AppendToTimeline: (v) => {
      submitted = v;
      return [{}];
    },
  };
  const project = {
    GetUniqueId: () => "p",
    GetMediaPool: () => pool,
    GetCurrentTimeline: () => timeline,
  };
  const resolve = {
    GetProjectManager: () => ({ GetCurrentProject: () => project }),
  };
  assert.throws(
    () =>
      importFile(
        resolve,
        "icon.png",
        { track: 2, duration: 5 },
        "timeline",
        "wrong",
      ),
    /changed/,
  );
  const result = importFile(
    resolve,
    "icon.png",
    { track: 2, duration: 5, position: "playhead" },
    "timeline",
    "p",
  );
  assert.equal(result.added, 1);
  assert.equal(submitted[0].recordFrame, 86424);
  assert.equal(submitted[0].endFrame, 119);
  assert.equal(submitted[0].trackIndex, 2);
});
test("drop-frame timecode and archive paths reject common edge cases", () => {
  assert.equal(timecodeToFrames("01:00:00;00", 29.97), 107892);
  assert.equal(timecodeToFrames("00:10:00;00", 59.94), 35964);
  assert.equal(inside("/icons", "/icons/../secrets"), false);
});
