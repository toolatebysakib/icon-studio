const { timecodeToFrames } = require("./core.cjs");
function snapshotTracks(timeline) {
  const tracks = [];
  for (let index = 1; index <= timeline.GetTrackCount("video"); index++) {
    const ranges = (timeline.GetItemListInTrack("video", index) || []).map((item) => {
      const start = Number(item.GetStart()), end = Number(item.GetEnd());
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
        throw Error("Resolve could not read a video clip's timeline range.");
      return { start, end };
    });
    tracks.push({ index, ranges, locked: !!timeline.GetIsTrackLocked("video", index), enabled: timeline.GetIsTrackEnabled("video", index) !== false });
  }
  return tracks;
}
function chooseTrack(tracks, frame, duration) {
  const end = frame + duration;
  let highest = 0;
  for (const track of tracks)
    if (track.ranges.some((clip) => clip.start < end && clip.end > frame)) highest = track.index;
  const available = tracks.find((track) => track.index > highest && !track.locked && track.enabled);
  return available?.index || tracks.length + 1;
}
function appendIcon(pool, clip, frame, duration, track) {
  return pool.AppendToTimeline([{ mediaPoolItem: clip, startFrame: 0, endFrame: duration - 1, mediaType: 1, trackIndex: track, recordFrame: frame }]);
}
function automaticInsert(timeline, pool, clip, frame, requestedDuration) {
  const originalTimecode = timeline.GetCurrentTimecode?.();
  const tracks = snapshotTracks(timeline), stagingTrack = tracks.length + 1;
  if (!timeline.AddTrack("video")) throw Error("Resolve could not create a video track.");
  // PNGs can ignore source ranges and use Resolve's Standard Still Duration.
  // Measure on a new, empty top track before touching any existing track.
  try {
    const staged = appendIcon(pool, clip, frame, requestedDuration, stagingTrack);
    if (!staged?.length) throw Error("Resolve could not place the icon. It is in the Media Pool.");
    const duration = Number(staged[0].GetDuration());
    if (!Number.isFinite(duration) || duration <= 0) {
      timeline.DeleteClips(staged, false);
      throw Error("Resolve could not determine the icon's duration.");
    }
    const track = chooseTrack(tracks, frame, duration);
    if (track === stagingTrack) return { imported: 1, added: staged.length, recordFrame: frame, trackIndex: track, duration };
    const placed = appendIcon(pool, clip, frame, duration, track);
    if (!placed?.length) return { imported: 1, added: staged.length, recordFrame: frame, trackIndex: stagingTrack, duration };
    if (!timeline.DeleteClips(staged, false)) {
      timeline.DeleteClips(placed, false);
      return { imported: 1, added: staged.length, recordFrame: frame, trackIndex: stagingTrack, duration };
    }
    return { imported: 1, added: placed.length, recordFrame: frame, trackIndex: track, duration };
  } finally {
    try {
      if (!(timeline.GetItemListInTrack("video", stagingTrack) || []).length)
        timeline.DeleteTrack("video", stagingTrack);
    } finally {
      if (originalTimecode) timeline.SetCurrentTimecode?.(originalTimecode);
    }
  }
}
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
  const duration = Math.max(1, Math.round((options.duration || 5) * fps));
  if (options.trackMode !== "manual")
    return automaticInsert(timeline, pool, clips[0], timecodeToFrames(timeline.GetCurrentTimecode(), fps), duration);
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
module.exports = { context, importFile, importFiles, chooseTrack, automaticInsert };
