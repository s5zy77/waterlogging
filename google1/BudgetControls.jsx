// src/components/AdminDashboard/BudgetControls.jsx
// Sidebar sliders for pump / truck / worker-day budget + monsoon toggle.

export default function BudgetControls({
  budget, onBudgetChange, monsoonMode, onMonsoonToggle, topN, onTopNChange
}) {
  const sliders = [
    { key: "pumps",      label: "Pumps",        min: 0, max: 20, color: "#185FA5" },
    { key: "trucks",     label: "Trucks",        min: 0, max: 30, color: "#0F6E56" },
    { key: "workerDays", label: "Worker-days",   min: 0, max: 60, color: "#854F0B" },
  ];

  return (
    <div style={bc.wrap}>
      <div style={bc.sectionTitle}>Resource budget</div>

      {sliders.map(({ key, label, min, max, color }) => (
        <div key={key} style={bc.sliderWrap}>
          <div style={bc.sliderHeader}>
            <span style={bc.sliderLabel}>{label}</span>
            <span style={{ ...bc.sliderValue, color }}>{budget[key]}</span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            value={budget[key]}
            onChange={(e) => onBudgetChange({ ...budget, [key]: Number(e.target.value) })}
            style={{ ...bc.slider, accentColor: color, width: "100%" }}
          />
          <div style={bc.sliderRange}>
            <span>{min}</span><span>{max}</span>
          </div>
        </div>
      ))}

      <div style={bc.sliderWrap}>
        <div style={bc.sliderHeader}>
          <span style={bc.sliderLabel}>Top streets (N)</span>
          <span style={{ ...bc.sliderValue, color: "#534AB7" }}>{topN}</span>
        </div>
        <input
          type="range" min={3} max={20} value={topN}
          onChange={(e) => onTopNChange(Number(e.target.value))}
          style={{ ...bc.slider, accentColor: "#534AB7", width: "100%" }}
        />
      </div>

      {/* Monsoon toggle */}
      <div style={bc.toggleRow}>
        <div>
          <div style={bc.toggleLabel}>Monsoon mode</div>
          <div style={bc.toggleHint}>Amplifies risk weights</div>
        </div>
        <button
          type="button"
          onClick={() => onMonsoonToggle(!monsoonMode)}
          style={{
            ...bc.toggleBtn,
            background: monsoonMode ? "#185FA5" : "#D3D1C7",
          }}
          aria-pressed={monsoonMode}
        >
          <span style={{
            ...bc.toggleThumb,
            transform: monsoonMode ? "translateX(18px)" : "translateX(0px)",
          }} />
        </button>
      </div>
    </div>
  );
}

