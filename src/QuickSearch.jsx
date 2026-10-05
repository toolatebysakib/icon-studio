import React, { useState, useEffect, useRef } from "react";
import { Search, Loader2 } from "lucide-react";
import { searchIcons, getIcon, dataSvg } from "./engine";
import { shortcutLabel } from "./shortcuts";

function SearchResult({ icon, selected, onChoose, onHover, disabled }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    getIcon(icon)
      .then((svg) => live && setSrc(dataSvg(svg)))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [icon.fullName]);
  return (
    <button
      className={`quick-search-result ${selected ? "selected" : ""}`}
      aria-label={`Insert ${icon.title || icon.name}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onChoose}
      onMouseEnter={onHover}
      onFocus={onHover}
    >
      {src ? <img src={src} alt="" /> : <Search size={24} />}
      <span>{icon.title || icon.name}</span>
    </button>
  );
}
export default function QuickSearch({ onChoose, shortcut }) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState([]),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(0),
    [adding, setAdding] = useState(false);
  const grid = useRef();
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    setBusy(true);
    const timer = setTimeout(
      () =>
        searchIcons(query, "", false, controller.signal, 25)
          .then((list) => {
            if (live) {
              setResults(list.slice(0, 25));
              setSelected(0);
              setBusy(false);
            }
          })
          .catch(() => live && setBusy(false)),
      query ? 150 : 0,
    );
    return () => {
      live = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  const choose = async (icon) => {
    if (busy || adding || !icon) return;
    setAdding(true);
    try {
      await onChoose(icon);
    } finally {
      setAdding(false);
    }
  };
  const navigate = (event) => {
    if (event.target.tagName === "BUTTON") return;
    if (event.key === "Enter") {
      event.preventDefault();
      choose(results[selected]);
      return;
    }
    const columns = grid.current
      ? getComputedStyle(grid.current).gridTemplateColumns.split(" ").length
      : 5;
    const step = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns,
      ArrowUp: -columns,
    }[event.key];
    if (step && results.length) {
      event.preventDefault();
      setSelected((n) => Math.max(0, Math.min(results.length - 1, n + step)));
    }
  };
  useEffect(() => {
    grid.current?.children[selected]?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  return (
    <div
      className="quick-search-content"
      onKeyDown={navigate}
      aria-busy={busy || adding}
    >
      <div className="quick-search-input">
        <Search size={19} />
        <input
          autoFocus
          aria-label="Quick icon search"
          placeholder="Search icons…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {busy || adding ? (
          <Loader2 size={17} className="spin" />
        ) : (
          <kbd>{shortcutLabel(shortcut)}</kbd>
        )}
      </div>
      <div className="quick-search-grid" ref={grid}>
        {results.map((icon, index) => (
          <SearchResult
            key={icon.fullName}
            icon={icon}
            selected={selected === index}
            disabled={busy || adding}
            onHover={() => setSelected(index)}
            onChoose={() => choose(icon)}
          />
        ))}
      </div>
      {!busy && !results.length && (
        <div className="empty-state">No matching icons</div>
      )}
      <footer>
        <span>{results.length} results</span>
        <span>↑↓ Select · Enter Add · Esc Close</span>
      </footer>
    </div>
  );
}
