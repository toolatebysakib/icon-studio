import React, { useEffect, useState } from "react";
import {
  Download,
  FolderOpen,
  Save,
  Trash2,
  Check,
  ExternalLink,
} from "lucide-react";
import { buildSvg } from "./engine";
import { newItem } from "./model";

export const desktop = window.iconStudioDesktop;
export const releaseUrl =
  "https://github.com/toolatebysakib/icon-studio/releases/latest/download/icon-studio-resolve.zip";
export const libraryUrl =
  "https://github.com/toolatebysakib/icon-studio/releases/latest/download/icon-library.zip";

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

export function SettingsPanel({ theme, setTheme, notify, onLibraryReady }) {
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
  const refresh = () =>
    desktop
      .archiveList(projectId)
      .then(setData)
      .catch((e) => notify(e.message));
  useEffect(() => {
    refresh();
  }, [projectId]);
  const act = async (kind, file) => {
    setPending(true);
    try {
      await desktop.archiveAction(kind, file.id);
      notify(kind === "pool" ? "Added to Media Pool" : "Added to timeline");
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
              src={file.thumbnail}
              draggable
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
                disabled={pending}
                onClick={() => act("pool", file)}
              >
                Media Pool
              </button>
              <button
                className="secondary-button"
                disabled={pending}
                onClick={() => act("timeline", file)}
              >
                Timeline
              </button>
            </div>
          </article>
        ))}
      </div>
      {!data.files.length && (
        <div className="empty-state">No generated files in this project</div>
      )}
    </div>
  );
}
