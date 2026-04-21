// src/pages/AdminDashboardPage.jsx
// Official dashboard: risk heatmap + priority street table + resource controls.
// Three panes:
//   Left sidebar  – BudgetControls (sliders + monsoon toggle + weather alert input)
//   Center        – RiskHeatMap (mock Google Maps heatmap)
//   Bottom/Right  – PriorityTable (AI-ranked streets + allocation actions)

import { useState, useEffect, useCallback } from "react";
import { getPriority, runWeatherRecommendation, createAllocation, deleteAllocation } from "../services/api";
import BudgetControls from "../components/AdminDashboard/BudgetControls";
import RiskHeatMap from "../components/AdminDashboard/RiskHeatMap";
import PriorityTable from "../components/AdminDashboard/PriorityTable";
import WeatherAlertBox from "../components/AdminDashboard/WeatherAlertBox";
import LoadingSpinner from "../components/shared/LoadingSpinner";
import ErrorBanner from "../components/shared/ErrorBanner";

const DEFAULT_BUDGET = { pumps: 5, trucks: 10, workerDays: 20 };

export default function AdminDashboardPage() {
  // Budget + filter state
  const [budget, setBudget] = useState(DEFAULT_BUDGET);
  const [monsoonMode, setMonsoonMode] = useState(false);
  const [topN, setTopN] = useState(10);

  // Data state
  const [priorityData, setPriorityData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // Selected street for map highlight
  const [selectedStreetId, setSelectedStreetId] = useState(null);

  // Fetch priority list whenever budget, monsoon, or topN changes
  const fetchPriority = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // During monsoon, bump pumps to simulate higher resource deployment
      const effectiveBudget = monsoonMode
        ? { ...budget, pumps: Math.min(budget.pumps + 2, 20) }
        : budget;
      const data = await getPriority({ n: topN, ...effectiveBudget });
      setPriorityData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [budget, monsoonMode, topN]);

  useEffect(() => { fetchPriority(); }, [fetchPriority]);

  // Run Gemini weather-alert pipeline
  const handleWeatherAlert = async (alertText) => {
    try {
      setWeatherLoading(true);
      setError(null);
      const result = await runWeatherRecommendation(alertText, budget);
      // The recommendation re-scores streets; re-fetch updated priority list
      setPriorityData(result.allocation);
    } catch (err) {
      setError(err.message);
    } finally {
      setWeatherLoading(false);
    }
  };

  // Confirm resource assignment
  const handleAllocate = async (streetId, resourceType, quantity) => {
    try {
      await createAllocation({ streetId, resourceType, quantity, assignedBy: "official" });
      await fetchPriority(); // refresh list
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeallocate = async (allocationId) => {
    try {
      await deleteAllocation(allocationId);
      await fetchPriority();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={styles.shell}>
      {/* ── Top bar ────────────────────────────────────────────────────── */}
      <header style={styles.topBar}>
        <div style={styles.topBarLeft}>
          <div style={styles.logoMark} aria-hidden="true" />
          <div>
            <span style={styles.appName}>Flood-Ready Streets</span>
            <span style={styles.rolePill}>Admin</span>
          </div>
        </div>
        <div style={styles.topBarRight}>
          {priorityData && (
            <span style={styles.summaryChip}>
              {priorityData.streets_evaluated} streets · {priorityData.streets_allocated} allocated
            </span>
          )}
          <button style={styles.refreshBtn} onClick={fetchPriority} disabled={loading}>
            {loading ? <LoadingSpinner size={14} color="#185FA5" /> : "↻ Refresh"}
          </button>
        </div>
      </header>

      {/* ── Error banner ───────────────────────────────────────────────── */}
      {error && (
        <div style={{ padding: "0 16px" }}>
          <ErrorBanner message={error} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* ── Main grid ──────────────────────────────────────────────────── */}
      <div style={styles.grid}>

        {/* Left sidebar: budget + weather controls */}
        <aside style={styles.sidebar}>
          <BudgetControls
            budget={budget}
            onBudgetChange={setBudget}
            monsoonMode={monsoonMode}
            onMonsoonToggle={setMonsoonMode}
            topN={topN}
            onTopNChange={setTopN}
          />
          <div style={styles.sidebarDivider} />
          <WeatherAlertBox
            onSubmit={handleWeatherAlert}
            loading={weatherLoading}
          />
          {/* Budget remaining summary */}
          {priorityData && (
            <div style={styles.remainingCard}>
              <div style={styles.remainingTitle}>Remaining resources</div>
              {Object.entries(priorityData.budget_remaining || {}).map(([key, val]) => (
                <div key={key} style={styles.remainingRow}>
                  <span style={styles.remainingLabel}>{key.replace("_", " ")}</span>
                  <span style={styles.remainingVal}>{val}</span>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Center: heatmap */}
        <section style={styles.mapPane}>
          <RiskHeatMap
            allocations={priorityData?.allocations || []}
            selectedStreetId={selectedStreetId}
            onStreetClick={setSelectedStreetId}
            monsoonMode={monsoonMode}
          />
        </section>

        {/* Right/bottom: priority table */}
        <section style={styles.tablePane}>
          {loading ? (
            <div style={styles.tableLoader}>
              <LoadingSpinner size={28} color="#185FA5" />
              <span style={{ color: "#5F5E5A", marginTop: 8 }}>Computing allocations…</span>
            </div>
          ) : (
            <PriorityTable
              allocations={priorityData?.allocations || []}
              selectedStreetId={selectedStreetId}
              onStreetSelect={setSelectedStreetId}
              onAllocate={handleAllocate}
              onDeallocate={handleDeallocate}
            />
          )}
        </section>

      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const styles = {
  shell: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#f7f6f2",
    fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
  },
  topBar: {
    background: "#0C447C",
    padding: "12px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  topBarLeft: { display: "flex", alignItems: "center", gap: 10 },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "rgba(255,255,255,0.2)",
    border: "2px solid rgba(255,255,255,0.35)",
  },
  appName: { color: "#fff", fontWeight: 700, fontSize: 16, marginRight: 8 },
  rolePill: {
    padding: "2px 8px",
    borderRadius: 20,
    background: "#378ADD",
    color: "#fff",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  topBarRight: { display: "flex", alignItems: "center", gap: 10 },
  summaryChip: {
    padding: "4px 10px",
    borderRadius: 6,
    background: "rgba(255,255,255,0.15)",
    color: "#fff",
    fontSize: 12,
  },
  refreshBtn: {
    padding: "6px 12px",
    borderRadius: 8,
    background: "#fff",
    color: "#185FA5",
    fontWeight: 600,
    fontSize: 13,
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
  grid: {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "260px 1fr 360px",
    gridTemplateRows: "1fr",
    gap: 0,
    minHeight: 0,
    // Mobile fallback
    "@media (max-width: 900px)": {
      gridTemplateColumns: "1fr",
    },
  },
  sidebar: {
    background: "#fff",
    borderRight: "1px solid rgba(0,0,0,0.08)",
    padding: "16px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  sidebarDivider: {
    height: 1,
    background: "rgba(0,0,0,0.08)",
    margin: "16px 0",
  },
  mapPane: {
    position: "relative",
    minHeight: 400,
  },
  tablePane: {
    background: "#fff",
    borderLeft: "1px solid rgba(0,0,0,0.08)",
    overflowY: "auto",
  },
  tableLoader: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 60,
  },
  remainingCard: {
    marginTop: 16,
    padding: "12px",
    borderRadius: 10,
    background: "#f7f6f2",
    border: "1px solid rgba(0,0,0,0.08)",
  },
  remainingTitle: { fontSize: 12, fontWeight: 700, color: "#5F5E5A", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" },
  remainingRow: { display: "flex", justifyContent: "space-between", padding: "4px 0" },
  remainingLabel: { fontSize: 13, color: "#444441", textTransform: "capitalize" },
  remainingVal: { fontSize: 13, fontWeight: 700, color: "#185FA5" },
};
