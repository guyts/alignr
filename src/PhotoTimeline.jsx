import { useState, useEffect, useRef } from "react";
import { getAllPhotos, deletePhoto } from "./photoDB.js";
import { generateTimelapse, isTimelapseSupported } from "./timelapse.js";

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

export default function PhotoTimeline({ db, currentTray, onRequestPhoto }) {
  const [photos, setPhotos] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [objectUrl, setObjectUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const touchStartX = useRef(null);

  useEffect(() => {
    if (!db) return;
    getAllPhotos(db).then(p => {
      setPhotos(p);
      setActiveIdx(Math.max(0, p.length - 1));
    });
  }, [db]);

  // swap active object URL
  useEffect(() => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    const photo = photos[activeIdx];
    if (photo?.blob) setObjectUrl(URL.createObjectURL(photo.blob));
    else setObjectUrl(null);
  }, [activeIdx, photos]);

  // cleanup on unmount
  useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }, []);

  async function handleDelete(trayNum) {
    if (!confirm(`Delete photo for Tray #${trayNum}?`)) return;
    await deletePhoto(db, trayNum);
    const updated = await getAllPhotos(db);
    setPhotos(updated);
    setActiveIdx(Math.max(0, updated.length - 1));
  }

  async function handleTimelapse() {
    setGenerating(true);
    try {
      const blob = await generateTimelapse(photos);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smile-log-timelapse-${dayKey()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Timelapse failed:", e);
      alert("Timelapse generation failed. Try Chrome or Firefox.");
    }
    setGenerating(false);
  }

  function swipe(dir) {
    setActiveIdx(i => Math.max(0, Math.min(photos.length - 1, i + dir)));
  }

  const activePhoto = photos[activeIdx];

  if (!db) {
    return <div style={s.empty}><p style={s.emptyText}>Loading…</p></div>;
  }

  if (photos.length === 0) {
    return (
      <div style={s.empty}>
        <div style={s.emptyIcon}>📸</div>
        <p style={s.emptyTitle}>No photos yet</p>
        <p style={s.emptyText}>On swap day, you'll be prompted to take a photo before putting in the new tray. They'll show up here.</p>
        <button style={s.addBtn} onClick={onRequestPhoto}>Take a photo now</button>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      {/* caption */}
      <div style={s.caption}>
        <span style={s.captionTray}>Tray #{activePhoto?.trayNum ?? "—"}</span>
        <span style={s.captionDate}>{activePhoto?.capturedAt?.slice(0, 10) ?? ""}</span>
      </div>

      {/* main image */}
      <div
        style={s.imageWrap}
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          if (touchStartX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (dx > 40) swipe(-1);
          else if (dx < -40) swipe(1);
          touchStartX.current = null;
        }}
      >
        {objectUrl
          ? <img src={objectUrl} alt={`Tray #${activePhoto.trayNum}`} style={s.mainImg} />
          : <div style={s.placeholder}><span style={{ fontSize: 40 }}>📸</span></div>
        }

        {/* nav arrows */}
        {activeIdx > 0 && (
          <button style={{ ...s.arrow, left: 8 }} onClick={() => swipe(-1)}>‹</button>
        )}
        {activeIdx < photos.length - 1 && (
          <button style={{ ...s.arrow, right: 8 }} onClick={() => swipe(1)}>›</button>
        )}
      </div>

      {/* nav info */}
      <div style={s.navRow}>
        <span style={s.navCount}>{activeIdx + 1} / {photos.length}</span>
        <button style={s.deleteBtn} onClick={() => handleDelete(activePhoto.trayNum)}>Delete</button>
      </div>

      {/* thumbnails */}
      <div style={s.thumbStrip}>
        {photos.map((p, i) => (
          <ThumbItem
            key={p.trayNum}
            photo={p}
            active={i === activeIdx}
            onClick={() => setActiveIdx(i)}
          />
        ))}
        <button style={s.addThumb} onClick={onRequestPhoto} title="Add photo">+</button>
      </div>

      {/* timelapse */}
      {photos.length >= 2 && (
        <div style={s.timelapseWrap}>
          {isTimelapseSupported() ? (
            <button style={s.timelapseBtn} onClick={handleTimelapse} disabled={generating}>
              {generating ? "Generating…" : "⬇ Download timelapse"}
            </button>
          ) : (
            <p style={s.noSupport}>Timelapse requires Chrome or Firefox</p>
          )}
          {generating && <p style={s.generatingHint}>This may take a moment…</p>}
        </div>
      )}
    </div>
  );
}

