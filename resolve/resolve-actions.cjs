const { timecodeToFrames } = require("./core.cjs");
function context(resolve) {
  const project = resolve.GetProjectManager().GetCurrentProject();
  if (!project) return { project: null, connected: true };
  return {
    project: { id: project.GetUniqueId(), name: project.GetName() },
    connected: true,
  };
}
function importFile(resolve, file, options, kind, expectedProjectId) {
  const project = resolve.GetProjectManager().GetCurrentProject();
  if (!project) throw Error("Open a Resolve project first.");
  if (expectedProjectId && project.GetUniqueId() !== expectedProjectId)
    throw Error("Resolve project changed.");
  const pool = project.GetMediaPool();
  let clips = pool.ImportMedia([{ FilePath: file }]);
  if (!clips?.length) clips = pool.ImportMedia([file]);
  if (!clips?.length) throw Error("Resolve could not import this PNG.");
  if (kind === "pool") return { imported: clips.length };
  const timeline = project.GetCurrentTimeline();
  if (!timeline)
    throw Error("Open a timeline first. The icon was added to the Media Pool.");
  const settings = timeline.GetSettings?.() || project.GetSettings?.() || {};
  const fps = Number(settings.timelineFrameRate) || 24;
  const track = options.track;
  while (timeline.GetTrackCount("video") < track) {
    if (!timeline.AddTrack("video"))
      throw Error("Resolve could not add the target video track.");
  }
  if (timeline.GetIsTrackLocked?.("video", track))
    throw Error(
      "The target video track is locked. The icon is in the Media Pool.",
    );
  const frame =
    options.position === "end"
      ? timeline.GetEndFrame()
      : timecodeToFrames(timeline.GetCurrentTimecode(), fps);
  const duration = Math.max(1, Math.round(options.duration * fps));
  const appended = pool.AppendToTimeline([
    {
      mediaPoolItem: clips[0],
      startFrame: 0,
      endFrame: duration - 1,
      mediaType: 1,
      trackIndex: track,
      recordFrame: frame,
    },
  ]);
  if (!appended?.length)
    throw Error(
      "Resolve could not place the icon on the timeline. The PNG is in the Media Pool.",
    );
  return { imported: 1, added: appended.length, recordFrame: frame };
}
function importFiles(resolve, files, expectedProjectId) {
  const project = resolve.GetProjectManager().GetCurrentProject();
  if (!project || project.GetUniqueId() !== expectedProjectId)
    throw Error("Resolve project changed.");
  const pool = project.GetMediaPool();
  let clips = pool.ImportMedia(files.map((file) => ({ FilePath: file })));
  if (!clips?.length) clips = pool.ImportMedia(files);
  if (!clips?.length) throw Error("Resolve could not import these PNGs.");
  return { imported: clips.length };
}
module.exports = { context, importFile, importFiles };
