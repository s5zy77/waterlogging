// src/components/CitizenReport/ImageUploader.jsx
// Drag-and-drop / click-to-upload image component with live preview.
// After image is selected, calls onImageSelected(file, previewUrl).

import { useState, useRef, useCallback } from "react";

export default function ImageUploader({ onImageSelected, preview, disabled }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);

  const processFile = useCallback((file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    onImageSelected(file, url);
  }, [onImageSelected]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    processFile(file);
  };

  const handleChange = (e) => processFile(e.target.files?.[0]);

  if (preview) {
    return (
      <div style={styles.previewWrap}>
        <img src={preview} alt="Selected waterlogging report" style={styles.preview} />
        {!disabled && (
          <button
            type="button"
            style={styles.changeBtn}
            onClick={() => { onImageSelected(null, null); inputRef.current?.click(); }}
          >
            Change photo
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleChange} />
      </div>
    );
  }

  return (
    <div
      style={{ ...styles.dropZone, ...(dragging ? styles.dropZoneDragging : {}) }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Upload waterlogging image"
      onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"    // opens camera on mobile
        style={{ display: "none" }}
        onChange={handleChange}
        disabled={disabled}
      />
      <div style={styles.dropIcon} aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="M21 15l-5-5L5 21"/>
        </svg>
      </div>
      <p style={styles.dropLabel}>Tap to take a photo or upload</p>
      <p style={styles.dropHint}>JPEG, PNG – max 10 MB</p>
    </div>
  );
}

// ── src/components/CitizenReport/LocationPicker.jsx ──────────────────────
// Calls browser Geolocation API to get current coords.
// Optionally shows a small inline map placeholder (full Maps integration
// can be wired up once the Maps API key is set).

export function LocationPicker({ onLocationPicked, picked, disabled }) {
  const [gpsState, setGpsState] = useState("idle"); // idle | loading | denied | done

  const detectGPS = () => {
    if (disabled) return;
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    setGpsState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsState("done");
        onLocationPicked({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          streetId: null,   // could be resolved server-side via reverse-geocoding
          streetName: null,
          accuracy: pos.coords.accuracy,
        });
      },
      () => setGpsState("denied"),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (picked) {
    return (
      <div style={locStyles.pickedWrap}>
        <div style={locStyles.coordRow}>
          <span style={locStyles.coordLabel}>Lat</span>
          <span style={locStyles.coord}>{picked.lat.toFixed(5)}</span>
          <span style={locStyles.coordLabel}>Lng</span>
          <span style={locStyles.coord}>{picked.lng.toFixed(5)}</span>
        </div>
        {picked.accuracy && (
          <span style={locStyles.accuracy}>± {Math.round(picked.accuracy)} m accuracy</span>
        )}
        {!disabled && (
          <button type="button" style={locStyles.retryBtn} onClick={detectGPS}>
            Re-detect
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        style={{ ...locStyles.gpsBtn, ...(gpsState === "loading" ? locStyles.gpsBtnLoading : {}) }}
        onClick={detectGPS}
        disabled={disabled || gpsState === "loading"}
      >
        {gpsState === "loading" ? "Detecting location…" : "Use my current location"}
      </button>
      {gpsState === "denied" && (
        <p style={locStyles.denied}>Location access denied. Please enable it in browser settings.</p>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = {
  dropZone: {
    border: "2px dashed #B5D4F4",
    borderRadius: 12,
    padding: "32px 16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    background: "#f0f7ff",
    cursor: "pointer",
    transition: "border-color 0.15s, background 0.15s",
    userSelect: "none",
  },
  dropZoneDragging: {
    borderColor: "#185FA5",
    background: "#daeaf8",
  },
  dropIcon: { marginBottom: 4 },
  dropLabel: { margin: 0, fontSize: 15, fontWeight: 600, color: "#185FA5" },
  dropHint: { margin: 0, fontSize: 12, color: "#5F5E5A" },
  previewWrap: {
    position: "relative",
    borderRadius: 12,
    overflow: "hidden",
    border: "1.5px solid rgba(0,0,0,0.1)",
  },
  preview: { width: "100%", display: "block", maxHeight: 280, objectFit: "cover" },
  changeBtn: {
    position: "absolute",
    bottom: 10,
    right: 10,
    padding: "6px 12px",
    borderRadius: 8,
    background: "rgba(0,0,0,0.55)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 500,
    border: "none",
    cursor: "pointer",
  },
};

const locStyles = {
  gpsBtn: {
    width: "100%",
    padding: "13px 16px",
    borderRadius: 10,
    background: "#185FA5",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  gpsBtnLoading: { background: "#888", cursor: "not-allowed" },
  pickedWrap: {
    padding: "12px 14px",
    borderRadius: 10,
    background: "#E1F5EE",
    border: "1.5px solid #9FE1CB",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  coordRow: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" },
  coordLabel: { fontSize: 11, fontWeight: 700, color: "#085041", textTransform: "uppercase" },
  coord: { fontSize: 14, fontWeight: 500, color: "#04342C", fontFamily: "monospace" },
  accuracy: { fontSize: 12, color: "#1D9E75" },
  retryBtn: {
    alignSelf: "flex-start",
    padding: "4px 10px",
    borderRadius: 6,
    background: "transparent",
    border: "1px solid #1D9E75",
    color: "#1D9E75",
    fontSize: 12,
    cursor: "pointer",
  },
  denied: { marginTop: 8, fontSize: 13, color: "#A32D2D" },
};
