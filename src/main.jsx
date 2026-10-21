import React, { useState, useEffect, useRef, useMemo, useSyncExternalStore } from "react";
import { t, getLang, onLangChange } from "./i18n.js";
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
            aria-label={t("Close dialog")}
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
            {t(text)}
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
        {mixed ? t(" · Mixed") : ""}
      </span>
      <div>
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          aria-label={t("{label} hex", { label })}
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
          {mixed ? t("Mixed") : `${Math.round(value * 100) / 100}${suffix}`}
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
        {mixed && <small>{t("Mixed selection")}</small>}
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
      aria-label={t("{name} preview", { name: item.name })}
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function App() {
  // 订阅语言变化，切换语言时整棵树重渲染
  useSyncExternalStore(onLangChange, getLang);
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
              ? t("Smart removal unavailable. Switched to edge detection.")
              : t("Background could not be removed."),
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
        t("A workspace can hold up to 200 icons. Export or start a new project first."),
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
      notify(t("Added {name}", { name: icon.title || icon.name }));
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
          throw new Error(t("{name}: maximum file size is 20 MB.", { name: file.name }));
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
        ? t("Imported {count}. Skipped: {skipped}", { count: incoming.length, skipped: errors.slice(0, 3).join(", ") })
        : t(`Imported {count} icon${incoming.length === 1 ? "" : "s"}`, { count: incoming.length }),
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
    notify(t("Project saved. Open it here to continue editing."));
  };
  const openProject = async (file) => {
    try {
      if (file.size > 100 * 1024 * 1024)
        throw new Error(t("Project is too large (maximum 100 MB)."));
      const next = validateProject(JSON.parse(await file.text())).map((i) => ({
        ...i,
        svg: i.svg ? sanitizeSvg(i.svg) : "",
      }));
      if (!next.length) throw new Error(t("This project is empty."));
      const names = uniqueNames(next.map((i) => i.name));
      commit(next.map((i, n) => ({ ...i, name: names[n] })));
      setSelected([next[0].id]);
      setActiveId(next[0].id);
      notify(t("Project opened. Your previous workspace is available with Undo."));
    } catch (e) {
      notify(e.message);
    }
  };
  const removeSelected = () => {
    commit(itemsRef.current.filter((i) => !targetIds.includes(i.id)));
    notify(t("Icons removed · Undo to restore"));
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
    notify(t("Selection duplicated"));
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
      notify(t("SVG copied to clipboard"));
    } catch {
      notify(t("Clipboard access unavailable. Export SVG instead."));
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
      else notify(t("Copy an image or SVG first, then paste here."));
    } catch {
      notify(t("Press Ctrl+V or ⌘V to paste an image or SVG."));
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
    notify(t("Look saved"));
  };
  const applyLook = async (look) => {
    applyStyle(look.style);
    localStorage.setItem(
      "icon-studio-default-look",
      JSON.stringify(look.style),
    );
    if (desktop && projectContext)
      await desktop.setProjectLook(projectContext.id, look.style);
    notify(t("{name} applied", { name: look.name }));
  };
  const generateNative = async (kind) => {
    if (removing) {
      notify(t("Background removal is still processing"));
      return;
    }
    setBusy(kind);
    try {
      const ctx = await desktop.context();
      if (!ctx.project || ctx.project.id !== projectContext?.id)
        throw new Error(
          t("Resolve project changed. Try again after the panel updates."),
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
        notify(t("Added {count} icons to Media Pool", { count: result.imported }));
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
          ? insertion?.trackIndex
            ? t("Added to timeline · V{track}", { track: insertion.trackIndex })
            : t("Added to timeline")
          : kind === "pool"
            ? t("Added to Media Pool")
            : t("PNG saved"),
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
              notify(t("Presets imported"));
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
              {projectContext?.name || t("Open a Resolve project")}
            </span>
          ) : (
            <>
              <span className="status-dot" />
              {t(saveStatus)}
            </>
          )}
        </div>
        <div className="header-actions">
          {desktop && (
            <button
              className={`icon-button pin-button ${alwaysOnTop ? "active" : ""}`}
              aria-label={t("Always on top")}
              title={t("Always on top")}
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
            aria-label={t("Quick icon search")}
            title={t("Quick icon search · {shortcut}", { shortcut: shortcutLabel(shortcut) })}
            onClick={() => setModal("search")}
          >
            <Search size={17} />
          </button>
          <button
            className="icon-button"
            aria-label={
              theme === "dark" ? t("Switch to light mode") : t("Switch to dark mode")
            }
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            className="quiet-button project-button"
            aria-label={t("Project")}
            title={t("Project")}
            onClick={() => setModal("project")}
          >
            <FolderOpen size={16} />
            <span>{t("Project")}</span>
            <ChevronDown size={12} />
          </button>
          <button
            className="icon-button"
            aria-label={t("Help and shortcuts")}
            onClick={() => setModal("help")}
          >
            <HelpCircle size={18} />
          </button>
          <button
            className="quiet-button look-button"
            onClick={() => setModal("looks")}
            aria-label={t("Style presets")}
            title={t("Saved looks")}
          >
            <Bookmark size={16} />
            <span>{t("Looks")}</span>
          </button>
          {desktop && (
            <button
              className="icon-button"
              onClick={() => setModal("archive")}
              aria-label={t("Generated icons archive")}
            >
              <Archive size={17} />
            </button>
          )}
          <button
            className="icon-button"
            onClick={() => setModal("settings")}
            aria-label={t("Settings")}
          >
            <Settings size={17} />
          </button>
          {!desktop && (
            <a
              className="secondary-button resolve-download-button"
              href={releaseUrl}
              title={t("Download Resolve script")}
              aria-label={t("Download Resolve script")}
            >
              <Film size={16} />
              <span className="button-label">{t("Resolve script")}</span>
            </a>
          )}
          <span className="divider" />
          <button
            className="primary-button"
            aria-label={t("Export icons")}
            title={t("Export icons")}
            disabled={!active || busy}
            onClick={() => setModal("export")}
          >
            <Download size={16} />
            <span>{t("Export")}</span>
            <ChevronDown size={13} />
          </button>
        </div>
      </header>
      <div className={`workspace ${showLibrary ? "" : "library-hidden"}`}>
        <button
          className="panel-backdrop"
          aria-label={t("Close side panels")}
          onClick={() => {
            setShowLibrary(false);
            if (window.innerWidth < 720) setShowInspector(false);
          }}
        />
        {showLibrary && (
          <aside className="library-panel">
            <div className="library-heading">
              <div>
                <h2>{t("Library")}</h2>
              </div>
              <button
                className="icon-button"
                aria-label={t("Hide library")}
                onClick={() => setShowLibrary(false)}
              >
                <PanelLeftClose size={17} />
              </button>
            </div>
            <div className="search-box">
              <Search size={16} />
              <input
                ref={searchInput}
                aria-label={t("Search icon library")}
                placeholder={t("Search icons…")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              {query ? (
                <button aria-label={t("Clear search")} onClick={() => setQuery("")}>
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
                {t("Explore")}
              </button>
              <button
                className={tabName === "favorites" ? "active" : ""}
                onClick={() => setTabName("favorites")}
              >
                <Heart size={13} />
                {t("Favorites")}
              </button>
              <button
                className={tabName === "imports" ? "active" : ""}
                onClick={() => setTabName("imports")}
              >
                {t("Imports")}
              </button>
            </div>
            {tabName !== "imports" ? (
              <>
                <div className="library-filters">
                  <select
                    aria-label={t("Icon collection")}
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                  >
                    {collections.map((c) => (
                      <option key={c.id} value={c.prefix}>
                        {t(
                          c.name
                            .replace(/[🍏🎬]/g, "")
                            .replace(" (200k+)", "")
                            .replace(" (350+)", "")
                            .trim(),
                        )}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="library-caption">
                  <span>
                    {query
                      ? t("Search results")
                      : tabName === "favorites"
                        ? t("Your favorites")
                        : t("Icons")}
                  </span>
                  {searchBusy ? (
                    <Loader2 size={13} className="spinning" />
                  ) : (
                    <span>{t("{count} icons", { count: visibleResults.length })}</span>
                  )}
                </div>
                <div className="icon-library">
                  {visibleResults.map((icon) => (
                    <div key={icon.fullName} className="library-icon-wrap">
                      <button
                        className="library-icon"
                        title={t("Add {name}", { name: icon.title || icon.name })}
                        aria-label={t("Add {name}", { name: icon.title || icon.name })}
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
                        aria-label={t("{action} {name}", {
                          action: favorites.includes(icon.fullName)
                            ? t("Unfavorite")
                            : t("Favorite"),
                          name: icon.name,
                        })}
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
                          title={t("Copy SVG")}
                          aria-label={t("Copy {name} SVG", { name: icon.name })}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                await getIcon(icon),
                              );
                              notify(t("SVG copied"));
                            } catch (e) {
                              notify(e.message);
                            }
                          }}
                        >
                          <Copy size={10} />
                        </button>
                        <button
                          title={t("Download SVG")}
                          aria-label={t("Download {name} SVG", { name: icon.name })}
                          onClick={async () => {
                            try {
                              const saved = await download(
                                new Blob([await getIcon(icon)], {
                                  type: "image/svg+xml",
                                }),
                                `${icon.name}.svg`,
                              );
                              if (saved) notify(t("SVG downloaded"));
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
                          ? t("Your favorites live here.")
                          : t("No icons found.")}
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
                  <strong>{t("Bring your own.")}</strong>
                  <span>SVG, PNG, JPG, WebP, GIF or AVIF</span>
                </button>
                <button className="quiet-button" onClick={paste}>
                  <Clipboard size={15} />
                  {t("Paste image or SVG")}
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
                <strong>{t("Import icons")}</strong>
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
                  aria-label={t("Show library")}
                  onClick={() => setShowLibrary(true)}
                >
                  <PanelLeftOpen size={17} />
                </button>
              )}
              <span>{t("Workspace")}</span>
              <ChevronRight size={13} />
              <strong>{active?.name || t("New icon")}</strong>
              {targetIds.length > 1 && (
                <span className="selection-badge">
                  {t("{count} selected", { count: targetIds.length })}
                </span>
              )}
            </div>
            <div className="history-controls">
              <button
                className="icon-button inspector-toggle"
                aria-label={showInspector ? t("Hide inspector") : t("Show inspector")}
                title={t("Inspector")}
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
                aria-label={t("Undo")}
                title={t("Undo · Ctrl/⌘ Z")}
                onClick={undo}
              >
                <Undo2 size={17} />
              </button>
              <button
                className="icon-button"
                disabled={!future.length}
                aria-label={t("Redo")}
                title={t("Redo · Ctrl/⌘ Shift Z")}
                onClick={redo}
              >
                <Redo2 size={17} />
              </button>
              <span className="divider" />
              <button
                className="icon-button"
                aria-label={t("Workspace options")}
                onClick={() => setModal("project")}
              >
                <MoreHorizontal size={19} />
              </button>
            </div>
          </div>
          <section
            className={`stage stage-${theme} ${stageBg === "checker" ? "stage-checker" : ""}`}
            aria-label={t("Icon canvas")}
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
                      ? t("Drag PNG to Resolve, Explorer or Finder")
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
                    aria-label={t("Download PNG")}
                    title={t("Download PNG")}
                    disabled={!!busy}
                    onClick={async () => {
                      setBusy("png");
                      try {
                        if (desktop) {
                          await generateNative("download");
                          return;
                        }
                        download(await renderPng(active), `${active.name}.png`);
                        notify(t("PNG downloaded"));
                      } catch (e) {
                        notify(e.message);
                      } finally {
                        setBusy(null);
                      }
                    }}
                  >
                    <Download size={14} />
                    <span className="button-label">{t("Download PNG")}</span>
                  </button>
                  <span />
                  <button
                    onClick={copySvg}
                    aria-label={t("Copy SVG")}
                    title={t("Copy SVG")}
                  >
                    <Copy size={14} />
                    <span className="button-label">{t("Copy SVG")}</span>
                  </button>
                  <span />
                  <button
                    aria-label={t("Copy PNG")}
                    title={t("Copy PNG")}
                    onClick={async () => {
                      try {
                        const blob = await renderPng(active);
                        if (!window.ClipboardItem) throw new Error();
                        await navigator.clipboard.write([
                          new ClipboardItem({ "image/png": blob }),
                        ]);
                        notify(t("PNG image copied"));
                      } catch {
                        notify(
                          t("Image clipboard unavailable. Export PNG instead."),
                        );
                      }
                    }}
                  >
                    <ImageIcon size={14} />
                    <span className="button-label">{t("Copy PNG")}</span>
                  </button>
                  {desktop && (
                    <>
                      <span />
                      <div className="resolve-actions">
                        <button
                          className="native-insert"
                          aria-label={
                            chosen.length > 1
                              ? t("Add selected icons to Media Pool")
                              : t("Add icon to Media Pool")
                          }
                          title={
                            chosen.length > 1
                              ? t("Add {count} selected icons to Media Pool", { count: chosen.length })
                              : t("Add icon to Media Pool")
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
                          aria-label={t("Add icon to timeline")}
                          title={t("Add icon to timeline")}
                          disabled={!!busy || removing || !projectContext}
                          onClick={() => generateNative("timeline")}
                        >
                          <ListVideo size={14} />
                          <span className="button-label">{t("Timeline")}</span>
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
                        title={t("Apply {name} palette", { name: p.name })}
                        aria-label={t("Apply {name} palette", { name: p.name })}
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
                <h2>{t("Drop icons here")}</h2>
                <button
                  className="primary-button"
                  onClick={() => fileInput.current.click()}
                >
                  <Upload size={16} />
                  {t("Import icons")}
                </button>
              </div>
            )}
            <div className="stage-bottom">
              <div className="zoom-control">
                <button
                  aria-label={t("Zoom out")}
                  onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
                >
                  −
                </button>
                <button aria-label={t("Reset zoom")} onClick={() => setZoom(1)}>
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  aria-label={t("Zoom in")}
                  onClick={() => setZoom((z) => Math.min(1.7, z + 0.1))}
                >
                  +
                </button>
              </div>
              <div className="stage-view">
                <button
                  className={theme === "light" ? "active" : ""}
                  aria-label={t("Light mode")}
                  onClick={() => setTheme("light")}
                >
                  <Sun size={15} />
                </button>
                <button
                  className={theme === "dark" ? "active" : ""}
                  aria-label={t("Dark mode")}
                  onClick={() => setTheme("dark")}
                >
                  <Moon size={15} />
                </button>
                <button
                  className={stageBg === "checker" ? "active" : ""}
                  aria-label={t("Transparency preview")}
                  onClick={() =>
                    setStageBg((bg) => (bg === "checker" ? "plain" : "checker"))
                  }
                >
                  <Grid2X2 size={15} />
                </button>
              </div>
            </div>
          </section>
          <section className="collection-panel" aria-label={t("Icon collection")}>
            <div className="collection-header">
              <div>
                <Layers size={16} />
                <h2>{t("Collection")}</h2>
                <span className="count">{items.length}</span>
              </div>
              <div>
                <button
                  className={`quiet-button ${batch ? "accent" : ""}`}
                  aria-label={batch ? t("Done selecting") : t("Select icons")}
                  title={batch ? t("Done selecting") : t("Select icons")}
                  onClick={() => {
                    setBatch(!batch);
                    if (batch) setSelected(active ? [active.id] : []);
                  }}
                >
                  <CheckCheck size={15} />
                  <span className="button-label">
                    {batch ? t("Done selecting") : t("Select")}
                  </span>
                </button>
                <button
                  className="quiet-button"
                  aria-label={t("Rename selected icons")}
                  title={t("Rename selected icons")}
                  disabled={!targetIds.length}
                  onClick={() => setModal("rename")}
                >
                  <Type size={14} />
                  <span className="button-label">{t("Rename")}</span>
                </button>
                <button
                  className="icon-button"
                  aria-label={t("Duplicate selected icons")}
                  disabled={!targetIds.length}
                  onClick={duplicate}
                >
                  <Copy size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={t("Remove selected icons")}
                  disabled={!targetIds.length}
                  onClick={removeSelected}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            {batch && (
              <div className="batch-bar">
                <span>{t("{count} selected", { count: targetIds.length })}</span>
                <button onClick={() => setSelected(items.map((i) => i.id))}>
                  {t("Select all")}
                </button>
                <button onClick={() => setSelected([])}>{t("Clear")}</button>
              </div>
            )}
            <div className="collection-strip">
              {items.map((item) => (
                <button
                  key={item.id}
                  className={`collection-item ${selected.includes(item.id) ? "selected" : ""} ${activeId === item.id ? "current" : ""}`}
                  aria-label={t("Select {name}", { name: item.name })}
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
                aria-label={t("Import more icons")}
              >
                <Plus size={23} />
                <span className="button-label">{t("Add icons")}</span>
              </button>
            </div>
          </section>
        </main>
        <aside className="inspector">
          <div className="inspector-heading">
            <h2>{targetIds.length > 1 ? t("Selection") : t("Inspector")}</h2>
            <span>
              {targetIds.length > 1
                ? t("{count} icons", { count: targetIds.length })
                : t("Live preview")}
            </span>
            <button
              className="icon-button inspector-close"
              aria-label={t("Close inspector")}
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
              {t("Style")}
            </button>
            <button
              className={panel === "glyph" ? "active" : ""}
              onClick={() => setPanel("glyph")}
            >
              <Sparkles size={15} />
              {t("Glyph")}
            </button>
          </div>
          <div className="inspector-scroll">
            {active ? (
              <>
                {targetIds.length > 1 && (
                  <div className="selection-info">
                    <Layers size={15} />
                    {t("{count} selected", { count: targetIds.length })}
                  </div>
                )}
                {panel === "appearance" && (
                  <>
                    <section className="control-section">
                      <h3>{t("Background")}</h3>
                      <Segment
                        label={t("Background type")}
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
                                  ? t("Start color")
                                  : t("Color")
                              }
                              value={s.bgColor1}
                              mixed={mixed("bgColor1")}
                              onChange={(v) => change("bgColor1", v)}
                            />
                            {s.bgType === "gradient" && (
                              <Color
                                label={t("End color")}
                                value={s.bgColor2}
                                mixed={mixed("bgColor2")}
                                onChange={(v) => change("bgColor2", v)}
                              />
                            )}
                          </div>
                          {s.bgType === "gradient" &&
                            slider("bgAngle", t("Gradient angle"), 0, 360, 1, "°")}
                        </>
                      )}
                      <h4>{t("Palettes")}</h4>
                      <div className="palette-grid">
                        {presets.map((p) => (
                          <button
                            aria-label={t("Use {name} colors", { name: p.name })}
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
                          {t("Solid colors")}
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
                              aria-label={t("Use {color}", { color: c })}
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
                      <h3>{t("Shape & finish")}</h3>
                      {slider("borderRadius", t("Corner radius"), 0, 50, 0.5, "%")}
                      <div className="mini-presets">
                        <button onClick={() => change("borderRadius", 0)}>
                          {t("Square")}
                        </button>
                        <button onClick={() => change("borderRadius", 22.5)}>
                          {t("Squircle")}
                        </button>
                        <button onClick={() => change("borderRadius", 50)}>
                          {t("Circle")}
                        </button>
                      </div>
                      {toggle(
                        "enableShadow",
                        t("Soft shadow"),
                        t("A little lift from the canvas"),
                      )}
                      {toggle(
                        "enableInnerLight",
                        t("Light edge"),
                        t("A subtle highlight around the shape"),
                      )}
                      <details className="disclosure">
                        <summary>
                          {t("More effects")}
                          <ChevronDown size={12} />
                        </summary>
                        {toggle(
                          "enableBevel",
                          t("Inset bevel"),
                          t("Monterey-inspired depth"),
                        )}
                        {toggle("enableGlyphShadow", t("Glyph shadow"))}
                        {toggle("enableGlow", t("Glyph glow"))}
                        {s.enableGlow &&
                          slider("glowStrength", t("Glow radius"), 5, 80, 1)}
                        {toggle("enableOutline", t("Glyph outline"))}
                        {s.enableOutline &&
                          slider("outlineWidth", t("Outline width"), 1, 30, 1)}
                        {(s.enableGlow || s.enableOutline) && (
                          <Color
                            label={t("Effect color")}
                            value={s.effectColor}
                            onChange={(v) => change("effectColor", v)}
                          />
                        )}
                        {toggle("enableAmbientLight", t("Ambient light"))}
                        {toggle("enableVignette", t("Vignette"))}
                        {toggle("enableGrain", t("Grain texture"))}
                        {s.enableGrain &&
                          slider("grainAmount", t("Grain amount"), 1, 25, 1, "%")}
                        {toggle("enableMonochrome", t("Monochrome glyph"))}
                        {s.enableShadow &&
                          slider(
                            "shadowStrength",
                            t("Shadow opacity"),
                            0,
                            70,
                            1,
                            "%",
                          )}
                        {slider(
                          "glyphOpacity",
                          t("Glyph opacity"),
                          10,
                          100,
                          1,
                          "%",
                        )}

                        {toggle(
                          "enableClassicSweep",
                          t("Classic gloss"),
                          t("A curved glass reflection"),
                        )}
                      </details>
                    </section>
                  </>
                )}
                {panel === "glyph" && (
                  <>
                    <section className="control-section">
                      <h3>{t("Foreground")}</h3>
                      <div className="two-buttons">
                        <button
                          className="secondary-button"
                          onClick={() => fileInput.current.click()}
                        >
                          <Upload size={14} />
                          {t("Import")}
                        </button>
                        <button className="secondary-button" onClick={paste}>
                          <Clipboard size={14} />
                          {t("Paste")}
                        </button>
                      </div>
                      <h4>{t("Color treatment")}</h4>
                      <Segment
                        label={t("Glyph color")}
                        value={s.iconColorMode}
                        options={["original", "solid", "gradient"]}
                        onChange={(v) => change("iconColorMode", v)}
                      />
                      {s.iconColorMode !== "original" && (
                        <>
                          <div className="colors">
                            <Color
                              label={t("Glyph color")}
                              value={s.iconColor1}
                              onChange={(v) => change("iconColor1", v)}
                            />
                            {s.iconColorMode === "gradient" && (
                              <Color
                                label={t("Second color")}
                                value={s.iconColor2}
                                onChange={(v) => change("iconColor2", v)}
                              />
                            )}
                          </div>
                          {s.iconColorMode === "gradient" &&
                            slider(
                              "iconAngle",
                              t("Glyph gradient angle"),
                              0,
                              360,
                              1,
                              "°",
                            )}
                        </>
                      )}
                    </section>
                    <section className="control-section">
                      <h3>{t("Glyph palettes")}</h3>
                      <div className="palette-grid">
                        {presets.map((p) => (
                          <button
                            key={p.name}
                            title={p.name}
                            aria-label={t("Use {name} glyph gradient", { name: p.name })}
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
                          {t("Solid colors")}
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
                              aria-label={t("Use {color} glyph color", { color: c })}
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
                      <h3>{t("Size & position")}</h3>
                      <Slider
                        label={t("Glyph size")}
                        value={s.iconScale * 100}
                        min={5}
                        max={150}
                        suffix="%"
                        mixed={mixed("iconScale")}
                        onChange={(v) => change("iconScale", v / 100)}
                      />
                      {slider("iconRotation", t("Rotation"), -180, 180, 1, "°")}
                      {slider("offsetX", t("Horizontal offset"), -40, 40, 1, "%")}
                      {slider("offsetY", t("Vertical offset"), -40, 40, 1, "%")}
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
                        {t("Reset placement")}
                      </button>
                    </section>
                    <section className="control-section">
                      <h3>{t("Background removal")}</h3>
                      {toggle(
                        "removeBg",
                        t("Remove image background"),
                        t("Works best with a flat background"),
                      )}
                      {removing && (
                        <span className="processing-state">
                          <Loader2 size={13} className="spin" /> {t("Removing")}
                          background…
                        </span>
                      )}
                      {s.removeBg && (
                        <>
                          <select
                            aria-label={t("Background removal color")}
                            value={s.bgRemoveMode}
                            onChange={(e) =>
                              change("bgRemoveMode", e.target.value)
                            }
                          >
                            <option value="smart">{t("Smart foreground (AI)")}</option>
                            <option value="auto">{t("Detect edge color")}</option>
                            <option value="white">{t("White background")}</option>
                            <option value="black">{t("Black background")}</option>
                            <option value="custom">{t("Choose a color")}</option>
                          </select>
                          {s.bgRemoveMode === "custom" && (
                            <Color
                              label={t("Remove color")}
                              value={s.bgRemoveColor}
                              onChange={(v) => change("bgRemoveColor", v)}
                            />
                          )}{" "}
                          {slider("bgTolerance", t("Tolerance"), 0, 180, 1)}
                          {toggle(
                            "edgeOnly",
                            t("Connected edges only"),
                            t("Protect matching colors inside the icon"),
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
                    {t("Reset style")}
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-inspector">
                <Sparkles size={30} />
                <p>{t("Add an icon to begin.")}</p>
              </div>
            )}
          </div>
        </aside>
      </div>
      {dragging && (
        <div className="drop-overlay">
          <div>
            <Upload size={38} />
            <h2>{t("Drop to import")}</h2>
            <span>SVG · PNG · JPG · WebP · GIF · AVIF</span>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
          <button
            aria-label={t("Dismiss notification")}
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
              t(`Renamed {count} icon${rows.length === 1 ? "" : "s"}`, { count: rows.length }),
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
        <Modal title={t("Saved looks")} onClose={() => setModal(null)} wide>
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
        <Modal title={t("Settings")} onClose={() => setModal(null)}>
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
        <Modal title={t("Find an icon")} onClose={() => setModal(null)} wide>
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
        <Modal title={t("Generated icons")} wide onClose={() => setModal(null)}>
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
        <Modal title={t("Project")} onClose={() => setModal(null)}>
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
                  {desktop ? t("Generated icons archive") : t("Save project")}
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
                <strong>{t("Open project")}</strong>
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
                <strong>{t("Import icons")}</strong>
              </span>
              <ChevronRight size={16} />
            </button>
            {!desktop && (
              <a className="resolve-download-row" href={releaseUrl}>
                <Download />
                <span>
                  <strong>{t("Download Resolve panel")}</strong>
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
                notify(t("Fresh workspace · Undo to restore your collection"));
              }}
            >
              <Plus />
              <span>
                <strong>{t("New workspace")}</strong>
              </span>
              <ChevronRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {modal === "help" && (
        <Modal title={t("Keyboard shortcuts")} onClose={() => setModal(null)}>
          <div className="help-content">
            {[
              [t("Quick icon search"), shortcutLabel(shortcut)],
              [t("Search library"), t("/ or Ctrl/⌘ K")],
              [t("Select all"), "Ctrl/⌘ A"],
              [t("Undo / redo"), "Ctrl/⌘ Z / Shift Z"],
              [t("Duplicate selection"), "Ctrl/⌘ D"],
              [t("Save project"), "Ctrl/⌘ S"],
              [t("Rename selection"), "F2"],
              [t("Paste image or SVG"), "Ctrl/⌘ V"],
              [t("Remove selection"), "Delete"],
              [t("Select a range"), "Shift click"],
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
    error = t("Check your regular expression.");
  }
  return (
    <Modal
      title={selected.length === 1 ? t("Rename icon") : t("Rename icons")}
      wide
      onClose={onClose}
    >
      <div className="rename-layout">
        <div className="rename-controls">
          <label className="form-field">
            <span>
              {selected.length === 1 ? t("Name or pattern") : t("Name pattern")}
            </span>
            <input
              aria-label={t("Name pattern")}
              value={rule.template}
              onChange={(e) => update("template", e.target.value)}
            />
            <small>
              {t("Use {name}, {original}, {n}, or {date}.")}
            </small>
          </label>
          <div className="form-row">
            <label className="form-field">
              <span>{t("Prefix")}</span>
              <input
                aria-label={t("Name prefix")}
                placeholder="app-"
                value={rule.prefix}
                onChange={(e) => update("prefix", e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>{t("Suffix")}</span>
              <input
                aria-label={t("Name suffix")}
                placeholder="-dark"
                value={rule.suffix}
                onChange={(e) => update("suffix", e.target.value)}
              />
            </label>
          </div>
          <label className="form-field">
            <span>{t("Letter case")}</span>
            <select
              aria-label={t("Letter case")}
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
              <span>{t("Start number")}</span>
              <input
                aria-label={t("Start number")}
                type="number"
                min="1"
                value={rule.start}
                onChange={(e) => update("start", e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>{t("Number padding")}</span>
              <select
                aria-label={t("Number padding")}
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
              {t("Find & replace")}
              <ChevronDown size={13} />
            </summary>
            <div className="form-row">
              <label className="form-field">
                <span>{t("Find")}</span>
                <input
                  aria-label={t("Find in name")}
                  value={rule.find}
                  onChange={(e) => update("find", e.target.value)}
                />
              </label>
              <label className="form-field">
                <span>{t("Replace with")}</span>
                <input
                  aria-label={t("Replace with")}
                  value={rule.replace}
                  onChange={(e) => update("replace", e.target.value)}
                />
              </label>
            </div>
            <Toggle
              label={t("Regular expression")}
              checked={rule.regex}
              onChange={(v) => update("regex", v)}
            />
            {rule.regex && (
              <Toggle
                label={t("Case sensitive")}
                checked={rule.caseSensitive}
                onChange={(v) => update("caseSensitive", v)}
              />
            )}
          </details>
        </div>
        <div className="rename-preview">
          <div className="preview-label">
            <span>{t("BEFORE")}</span>
            <span>{t("AFTER")}</span>
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
          {t("Cancel")}
        </button>
        <button
          className="primary-button"
          disabled={!!error || !rows.length || !rule.template.trim()}
          onClick={() => onApply(rows)}
        >
          {t("Apply names")}
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
      if (desktop && !projectId) throw Error(t("Open a Resolve project first."));
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
            t("PNG icon sizes: 16–1024 px. SVG is available as a separate export.\n"),
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
        t(
          `${saved ? "Exported" : "Generated"} {count} ${targets.length === 1 ? "icon" : "icons"}`,
          { count: targets.length },
        ),
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
    <Modal title={t("Export icons")} onClose={() => !working && onClose()}>
      <div className="export-options">
        <label className="form-field">
          <span>{t("Export")}</span>
          <select
            aria-label={t("Export scope")}
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="selected">
              {t("Selected icons ({count})", { count: selected.length })}
            </option>
            <option value="all">
              {t("Entire collection ({count})", { count: items.length })}
            </option>
          </select>
        </label>
        <div className="format-cards">
          {[
            ["png", "PNG", t("Crisp, transparent images")],
            ["svg", "SVG", t("Editable, scalable vectors")],
            ["iconset", t("Icon set"), t("Seven PNG sizes in a ZIP")],
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
            <span>{t("Resolution")}</span>
            <select
              aria-label={t("Export resolution")}
              value={size}
              onChange={(e) => setSize(e.target.value)}
            >
              {[16, 32, 64, 128, 256, 512, 1024, 2048].map((n) => (
                <option key={n} value={n}>
                  {n} × {n}
                  {n === 1024 ? t(" · Recommended") : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <Toggle
          label={t("Glyph only")}
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
          {t("Cancel")}
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
              {targets.length > 1
                ? t("{count} icons", { count: targets.length })
                : t("icon")}
            </>
          )}
        </button>
      </footer>
    </Modal>
  );
}
createRoot(document.getElementById("root")).render(<App />);