// separate component so each thumb manages its own object URL
function ThumbItem({ photo, active, onClick }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    const u = URL.createObjectURL(photo.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo.blob]);
  return (
    <img
      src={url || ""}
      alt={`Tray #${photo.trayNum}`}
      style={{ ...s.thumb, ...(active ? s.thumbActive : {}) }}
      onClick={onClick}
    />
  );
}

const s = {
  wrap: { padding: "16px 20px 32px" },

  caption: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    background: "#161b24", borderRadius: 12, padding: "10px 14px", marginBottom: 10,
  },
  captionTray: { fontSize: 15, fontWeight: 700, color: "#e8edf5" },
  captionDate: { fontSize: 13, color: "#6b7a94" },

  imageWrap: {
    position: "relative", width: "100%", aspectRatio: "4/3",
    borderRadius: 16, overflow: "hidden", background: "#161b24", marginBottom: 8,
  },
  mainImg: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
  placeholder: {
    width: "100%", height: "100%", display: "flex",
    alignItems: "center", justifyContent: "center",
  },
  arrow: {
    position: "absolute", top: "50%", transform: "translateY(-50%)",
    background: "rgba(0,0,0,0.45)", border: "none", color: "#fff",
    fontSize: 28, lineHeight: 1, width: 36, height: 36, borderRadius: "50%",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  },

  navRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "4px 4px 10px",
  },
  navCount: { fontSize: 13, color: "#6b7a94" },
  deleteBtn: {
    background: "none", border: "none", color: "#f06868",
    fontSize: 13, cursor: "pointer", fontFamily: "inherit",
  },

  thumbStrip: {
    display: "flex", gap: 8, overflowX: "auto", padding: "4px 0 12px",
    scrollbarWidth: "none",
  },
  thumb: {
    width: 56, height: 56, borderRadius: 8, objectFit: "cover",
    flexShrink: 0, cursor: "pointer", border: "2px solid transparent",
  },
  thumbActive: { border: "2px solid #5ce0d8" },
  addThumb: {
    width: 56, height: 56, borderRadius: 8, flexShrink: 0,
    background: "#161b24", border: "2px dashed #2a3347",
    color: "#6b7a94", fontSize: 22, cursor: "pointer", display: "flex",
    alignItems: "center", justifyContent: "center",
  },

  timelapseWrap: { marginTop: 4, textAlign: "center" },
  timelapseBtn: {
    width: "100%", padding: "13px 0", borderRadius: 14, border: "none",
    background: "rgba(92,224,216,0.12)", color: "#5ce0d8",
    fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
    borderWidth: 1, borderStyle: "solid", borderColor: "rgba(92,224,216,0.25)",
  },
  generatingHint: { fontSize: 12, color: "#6b7a94", marginTop: 6 },
  noSupport: { fontSize: 13, color: "#6b7a94", margin: 0 },

  empty: {
    padding: "48px 32px", textAlign: "center",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: "#e8edf5", margin: 0 },
  emptyText: { fontSize: 14, color: "#6b7a94", lineHeight: 1.6, margin: 0, maxWidth: 280 },
  addBtn: {
    marginTop: 8, padding: "11px 24px", borderRadius: 12, border: "none",
    background: "#5ce0d8", color: "#0c0f14", fontSize: 14, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
  },
};
