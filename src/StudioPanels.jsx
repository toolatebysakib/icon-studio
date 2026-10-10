import React, { useEffect, useState } from "react";
import {
  Download,
  FolderOpen,
  Save,
  Trash2,
  Check,
  ExternalLink,
  Film,
  ListVideo,
} from "lucide-react";
import { buildSvg, dataSvg } from "./engine";
import { newItem } from "./model";
import { defaultShortcut, shortcutPresets, captureShortcut, shortcutLabel } from "./shortcuts";

export const desktop = window.iconStudioDesktop;
export const releaseUrl =
  "https://github.com/toolatebysakib/icon-studio/releases/latest/download/icon-studio-resolve.zip";
export const libraryUrl =
  "https://github.com/toolatebysakib/icon-studio/releases/download/v4.0.0/icon-library-rust.zip";

export function LooksPanel({
  looks,
  onSave,
  onApply,
  onDelete,
  onImport,
  onExport,
  style,
}) {
  const [name, setName] = useState("");
  return (
    <div className="settings-content">
      <form
        className="look-save"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) {
            onSave(name.trim());
            setName("");
          }
        }}
      >
        <input
          aria-label="Preset name"
          placeholder="Name this look"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="primary-button" disabled={!name.trim()}>
          <Save size={15} /> Save look
        </button>
      </form>
      <div className="looks-grid">
        {looks.map((look) => (
          <article key={look.id} className="look-card">
            <button
              className="look-apply"
              onClick={() => onApply(look)}
              aria-label={`Apply ${look.name} look`}
            >
              <span
                dangerouslySetInnerHTML={{
                  __html: buildSvg(
                    newItem(
                      {
                        name: look.name,
                        svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="white" d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/></svg>',
                      },
                      look.style,
                    ),
                    { size: 72 },
                  ),
                }}
              />
              <strong>{look.name}</strong>
            </button>
            <button
              className="icon-button"
              aria-label={`Delete ${look.name} preset`}
              onClick={() => onDelete(look.id)}
            >
              <Trash2 size={13} />
            </button>
          </article>
        ))}
      </div>
      {!looks.length && <div className="empty-state">No saved looks</div>}
      <div className="settings-inline">
        <button className="secondary-button" onClick={onImport}>
          <FolderOpen size={14} /> Import presets
        </button>
        <button
          className="secondary-button"
          onClick={onExport}
          disabled={!looks.length}
        >
          <Download size={14} /> Export presets
        </button>
      </div>
    </div>
  );
}

