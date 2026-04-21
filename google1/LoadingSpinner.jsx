// src/components/shared/LoadingSpinner.jsx
export default function LoadingSpinner({ size = 20, color = "#185FA5" }) {
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{ animation: "spin 0.8s linear infinite" }}
      aria-label="Loading"
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}


// ══════════════════════════════════════════════════════════════════════════
// src/components/shared/ErrorBanner.jsx
// ══════════════════════════════════════════════════════════════════════════
export function ErrorBanner({ message, onDismiss }) {
  return (
    <div style={eb.wrap} role="alert">
      <span style={eb.icon} aria-hidden="true">⚠</span>
      <span style={eb.msg}>{message}</span>
      {onDismiss && (
        <button style={eb.close} onClick={onDismiss} aria-label="Dismiss">✕</button>
      )}
    </div>
  );
}

const eb = {
  wrap: {
    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
    borderRadius: 10, background: "#FCEBEB", border: "1px solid #F7C1C1",
    marginBottom: 12,
  },
  icon: { fontSize: 16, color: "#A32D2D", flexShrink: 0 },
  msg: { flex: 1, fontSize: 14, color: "#791F1F" },
  close: { background: "none", border: "none", cursor: "pointer", color: "#A32D2D", fontSize: 14, padding: 0 },
};


// ══════════════════════════════════════════════════════════════════════════
// src/components/shared/SuccessToast.jsx
// ══════════════════════════════════════════════════════════════════════════
export function SuccessToast({ severity, reportId, onReset }) {
  const severityColors = {
    critical: { bg: "#FCEBEB", color: "#A32D2D" },
    high:     { bg: "#FAEEDA", color: "#633806" },
    medium:   { bg: "#E6F1FB", color: "#0C447C" },
    low:      { bg: "#EAF3DE", color: "#27500A" },
  };
  const sc = severityColors[severity] || severityColors.medium;

  return (
    <div style={st.page}>
      <div style={st.card}>
        <div style={st.check} aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1D9E75" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M8 12l3 3 5-5"/>
          </svg>
        </div>
        <h2 style={st.title}>Report submitted!</h2>
        <p style={st.sub}>Our AI is analysing your photo.</p>
        {severity && (
          <div style={{ ...st.severityPill, background: sc.bg, color: sc.color }}>
            Severity detected: {severity}
          </div>
        )}
        {reportId && <p style={st.id}>Report ID: {reportId}</p>}
        <button style={st.btn} onClick={onReset}>Submit another</button>
      </div>
    </div>
  );
}

const st = {
  page: { minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  card: {
    maxWidth: 360, width: "100%", background: "#fff",
    borderRadius: 16, padding: "32px 24px", textAlign: "center",
    border: "1px solid rgba(0,0,0,0.08)",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
  },
  check: { marginBottom: 4 },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: "#1a1a18" },
  sub: { margin: 0, fontSize: 15, color: "#5F5E5A" },
  severityPill: {
    padding: "4px 16px", borderRadius: 20,
    fontSize: 13, fontWeight: 700, textTransform: "capitalize",
  },
  id: { margin: 0, fontSize: 11, color: "#888780", fontFamily: "monospace" },
  btn: {
    marginTop: 8, padding: "12px 28px", borderRadius: 10, background: "#185FA5",
    color: "#fff", fontSize: 15, fontWeight: 600, border: "none", cursor: "pointer",
  },
};


// ══════════════════════════════════════════════════════════════════════════
// src/components/shared/StatusPill.jsx
// ══════════════════════════════════════════════════════════════════════════
export function StatusPill({ status }) {
  const MAP = {
    pending:  { bg: "#FAEEDA", color: "#633806", label: "Pending" },
    verified: { bg: "#EAF3DE", color: "#27500A", label: "Verified" },
    dismissed:{ bg: "#F1EFE8", color: "#5F5E5A", label: "Dismissed" },
    active:   { bg: "#E6F1FB", color: "#0C447C", label: "Active" },
    completed:{ bg: "#EAF3DE", color: "#27500A", label: "Done" },
  };
  const { bg, color, label } = MAP[status] || MAP.pending;
  return (
    <span style={{ padding: "2px 8px", borderRadius: 4, background: bg, color, fontSize: 11, fontWeight: 700 }}>
      {label}
    </span>
  );
}
