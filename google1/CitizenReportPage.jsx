// src/pages/CitizenReportPage.jsx
// Mobile-first page for citizens to report waterlogging.
// Flow: pick/drop image → auto-detect GPS location → describe → submit
// The image is uploaded to Firebase Storage first, then the URL + metadata
// are POSTed to Flask /api/reports.

import { useState, useCallback, useRef } from "react";
import { auth, uploadReportImage } from "../services/firebase";
import { createReport } from "../services/api";
import ImageUploader from "../components/CitizenReport/ImageUploader";
import LocationPicker from "../components/CitizenReport/LocationPicker";
import StatusPill from "../components/shared/StatusPill";
import SuccessToast from "../components/shared/SuccessToast";
import ErrorBanner from "../components/shared/ErrorBanner";
import LoadingSpinner from "../components/shared/LoadingSpinner";

export default function CitizenReportPage() {
  // Form state
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [location, setLocation] = useState(null);        // { lat, lng, streetId, streetName }
  const [description, setDescription] = useState("");

  // Async state
  const [uploadProgress, setUploadProgress] = useState(0);
  const [phase, setPhase] = useState("idle");            // idle | uploading | submitting | done | error
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);            // API response after submit

  const handleImageSelected = useCallback((file, previewUrl) => {
    setImageFile(file);
    setImagePreview(previewUrl);
    setError(null);
  }, []);

  const handleLocationPicked = useCallback((loc) => {
    setLocation(loc);
    setError(null);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!imageFile) return setError("Please select an image of the waterlogging.");
    if (!location) return setError("Please confirm your location.");

    try {
      // 1. Upload image to Firebase Storage
      setPhase("uploading");
      setUploadProgress(0);
      const uid = auth.currentUser?.uid || "anonymous";
      const imageUrl = await uploadReportImage(imageFile, uid, setUploadProgress);

      // 2. POST report to Flask backend
      setPhase("submitting");
      const response = await createReport({
        streetId: location.streetId || "unknown",
        imageUrl,
        lat: location.lat,
        lng: location.lng,
        description,
        reporterUid: uid,
      });

      setResult(response);
      setPhase("done");
    } catch (err) {
      setError(err.message);
      setPhase("error");
    }
  };

  const handleReset = () => {
    setImageFile(null);
    setImagePreview(null);
    setLocation(null);
    setDescription("");
    setUploadProgress(0);
    setPhase("idle");
    setError(null);
    setResult(null);
  };

  // ── Done state ──────────────────────────────────────────────────────────
  if (phase === "done" && result) {
    return (
      <div style={styles.page}>
        <SuccessToast
          severity={result.vision_analysis?.severity}
          reportId={result.id}
          onReset={handleReset}
        />
      </div>
    );
  }

  // ── Main form ───────────────────────────────────────────────────────────
  const isLoading = phase === "uploading" || phase === "submitting";

  return (
    <div style={styles.page}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <div style={styles.logoMark} aria-hidden="true" />
          <div>
            <h1 style={styles.title}>Report waterlogging</h1>
            <p style={styles.subtitle}>Help the city respond faster</p>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

        <form onSubmit={handleSubmit} style={styles.form} noValidate>
          {/* Step 1: Image */}
          <section style={styles.section}>
            <SectionLabel number="1" label="Photo of the waterlogging" />
            <ImageUploader
              onImageSelected={handleImageSelected}
              preview={imagePreview}
              disabled={isLoading}
            />
          </section>

          {/* Step 2: Location */}
          <section style={styles.section}>
            <SectionLabel number="2" label="Your location" />
            <LocationPicker
              onLocationPicked={handleLocationPicked}
              picked={location}
              disabled={isLoading}
            />
          </section>

          {/* Step 3: Description */}
          <section style={styles.section}>
            <SectionLabel number="3" label="Brief description (optional)" />
            <textarea
              style={styles.textarea}
              rows={3}
              placeholder="e.g. Water up to knee level near the crossing, drain completely blocked"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
              maxLength={300}
            />
            <span style={styles.charCount}>{description.length}/300</span>
          </section>

          {/* Progress bar */}
          {phase === "uploading" && (
            <div style={styles.progressWrap}>
              <div style={styles.progressLabel}>
                Uploading image… {uploadProgress}%
              </div>
              <div style={styles.progressTrack}>
                <div style={{ ...styles.progressBar, width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            style={{
              ...styles.submitBtn,
              ...(isLoading ? styles.submitBtnDisabled : {}),
            }}
            disabled={isLoading || !imageFile || !location}
          >
            {isLoading ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <LoadingSpinner size={16} color="#fff" />
                {phase === "uploading" ? "Uploading…" : "Submitting…"}
              </span>
            ) : (
              "Submit report"
            )}
          </button>
        </form>
      </main>
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────

function SectionLabel({ number, label }) {
  return (
    <div style={styles.sectionLabelRow}>
      <span style={styles.stepCircle}>{number}</span>
      <span style={styles.sectionLabel}>{label}</span>
    </div>
  );
}

// ── Styles (inline, mobile-first) ──────────────────────────────────────────
const C = {
  blue: "#185FA5",
  blueDark: "#0C447C",
  blueLight: "#E6F1FB",
  text: "#1a1a18",
  muted: "#5F5E5A",
  border: "rgba(0,0,0,0.12)",
  success: "#1D9E75",
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f7f6f2",
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
  },
  header: {
    background: C.blue,
    padding: "20px 16px 16px",
  },
  headerInner: {
    maxWidth: 480,
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: "rgba(255,255,255,0.25)",
    border: "2px solid rgba(255,255,255,0.4)",
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 600,
    color: "#fff",
    lineHeight: 1.2,
  },
  subtitle: {
    margin: 0,
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
  },
  main: {
    maxWidth: 480,
    margin: "0 auto",
    padding: "20px 16px 40px",
  },
  form: { display: "flex", flexDirection: "column", gap: 24 },
  section: { display: "flex", flexDirection: "column", gap: 10 },
  sectionLabelRow: { display: "flex", alignItems: "center", gap: 8 },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: C.blue,
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: 600,
    color: C.text,
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    borderRadius: 10,
    border: `1.5px solid ${C.border}`,
    background: "#fff",
    fontSize: 15,
    color: C.text,
    resize: "vertical",
    fontFamily: "inherit",
    outline: "none",
  },
  charCount: { fontSize: 12, color: C.muted, textAlign: "right" },
  progressWrap: { display: "flex", flexDirection: "column", gap: 6 },
  progressLabel: { fontSize: 13, color: C.muted },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    background: C.blueLight,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    background: C.blue,
    borderRadius: 3,
    transition: "width 0.2s ease",
  },
  submitBtn: {
    padding: "15px 24px",
    borderRadius: 12,
    background: C.blue,
    color: "#fff",
    fontSize: 16,
    fontWeight: 600,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: "background 0.15s",
  },
  submitBtnDisabled: {
    background: "#888",
    cursor: "not-allowed",
  },
};