export function SettingsPanel({
  theme,
  setTheme,
  notify,
  onLibraryReady,
  shortcut,
  setShortcut,
}) {
  const [recording, setRecording] = useState(false);
  useEffect(() => {
    if (!recording) return;
    const capture = (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.key === "Escape") {
        setRecording(false);
        return;
      }
      const value = captureShortcut(event);
      if (value) {
        setShortcut(value);
        setRecording(false);
      }
    };
    window.addEventListener("keydown", capture, true);
    return () => window.removeEventListener("keydown", capture, true);
  }, [recording, setShortcut]);
  const [settings, setSettings] = useState(null),
    [pending, setPending] = useState("");
  useEffect(() => {
    desktop
      ?.settings()
      .then(setSettings)
      .catch((e) => notify(e.message));
  }, []);
  const choose = async (key) => {
    try {
      setSettings(await desktop.chooseFolder(key));
      onLibraryReady();
    } catch (e) {
      notify(e.message);
    }
  };
  const update = async (key, value) => {
    try {
      setSettings(await desktop.updateSettings({ [key]: value }));
    } catch (e) {
      notify(e.message);
    }
  };
  return (
    <div className="settings-content">
      <section className="settings-section">
        <h3>Appearance</h3>
        <div className="theme-choices">
          {["light", "dark"].map((value) => (
            <button
              className={`secondary-button ${theme === value ? "selected" : ""}`}
              key={value}
              onClick={() => setTheme(value)}
            >
              {value === "light" ? "Light" : "Dark"}
              {theme === value && <Check size={14} />}
            </button>
          ))}
        </div>
      </section>
      <section className="settings-section">
        <h3>Quick search</h3>
        <label className="folder-setting">
          <span>Shortcut preset</span>
          <select
            aria-label="Quick search shortcut preset"
            value={shortcutPresets.find((preset) => shortcutLabel(preset.shortcut) === shortcutLabel(shortcut))?.id || "custom"}
            onChange={(event) => {
              const preset = shortcutPresets.find((value) => value.id === event.target.value);
              if (preset) {
                setShortcut(preset.shortcut);
                setRecording(false);
              }
            }}
          >
            {shortcutPresets.map((preset, index) => <option key={preset.id} value={preset.id}>{preset.label}{index === 0 ? " (default)" : ""}</option>)}
            <option value="custom" disabled>Custom</option>
          </select>
        </label>
        <div className="settings-inline">
          <button
            className="secondary-button shortcut-capture"
            aria-label="Change quick search shortcut"
            aria-pressed={recording}
            onClick={() => setRecording((value) => !value)}
          >
            {recording ? "Press a shortcut…" : shortcutLabel(shortcut)}
          </button>
          <button
            className="text-button"
            onClick={() => {
              setShortcut(defaultShortcut);
              setRecording(false);
            }}
          >
            Reset
          </button>
        </div>
      </section>
      {desktop && (
        <>
          <section className="settings-section">
            <h3>Folders</h3>
            {[
              ["rawFolder", "Raw icon library"],
              ["outputFolder", "Generated icons"],
            ].map(([key, label]) => (
              <label className="folder-setting" key={key}>
                <span>{label}</span>
                <div>
                  <input
                    aria-label={label + " folder"}
                    readOnly
                    value={settings?.[key] || ""}
                    placeholder="Choose a folder"
                  />
                  <button
                    className="secondary-button"
                    onClick={() => choose(key)}
                  >
                    <FolderOpen size={15} /> Choose
                  </button>
                </div>
              </label>
            ))}
          </section>
          <section className="settings-section">
            <h3>Timeline</h3>
            <label className="form-field">
              <span>Placement</span>
              <select aria-label="Timeline placement" value={settings?.trackMode || "auto"} onChange={(event) => update("trackMode", event.target.value)}>
                <option value="auto">Automatic · above overlapping clips</option>
                <option value="manual">Manual track and position</option>
              </select>
            </label>
            {(settings?.trackMode || "auto") === "manual" && <>
            <label className="form-field">
              <span>Target video track</span>
              <input
                type="number"
                aria-label="Target video track"
                min="1"
                max="99"
                value={settings?.track ?? 2}
                onChange={(e) => update("track", Number(e.target.value))}
              />
            </label>
            <label className="form-field">
              <span>Position</span>
              <select
                aria-label="Timeline position"
                value={settings?.position || "playhead"}
                onChange={(e) => update("position", e.target.value)}
              >
                <option value="playhead">At playhead</option>
                <option value="end">At timeline end</option>
              </select>
            </label>
            </>}
          </section>
        </>
      )}
      <section className="settings-section">
        <h3>Offline icon library</h3>
        <div className="settings-inline">
          {desktop ? (
            <button
              className="secondary-button"
              disabled={!!pending || !settings?.rawFolder}
              onClick={async () => {
                setPending("Downloading…");
                try {
                  const result = await desktop.downloadLibrary();
                  setSettings(await desktop.settings());
                  notify(`${result.count.toLocaleString()} icons installed`);
                  onLibraryReady();
                } catch (e) {
                  notify(e.message);
                } finally {
                  setPending("");
                }
              }}
            >
              <Download size={15} />
              {pending || "Download icon library"}
            </button>
          ) : (
            <a className="secondary-button" href={libraryUrl}>
              <Download size={15} /> Download icon library
            </a>
          )}
        </div>
        {desktop && settings?.libraryCount > 0 && (
          <span className="setting-value">
            {settings.libraryCount.toLocaleString()} icons installed
          </span>
        )}
      </section>
      {!desktop && (
        <section className="settings-section">
          <h3>DaVinci Resolve</h3>
          <a className="primary-button" href={releaseUrl}>
            <Download size={15} /> Download Resolve panel
          </a>
        </section>
      )}
      <footer className="settings-footer">
        <span>
          Icon Studio <small>by Sakib</small>
        </span>
        <a
          href="https://github.com/toolatebysakib/icon-studio"
          target="_blank"
          rel="noreferrer"
        >
          Source <ExternalLink size={12} />
        </a>
      </footer>
    </div>
  );
}

