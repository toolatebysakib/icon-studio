const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

// Search names stay compressed on disk. Artwork is read one chunk at a time.
class IconLibrary {
  constructor(metadataFolder, getFolder) {
    this.metadataFolder = metadataFolder;
    this.getFolder = getFolder;
    this.catalog = JSON.parse(fs.readFileSync(path.join(metadataFolder, 'catalog.json'), 'utf8'));
    this.names = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(metadataFolder, 'index.json.gz'))));
    this.packs = new Map(this.catalog.collections.map(pack => [pack.prefix, pack]));
    this.chunks = new Map();
    this.pending = new Map();
    this.folder = null;
  }
  root() {
    const folder = this.getFolder() || '';
    if (folder !== this.folder) { this.chunks.clear(); this.folder = folder; }
    if (!folder) return null;
    const roots = [path.join(folder, 'icon-studio-library-v2'), folder];
    return roots.find(root => fs.existsSync(path.join(root, 'catalog.json'))) || roots[0];
  }
  installedCount() {
    const root = this.root();
    if (!root) return 0;
    try {
      const catalog = JSON.parse(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'));
      if (catalog.version !== 2 || catalog.count !== this.catalog.count) return 0;
      return catalog.collections.every(pack => (pack.chunks || [pack]).every(chunk => fs.existsSync(path.join(root, chunk.file)))) ? catalog.count : 0;
    } catch { return 0; }
  }
  async chunk(pack, name) {
    const position = this.names[pack.prefix].indexOf(name);
    if (position < 0) return null;
    const descriptor = pack.chunks?.find(chunk => position >= chunk.start && position < chunk.start + chunk.count) || pack;
    if (!/^[a-z0-9-]+\.json\.gz$/.test(descriptor.file)) throw Error('Invalid library chunk');
    const root = this.root();
    const key = `${root || 'online'}:${descriptor.file}`;
    if (this.chunks.has(key)) {
      const data = this.chunks.get(key); this.chunks.delete(key); this.chunks.set(key, data); return data;
    }
    if (this.pending.has(key)) return this.pending.get(key);
    const task = (async () => {
      const local = root && path.join(root, descriptor.file);
      let bytes;
      if (local && fs.existsSync(local)) bytes = fs.readFileSync(local);
      else {
        const response = await fetch(`https://iconeditor.pages.dev/library/${descriptor.file}`, { signal: AbortSignal.timeout(20000) });
        if (!response.ok) throw Error(`Icon unavailable (${response.status}). Download the library in Settings for offline use.`);
        bytes = Buffer.from(await response.arrayBuffer());
      }
      if (bytes.length > 25 * 1024 * 1024 || crypto.createHash('sha256').update(bytes).digest('hex') !== descriptor.sha256) throw Error('Icon collection checksum did not match');
      const data = JSON.parse(zlib.gunzipSync(bytes, { maxOutputLength: 32 * 1024 * 1024 }));
      this.chunks.set(key, data);
      while (this.chunks.size > 6) this.chunks.delete(this.chunks.keys().next().value);
      return data;
    })();
    this.pending.set(key, task);
    try { return await task; } finally { this.pending.delete(key); }
  }
  async read(fullName) {
    const [prefix, name] = String(fullName).split(':');
    const pack = this.packs.get(prefix);
    if (!pack || !name) return null;
    const data = await this.chunk(pack, name);
    const icon = data?.icons[name];
    if (!icon) return null;
    const width = icon.width ?? data.width ?? 24, height = icon.height ?? data.height ?? 24;
    const left = icon.left ?? data.left ?? 0, top = icon.top ?? data.top ?? 0;
    if (![width, height, left, top].every(Number.isFinite)) throw Error('Invalid icon dimensions');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${width} ${height}">${icon.body}</svg>`;
  }
  async search(query, prefix, limit) {
    const words = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 12);
    const priority = ['lucide', 'flat-color-icons', 'tabler', 'fluent', 'fluent-color', 'material-symbols', 'logos', 'devicon'];
    const packs = [...this.packs.values()].sort((a,b) => (priority.indexOf(a.prefix) < 0 ? 100 : priority.indexOf(a.prefix)) - (priority.indexOf(b.prefix) < 0 ? 100 : priority.indexOf(b.prefix)));
    const count = Math.max(1, Math.min(90, Number(limit) || 90));
    const found = [];
    for (const pack of packs) {
      if (prefix && prefix !== pack.prefix) continue;
      for (const name of this.names[pack.prefix] || []) {
        const title = name.replace(/[-_]/g, ' ');
        const hay = `${title} ${pack.name} ${pack.prefix}`.toLowerCase();
        if (!words.every(word => hay.includes(word))) continue;
        found.push({ prefix: pack.prefix, name, fullName: `${pack.prefix}:${name}`, title, isColor: pack.color });
        if (found.length >= count) break;
      }
      if (found.length >= count) break;
    }
    // Four workers bound network requests and decompression; only six chunks remain cached.
    let next = 0;
    await Promise.all(Array.from({length: Math.min(4, found.length)}, async () => {
      while (next < found.length) {
        const icon = found[next++];
        try { icon.rawSvg = await this.read(icon.fullName); } catch { /* The existing preview can retry loading. */ }
      }
    }));
    return found;
  }
}
module.exports = { IconLibrary };
