import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import {
  Sparkles,
  Search,
  Plus,
  Upload,
  Download,
  ChevronDown,
  ChevronRight,
  Undo2,
  Redo2,
  Copy,
  Check,
  X,
  Heart,
  Layers,
  SlidersHorizontal,
  Image as ImageIcon,
  Play,
  Pause,
  ArrowUpRight,
  FolderOpen,
  Save,
  Trash2,
  Type,
  MoreHorizontal,
  Sun,
  Moon,
  HelpCircle,
  Grid2X2,
  MousePointer2,
  RotateCcw,
  Clipboard,
  Loader2,
  CheckCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Bookmark,
  Archive,
  Pin,
  Film,
  ListVideo,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { zipSync, strToU8 } from "fflate";
import {
  library as fullLibrary,
  collections as fullCollections,
} from "./library";
import {
  defaults,
  presets,
  newItem,
  uniqueNames,
  renamePreview,
  validateProject,
  safeName,
} from "./model";
import {
  sanitizeSvg,
  dataSvg,
  getIcon,
  searchIcons,
  buildSvg,
  renderPng,
  download,
  removeBackground,
} from "./engine";
import { readSaved, saveWorkspace } from "./storage";
import "./style.css";
import "./theme.css";
import "./product.css";
import "./compact.css";
import featured from "./featured.json";
import expandedCollections from "./library-collections.json";
import LibraryAnnouncement from "./LibraryAnnouncement";
import QuickSearch from "./QuickSearch";
import { readShortcut, matchesShortcut, shortcutLabel } from "./shortcuts";
import { readLooks, writeLooks, cleanStyle, parseLooks } from "./looks";
import {
  desktop,
  releaseUrl,
  LooksPanel,
  SettingsPanel,
  ArchivePanel,
} from "./StudioPanels";

const library = fullLibrary.filter((i) => !i.isAnimated);
const collections = [{id:"featured",prefix:"",name:"Featured"},{id:"all",prefix:"all",name:"All collections"}, ...fullCollections.filter(c => ["apple","brands","ui"].includes(c.prefix)), ...expandedCollections];
function defaultLook() {
  try {
    return {
      ...defaults,
      ...cleanStyle(
        JSON.parse(localStorage.getItem("icon-studio-default-look") || "null"),
      ),
    };
  } catch {
    return defaults;
  }
}
const seed = () =>
  newItem(
    {
      name: "sparkle",
      svg: sanitizeSvg(
        library.find((i) => i.fullName === "ui:sparkles").rawSvg,
      ),
      source: "Essential UI",
    },
    defaultLook(),
  );
function Modal({ title, subtitle, children, onClose, wide = false }) {
  const ref = useRef();
  useEffect(() => {
    const previous = document.activeElement;
    (
      ref.current?.querySelector("input:not([type='hidden']),select") ||
      ref.current?.querySelector("button")
    )?.focus();
    const handle = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const nodes = [
          ...ref.current.querySelectorAll(
            'button,input,select,textarea,[tabindex="0"]',
          ),
        ].filter((el) => !el.disabled);
        if (e.shiftKey && document.activeElement === nodes[0]) {
          e.preventDefault();
          nodes.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === nodes.at(-1)) {
          e.preventDefault();
          nodes[0]?.focus();
        }
      }
    };
    window.addEventListener("keydown", handle);
    return () => {
      window.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        ref={ref}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function Segment({ label, value, options, onChange }) {
  return (
    <div className="segment" role="group" aria-label={label}>
      {options.map((o) => {
        const [key, text] = Array.isArray(o) ? o : [o, o];
        return (
          <button
            key={key}
            className={value === key ? "active" : ""}
            aria-pressed={value === key}
            onClick={() => onChange(key)}
          >
            {text}
          </button>
        );
      })}
    </div>
  );
}
function Color({ label, value, onChange, mixed = false }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="color-field">
      <span>
        {label}
        {mixed ? " · Mixed" : ""}
      </span>
      <div>
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          aria-label={`${label} hex`}
          value={text.toUpperCase()}
          maxLength={7}
          onChange={(e) => {
            setText(e.target.value);
            if (/^#[\da-f]{6}$/i.test(e.target.value)) onChange(e.target.value);
          }}
          onBlur={() => setText(value)}
        />
      </div>
    </label>
  );
}
function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
  mixed = false,
}) {
  return (
    <label className="slider-field">
      <div>
        <span>{label}</span>
        <output>
          {mixed ? "Mixed" : `${Math.round(value * 100) / 100}${suffix}`}
        </output>
      </div>
      <input
        type="range"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
function Toggle({ label, hint, checked, onChange, mixed = false }) {
  return (
    <label className="toggle-row">
      <span>
        {label}
        {hint && <small>{hint}</small>}
        {mixed && <small>Mixed selection</small>}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span className="switch" />
    </label>
  );
}
function Preview({ item, size = 96, paused = false, glyphOnly = false }) {
  const svg = useMemo(
    () => buildSvg(item, { size, glyphOnly, time: paused ? 0 : null }),
    [item, size, paused, glyphOnly],
  );
  return (
    <div
      className="icon-preview"
      aria-label={`${item.name} preview`}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function App() {
  const initial = useMemo(seed, []),
    [items, setItems] = useState([initial]),
    [selected, setSelected] = useState([initial.id]),
    [activeId, setActiveId] = useState(initial.id);
  const [ready, setReady] = useState(false),
    [saveStatus, setSaveStatus] = useState("Saving…"),
    [past, setPast] = useState([]),
    [future, setFuture] = useState([]),
    lastEdit = useRef({ key: "", time: 0 });
  const [looks, setLooks] = useState(readLooks),
    [projectContext, setProjectContext] = useState(null),
    [removing, setRemoving] = useState(false),
    [nativeFile, setNativeFile] = useState(null);
  const nativeProjectRef = useRef(null),
    nativeSwitching = useRef(false),
    presetInput = useRef(),
    nativeFileGeneration = useRef(0);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const [query, setQuery] = useState(""),
    [prefix, setPrefix] = useState(""),
    [results, setResults] = useState(() => featured.map(id => library.find(i => i.fullName === id)).filter(Boolean)),
    [searchBusy, setSearchBusy] = useState(false),
    [tabName, setTabName] = useState("library");
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("icon-studio-favorites") || "[]");
    } catch {
      return [];
    }
  });
  const [panel, setPanel] = useState("appearance"),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [batch, setBatch] = useState(false),
    [zoom, setZoom] = useState(1),
    [theme, setTheme] = useState(() => {
      try {
        return localStorage.getItem("icon-studio-theme") === "dark"
          ? "dark"
          : "light";
      } catch {
        return "light";
      }
    }),
    [stageBg, setStageBg] = useState("plain"),
    [dragging, setDragging] = useState(false),
    [showLibrary, setShowLibrary] = useState(
      !desktop || window.innerWidth > 1100,
    ),
    [showInspector, setShowInspector] = useState(window.innerWidth >= 720),
    [alwaysOnTop, setAlwaysOnTop] = useState(false),
    [shortcut, setShortcut] = useState(readShortcut);
  useEffect(() => {
    localStorage.setItem(
      "icon-studio-search-shortcut",
      JSON.stringify(shortcut),
    );
  }, [shortcut]);
  useEffect(() => {
    desktop
      ?.settings()
      .then((value) => setAlwaysOnTop(!!value.alwaysOnTop))
      .catch(() => {});
  }, []);
  const [busy, setBusy] = useState(null),
    fileInput = useRef(),
    projectInput = useRef(),
    searchInput = useRef(),
    toastTimer = useRef();
  const [viewportSize, setViewportSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  useEffect(() => {
    const resize = () =>
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  const active = items.find((i) => i.id === activeId) || items[0],
    chosen = items.filter((i) => selected.includes(i.id));
  const targetIds = chosen.map((i) => i.id);
  const notify = (message) => {
    setToast(
      String(message).replace(
        /^Error invoking remote method '[^']+': (?:Error: )?/,
        "",
      ),
    );
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  };
  const commit = (next, key = "") => {
    const old = itemsRef.current;
    if (next === old) return;
    const now = Date.now();
    if (
      !key ||
      lastEdit.current.key !== key ||
      now - lastEdit.current.time > 700
    )
      setPast((p) => [...p.slice(-49), old]);
    lastEdit.current = { key, time: now };
    setFuture([]);
    itemsRef.current = next;
    setItems(next);
  };
  const change = (key, value) =>
    commit(
      itemsRef.current.map((i) =>
        targetIds.includes(i.id)
          ? { ...i, style: { ...i.style, [key]: value } }
          : i,
      ),
      key,
    );
  const applyStyle = (style) =>
    commit(
      itemsRef.current.map((i) =>
        targetIds.includes(i.id)
          ? { ...i, style: { ...i.style, ...style } }
          : i,
      ),
    );
  const mixed = (key) =>
    chosen.some((i) => i.style[key] !== chosen[0]?.style[key]);
  const undo = () => {
    if (!past.length) return;
    const old = past.at(-1);
    setFuture((f) => [itemsRef.current, ...f]);
    setPast((p) => p.slice(0, -1));
    setItems(old);
    itemsRef.current = old;
    lastEdit.current = { key: "", time: 0 };
  };
  const redo = () => {
    if (!future.length) return;
    const next = future[0];
    setPast((p) => [...p, itemsRef.current]);
    setFuture((f) => f.slice(1));
    setItems(next);
    itemsRef.current = next;
  };
  useEffect(() => {
    let mounted = true;
    (desktop
      ? desktop.context().then(async (ctx) => {
          if (ctx.project) {
            nativeProjectRef.current = ctx.project;
            setProjectContext(ctx.project);
            const saved = await desktop.loadWorkspace(ctx.project.id);
            if (saved?.items?.length) return saved;
            const item = seed();
            item.style = { ...defaults, ...ctx.look };
            return { version: 2, items: [item] };
          }
          return null;
        })
      : readSaved()
    )
      .then((saved) => {
        if (!mounted || !saved?.items?.length) return;
        const restored = validateProject(saved).map((i) => ({
          ...i,
          svg: i.svg ? sanitizeSvg(i.svg) : "",
        }));
        setItems(restored);
        setSelected([restored[0].id]);
        setActiveId(restored[0].id);
      })
      .catch(() => {})
      .finally(() => mounted && setReady(true));
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const workspaceProjectId = nativeProjectRef.current?.id;
    setSaveStatus("Saving…");
    const timer = setTimeout(
      () =>
        (desktop && workspaceProjectId
          ? desktop.saveWorkspace(workspaceProjectId, { version: 2, items })
          : saveWorkspace({ version: 2, items })
        )
          .then(() => setSaveStatus("Saved"))
          .catch(() => setSaveStatus("Save needed")),
      600,
    );
    return () => clearTimeout(timer);
  }, [items, ready]);
  useEffect(() => {
    const ids = new Set(items.map((i) => i.id));
    setSelected((s) => s.filter((id) => ids.has(id)));
    if (!ids.has(activeId)) setActiveId(items[0]?.id);
  }, [items]);
  useEffect(() => {
    const ac = new AbortController();
    setSearchBusy(true);
    const timer = setTimeout(
      () =>
        searchIcons(query, prefix, false, ac.signal)
          .then((list) => {
            setResults(list);
            setSearchBusy(false);
          })
          .catch(() => {
            if (!ac.signal.aborted) setSearchBusy(false);
          }),
      query ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [query, prefix]);
  useEffect(() => {
    localStorage.setItem("icon-studio-favorites", JSON.stringify(favorites));
  }, [favorites]);
  useEffect(() => {
    let live = true;
    const pending = items.filter(
      (i) =>
        i.style.removeBg &&
        i.processedKey !==
          JSON.stringify([
            i.svg,
            i.image,
            i.style.bgTolerance,
            i.style.bgRemoveMode,
            i.style.bgRemoveColor,
            i.style.edgeOnly,
          ]),
    );
    if (!pending.length) {
      setRemoving(false);
      return;
    }
    setRemoving(true);
    const timer = setTimeout(async () => {
      for (const item of pending) {
        try {
          const key = JSON.stringify([
            item.svg,
            item.image,
            item.style.bgTolerance,
            item.style.bgRemoveMode,
            item.style.bgRemoveColor,
            item.style.edgeOnly,
          ]);
          const processedImage = await removeBackground(item);
          if (!live) return;
          setItems((list) =>
            list.map((i) =>
              i.id === item.id
                ? { ...i, processedImage, processedKey: key }
                : i,
            ),
          );
        } catch {
          if (!live) return;
          notify(
            item.style.bgRemoveMode === "smart"
              ? "Smart removal unavailable. Switched to edge detection."
              : "Background could not be removed.",
          );
          setItems((list) =>
            list.map((i) =>
              i.id === item.id
                ? {
                    ...i,
                    style: {
                      ...i.style,
                      removeBg: item.style.bgRemoveMode === "smart",
                      bgRemoveMode: "auto",
                    },
                  }
                : i,
            ),
          );
        }
      }
    }, 180);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [items]);
  const addItems = (incoming) => {
    const current = itemsRef.current;
    if (current.length + incoming.length > 200) {
      notify(
        "A workspace can hold up to 200 icons. Export or start a new project first.",
      );
      return;
    }
    const names = uniqueNames(
      incoming.map((i) => i.name),
      current.map((i) => i.name),
    );
    const added = incoming.map((i, index) => ({ ...i, name: names[index] }));
    commit([...current, ...added]);
    setSelected(added.map((i) => i.id));
    setActiveId(added[0]?.id);
    if (added.length > 1) setBatch(true);
  };
  const addIcon = async (icon) => {
    try {
      const svg = await getIcon(icon);
      addItems([
        newItem(
          { name: icon.name, svg, source: icon.prefix, animated: false },
          cleanStyle(active?.style || defaultLook()),
        ),
      ]);
      notify(`Added ${icon.title || icon.name}`);
    } catch (e) {
      notify(e.message);
    }
  };
  const importFiles = async (files) => {
    const incoming = [],
      errors = [];
    for (const file of [...files]) {
      try {
        if (file.size > 20 * 1024 * 1024)
          throw new Error(`${file.name}: maximum file size is 20 MB.`);
        if (/\.svg$/i.test(file.name) || file.type === "image/svg+xml") {
          incoming.push(
            newItem(
              {
                name: file.name,
                svg: sanitizeSvg(await file.text()),
                source: "Imported",
                animated: false,
              },
              cleanStyle(active?.style || defaultLook()),
            ),
          );
        } else if (/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type)) {
          const image = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = reject;
            r.readAsDataURL(file);
          });
          incoming.push(
            newItem(
              { name: file.name, image, source: "Imported" },
              cleanStyle(active?.style || defaultLook()),
            ),
          );
        } else errors.push(file.name);
      } catch (e) {
        errors.push(e.message);
      }
    }
    if (incoming.length) addItems(incoming);
    notify(
      errors.length
        ? `Imported ${incoming.length}. Skipped: ${errors.slice(0, 3).join(", ")}`
        : `Imported ${incoming.length} icon${incoming.length === 1 ? "" : "s"}`,
    );
  };
  const saveProject = () => {
    if (desktop) {
      setModal("archive");
      return;
    }
    download(
      new Blob([JSON.stringify({ version: 2, items }, null, 2)], {
        type: "application/json",
      }),
      "icon-studio.iconstudio",
    );
    notify("Project saved. Open it here to continue editing.");
  };
  const openProject = async (file) => {
    try {
      if (file.size > 100 * 1024 * 1024)
        throw new Error("Project is too large (maximum 100 MB).");
      const next = validateProject(JSON.parse(await file.text())).map((i) => ({
        ...i,
        svg: i.svg ? sanitizeSvg(i.svg) : "",
      }));
      if (!next.length) throw new Error("This project is empty.");
      const names = uniqueNames(next.map((i) => i.name));
      commit(next.map((i, n) => ({ ...i, name: names[n] })));
      setSelected([next[0].id]);
      setActiveId(next[0].id);
      notify("Project opened. Your previous workspace is available with Undo.");
    } catch (e) {
      notify(e.message);
    }
  };
  const removeSelected = () => {
    commit(itemsRef.current.filter((i) => !targetIds.includes(i.id)));
    notify("Icons removed · Undo to restore");
  };
  const duplicate = () => {
    addItems(
      items
        .filter((i) => targetIds.includes(i.id))
        .map((i) => ({
          ...i,
          id: crypto.randomUUID(),
          name: i.name + " copy",
        })),
    );
    notify("Selection duplicated");
  };
  const choose = (item, event) => {
    setActiveId(item.id);
    if (event?.shiftKey && selected.length) {
      const start = items.findIndex((i) => i.id === activeId),
        end = items.indexOf(item);
      setSelected(
        items
          .slice(Math.min(start, end), Math.max(start, end) + 1)
          .map((i) => i.id),
      );
    } else if (batch || event?.metaKey || event?.ctrlKey)
      setSelected((ids) =>
        ids.includes(item.id)
          ? ids.filter((id) => id !== item.id)
          : [...ids, item.id],
      );
    else setSelected([item.id]);
  };
  const copySvg = async () => {
    try {
      await navigator.clipboard.writeText(buildSvg(active));
      notify("SVG copied to clipboard");
    } catch {
      notify("Clipboard access unavailable. Export SVG instead.");
    }
  };
  const paste = async () => {
    try {
      const data = await navigator.clipboard.read();
      const files = [];
      for (const item of data)
        for (const type of item.types) {
          if (type.startsWith("image/"))
            files.push(
              new File(
                [await item.getType(type)],
                "pasted-image." + type.split("/")[1],
                { type },
              ),
            );
          else if (type === "text/plain") {
            const text = await (await item.getType(type)).text();
            if (text.includes("<svg"))
              files.push(
                new File([text], "pasted-icon.svg", { type: "image/svg+xml" }),
              );
          }
        }
      if (files.length) importFiles(files);
      else notify("Copy an image or SVG first, then paste here.");
    } catch {
      notify("Press Ctrl+V or ⌘V to paste an image or SVG.");
    }
  };
  useEffect(() => {
    const handle = (e) => {
      if (
        /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) ||
        e.target.isContentEditable ||
        modal
      )
        return;
      const mod = e.ctrlKey || e.metaKey;
      if (matchesShortcut(e, shortcut)) {
        e.preventDefault();
        setModal("search");
      } else if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(items.map((i) => i.id));
        setBatch(true);
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveProject();
      } else if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        duplicate();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        removeSelected();
      } else if (e.key === "F2") {
        e.preventDefault();
        setModal("rename");
      } else if (e.key === "/" || (mod && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setShowLibrary(true);
        searchInput.current?.focus();
      } else if (e.key === "Escape") {
        setSelected(active ? [active.id] : []);
        setBatch(false);
      }
    };
    const onPaste = (e) => {
      if (/INPUT|TEXTAREA/.test(e.target.tagName) || modal) return;
      const text = e.clipboardData?.getData("text/plain");
      const files = [...(e.clipboardData?.files || [])];
      if (text?.includes("<svg"))
        files.push(
          new File([text], "pasted-icon.svg", { type: "image/svg+xml" }),
        );
      if (files.length) {
        e.preventDefault();
        importFiles(files);
      }
    };
    window.addEventListener("keydown", handle);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("keydown", handle);
      window.removeEventListener("paste", onPaste);
    };
  });
  const onDrop = async (e) => {
    e.preventDefault();
    setDragging(false);
    const name = e.dataTransfer.getData("application/icon-studio");
    if (name) {
      const icon = [...library, ...results].find((i) => i.fullName === name);
      if (icon) addIcon(icon);
    } else if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files);
    else {
      const text = e.dataTransfer.getData("text/plain");
      if (text.includes("<svg"))
        importFiles([
          new File([text], "dropped-icon.svg", { type: "image/svg+xml" }),
        ]);
    }
  };
  const visibleResults =
    tabName === "favorites"
      ? results.filter((i) => favorites.includes(i.fullName))
      : results;
  const s = active?.style || defaultLook();
  const slider = (key, label, min, max, step = 1, suffix = "") => (
    <Slider
      label={label}
      value={s[key]}
      min={min}
      max={max}
      step={step}
      suffix={suffix}
      mixed={mixed(key)}
      onChange={(v) => change(key, v)}
    />
  );
  const toggle = (key, label, hint) => (
    <Toggle
      label={label}

      checked={s[key]}
      mixed={mixed(key)}
      onChange={(v) => change(key, v)}
    />
  );
  useEffect(() => {
    try {
      localStorage.setItem("icon-studio-theme", theme);
    } catch {}
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    writeLooks(looks);
  }, [looks]);
  useEffect(() => {
    if (!desktop) return;
    let live = true,
      checking = false;
    const check = async () => {
      if (checking || !ready) return;
      checking = true;
      try {
        const ctx = await desktop.context();
        if (!live) return;
        setProjectContext((previous) =>
          previous?.id === ctx.project?.id ? previous : ctx.project,
        );
        if (ctx.project?.id !== nativeProjectRef.current?.id) {
          nativeSwitching.current = true;
          if (nativeProjectRef.current)
            await desktop.saveWorkspace(nativeProjectRef.current.id, {
              version: 2,
              items: itemsRef.current,
            });
          nativeProjectRef.current = ctx.project;
          setProjectContext(ctx.project);
          const saved = ctx.project
            ? await desktop.loadWorkspace(ctx.project.id)
            : null;
          if (!live) return;
          const next = saved?.items?.length
            ? validateProject(saved).map((i) => ({
                ...i,
                svg: i.svg ? sanitizeSvg(i.svg) : "",
              }))
            : [{ ...seed(), style: { ...defaults, ...ctx.look } }];
          setItems(next);
          itemsRef.current = next;
          setSelected([next[0].id]);
          setActiveId(next[0].id);
          setPast([]);
          setFuture([]);
          setNativeFile(null);
          nativeSwitching.current = false;
        }
      } catch (error) {
        if (live) setProjectContext(null);
      } finally {
        checking = false;
      }
    };
    const timer = setInterval(check, 1800);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [ready]);
  useEffect(() => {
    if (!desktop || !active || !ready || !projectContext || removing) return;
    const generation = ++nativeFileGeneration.current;
    setNativeFile(null);
    const timer = setTimeout(async () => {
      try {
        const blob = await renderPng(active);
        const file = await desktop.prepareIcon({
          name: active.name,
          item: active,
          projectId: projectContext.id,
          bytes: await blob.arrayBuffer(),
        });
        if (generation === nativeFileGeneration.current) setNativeFile(file);
      } catch (error) {
        if (!/Choose a generated|folder/i.test(error.message))
          notify(error.message);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      nativeFileGeneration.current++;
    };
  }, [active, ready, projectContext, removing]);
  const saveLook = async (name) => {
    const look = {
      id: crypto.randomUUID(),
      name: safeName(name),
      style: cleanStyle(s),
    };
    setLooks((list) => [...list, look]);
    localStorage.setItem(
      "icon-studio-default-look",
      JSON.stringify(look.style),
    );
    if (desktop && projectContext)
      await desktop.setProjectLook(projectContext.id, look.style);
    notify("Look saved");
  };
  const applyLook = async (look) => {
    applyStyle(look.style);
    localStorage.setItem(
      "icon-studio-default-look",
      JSON.stringify(look.style),
    );
    if (desktop && projectContext)
      await desktop.setProjectLook(projectContext.id, look.style);
    notify(`${look.name} applied`);
  };
  const generateNative = async (kind) => {
    if (removing) {
      notify("Background removal is still processing");
      return;
    }
    setBusy(kind);
    try {
      const ctx = await desktop.context();
      if (!ctx.project || ctx.project.id !== projectContext?.id)
        throw new Error(
          "Resolve project changed. Try again after the panel updates.",
        );
      if (kind === "pool" && chosen.length > 1) {
        const generated = [];
        for (const item of chosen) {
          const png = await renderPng(item);
          const prepared = await desktop.prepareIcon({
            name: item.name,
            item,
            projectId: ctx.project.id,
            bytes: await png.arrayBuffer(),
          });
          generated.push(await desktop.generate(prepared.id));
        }
        const result = await desktop.batchImport(
          generated.map((file) => file.id),
          ctx.project.id,
        );
        notify(`Added ${result.imported} icons to Media Pool`);
        return;
      }
      let file = nativeFile;
      if (!file) {
        const blob = await renderPng(active);
        file = await desktop.prepareIcon({
          name: active.name,
          item: active,
          projectId: ctx.project.id,
          bytes: await blob.arrayBuffer(),
        });
      }
      const saved = await desktop.generate(file.id);
      setNativeFile(file);
      let insertion;
      if (kind === "pool" || kind === "timeline")
        insertion = await desktop.archiveAction(kind, saved.id);
      if (kind === "download") await desktop.downloadGenerated(saved.id);
      notify(
        kind === "timeline"
          ? `Added to timeline${insertion?.trackIndex ? ` · V${insertion.trackIndex}` : ""}`
          : kind === "pool"
            ? "Added to Media Pool"
            : "PNG saved",
      );
    } catch (error) {
      notify(error.message);
      if (/folder/i.test(error.message)) setModal("settings");
    } finally {
      setBusy(null);
    }
  };
  const previewSize = Math.round(
    (desktop
      ? Math.max(
          80,
          Math.min(
            240,
            viewportSize.width - (viewportSize.width < 720 ? 90 : 370),
            viewportSize.height - 380,
          ),
        )
      : 280) * zoom,
  );
  return (
    <div
      className="app"
      data-theme={theme}
      data-desktop={!!desktop}
      data-inspector-open={showInspector}
      data-library-open={showLibrary}
      onDragOver={(e) => {
        e.preventDefault();
        if (
          e.dataTransfer.types.includes("Files") ||
          e.dataTransfer.types.includes("application/icon-studio")
        )
          setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
      }}
      onDrop={onDrop}
    >
      <LibraryAnnouncement desktop={desktop} notify={notify} onReady={() => searchIcons(query, prefix, false).then(setResults)} />
      <input
        ref={fileInput}
        className="hidden"
        type="file"
        accept=".svg,.png,.jpg,.jpeg,.webp,.gif,.avif"
        multiple
        onChange={(e) => {
          importFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={projectInput}
        className="hidden"
        type="file"
        accept=".iconstudio,.json"
        onChange={(e) => {
          if (e.target.files[0]) openProject(e.target.files[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={presetInput}
        className="hidden"
        type="file"
        accept=".json,.iconlooks"
        onChange={async (e) => {
          try {
            if (e.target.files[0]) {
              const incoming = parseLooks(
                JSON.parse(await e.target.files[0].text()),
              );
              setLooks((list) => [...list, ...incoming]);
              notify("Presets imported");
            }
          } catch (error) {
            notify(error.message);
          } finally {
            e.target.value = "";
          }
        }}
      />
      <header className="app-header">
        <a className="brand" href="/" onClick={(e) => e.preventDefault()}>
          <span className="brand-symbol">
            <Sparkles size={21} />
          </span>
          <span className="brand-label">
            <strong>Icon Studio</strong>
            <small>by Sakib</small>
          </span>
        </a>
        <div className="header-center">
          {desktop ? (
            <span className="resolve-context">
              {projectContext?.name || "Open a Resolve project"}
            </span>
          ) : (
            <>
              <span className="status-dot" />
              {saveStatus}
            </>
          )}
        </div>
        <div className="header-actions">
          {desktop && (
            <button
              className={`icon-button pin-button ${alwaysOnTop ? "active" : ""}`}
              aria-label="Always on top"
              title="Always on top"
              aria-pressed={alwaysOnTop}
              onClick={async () => {
                try {
                  setAlwaysOnTop(await desktop.setAlwaysOnTop(!alwaysOnTop));
                } catch (error) {
                  notify(error.message);
                }
              }}
            >
              <Pin size={16} />
            </button>
          )}
          <button
            className="icon-button"
            aria-label="Quick icon search"
            title={`Quick icon search · ${shortcutLabel(shortcut)}`}
            onClick={() => setModal("search")}
          >
            <Search size={17} />
          </button>
          <button
            className="icon-button"
            aria-label={
              theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            }
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            className="quiet-button project-button"
            aria-label="Project"
            title="Project"
            onClick={() => setModal("project")}
          >
            <FolderOpen size={16} />
            <span>Project</span>
            <ChevronDown size={12} />
          </button>
          <button
            className="icon-button"
            aria-label="Help and shortcuts"
            onClick={() => setModal("help")}
          >
            <HelpCircle size={18} />
          </button>
          <button
            className="quiet-button look-button"
            onClick={() => setModal("looks")}
            aria-label="Style presets"
            title="Saved looks"
          >
            <Bookmark size={16} />
            <span>Looks</span>
          </button>
          {desktop && (
            <button
              className="icon-button"
              onClick={() => setModal("archive")}
              aria-label="Generated icons archive"
            >
              <Archive size={17} />
            </button>
          )}
          <button
            className="icon-button"
            onClick={() => setModal("settings")}
            aria-label="Settings"
          >
            <Settings size={17} />
          </button>
          {!desktop && (
            <a
              className="secondary-button resolve-download-button"
              href={releaseUrl}
              title="Download Resolve script"
              aria-label="Download Resolve script"
            >
              <Film size={16} />
              <span className="button-label">Resolve script</span>
            </a>
          )}
          <span className="divider" />
          <button
            className="primary-button"
            aria-label="Export icons"
            title="Export icons"
            disabled={!active || busy}
            onClick={() => setModal("export")}
          >
            <Download size={16} />
            <span>Export</span>
            <ChevronDown size={13} />
          </button>
        </div>
      </header>
      <div className={`workspace ${showLibrary ? "" : "library-hidden"}`}>
        <button
          className="panel-backdrop"
          aria-label="Close side panels"
          onClick={() => {
            setShowLibrary(false);
            if (window.innerWidth < 720) setShowInspector(false);
          }}
        />
        {showLibrary && (
          <aside className="library-panel">
            <div className="library-heading">
              <div>
                <h2>Library</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Hide library"
                onClick={() => setShowLibrary(false)}
              >
                <PanelLeftClose size={17} />
              </button>
            </div>
            <div className="search-box">
              <Search size={16} />
              <input
                ref={searchInput}
                aria-label="Search icon library"
                placeholder="Search icons…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query ? (
                <button aria-label="Clear search" onClick={() => setQuery("")}>
                  <X size={13} />
                </button>
              ) : (
                <kbd>/</kbd>
              )}
            </div>
            <div className="library-tabs">
              <button
                className={tabName === "library" ? "active" : ""}
                onClick={() => setTabName("library")}
              >
                Explore
              </button>
              <button
                className={tabName === "favorites" ? "active" : ""}
                onClick={() => setTabName("favorites")}
              >
                <Heart size={13} />
                Favorites
              </button>
              <button
                className={tabName === "imports" ? "active" : ""}
                onClick={() => setTabName("imports")}
              >
                Imports
              </button>
            </div>
            {tabName !== "imports" ? (
              <>
                <div className="library-filters">
                  <select
                    aria-label="Icon collection"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                  >
                    {collections.map((c) => (
                      <option key={c.id} value={c.prefix}>
                        {c.name
                          .replace(/[🍏🎬]/g, "")
                          .replace(" (200k+)", "")
                          .replace(" (350+)", "")
                          .trim()}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="library-caption">
                  <span>
                    {query
                      ? "Search results"
                      : tabName === "favorites"
                        ? "Your favorites"
                        : "Icons"}
                  </span>
                  {searchBusy ? (
                    <Loader2 size={13} className="spinning" />
                  ) : (
                    <span>{visibleResults.length} icons</span>
                  )}
                </div>
                <div className="icon-library">
                  {visibleResults.map((icon) => (
                    <div key={icon.fullName} className="library-icon-wrap">
                      <button
                        className="library-icon"
                        title={`Add ${icon.title || icon.name}`}
                        aria-label={`Add ${icon.title || icon.name}`}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(
                            "application/icon-studio",
                            icon.fullName,
                          );
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        onClick={() => addIcon(icon)}
                      >
                        <img
                          loading="lazy"
                          className={icon.isColor ? "color-icon" : ""}
                          alt=""
                          src={
                            icon.rawSvg
                              ? dataSvg(
                                  sanitizeSvg(icon.rawSvg).replace(
                                    /#FFFFFF|#ffffff|currentColor/g,
                                    "#474954",
                                  ),
                                )
                              : `${"https://api.iconify.design"}/${icon.prefix}/${icon.name}.svg?color=%23474954`
                          }
                        />
                        <span>
                          {icon.name.replace(/^lucide-|^useanim-/, "")}
                        </span>
                      </button>
                      <button
                        className={`favorite-button ${favorites.includes(icon.fullName) ? "chosen" : ""}`}
                        aria-label={`${favorites.includes(icon.fullName) ? "Unfavorite" : "Favorite"} ${icon.name}`}
                        onClick={() =>
                          setFavorites((f) =>
                            f.includes(icon.fullName)
                              ? f.filter((n) => n !== icon.fullName)
                              : [...f, icon.fullName],
                          )
                        }
                      >
                        <Heart size={11} />
                      </button>
                      <div className="library-actions">
                        <button
                          title="Copy SVG"
                          aria-label={`Copy ${icon.name} SVG`}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                await getIcon(icon),
                              );
                              notify("SVG copied");
                            } catch (e) {
                              notify(e.message);
                            }
                          }}
                        >
                          <Copy size={10} />
                        </button>
                        <button
                          title="Download SVG"
                          aria-label={`Download ${icon.name} SVG`}
                          onClick={async () => {
                            try {
                              const saved = await download(
                                new Blob([await getIcon(icon)], {
                                  type: "image/svg+xml",
                                }),
                                `${icon.name}.svg`,
                              );
                              if (saved) notify("SVG downloaded");
                            } catch (e) {
                              notify(e.message);
                            }
                          }}
                        >
                          <Download size={10} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {!visibleResults.length && (
                    <div className="empty-library">
                      <Search size={24} />
                      <p>
                        {tabName === "favorites"
                          ? "Your favorites live here."
                          : "No icons found."}
                      </p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="imports-panel">
                {items
                  .filter((i) => i.source === "Imported")
                  .map((i) => (
                    <button
                      className="import-row"
                      key={i.id}
                      onClick={(e) => choose(i, e)}
                    >
                      <Preview item={i} size={40} paused />
                      <span>{i.name}</span>
                    </button>
                  ))}
                <button
                  className="import-empty"
                  onClick={() => fileInput.current.click()}
                >
                  <Upload size={24} />
                  <strong>Bring your own.</strong>
                  <span>SVG, PNG, JPG, WebP, GIF or AVIF</span>
                </button>
                <button className="quiet-button" onClick={paste}>
                  <Clipboard size={15} />
                  Paste image or SVG
                </button>
              </div>
            )}
            <button
              className="import-drop"
              onClick={() => fileInput.current.click()}
            >
              <span className="upload-square">
                <Upload size={17} />
              </span>
              <span>
                <strong>Import icons</strong>
                <small>SVG, PNG, JPG, WebP</small>
              </span>
              <Plus size={15} />
            </button>
          </aside>
        )}
        <main className="main-panel">
          <div className="canvas-toolbar">
            <div className="canvas-title">
              {!showLibrary && (
                <button
                  className="icon-button"
                  aria-label="Show library"
                  onClick={() => setShowLibrary(true)}
                >
                  <PanelLeftOpen size={17} />
                </button>
              )}
              <span>Workspace</span>
              <ChevronRight size={13} />
              <strong>{active?.name || "New icon"}</strong>
              {targetIds.length > 1 && (
                <span className="selection-badge">
                  {targetIds.length} selected
                </span>
              )}
            </div>
            <div className="history-controls">
              <button
                className="icon-button inspector-toggle"
                aria-label={showInspector ? "Hide inspector" : "Show inspector"}
                title="Inspector"
                onClick={() => setShowInspector((value) => !value)}
              >
                {showInspector ? (
                  <PanelRightClose size={17} />
                ) : (
                  <PanelRightOpen size={17} />
                )}
              </button>
              <button
                className="icon-button"
                disabled={!past.length}
                aria-label="Undo"
                title="Undo · Ctrl/⌘ Z"
                onClick={undo}
              >
                <Undo2 size={17} />
              </button>
              <button
                className="icon-button"
                disabled={!future.length}
                aria-label="Redo"
                title="Redo · Ctrl/⌘ Shift Z"
                onClick={redo}
              >
                <Redo2 size={17} />
              </button>
              <span className="divider" />
              <button
                className="icon-button"
                aria-label="Workspace options"
                onClick={() => setModal("project")}
              >
                <MoreHorizontal size={19} />
              </button>
            </div>
          </div>
          <section
            className={`stage stage-${theme} ${stageBg === "checker" ? "stage-checker" : ""}`}
            aria-label="Icon canvas"
            onWheel={(e) => {
              if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                setZoom((z) =>
                  Math.min(1.7, Math.max(0.4, z - e.deltaY * 0.002)),
                );
              }
            }}
          >
            {active ? (
              <>
                <div
                  className={`stage-art ${desktop && nativeFile ? "native-drag-ready" : ""}`}
                  title={
                    desktop
                      ? "Drag PNG to Resolve, Explorer or Finder"
                      : undefined
                  }
                  draggable={!!desktop && !!nativeFile && !removing}
                  onDragStart={(e) => {
                    if (desktop && nativeFile) {
                      e.preventDefault();
                      desktop.dragPrepared(nativeFile.id);
                    }
                  }}
                  style={{ minHeight: Math.max(280, previewSize) }}
                >
                  <Preview item={active} size={previewSize} paused />
                </div>
                <div className="stage-name">
                  <button onClick={() => setModal("rename")}>
                    {active.name}
                    <Type size={12} />
                  </button>
                </div>
                <div className="stage-actions">
                  <button
                    className="quick-png"
                    aria-label="Download PNG"
                    title="Download PNG"
                    disabled={!!busy}
                    onClick={async () => {
                      setBusy("png");
                      try {
                        if (desktop) {
                          await generateNative("download");
                          return;
                        }
                        download(await renderPng(active), `${active.name}.png`);
                        notify("PNG downloaded");
                      } catch (e) {
                        notify(e.message);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    <Download size={14} />
                    <span className="button-label">Download PNG</span>
                  </button>
                  <span />
                  <button
                    onClick={copySvg}
                    aria-label="Copy SVG"
                    title="Copy SVG"
                  >
                    <Copy size={14} />
                    <span className="button-label">Copy SVG</span>
                  </button>
                  <span />
                  <button
                    aria-label="Copy PNG"
                    title="Copy PNG"
                    onClick={async () => {
                      try {
                        const blob = await renderPng(active);
                        if (!window.ClipboardItem) throw new Error();
                        await navigator.clipboard.write([
                          new ClipboardItem({ "image/png": blob }),
                        ]);
                        notify("PNG image copied");
                      } catch {
                        notify(
                          "Image clipboard unavailable. Export PNG instead.",
                        );
                      }
                    }}
                  >
                    <ImageIcon size={14} />
                    <span className="button-label">Copy PNG</span>
                  </button>
                  {desktop && (
                    <>
                      <span />
                      <div className="resolve-actions">
                        <button
                          className="native-insert"
                          aria-label={
                            chosen.length > 1
                              ? "Add selected icons to Media Pool"
                              : "Add icon to Media Pool"
                          }
                          title={
                            chosen.length > 1
                              ? `Add ${chosen.length} selected icons to Media Pool`
                              : "Add icon to Media Pool"
                          }
                          disabled={!!busy || removing || !projectContext}
                          onClick={() => generateNative("pool")}
                        >
                          <Film size={14} />
                          <span className="button-label">
                            Media Pool
                            {chosen.length > 1 ? ` (${chosen.length})` : ""}
                          </span>
                        </button>
                        <button
                          className="native-insert"
                          aria-label="Add icon to timeline"
                          title="Add icon to timeline"
                          disabled={!!busy || removing || !projectContext}
                          onClick={() => generateNative("timeline")}
                        >
                          <ListVideo size={14} />
                          <span className="button-label">Timeline</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
                <div className="preview-presets">
                  <div>
                    {presets.slice(0, 4).map((p) => (
                      <button
                        key={p.name}
                        title={`Apply ${p.name} palette`}
                        aria-label={`Apply ${p.name} palette`}
                        onClick={() =>
                          applyStyle({
                            bgType: "gradient",
                            bgColor1: p.colors[0],
                            bgColor2: p.colors[1],
                          })
                        }
                      >
                        <span
                          style={{
                            background: `linear-gradient(145deg,${p.colors[0]},${p.colors[1]})`,
                          }}
                        />
                        <small>{p.name}</small>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="stage-empty">
                <Sparkles size={40} />
                <h2>Drop icons here</h2>
                <button
                  className="primary-button"
                  onClick={() => fileInput.current.click()}
                >
                  <Upload size={16} />
                  Import icons
                </button>
              </div>
            )}
            <div className="stage-bottom">
              <div className="zoom-control">
                <button
                  aria-label="Zoom out"
                  onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
                >
                  −
                </button>
                <button aria-label="Reset zoom" onClick={() => setZoom(1)}>
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  aria-label="Zoom in"
                  onClick={() => setZoom((z) => Math.min(1.7, z + 0.1))}
                >
                  +
                </button>
              </div>
              <div className="stage-view">
                <button
                  className={theme === "light" ? "active" : ""}
                  aria-label="Light mode"
                  onClick={() => setTheme("light")}
                >
                  <Sun size={15} />
                </button>
                <button
                  className={theme === "dark" ? "active" : ""}
                  aria-label="Dark mode"
                  onClick={() => setTheme("dark")}
                >
                  <Moon size={15} />
                </button>
                <button
                  className={stageBg === "checker" ? "active" : ""}
                  aria-label="Transparency preview"
                  onClick={() =>
                    setStageBg((bg) => (bg === "checker" ? "plain" : "checker"))
                  }
                >
                  <Grid2X2 size={15} />
                </button>
              </div>
            </div>
          </section>
          <section className="collection-panel" aria-label="Icon collection">
            <div className="collection-header">
              <div>
                <Layers size={16} />
                <h2>Collection</h2>
                <span className="count">{items.length}</span>
              </div>
              <div>
                <button
                  className={`quiet-button ${batch ? "accent" : ""}`}
                  aria-label={batch ? "Done selecting" : "Select icons"}
                  title={batch ? "Done selecting" : "Select icons"}
                  onClick={() => {
                    setBatch(!batch);
                    if (batch) setSelected(active ? [active.id] : []);
                  }}
                >
                  <CheckCheck size={15} />
                  <span className="button-label">
                    {batch ? "Done selecting" : "Select"}
                  </span>
                </button>
                <button
                  className="quiet-button"
                  aria-label="Rename selected icons"
                  title="Rename selected icons"
                  disabled={!targetIds.length}
                  onClick={() => setModal("rename")}
                >
                  <Type size={14} />
                  <span className="button-label">Rename</span>
                </button>
                <button
                  className="icon-button"
                  aria-label="Duplicate selected icons"
                  disabled={!targetIds.length}
                  onClick={duplicate}
                >
                  <Copy size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Remove selected icons"
                  disabled={!targetIds.length}
                  onClick={removeSelected}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            {batch && (
              <div className="batch-bar">
                <span>{targetIds.length} selected</span>
                <button onClick={() => setSelected(items.map((i) => i.id))}>
                  Select all
                </button>
                <button onClick={() => setSelected([])}>Clear</button>
              </div>
            )}
            <div className="collection-strip">
              {items.map((item) => (
                <button
                  key={item.id}
                  className={`collection-item ${selected.includes(item.id) ? "selected" : ""} ${activeId === item.id ? "current" : ""}`}
                  aria-label={`Select ${item.name}`}
                  aria-pressed={selected.includes(item.id)}
                  onClick={(e) => choose(item, e)}
                >
                  {batch && (
                    <span className="item-check">
                      {selected.includes(item.id) && <Check size={11} />}
                    </span>
                  )}
                  <Preview item={item} size={66} paused />
                  <span>{item.name}</span>
                </button>
              ))}
              <button
                className="collection-add"
                onClick={() => fileInput.current.click()}
                aria-label="Import more icons"
              >
                <Plus size={23} />
                <span className="button-label">Add icons</span>
              </button>
            </div>
          </section>
        </main>
        <aside className="inspector">
          <div className="inspector-heading">
            <h2>{targetIds.length > 1 ? "Selection" : "Inspector"}</h2>
            <span>
              {targetIds.length > 1
                ? `${targetIds.length} icons`
                : "Live preview"}
            </span>
            <button
              className="icon-button inspector-close"
              aria-label="Close inspector"
              onClick={() => setShowInspector(false)}
            >
              <X size={16} />
            </button>
          </div>
          <div className="inspector-tabs">
            <button
              className={panel === "appearance" ? "active" : ""}
              onClick={() => setPanel("appearance")}
            >
              <SlidersHorizontal size={15} />
              Style
            </button>
            <button
              className={panel === "glyph" ? "active" : ""}
              onClick={() => setPanel("glyph")}
            >
              <Sparkles size={15} />
              Glyph
            </button>
          </div>
          <div className="inspector-scroll">
            {active ? (
              <>
                {targetIds.length > 1 && (
                  <div className="selection-info">
                    <Layers size={15} />
                    {targetIds.length} selected
                  </div>
                )}
                {panel === "appearance" && (
                  <>
                    <section className="control-section">
                      <h3>Background</h3>
                      <Segment
                        label="Background type"
                        value={s.bgType}
                        options={["solid", "gradient", ["transparent", "None"]]}
                        onChange={(v) => change("bgType", v)}
                      />
                      {s.bgType !== "transparent" && (
                        <>
                          <div className="colors">
                            <Color
                              label={
                                s.bgType === "gradient"
                                  ? "Start color"
                                  : "Color"
                              }
                              value={s.bgColor1}
                              mixed={mixed("bgColor1")}
                              onChange={(v) => change("bgColor1", v)}
                            />
                            {s.bgType === "gradient" && (
                              <Color
                                label="End color"
                                value={s.bgColor2}
                                mixed={mixed("bgColor2")}
                                onChange={(v) => change("bgColor2", v)}
                              />
                            )}
                          </div>
                          {s.bgType === "gradient" &&
                            slider("bgAngle", "Gradient angle", 0, 360, 1, "°")}
                        </>
                      )}
                      <h4>Palettes</h4>
                      <div className="palette-grid">
                        {presets.map((p) => (
                          <button
                            aria-label={`Use ${p.name} colors`}
                            title={p.name}
                            key={p.name}
                            style={{
                              background: `linear-gradient(145deg,${p.colors[0]},${p.colors[1]})`,
                            }}
                            onClick={() =>
                              applyStyle({
                                bgType: "gradient",
                                bgColor1: p.colors[0],
                                bgColor2: p.colors[1],
                              })
                            }
                          >
                            {s.bgColor1 === p.colors[0] && <Check size={14} />}
                          </button>
                        ))}
                      </div>
                      <details className="disclosure">
                        <summary>
                          Solid colors
                          <ChevronDown size={12} />
                        </summary>
                        <div className="palette-grid">
                          {[
                            "#ff3b30",
                            "#ff9500",
                            "#ffcc00",
                            "#34c759",
                            "#00c7be",
                            "#30b0c7",
                            "#32ade6",
                            "#007aff",
                            "#5856d6",
                            "#af52de",
                            "#ff2d55",
                            "#8e8e93",
                            "#000000",
                            "#ffffff",
                          ].map((c) => (
                            <button
                              key={c}
                              title={c}
                              aria-label={`Use ${c}`}
                              style={{ background: c }}
                              onClick={() =>
                                applyStyle({ bgType: "solid", bgColor1: c })
                              }
                            />
                          ))}
                        </div>
                      </details>
                    </section>
                    <section className="control-section">
                      <h3>Shape & finish</h3>
                      {slider("borderRadius", "Corner radius", 0, 50, 0.5, "%")}
                      <div className="mini-presets">
                        <button onClick={() => change("borderRadius", 0)}>
                          Square
                        </button>
                        <button onClick={() => change("borderRadius", 22.5)}>
                          Squircle
                        </button>
                        <button onClick={() => change("borderRadius", 50)}>
                          Circle
                        </button>
                      </div>
                      {toggle(
                        "enableShadow",
                        "Soft shadow",
                        "A little lift from the canvas",
                      )}
                      {toggle(
                        "enableInnerLight",
                        "Light edge",
                        "A subtle highlight around the shape",
                      )}
                      <details className="disclosure">
                        <summary>
                          More effects
                          <ChevronDown size={12} />
                        </summary>
                        {toggle(
                          "enableBevel",
                          "Inset bevel",
                          "Monterey-inspired depth",
                        )}
                        {toggle("enableGlyphShadow", "Glyph shadow")}
                        {toggle("enableGlow", "Glyph glow")}
                        {s.enableGlow &&
                          slider("glowStrength", "Glow radius", 5, 80, 1)}
                        {toggle("enableOutline", "Glyph outline")}
                        {s.enableOutline &&
                          slider("outlineWidth", "Outline width", 1, 30, 1)}
                        {(s.enableGlow || s.enableOutline) && (
                          <Color
                            label="Effect color"
                            value={s.effectColor}
                            onChange={(v) => change("effectColor", v)}
                          />
                        )}
                        {toggle("enableAmbientLight", "Ambient light")}
                        {toggle("enableVignette", "Vignette")}
                        {toggle("enableGrain", "Grain texture")}
                        {s.enableGrain &&
                          slider("grainAmount", "Grain amount", 1, 25, 1, "%")}
                        {toggle("enableMonochrome", "Monochrome glyph")}
                        {s.enableShadow &&
                          slider(
                            "shadowStrength",
                            "Shadow opacity",
                            0,
                            70,
                            1,
                            "%",
                          )}
                        {slider(
                          "glyphOpacity",
                          "Glyph opacity",
                          10,
                          100,
                          1,
                          "%",
                        )}

                        {toggle(
                          "enableClassicSweep",
                          "Classic gloss",
                          "A curved glass reflection",
                        )}
                      </details>
                    </section>
                  </>
                )}
                {panel === "glyph" && (
                  <>
                    <section className="control-section">
                      <h3>Foreground</h3>
                      <div className="two-buttons">
                        <button
                          className="secondary-button"
                          onClick={() => fileInput.current.click()}
                        >
                          <Upload size={14} />
                          Import
                        </button>
                        <button className="secondary-button" onClick={paste}>
                          <Clipboard size={14} />
                          Paste
                        </button>
                      </div>
                      <h4>Color treatment</h4>
                      <Segment
                        label="Glyph color"
                        value={s.iconColorMode}
                        options={["original", "solid", "gradient"]}
                        onChange={(v) => change("iconColorMode", v)}
                      />
                      {s.iconColorMode !== "original" && (
                        <>
                          <div className="colors">
                            <Color
                              label="Glyph color"
                              value={s.iconColor1}
                              onChange={(v) => change("iconColor1", v)}
                            />
                            {s.iconColorMode === "gradient" && (
                              <Color
                                label="Second color"
                                value={s.iconColor2}
                                onChange={(v) => change("iconColor2", v)}
                              />
                            )}
                          </div>
                          {s.iconColorMode === "gradient" &&
                            slider(
                              "iconAngle",
                              "Glyph gradient angle",
                              0,
                              360,
                              1,
                              "°",
                            )}
                        </>
                      )}
                    </section>
                    <section className="control-section">
                      <h3>Glyph palettes</h3>
                      <div className="palette-grid">
                        {presets.map((p) => (
                          <button
                            key={p.name}
                            title={p.name}
                            aria-label={`Use ${p.name} glyph gradient`}
                            style={{
                              background: `linear-gradient(145deg,${p.colors[0]},${p.colors[1]})`,
                            }}
                            onClick={() =>
                              applyStyle({
                                iconColorMode: "gradient",
                                iconColor1: p.colors[0],
                                iconColor2: p.colors[1],
                              })
                            }
                          />
                        ))}
                      </div>
                      <details className="disclosure">
                        <summary>
                          Solid colors
                          <ChevronDown size={12} />
                        </summary>
                        <div className="palette-grid">
                          {[
                            "#ffffff",
                            "#000000",
                            ...presets.map((p) => p.colors[0]),
                          ].map((c) => (
                            <button
                              key={c}
                              title={c}
                              aria-label={`Use ${c} glyph color`}
                              style={{ background: c }}
                              onClick={() =>
                                applyStyle({
                                  iconColorMode: "solid",
                                  iconColor1: c,
                                })
                              }
                            />
                          ))}
                        </div>
                      </details>
                    </section>
                    <section className="control-section">
                      <h3>Size & position</h3>
                      <Slider
                        label="Glyph size"
                        value={s.iconScale * 100}
                        min={5}
                        max={150}
                        suffix="%"
                        mixed={mixed("iconScale")}
                        onChange={(v) => change("iconScale", v / 100)}
                      />
                      {slider("iconRotation", "Rotation", -180, 180, 1, "°")}
                      {slider("offsetX", "Horizontal offset", -40, 40, 1, "%")}
                      {slider("offsetY", "Vertical offset", -40, 40, 1, "%")}
                      <button
                        className="text-button"
                        onClick={() =>
                          applyStyle({
                            offsetX: 0,
                            offsetY: 0,
                            iconScale: 0.48,
                            iconRotation: 0,
                          })
                        }
                      >
                        <RotateCcw size={13} />
                        Reset placement
                      </button>
                    </section>
                    <section className="control-section">
                      <h3>Background removal</h3>
                      {toggle(
                        "removeBg",
                        "Remove image background",
                        "Works best with a flat background",
                      )}
                      {removing && (
                        <span className="processing-state">
                          <Loader2 size={13} className="spin" /> Removing
                          background…
                        </span>
                      )}
                      {s.removeBg && (
                        <>
                          <select
                            aria-label="Background removal color"
                            value={s.bgRemoveMode}
                            onChange={(e) =>
                              change("bgRemoveMode", e.target.value)
                            }
                          >
                            <option value="smart">Smart foreground (AI)</option>
                            <option value="auto">Detect edge color</option>
                            <option value="white">White background</option>
                            <option value="black">Black background</option>
                            <option value="custom">Choose a color</option>
                          </select>
                          {s.bgRemoveMode === "custom" && (
                            <Color
                              label="Remove color"
                              value={s.bgRemoveColor}
                              onChange={(v) => change("bgRemoveColor", v)}
                            />
                          )}{" "}
                          {slider("bgTolerance", "Tolerance", 0, 180, 1)}
                          {toggle(
                            "edgeOnly",
                            "Connected edges only",
                            "Protect matching colors inside the icon",
                          )}
                        </>
                      )}
                    </section>
                  </>
                )}
                <div className="inspector-reset">
                  <button
                    className="quiet-button"
                    onClick={() => applyStyle(defaults)}
                  >
                    <RotateCcw size={14} />
                    Reset style
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-inspector">
                <Sparkles size={30} />
                <p>Add an icon to begin.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
      {dragging && (
        <div className="drop-overlay">
          <div>
            <Upload size={38} />
            <h2>Drop to import</h2>
            <span>SVG · PNG · JPG · WebP · GIF · AVIF</span>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={13} />
          </button>
        </div>
      )}
      {modal === "rename" && (
        <RenameModal
          items={items}
          selected={targetIds}
          onClose={() => setModal(null)}
          onApply={(rows) => {
            const names = new Map(rows.map((r) => [r.id, r.after]));
            commit(
              items.map((i) =>
                names.has(i.id) ? { ...i, name: names.get(i.id) } : i,
              ),
            );
            setModal(null);
            notify(
              `Renamed ${rows.length} icon${rows.length === 1 ? "" : "s"}`,
            );
          }}
        />
      )}
      {modal === "export" && (
        <ExportModal
          items={items}
          selected={targetIds}
          onClose={() => setModal(null)}
          notify={notify}
          setBusy={setBusy}
        />
      )}
      {modal === "looks" && (
        <Modal title="Saved looks" onClose={() => setModal(null)} wide>
          <LooksPanel
            looks={looks}
            style={s}
            onSave={saveLook}
            onApply={applyLook}
            onDelete={(id) =>
              setLooks((list) => list.filter((v) => v.id !== id))
            }
            onImport={() => presetInput.current.click()}
            onExport={async () => {
              try {
                await download(
                  new Blob(
                    [
                      JSON.stringify(
                        { format: "icon-studio-looks", version: 1, looks },
                        null,
                        2,
                      ),
                    ],
                    { type: "application/json" },
                  ),
                  "Icon Studio.iconlooks",
                );
              } catch (error) {
                notify(error.message);
              }
            }}
          />
        </Modal>
      )}
      {modal === "settings" && (
        <Modal title="Settings" onClose={() => setModal(null)}>
          <SettingsPanel
            shortcut={shortcut}
            setShortcut={setShortcut}
            theme={theme}
            setTheme={setTheme}
            notify={notify}
            onLibraryReady={() => {
              if (desktop)
                setProjectContext((previous) =>
                  previous ? { ...previous } : previous,
                );
              setQuery("");
              setPrefix("");
              searchIcons("", "", false).then(setResults);
            }}
          />
        </Modal>
      )}
      {modal === "search" && (
        <Modal title="Find an icon" onClose={() => setModal(null)} wide>
          <QuickSearch
            shortcut={shortcut}
            onChoose={async (icon) => {
              await addIcon(icon);
              setModal(null);
            }}
          />
        </Modal>
      )}
      {modal === "archive" && desktop && (
        <Modal title="Generated icons" wide onClose={() => setModal(null)}>
          <ArchivePanel
            notify={notify}
            onRestore={(file) => {
              try {
                const restored = validateProject({
                  version: 2,
                  items: [file.item],
                }).map((i) => ({
                  ...i,
                  id: crypto.randomUUID(),
                  svg: i.svg ? sanitizeSvg(i.svg) : "",
                }));
                addItems(restored);
                setModal(null);
              } catch (error) {
                notify(error.message);
              }
            }}
          />
        </Modal>
      )}
      {modal === "project" && (
        <Modal title="Project" onClose={() => setModal(null)}>
          <div className="project-options">
            <button
              onClick={() => {
                if (desktop) {
                  setModal("archive");
                  return;
                }
                saveProject();
                setModal(null);
              }}
            >
              <Save />
              <span>
                <strong>
                  {desktop ? "Generated icons archive" : "Save project"}
                </strong>
              </span>
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => {
                projectInput.current.click();
                setModal(null);
              }}
            >
              <FolderOpen />
              <span>
                <strong>Open project</strong>
              </span>
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => {
                fileInput.current.click();
                setModal(null);
              }}
            >
              <Upload />
              <span>
                <strong>Import icons</strong>
              </span>
              <ChevronRight size={16} />
            </button>
            {!desktop && (
              <a className="resolve-download-row" href={releaseUrl}>
                <Download />
                <span>
                  <strong>Download Resolve panel</strong>
                </span>
                <ChevronRight size={16} />
              </a>
            )}
            <button
              onClick={() => {
                commit([]);
                setSelected([]);
                setActiveId(null);
                setModal(null);
                notify("Fresh workspace · Undo to restore your collection");
              }}
            >
              <Plus />
              <span>
                <strong>New workspace</strong>
              </span>
              <ChevronRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {modal === "help" && (
        <Modal title="Keyboard shortcuts" onClose={() => setModal(null)}>
          <div className="help-content">
            {[
              ["Quick icon search", shortcutLabel(shortcut)],
              ["Search library", "/ or Ctrl/⌘ K"],
              ["Select all", "Ctrl/⌘ A"],
              ["Undo / redo", "Ctrl/⌘ Z / Shift Z"],
              ["Duplicate selection", "Ctrl/⌘ D"],
              ["Save project", "Ctrl/⌘ S"],
              ["Rename selection", "F2"],
              ["Paste image or SVG", "Ctrl/⌘ V"],
              ["Remove selection", "Delete"],
              ["Select a range", "Shift click"],
            ].map(([a, b]) => (
              <div key={a}>
                <span>{a}</span>
                <kbd>{b}</kbd>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

function RenameModal({ items, selected, onApply, onClose }) {
  const [rule, setRule] = useState({
    template: "{name}",
    prefix: "",
    suffix: "",
    find: "",
    replace: "",
    regex: false,
    case: "keep",
    start: 1,
    padding: 2,
    caseSensitive: false,
  });
  const update = (k, v) => setRule((r) => ({ ...r, [k]: v }));
  let rows = [],
    error = "";
  try {
    rows = renamePreview(items, selected, rule);
  } catch {
    error = "Check your regular expression.";
  }
  return (
    <Modal
      title={selected.length === 1 ? "Rename icon" : "Rename icons"}
      wide
      onClose={onClose}
    >
      <div className="rename-layout">
        <div className="rename-controls">
          <label className="form-field">
            <span>
              {selected.length === 1 ? "Name or pattern" : "Name pattern"}
            </span>
            <input
              aria-label="Name pattern"
              value={rule.template}
              onChange={(e) => update("template", e.target.value)}
            />
            <small>
              Use {"{name}"}, {"{original}"}, {"{n}"}, or {"{date}"}.
            </small>
          </label>
          <div className="form-row">
            <label className="form-field">
              <span>Prefix</span>
              <input
                aria-label="Name prefix"
                placeholder="app-"
                value={rule.prefix}
                onChange={(e) => update("prefix", e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Suffix</span>
              <input
                aria-label="Name suffix"
                placeholder="-dark"
                value={rule.suffix}
                onChange={(e) => update("suffix", e.target.value)}
              />
            </label>
          </div>
          <label className="form-field">
            <span>Letter case</span>
            <select
              aria-label="Letter case"
              value={rule.case}
              onChange={(e) => update("case", e.target.value)}
            >
              {[
                ["keep", "Keep original"],
                ["lower", "lowercase"],
                ["upper", "UPPERCASE"],
                ["kebab", "kebab-case"],
                ["snake", "snake_case"],
                ["camel", "camelCase"],
                ["title", "Title Case"],
              ].map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label className="form-field">
              <span>Start number</span>
              <input
                aria-label="Start number"
                type="number"
                min="1"
                value={rule.start}
                onChange={(e) => update("start", e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Number padding</span>
              <select
                aria-label="Number padding"
                value={rule.padding}
                onChange={(e) => update("padding", e.target.value)}
              >
                <option value="0">1, 2, 3</option>
                <option value="2">01, 02, 03</option>
                <option value="3">001, 002, 003</option>
                <option value="4">0001, 0002</option>
              </select>
            </label>
          </div>
          <details className="disclosure">
            <summary>
              Find & replace
              <ChevronDown size={13} />
            </summary>
            <div className="form-row">
              <label className="form-field">
                <span>Find</span>
                <input
                  aria-label="Find in name"
                  value={rule.find}
                  onChange={(e) => update("find", e.target.value)}
                />
              </label>
              <label className="form-field">
                <span>Replace with</span>
                <input
                  aria-label="Replace with"
                  value={rule.replace}
                  onChange={(e) => update("replace", e.target.value)}
                />
              </label>
            </div>
            <Toggle
              label="Regular expression"
              checked={rule.regex}
              onChange={(v) => update("regex", v)}
            />
            {rule.regex && (
              <Toggle
                label="Case sensitive"
                checked={rule.caseSensitive}
                onChange={(v) => update("caseSensitive", v)}
              />
            )}
          </details>
        </div>
        <div className="rename-preview">
          <div className="preview-label">
            <span>BEFORE</span>
            <span>AFTER</span>
          </div>
          {error ? (
            <p className="error">{error}</p>
          ) : (
            rows.map((row) => (
              <div className="rename-preview-row" key={row.id}>
                <span>{row.before}</span>
                <ChevronRight size={13} />
                <strong>{row.after}</strong>
              </div>
            ))
          )}
        </div>
      </div>
      <footer className="modal-footer">
        <button className="secondary-button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="primary-button"
          disabled={!!error || !rows.length || !rule.template.trim()}
          onClick={() => onApply(rows)}
        >
          Apply names
          <Check size={15} />
        </button>
      </footer>
    </Modal>
  );
}
function ExportModal({ items, selected, onClose, notify, setBusy }) {
  const [format, setFormat] = useState("png"),
    [scope, setScope] = useState("selected"),
    [size, setSize] = useState(1024),
    [glyphOnly, setGlyphOnly] = useState(false),
    [working, setWorking] = useState(false),
    [progress, setProgress] = useState(0);
  const targets = items.filter(
    (i) => scope === "all" || selected.includes(i.id),
  );
  const start = async () => {
    setWorking(true);
    setBusy("export");
    try {
      const projectId = desktop ? (await desktop.context()).project?.id : null;
      if (desktop && !projectId) throw Error("Open a Resolve project first.");
      const files = {},
        sizes =
          format === "iconset"
            ? [16, 32, 64, 128, 256, 512, 1024]
            : [Number(size)];
      let done = 0;
      for (const item of targets)
        for (const resolution of sizes) {
          const ext = format === "svg" ? "svg" : "png";
          const blob =
            ext === "svg"
              ? new Blob([buildSvg(item, { size: resolution, glyphOnly })], {
                  type: "image/svg+xml",
                })
              : await renderPng(item, { size: resolution, glyphOnly });
          const path =
            format === "iconset"
              ? `${item.name}/${item.name}-${resolution}.png`
              : `${item.name}.${ext}`;
          files[path] = new Uint8Array(await blob.arrayBuffer());
          if (desktop) {
            const png =
              ext === "png"
                ? blob
                : await renderPng(item, { size: resolution, glyphOnly });
            const preview = await desktop.prepareIcon({
              name:
                format === "iconset" ? `${item.name}-${resolution}` : item.name,
              item,
              projectId,
              bytes: await png.arrayBuffer(),
            });
            const generated = await desktop.generate(preview.id);
            if (ext === "svg")
              await desktop.attachSvg(generated.id, await blob.text());
          }
          setProgress(
            Math.round((++done / (targets.length * sizes.length)) * 100),
          );
        }
      if (format === "iconset")
        for (const item of targets)
          files[`${item.name}/README.txt`] = strToU8(
            "PNG icon sizes: 16–1024 px. SVG is available as a separate export.\n",
          );
      let saved;
      if (targets.length === 1 && format !== "iconset") {
        const key = Object.keys(files)[0];
        saved = await download(
          new Blob([files[key]], {
            type: format === "svg" ? "image/svg+xml" : "image/png",
          }),
          key,
        );
      } else
        saved = await download(
          new Blob([zipSync(files)], { type: "application/zip" }),
          format === "iconset"
            ? "icon-studio-iconsets.zip"
            : "icon-studio-collection.zip",
        );
      notify(
        `${saved ? "Exported" : "Generated"} ${targets.length} icon${targets.length === 1 ? "" : "s"}`,
      );
      onClose();
    } catch (e) {
      notify(e.message);
    } finally {
      setWorking(false);
      setBusy(null);
    }
  };
  return (
    <Modal title="Export icons" onClose={() => !working && onClose()}>
      <div className="export-options">
        <label className="form-field">
          <span>Export</span>
          <select
            aria-label="Export scope"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="selected">Selected icons ({selected.length})</option>
            <option value="all">Entire collection ({items.length})</option>
          </select>
        </label>
        <div className="format-cards">
          {[
            ["png", "PNG", "Crisp, transparent images"],
            ["svg", "SVG", "Editable, scalable vectors"],
            ["iconset", "Icon set", "Seven PNG sizes in a ZIP"],
          ].map(([k, label, description]) => (
            <button
              key={k}
              className={format === k ? "active" : ""}
              onClick={() => setFormat(k)}
              aria-pressed={format === k}
            >
              <strong>{label}</strong>
              <small>{description}</small>
              {format === k && <Check size={15} />}
            </button>
          ))}
        </div>
        {format !== "iconset" && (
          <label className="form-field">
            <span>Resolution</span>
            <select
              aria-label="Export resolution"
              value={size}
              onChange={(e) => setSize(e.target.value)}
            >
              {[16, 32, 64, 128, 256, 512, 1024, 2048].map((n) => (
                <option key={n} value={n}>
                  {n} × {n}
                  {n === 1024 ? " · Recommended" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <Toggle
          label="Glyph only"
          checked={glyphOnly}
          onChange={setGlyphOnly}
        />
      </div>
      <footer className="modal-footer">
        <button
          className="secondary-button"
          disabled={working}
          onClick={onClose}
        >
          Cancel
        </button>
        <button
          className="primary-button"
          disabled={!targets.length || working}
          onClick={start}
        >
          {working ? (
            <>
              <Loader2 className="spinning" size={15} />
              {progress}%
            </>
          ) : (
            <>
              <Download size={15} />
              Export {targets.length > 1 ? `${targets.length} icons` : "icon"}
            </>
          )}
        </button>
      </footer>
    </Modal>
  );
}
createRoot(document.getElementById("root")).render(<App />);