export function ArchivePanel({ notify, onRestore }) {
  const [data, setData] = useState({ projects: [], files: [] }),
    [projectId, setProjectId] = useState(""),
    [pending, setPending] = useState(false);
  useEffect(() => {
    let live = true;
    desktop
      .archiveList(projectId)
      .then((value) => live && setData(value))
      .catch((error) => live && notify(error.message));
    return () => {
      live = false;
    };
  }, [projectId]);
  const act = async (kind, file) => {
    setPending(true);
    try {
      const insertion = await desktop.archiveAction(kind, file.id);
      notify(kind === "pool" ? "Added to Media Pool" : `Added to timeline${insertion?.trackIndex ? ` · V${insertion.trackIndex}` : ""}`);
    } catch (e) {
      notify(e.message);
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="settings-content archive-content">
      <div className="settings-inline">
        <select
          aria-label="Archive project"
          disabled={pending}
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">All projects</option>
          {data.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          className="secondary-button"
          disabled={pending || !data.files.length}
          onClick={async () => {
            setPending(true);
            try {
              if (await desktop.exportArchive(projectId))
                notify("Archive saved");
            } catch (e) {
              notify(e.message);
            } finally {
              setPending(false);
            }
          }}
        >
          <Download size={14} /> Archive ZIP
        </button>
      </div>
      <div className="archive-grid">
        {data.files.map((file) => (
          <article className="archive-card" key={file.id}>
            <img
              alt={file.name}
              src={
                file.thumbnail ||
                (file.item?.style
                  ? dataSvg(buildSvg(file.item, { size: 128 }))
                  : "")
              }
              draggable={file.hasPng !== false}
              onDragStart={(e) => {
                e.preventDefault();
                desktop.dragArchive(file.id);
              }}
            />
            <strong>{file.name}</strong>
            <small>
              {file.projectName} ·{" "}
              {new Date(file.createdAt).toLocaleDateString()}
            </small>
            <div>
              <button
                className="text-button"
                onClick={() => desktop.reveal(file.id)}
              >
                Show file
              </button>
              <button className="text-button" onClick={() => onRestore(file)}>
                Edit
              </button>
            </div>
            <div>
              <button
                className="secondary-button"
                disabled={pending || file.hasPng === false}
                onClick={() => act("pool", file)}
                aria-label={`Add ${file.name} to Media Pool`}
                title="Add to Media Pool"
              >
                <Film size={14} />
                <span className="button-label">Media Pool</span>
              </button>
              <button
                className="secondary-button"
                disabled={pending || file.hasPng === false}
                onClick={() => act("timeline", file)}
                aria-label={`Add ${file.name} to timeline`}
                title="Add to timeline"
              >
                <ListVideo size={14} />
                <span className="button-label">Timeline</span>
              </button>
            </div>
          </article>
        ))}
      </div>
      {!data.files.length && (
        <div className="empty-state">No generated files in this project</div>
      )}
      {data.total > data.files.length && (
        <button
          className="secondary-button archive-more"
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              const next = await desktop.archiveList(
                projectId,
                data.files.length,
              );
              setData((current) => ({
                ...next,
                files: [...current.files, ...next.files],
              }));
            } catch (error) {
              notify(error.message);
            } finally {
              setPending(false);
            }
          }}
        >
          Load more
        </button>
      )}
    </div>
  );
}
