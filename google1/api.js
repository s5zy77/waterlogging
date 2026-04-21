// src/services/api.js
// Axios API client — all calls to the Flask backend live here.
// Components never import axios directly; they call these helpers instead.
// This makes it trivial to mock during tests or swap the base URL.

import axios from "axios";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor: attach Firebase ID token if present ──────────────
api.interceptors.request.use(async (config) => {
  try {
    const { auth } = await import("./firebase");
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (_) {}
  return config;
});

// ── Response interceptor: unwrap data, surface error messages ────────────
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message =
      err.response?.data?.error || err.message || "Unknown error";
    return Promise.reject(new Error(message));
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// Streets
// ═══════════════════════════════════════════════════════════════════════════

/** List all street segments. Pass { zone } to filter by city zone. */
export const getStreets = (params = {}) =>
  api.get("/api/streets", { params });

/** Get one street's full detail including score history. */
export const getStreet = (streetId) =>
  api.get(`/api/streets/${streetId}`);

/** GeoJSON FeatureCollection for the heatmap layer. */
export const getHeatmap = () =>
  api.get("/api/streets/heatmap");

/** Create a new street segment (admin / seeding). */
export const createStreet = (data) =>
  api.post("/api/streets", data);

/**
 * Update a street's risk score.
 * @param {string} streetId
 * @param {number} riskScore  0–100
 * @param {string} reason     Human-readable reason
 */
export const updateRiskScore = (streetId, riskScore, reason = "") =>
  api.patch(`/api/streets/${streetId}/risk-score`, { risk_score: riskScore, reason });


// ═══════════════════════════════════════════════════════════════════════════
// Reports
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Submit a citizen waterlogging report.
 * The image must already be uploaded to Firebase Storage; pass its URL here.
 *
 * @param {{ streetId, imageUrl, lat, lng, description, reporterUid }} payload
 */
export const createReport = ({ streetId, imageUrl, lat, lng, description, reporterUid }) =>
  api.post("/api/reports", {
    street_id: streetId,
    image_url: imageUrl,
    lat,
    lng,
    description,
    reporter_uid: reporterUid,
  });

/** List reports. Pass { streetId, status } to filter. */
export const getReports = (params = {}) =>
  api.get("/api/reports", {
    params: {
      ...(params.streetId && { street_id: params.streetId }),
      ...(params.status && { status: params.status }),
    },
  });

/** Get a single report with its Vision AI analysis result. */
export const getReport = (reportId) =>
  api.get(`/api/reports/${reportId}`);

/** Official marks a report verified or dismissed. */
export const updateReportStatus = (reportId, status, officialUid = "") =>
  api.patch(`/api/reports/${reportId}/status`, { status, official_uid: officialUid });

/**
 * Manually trigger Vision AI analysis on an image URL.
 * Optionally persists the result to an existing report.
 */
export const analyzeImage = (imageUrl, reportId = null) =>
  api.post("/api/reports/analyze", {
    image_url: imageUrl,
    ...(reportId && { report_id: reportId }),
  });


// ═══════════════════════════════════════════════════════════════════════════
// Priority & Resource Allocation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get top-N priority streets with recommended resource allocations.
 * @param {{ n, pumps, trucks, workerDays }} budget
 */
export const getPriority = ({ n = 10, pumps = 5, trucks = 10, workerDays = 20 } = {}) =>
  api.get("/api/priority", {
    params: { n, pumps, trucks, worker_days: workerDays },
  });

/**
 * Run the full Gemini weather-alert pipeline:
 * parse alert → update weights → re-score streets → return allocations.
 *
 * @param {string} alertText  Raw weather bulletin text
 * @param {{ pumps, trucks, workerDays }} budget
 */
export const runWeatherRecommendation = (alertText, budget = {}) =>
  api.post("/api/priority/recommend", {
    alert_text: alertText,
    pumps: budget.pumps ?? 5,
    trucks: budget.trucks ?? 10,
    worker_days: budget.workerDays ?? 20,
  });

/** Get current confirmed resource assignments. */
export const getAllocations = () =>
  api.get("/api/priority/allocations");

/**
 * Confirm and persist a resource assignment.
 * @param {{ streetId, resourceType, quantity, assignedBy }} data
 */
export const createAllocation = ({ streetId, resourceType, quantity = 1, assignedBy = "" }) =>
  api.post("/api/priority/allocations", {
    street_id: streetId,
    resource_type: resourceType,
    quantity,
    assigned_by: assignedBy,
  });

/** Mark an allocation as completed (resource returned). */
export const deleteAllocation = (allocationId) =>
  api.delete(`/api/priority/allocations/${allocationId}`);