const bc = {
  wrap: { display: "flex", flexDirection: "column", gap: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 700, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.06em" },
  sliderWrap: { display: "flex", flexDirection: "column", gap: 4 },
  sliderHeader: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  sliderLabel: { fontSize: 13, fontWeight: 500, color: "#2C2C2A" },
  sliderValue: { fontSize: 14, fontWeight: 700 },
  slider: { height: 4, cursor: "pointer", margin: "4px 0" },
  sliderRange: { display: "flex", justifyContent: "space-between", fontSize: 10, color: "#888780" },
  toggleRow: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" },
  toggleLabel: { fontSize: 13, fontWeight: 600, color: "#2C2C2A" },
  toggleHint: { fontSize: 11, color: "#888780" },
  toggleBtn: {
    width: 42, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
    position: "relative", transition: "background 0.2s", padding: 0,
  },
  toggleThumb: {
    position: "absolute", top: 3, left: 3,
    width: 18, height: 18, borderRadius: "50%", background: "#fff",
    transition: "transform 0.2s", display: "block",
  },
};


// ══════════════════════════════════════════════════════════════════════════
// src/components/AdminDashboard/PriorityTable.jsx
// ══════════════════════════════════════════════════════════════════════════
// Ranked list of streets with risk badges, resource tags, and allocate button.

export function PriorityTable({ allocations, selectedStreetId, onStreetSelect, onAllocate, onDeallocate }) {
  if (!allocations.length) {
    return <div style={pt.empty}>No streets meet the risk threshold.</div>;
  }

  return (
    <div style={pt.wrap}>
      <div style={pt.header}>
        <span style={pt.headerTitle}>Priority streets</span>
        <span style={pt.headerSub}>{allocations.length} streets</span>
      </div>

      <div style={pt.list}>
        {allocations.map((row) => (
          <div
            key={row.street_id}
            style={{
              ...pt.row,
              ...(selectedStreetId === row.street_id ? pt.rowSelected : {}),
            }}
            onClick={() => onStreetSelect(row.street_id)}
          >
            {/* Rank badge */}
            <div style={{ ...pt.rankBadge, background: rankColor(row.priority_rank) }}>
              {row.priority_rank}
            </div>

            {/* Street info */}
            <div style={pt.info}>
              <div style={pt.streetName}>{row.street_name}</div>
              <div style={pt.streetMeta}>
                <span style={pt.zonePill}>{row.zone}</span>
                <RiskBadge score={row.risk_score} />
              </div>
              <div style={pt.resources}>
                {row.assigned_resources.map((r, i) => (
                  <ResourceTag key={i} resource={r} />
                ))}
              </div>
              <div style={pt.rationale}>{row.rationale}</div>
            </div>

            {/* Confirm button */}
            <button
              style={pt.allocateBtn}
              onClick={(e) => {
                e.stopPropagation();
                onAllocate(row.street_id, "pump", 1);
              }}
            >
              Confirm
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskBadge({ score }) {
  const { bg, color, label } = riskLevel(score);
  return <span style={{ ...pt.badge, background: bg, color }}>{label} {score}</span>;
}

function ResourceTag({ resource }) {
  const icons = { pump: "💧", truck: "🚛", workers: "👷" };
  const type = resource.split(":")[0];
  return (
    <span style={pt.resourceTag}>
      {icons[type] || "🔧"} {resource}
    </span>
  );
}

function rankColor(rank) {
  if (rank === 1) return "#E24B4A";
  if (rank <= 3) return "#EF9F27";
  if (rank <= 6) return "#185FA5";
  return "#888780";
}

function riskLevel(score) {
  if (score >= 80) return { bg: "#FCEBEB", color: "#A32D2D", label: "Critical" };
  if (score >= 60) return { bg: "#FAEEDA", color: "#633806", label: "High" };
  if (score >= 40) return { bg: "#E6F1FB", color: "#0C447C", label: "Medium" };
  return { bg: "#EAF3DE", color: "#27500A", label: "Low" };
}

const pt = {
  wrap: { display: "flex", flexDirection: "column", height: "100%" },
  header: { padding: "14px 16px", borderBottom: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "baseline", gap: 8 },
  headerTitle: { fontSize: 14, fontWeight: 700, color: "#2C2C2A" },
  headerSub: { fontSize: 12, color: "#888780" },
  list: { overflowY: "auto", flex: 1 },
  empty: { padding: 32, textAlign: "center", color: "#888780", fontSize: 14 },
  row: {
    display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px",
    borderBottom: "1px solid rgba(0,0,0,0.05)", cursor: "pointer",
    transition: "background 0.1s",
  },
  rowSelected: { background: "#E6F1FB" },
  rankBadge: {
    minWidth: 26, height: 26, borderRadius: 6,
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "#fff", fontSize: 12, fontWeight: 800, flexShrink: 0, marginTop: 2,
  },
  info: { flex: 1, display: "flex", flexDirection: "column", gap: 4 },
  streetName: { fontSize: 14, fontWeight: 600, color: "#1a1a18" },
  streetMeta: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  zonePill: {
    padding: "1px 6px", borderRadius: 4, background: "#F1EFE8",
    color: "#5F5E5A", fontSize: 11, fontWeight: 600, textTransform: "capitalize",
  },
  badge: { padding: "1px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700 },
  resources: { display: "flex", flexWrap: "wrap", gap: 4 },
  resourceTag: {
    padding: "2px 7px", borderRadius: 4, background: "#f0f7ff",
    color: "#185FA5", fontSize: 11, fontWeight: 500,
  },
  rationale: { fontSize: 11, color: "#888780", lineHeight: 1.4 },
  allocateBtn: {
    padding: "5px 10px", borderRadius: 7, background: "#185FA5",
    color: "#fff", fontSize: 12, fontWeight: 600, border: "none",
    cursor: "pointer", flexShrink: 0, marginTop: 2,
  },
};


// ══════════════════════════════════════════════════════════════════════════
// src/components/AdminDashboard/RiskHeatMap.jsx
// ══════════════════════════════════════════════════════════════════════════
// Mock heatmap using a styled div grid. Swap the inner content for a real
// Google Maps HeatmapLayer once the Maps JS API is wired up.

export function RiskHeatMap({ allocations, selectedStreetId, onStreetClick, monsoonMode }) {
  // Build a mock grid of risk cells from allocations data
  const cells = allocations.slice(0, 20).map((a, i) => ({
    id: a.street_id,
    name: a.street_name,
    score: a.risk_score,
    zone: a.zone,
    col: i % 5,
    row: Math.floor(i / 5),
  }));

  return (
    <div style={hm.wrap}>
      {/* Map placeholder header */}
      <div style={hm.header}>
        <span style={hm.headerLabel}>Kolkata — waterlogging risk heatmap</span>
        {monsoonMode && <span style={hm.monsoonBadge}>Monsoon mode ON</span>}
        <span style={hm.mapNote}>Connect Google Maps JS API for live layer</span>
      </div>

      {/* Mock grid heatmap */}
      <div style={hm.grid}>
        {cells.map((cell) => {
          const { bg } = heatColor(cell.score);
          const isSelected = selectedStreetId === cell.id;
          return (
            <div
              key={cell.id}
              style={{
                ...hm.cell,
                background: bg,
                border: isSelected ? "2.5px solid #0C447C" : "1.5px solid rgba(255,255,255,0.4)",
                zIndex: isSelected ? 2 : 1,
              }}
              onClick={() => onStreetClick(cell.id)}
              title={`${cell.name}: ${cell.score}`}
            >
              <span style={hm.cellScore}>{Math.round(cell.score)}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={hm.legend}>
        <span style={hm.legendLabel}>Risk:</span>
        {[
          { label: "Low", color: "#5DCAA5" },
          { label: "Medium", color: "#EF9F27" },
          { label: "High", color: "#D85A30" },
          { label: "Critical", color: "#E24B4A" },
        ].map(({ label, color }) => (
          <div key={label} style={hm.legendItem}>
            <div style={{ ...hm.legendSwatch, background: color }} />
            <span style={hm.legendText}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function heatColor(score) {
  if (score >= 80) return { bg: "#E24B4A" };
  if (score >= 60) return { bg: "#D85A30" };
  if (score >= 40) return { bg: "#EF9F27" };
  return { bg: "#5DCAA5" };
}

const hm = {
  wrap: { display: "flex", flexDirection: "column", height: "100%", background: "#1a2744" },
  header: {
    padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
    background: "rgba(0,0,0,0.3)",
  },
  headerLabel: { fontSize: 13, fontWeight: 600, color: "#fff" },
  monsoonBadge: {
    padding: "2px 8px", borderRadius: 4, background: "#378ADD",
    color: "#fff", fontSize: 11, fontWeight: 700,
  },
  mapNote: { fontSize: 11, color: "rgba(255,255,255,0.4)", marginLeft: "auto" },
  grid: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 4,
    padding: 16,
    alignContent: "start",
  },
  cell: {
    aspectRatio: "1",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "border 0.1s, transform 0.1s",
  },
  cellScore: { fontSize: 12, fontWeight: 800, color: "rgba(255,255,255,0.9)" },
  legend: {
    display: "flex", alignItems: "center", gap: 12, padding: "8px 16px",
    background: "rgba(0,0,0,0.25)", flexWrap: "wrap",
  },
  legendLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)" },
  legendItem: { display: "flex", alignItems: "center", gap: 5 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 11, color: "rgba(255,255,255,0.75)" },
};


// ══════════════════════════════════════════════════════════════════════════
// src/components/AdminDashboard/WeatherAlertBox.jsx
// ══════════════════════════════════════════════════════════════════════════
// Textarea to paste an IMD weather alert → Gemini pipeline → updated scores.

export function WeatherAlertBox({ onSubmit, loading }) {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(text.trim());
  };

  return (
    <div style={wa.wrap}>
      <div style={wa.title}>Weather alert (Gemini)</div>
      <textarea
        style={wa.textarea}
        rows={4}
        placeholder="Paste an IMD or weather bulletin here…&#10;e.g. Red alert: heavy rainfall 220mm in 24hrs for Kolkata"
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={loading}
      />
      <button
        style={{ ...wa.btn, ...(loading ? wa.btnDisabled : {}) }}
        onClick={handleSubmit}
        disabled={loading || !text.trim()}
      >
        {loading ? "Analysing…" : "Run Gemini analysis"}
      </button>
    </div>
  );
}

// need useState for WeatherAlertBox
import { useState } from "react";

const wa = {
  wrap: { display: "flex", flexDirection: "column", gap: 8 },
  title: { fontSize: 11, fontWeight: 700, color: "#5F5E5A", textTransform: "uppercase", letterSpacing: "0.06em" },
  textarea: {
    width: "100%", boxSizing: "border-box", padding: "8px 10px",
    borderRadius: 8, border: "1.5px solid rgba(0,0,0,0.12)",
    background: "#f7f6f2", fontSize: 12, color: "#2C2C2A",
    resize: "vertical", fontFamily: "inherit", outline: "none",
  },
  btn: {
    padding: "8px 12px", borderRadius: 8, background: "#534AB7",
    color: "#fff", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
  },
  btnDisabled: { background: "#888", cursor: "not-allowed" },
};
