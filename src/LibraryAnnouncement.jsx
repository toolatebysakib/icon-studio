import React, { useEffect, useState } from 'react';
import { t } from './i18n.js';
import { Sparkles, Download, X, Loader2 } from 'lucide-react';
import campaign from './library-announcement.json';

const key = `icon-studio-announcement-${campaign.id}`;
const active = () => Date.now() >= campaign.startsAt && Date.now() < campaign.endsAt;
const dismissed = () => { try { return localStorage.getItem(key) === 'dismissed'; } catch { return false; } };

export default function LibraryAnnouncement({ desktop, notify, onReady }) {
  const [visible, setVisible] = useState(() => active() && !dismissed());
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), Math.max(0, campaign.endsAt - Date.now()));
    let live = true;
    desktop?.settings().then(s => { if (live && s.libraryCount >= campaign.count) setVisible(false); }).catch(() => {});
    return () => { live = false; clearTimeout(timer); };
  }, [visible]);
  const close = () => {
    try { localStorage.setItem(key, 'dismissed'); } catch {}
    setVisible(false);
  };
  const downloadLibrary = async () => {
    if (status) return;
    try {
      let settings = await desktop.settings();
      if (!settings.rawFolder) {
        setStatus(t('Choose a folder…'));
        settings = await desktop.chooseFolder('rawFolder');
        if (!settings.rawFolder) { setStatus(''); return; }
      }
      setStatus(t('Downloading library…'));
      const result = await desktop.downloadLibrary();
      notify(t("{count} icons installed", { count: result.count.toLocaleString() }));
      onReady?.();
      close();
    } catch (error) { notify(error.message || t('Download failed. Try again in Settings.')); }
    finally { setStatus(''); }
  };
  if (!visible) return null;
  return <aside className="library-announcement" aria-label={t("Expanded icon library")}>
    <button className="announcement-dismiss" title={t("Dismiss")} aria-label={t("Dismiss library announcement")} onClick={close}><X size={15}/></button>
    <div className="announcement-mark"><Sparkles size={19}/></div>
    <div className="announcement-copy"><span className="announcement-eyebrow">{t("LIBRARY UPDATE")}</span>
      <strong>{t("382,000+ icons. More possibilities.")}</strong>
      <p>{t("Color, detail, and everyday essentials.")}</p>
      {desktop && <button className="announcement-download" disabled={!!status} onClick={downloadLibrary}>
        {status ? <Loader2 size={14} className="spinning"/> : <Download size={14}/>}{status || t('Download library · 101 MB')}
      </button>}
    </div>
  </aside>;
}
