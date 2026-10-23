// CasePilot AI Frontend API Service
// Connects to FastAPI Backend at http://127.0.0.1:8000 with real cryptographic Bearer tokens

const API_BASE = "http://127.0.0.1:8000";

let authToken = localStorage.getItem("casepilot_auth_token") || "";

export const api = {
  setToken(token) {
    authToken = token;
    if (token) {
      localStorage.setItem("casepilot_auth_token", token);
    } else {
      localStorage.removeItem("casepilot_auth_token");
    }
  },

  getToken() {
    return authToken;
  },

  async req(url, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      ...(authToken ? { "Authorization": `Bearer ${authToken}` } : {}),
      ...(options.headers || {})
    };

    const res = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail || "API request failed");
    }
    return await res.json();
  },

  // Health
  async checkHealth() {
    try {
      const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
      return r.ok;
    } catch {
      return false;
    }
  },

  // Auth & Roles (FR-001)
  async login(email, password) {
    const res = await this.req("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    if (res.access_token) {
      this.setToken(res.access_token);
    }
    return res;
  },

  async switchPersona(role) {
    const res = await this.req("/api/v1/auth/switch-demo", {
      method: "POST",
      body: JSON.stringify({ role })
    });
    if (res.access_token) {
      this.setToken(res.access_token);
    }
    return res;
  },

  async getCurrentUser() {
    return await this.req("/api/v1/auth/me");
  },

  // Dashboard
  async getDashboardStats() {
    return await this.req("/api/v1/dashboard/stats");
  },

  // Cases (FR-003, FR-004)
  async getCases(params = {}) {
    const q = new URLSearchParams();
    if (params.search) q.append("search", params.search);
    if (params.status && params.status !== "All") q.append("status", params.status);
    if (params.case_type && params.case_type !== "All") q.append("case_type", params.case_type);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return await this.req(`/api/v1/cases${qs}`);
  },

  async getCaseDetail(caseId) {
    return await this.req(`/api/v1/cases/${caseId}`);
  },

  async createCase(caseData) {
    return await this.req("/api/v1/cases", {
      method: "POST",
      body: JSON.stringify(caseData)
    });
  },

  async updateCase(caseId, updateData) {
    return await this.req(`/api/v1/cases/${caseId}`, {
      method: "PATCH",
      body: JSON.stringify(updateData)
    });
  },

  async changeCaseStatus(caseId, status) {
    return await this.req(`/api/v1/cases/${caseId}/status`, {
      method: "POST",
      body: JSON.stringify({ status })
    });
  },

  async deleteCase(caseId) {
    return await this.req(`/api/v1/cases/${caseId}`, {
      method: "DELETE"
    });
  },

  // Documents (FR-005)
  async getDocuments(params = {}) {
    const q = new URLSearchParams();
    if (params.case_id) q.append("case_id", params.case_id);
    if (params.category && params.category !== "All") q.append("category", params.category);
    if (params.search) q.append("search", params.search);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return await this.req(`/api/v1/documents${qs}`);
  },

  async uploadDocument(docData) {
    return await this.req("/api/v1/documents", {
      method: "POST",
      body: JSON.stringify(docData)
    });
  },

  getDocumentDownloadURL(docId) {
    return `${API_BASE}/api/v1/documents/${docId}/download`;
  },

  async deleteDocument(docId) {
    return await this.req(`/api/v1/documents/${docId}`, { method: "DELETE" });
  },

  // AI Reviews & Verification (FR-006, FR-007)
  async getAISummaries(params = {}) {
    const q = new URLSearchParams();
    if (params.review_status && params.review_status !== "All") q.append("review_status", params.review_status);
    if (params.case_id) q.append("case_id", params.case_id);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return await this.req(`/api/v1/ai/summaries${qs}`);
  },

  async verifyCandidateFact(summaryId, factId, action, editedText) {
    return await this.req(`/api/v1/ai/summaries/${summaryId}/verify-fact`, {
      method: "POST",
      body: JSON.stringify({ fact_id: factId, action, edited_text: editedText })
    });
  },

  async approveAISummary(summaryId, acknowledgedAdvisory = true) {
    return await this.req(`/api/v1/ai/summaries/${summaryId}/approve`, {
      method: "POST",
      body: JSON.stringify({ acknowledged_advisory: acknowledgedAdvisory })
    });
  },

  async askAIAssistant(query) {
    return await this.req("/api/v1/ai/ask", {
      method: "POST",
      body: JSON.stringify({ query })
    });
  },

  // Hearings (FR-008)
  async getHearings(caseId) {
    const q = caseId ? `?case_id=${caseId}` : "";
    return await this.req(`/api/v1/hearings${q}`);
  },

  async createHearing(hearingData) {
    return await this.req("/api/v1/hearings", {
      method: "POST",
      body: JSON.stringify(hearingData)
    });
  },

  async deleteHearing(hearingId) {
    return await this.req(`/api/v1/hearings/${hearingId}`, { method: "DELETE" });
  },

  // Tasks (FR-008)
  async getTasks(params = {}) {
    const q = new URLSearchParams();
    if (params.case_id) q.append("case_id", params.case_id);
    if (params.is_completed !== undefined) q.append("is_completed", params.is_completed);
    const qs = q.toString() ? `?${q.toString()}` : "";
    return await this.req(`/api/v1/tasks${qs}`);
  },

  async createTask(taskData) {
    return await this.req("/api/v1/tasks", {
      method: "POST",
      body: JSON.stringify(taskData)
    });
  },

  async toggleTask(taskId) {
    return await this.req(`/api/v1/tasks/${taskId}/toggle`, { method: "POST" });
  },

  async deleteTask(taskId) {
    return await this.req(`/api/v1/tasks/${taskId}`, { method: "DELETE" });
  },

  // Clients
  async getClients() {
    return await this.req("/api/v1/clients");
  },

  async createClient(clientData) {
    return await this.req("/api/v1/clients", {
      method: "POST",
      body: JSON.stringify(clientData)
    });
  },

  // Audit Logs (FR-010)
  async getAuditLogs(entityType) {
    const q = entityType && entityType !== "All" ? `?entity_type=${entityType}` : "";
    return await this.req(`/api/v1/audit-logs${q}`);
  },

  async verifyAuditChainIntegrity() {
    return await this.req("/api/v1/audit-logs/verify-integrity");
  },

  // Data Export / Import (FR-011)
  async exportJSON() {
    return await this.req("/api/v1/export/json");
  },

  getCSVExportURL() {
    return `${API_BASE}/api/v1/export/csv/cases`;
  },

  async importCasesJSON(casesList) {
    return await this.req("/api/v1/import/cases", {
      method: "POST",
      body: JSON.stringify(casesList)
    });
  }
};
