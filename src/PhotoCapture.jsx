import { useState, useEffect, useRef } from "react";
import { savePhoto } from "./photoDB.js";

export default function PhotoCapture({ trayNum, db, onSaved, onSkip }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [facingMode, setFacingMode] = useState("user");
  const [preview, setPreview] = useState(null); // object URL of captured image
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    startCamera(facingMode);
    return () => stopStream();
  }, [facingMode]);

  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  async function startCamera(mode) {
    stopStream();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 960 } },
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (e) {
      console.warn("Camera access failed:", e);
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      setCapturedBlob(blob);
      setPreview(URL.createObjectURL(blob));
      stopStream();
    }, "image/jpeg", 0.88);
  }

  function retake() {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setCapturedBlob(null);
    startCamera(facingMode);
  }

  async function confirmSave() {
    if (!capturedBlob || !db) return;
    setSaving(true);
    await savePhoto(db, trayNum, capturedBlob);
    onSaved();
  }

  return (
    <div style={s.overlay}>
      <div style={s.sheet}>
        <p style={s.prompt}>
          Tray #{trayNum} — take a photo of your teeth before swapping
        </p>

        {!preview ? (
          <>
            <video ref={videoRef} autoPlay playsInline muted style={s.video} />
            <div style={s.camRow}>
              <button style={s.flipBtn} onClick={() => setFacingMode(f => f === "user" ? "environment" : "user")}>
                {Icons.flip} Flip
              </button>
              <button style={s.captureBtn} onClick={capture} aria-label="Capture" />
              <div style={{ width: 64 }} />
            </div>
          </>
        ) : (
          <>
            <img src={preview} alt="Preview" style={s.previewImg} />
            <div style={s.confirmRow}>
              <button style={s.retakeBtn} onClick={retake}>Retake</button>
              <button style={s.saveBtn} onClick={confirmSave} disabled={saving}>
                {saving ? "Saving…" : "Use photo"}
              </button>
            </div>
          </>
        )}

        <button style={s.skipBtn} onClick={onSkip}>Skip for now</button>
      </div>
    </div>
  );
}

const Icons = {
  flip: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4 }}>
      <path d="M1 4v6h6"/><path d="M23 20v-6h-6"/>
      <path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/>
    </svg>
  ),
};

const s = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
    display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200,
  },
  sheet: {
    background: "#1c2230", borderRadius: "20px 20px 0 0", padding: "20px 20px 36px",
    width: "100%", maxWidth: 480,
  },
  prompt: {
    textAlign: "center", fontSize: 15, fontWeight: 600,
    color: "#e8edf5", margin: "0 0 14px",
  },
  video: {
    width: "100%", borderRadius: 12, background: "#000",
    display: "block", maxHeight: 340, objectFit: "cover",
  },
  camRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 8px 4px",
  },
  flipBtn: {
    background: "none", border: "1px solid #2a3347", borderRadius: 8,
    color: "#6b7a94", fontSize: 13, fontWeight: 500, cursor: "pointer",
    padding: "6px 12px", display: "flex", alignItems: "center",
    fontFamily: "inherit",
  },
  captureBtn: {
    width: 64, height: 64, borderRadius: "50%",
    border: "4px solid #5ce0d8", background: "rgba(92,224,216,0.15)",
    cursor: "pointer",
  },
  previewImg: {
    width: "100%", borderRadius: 12, display: "block",
    maxHeight: 340, objectFit: "cover",
  },
  confirmRow: {
    display: "flex", gap: 10, marginTop: 14,
  },
  retakeBtn: {
    flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid #2a3347",
    background: "transparent", color: "#6b7a94", fontSize: 15, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  },
  saveBtn: {
    flex: 2, padding: "12px 0", borderRadius: 12, border: "none",
    background: "#5ce0d8", color: "#0c0f14", fontSize: 15, fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit",
  },
  skipBtn: {
    display: "block", width: "100%", marginTop: 10, padding: "10px 0",
    background: "none", border: "none", color: "#6b7a94", fontSize: 14,
    cursor: "pointer", fontFamily: "inherit",
  },
};
