import React, { useState, useEffect, useMemo } from 'react';
import {
  Gavel, LayoutDashboard, FolderKanban, FileText, CalendarDays, ListChecks,
  Users, Sparkles, Search, Plus, Bell, Clock3, Check, X, ShieldCheck,
  Download, Upload, AlertTriangle, Eye, Trash2, ArrowUpRight, Scale,
  CheckCircle2, XCircle, Edit3, MessageSquare, ChevronRight, RefreshCw,
  Lock, Filter, ExternalLink, Calendar, Building, UserCheck, Key, ShieldAlert,
  HelpCircle, BookOpen, Command, FileSpreadsheet
} from 'lucide-react';
import { api } from './api';

const USERS = [
  { name: 'Arjun Kapoor', email: 'arjun.kapoor@lexford.legal', role: 'Managing Attorney', initials: 'AK', color: '#2563eb' },
  { name: 'Priya Nair', email: 'priya.nair@lexford.legal', role: 'Senior Associate', initials: 'PN', color: '#7c3aed' },
  { name: 'Rohan Gupta', email: 'rohan.gupta@lexford.legal', role: 'Paralegal', initials: 'RG', color: '#059669' },
  { name: 'Kavita Desai', email: 'kavita.desai@lexford.legal', role: 'Compliance Officer', initials: 'KD', color: '#d97706' },
];

const NAV_ITEMS = [
  { id: 'Dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'Cases', label: 'Cases & Matters', icon: FolderKanban },
  { id: 'Documents', label: 'Documents & Vault', icon: FileText },
  { id: 'AI Review', label: 'AI Review Desk', icon: Sparkles, badgeAlert: true },
  { id: 'Calendar', label: 'Hearings & Calendar', icon: CalendarDays },
  { id: 'Tasks', label: 'Tasks & Deadlines', icon: ListChecks },
  { id: 'Clients', label: 'Clients & Directory', icon: Users },
  { id: 'Audit Trail', label: 'Audit Compliance', icon: ShieldCheck },
  { id: 'Integrations', label: 'Import / Export & API', icon: Download },
];

export default function App() {
  // Navigation & User Context (FR-001)
  const [page, setPage] = useState('Dashboard');
  const [currentUser, setCurrentUser] = useState(USERS[0]);
  const [loading, setLoading] = useState(true);

  // Core Data Collections
  const [stats, setStats] = useState({
    metrics: { active_cases: 0, total_cases: 0, upcoming_hearings: 0, pending_tasks: 0, ai_reviews_awaiting: 0 },
    recent_cases: [],
    upcoming_hearings: [],
    tasks: [],
    recent_logs: []
  });
  const [cases, setCases] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [aiSummaries, setAiSummaries] = useState([]);
  const [hearings, setHearings] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditChainProof, setAuditChainProof] = useState(null);

  // Filters & Global Search (FR-009)
  const [searchQuery, setSearchQuery] = useState('');
  const [caseStatusFilter, setCaseStatusFilter] = useState('All');
  const [caseTypeFilter, setCaseTypeFilter] = useState('All');
  const [docCategoryFilter, setDocCategoryFilter] = useState('All');
  const [aiReviewTab, setAiReviewTab] = useState('verifications');
  const [auditFilter, setAuditFilter] = useState('All');

  // Interactive Modals
  const [modalNewCase, setModalNewCase] = useState(false);
  const [modalUploadDoc, setModalUploadDoc] = useState(false);
  const [modalNewHearing, setModalNewHearing] = useState(false);
  const [modalNewTask, setModalNewTask] = useState(false);
  const [modalNewClient, setModalNewClient] = useState(false);
  const [modalUserGuide, setModalUserGuide] = useState(false);
  const [selectedCaseDetail, setSelectedCaseDetail] = useState(null);
  const [selectedCaseSubTab, setSelectedCaseSubTab] = useState('overview');

  // AI Copilot Interactive Chat State
  const [copilotQuery, setCopilotQuery] = useState('');
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotChat, setCopilotChat] = useState([
    {
      role: 'assistant',
      text: 'Good morning Counselor. I am CasePilot AI, your legal intelligence assistant. How may I assist your preparation today? You can ask about active litigation timelines, statutory limitation periods, or request an argument outline.',
      sources: ['CasePilot Legal Knowledge Base', 'PS-01 Compliance Guardrails']
    }
  ]);

  // Toast Notification
  const [toast, setToast] = useState('');

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  // Initial Authentication & Data Fetch
  const refreshAllData = async () => {
    try {
      // Ensure we have an active bearer token for the current user
      if (!api.getToken()) {
        const authData = await api.switchPersona(currentUser.role);
        if (authData.access_token) {
          api.setToken(authData.access_token);
        }
      }

      const [dashData, casesData, docsData, aiData, hearingsData, tasksData, clientsData, auditData] = await Promise.all([
        api.getDashboardStats().catch(() => null),
        api.getCases().catch(() => []),
        api.getDocuments().catch(() => []),
        api.getAISummaries().catch(() => []),
        api.getHearings().catch(() => []),
        api.getTasks().catch(() => []),
        api.getClients().catch(() => []),
        api.getAuditLogs().catch(() => [])
      ]);

      if (dashData) setStats(dashData);
      if (casesData) setCases(casesData);
      if (docsData) setDocuments(docsData);
      if (aiData) setAiSummaries(aiData);
      if (hearingsData) setHearings(hearingsData);
      if (tasksData) setTasks(tasksData);
      if (clientsData) setClients(clientsData);
      if (auditData) setAuditLogs(auditData);
    } catch (err) {
      console.warn('Data sync notice:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAllData();
    const interval = setInterval(refreshAllData, 12000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard Shortcuts for Enhanced Usability (?, /, Esc)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if (e.key === 'Escape') {
        setModalNewCase(false);
        setModalUploadDoc(false);
        setModalNewHearing(false);
        setModalNewTask(false);
        setModalNewClient(false);
        setSelectedCaseDetail(null);
        setModalUserGuide(false);
      } else if (e.key === '?' && !inInput) {
        e.preventDefault();
        setModalUserGuide(prev => !prev);
      } else if (e.key === '/' && !inInput) {
        e.preventDefault();
        const searchInput = document.querySelector('.search-box input');
        if (searchInput) searchInput.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handle Persona Switching with Authenticated Token
  const handleSwitchUser = async (userObj) => {
    try {
      setCurrentUser(userObj);
      const res = await api.switchPersona(userObj.role);
      showToast(`Authenticated as ${userObj.name} (${userObj.role}) · Bearer Token Issued`);
      refreshAllData();
    } catch (err) {
      showToast('Error switching persona: ' + err.message);
    }
  };

  // Filtered Cases
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      const matchesSearch = searchQuery === '' ||
        Object.values(c).join(' ').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = caseStatusFilter === 'All' || c.status === caseStatusFilter;
      const matchesType = caseTypeFilter === 'All' || c.case_type === caseTypeFilter;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [cases, searchQuery, caseStatusFilter, caseTypeFilter]);

  // Filtered Documents
  const filteredDocs = useMemo(() => {
    return documents.filter(d => {
      const matchesCategory = docCategoryFilter === 'All' || d.category === docCategoryFilter;
      const matchesSearch = searchQuery === '' ||
        (d.filename + ' ' + (d.case_title || '')).toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [documents, docCategoryFilter, searchQuery]);

  // Counters
  const pendingTasksCount = useMemo(() => tasks.filter(t => !t.is_completed).length, [tasks]);
  const pendingAiCount = useMemo(() => aiSummaries.filter(s => s.review_status === 'Pending Human Review').length, [aiSummaries]);

  // Handle Task Toggle
  const handleToggleTask = async (taskId) => {
    try {
      const updated = await api.toggleTask(taskId);
      setTasks(prev => prev.map(t => t.id === taskId ? updated : t));
      showToast(`Task updated by ${currentUser.name}`);
      refreshAllData();
    } catch (err) {
      showToast(err.message || 'Failed to update task');
    }
  };

  // Handle Fact Verification (FR-007)
  const handleVerifyFact = async (summaryId, factId, action) => {
    try {
      const res = await api.verifyCandidateFact(summaryId, factId, action);
      setAiSummaries(prev => prev.map(s => s.id === summaryId ? res.summary : s));
      showToast(`Candidate fact marked as ${action}ed by ${currentUser.name}`);
      refreshAllData();
    } catch (err) {
      showToast(err.message || 'Error updating fact verification');
    }
  };

  // Handle Approve Summary with Active Lawyer Acknowledgment (FR-007)
  const handleApproveSummary = async (summaryId, acknowledged) => {
    if (!acknowledged) {
      alert('Statutory Warning: You must affirmatively acknowledge that you have independently verified the candidate facts before final legal sign-off.');
      return;
    }
    try {
      const res = await api.approveAISummary(summaryId, acknowledged);
      setAiSummaries(prev => prev.map(s => s.id === summaryId ? res.summary : s));
      showToast('Document analysis approved and digitally signed by counsel.');
      refreshAllData();
    } catch (err) {
      showToast(err.message || 'Error approving summary');
    }
  };

  // Handle AI Copilot Query
  const handleAskCopilot = async (presetText) => {
    const q = presetText || copilotQuery;
    if (!q.trim()) return;

    setCopilotChat(prev => [...prev, { role: 'user', text: q }]);
    setCopilotQuery('');
    setCopilotLoading(true);

    try {
      const resp = await api.askAIAssistant(q);
      setCopilotChat(prev => [...prev, {
        role: 'assistant',
        text: resp.answer,
        sources: resp.sources,
        suggested_tasks: resp.suggested_tasks,
        advisory_label: resp.advisory_label
      }]);
    } catch (err) {
      setCopilotChat(prev => [...prev, {
        role: 'assistant',
        text: 'Error processing inquiry. ' + err.message,
        sources: ['Local Error Handler']
      }]);
    } finally {
      setCopilotLoading(false);
    }
  };

  // Case Detail Drawer Handler
  const openCaseDetail = async (c) => {
    setSelectedCaseDetail(c);
    setSelectedCaseSubTab('overview');
    try {
      const fullDetail = await api.getCaseDetail(c.id);
      setSelectedCaseDetail(fullDetail);
    } catch (e) {
      // Keep existing object
    }
  };

  // Handle Case Status Change
  const handleChangeCaseStatus = async (caseId, newStatus) => {
    try {
      await api.changeCaseStatus(caseId, newStatus);
      showToast(`Case status transitioned to ${newStatus}`);
      refreshAllData();
      if (selectedCaseDetail?.case?.id === caseId) {
        setSelectedCaseDetail(prev => ({
          ...prev,
          case: { ...prev.case, status: newStatus }
        }));
      }
    } catch (err) {
      showToast(err.message || 'Error changing case status');
    }
  };

  // Handle Case Deletion with Server RBAC check
  const handleDeleteCase = async (caseId) => {
    if (!window.confirm('Are you sure you want to delete this case record? This action is logged in audit history.')) {
      return;
    }
    try {
      await api.deleteCase(caseId);
      showToast('Case record successfully deleted.');
      setSelectedCaseDetail(null);
      refreshAllData();
    } catch (err) {
      showToast(err.message || 'Error deleting case');
    }
  };

  // Verify Audit Trail Cryptographic Hash Chain (FR-010)
  const handleVerifyAuditChain = async () => {
    try {
      const proof = await api.verifyAuditChainIntegrity();
      setAuditChainProof(proof);
      if (proof.verified) {
        showToast(`Audit Chain Verified: ${proof.chain_length} blocks valid under Sec 65B BSA.`);
      } else {
        showToast('WARNING: Tampering detected in audit log chain!');
      }
    } catch (err) {
      showToast('Error verifying audit chain: ' + err.message);
    }
  };

  // Data Export Handlers (FR-011)
  const handleExportJSON = async () => {
    try {
      const bundle = await api.exportJSON();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `casepilot_workspace_export_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Workspace exported to JSON successfully.');
    } catch (e) {
      showToast('Export failed: ' + e.message);
    }
  };

  return (
    <div className="app-shell">
      {/* ----------------- SIDEBAR ----------------- */}
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Scale size={22} />
          </div>
          <div className="brand-info">
            <strong>CasePilot<span>AI</span></strong>
            <small>LEGAL WORKSPACE · PS-01</small>
          </div>
        </div>

        <div className="workspace-badge">
          <div className="workspace-badge-avatar">LF</div>
          <div>
            <b>Lexford & Partners Legal</b>
            <span>Active Chamber · Delhi & Saket</span>
          </div>
        </div>

        <p className="nav-section-title">NAVIGATION</p>
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => {
            const Icon = item.icon;
            const isActive = page === item.id;
            return (
              <button
                key={item.id}
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => setPage(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.id === 'AI Review' && pendingAiCount > 0 && (
                  <span className="nav-counter alert">{pendingAiCount}</span>
                )}
                {item.id === 'Tasks' && pendingTasksCount > 0 && (
                  <span className="nav-counter">{pendingTasksCount}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="security-seal">
            <Lock size={15} />
            <div>
              <b>Encrypted Vault</b>
              <p style={{ fontSize: '9.5px', color: '#94a3b8' }}>SHA-256 Verified · FR-010 Audited</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ----------------- MAIN VIEWPORT ----------------- */}
      <main className="app-main">
        {/* Header */}
        <header className="app-header">
          <div className="header-left">
            <div className="breadcrumbs">
              <span>Chamber</span>
              <span>/</span>
              <b>{page}</b>
            </div>
          </div>

          <div className="header-right">
            <div className="search-box">
              <Search size={16} />
              <input
                placeholder="Search cases, documents, filings..."
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  if (e.target.value && page === 'Dashboard') setPage('Cases');
                }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}><X size={14} /></button>
              )}
            </div>

            {/* Authenticated Persona Switcher (FR-001) */}
            <div className="role-switcher" title="Cryptographically Authenticated User">
              <UserCheck size={16} color={currentUser.color} />
              <select
                value={currentUser.name}
                onChange={e => {
                  const u = USERS.find(x => x.name === e.target.value);
                  if (u) handleSwitchUser(u);
                }}
              >
                {USERS.map(u => (
                  <option key={u.name} value={u.name}>
                    {u.name} — {u.role}
                  </option>
                ))}
              </select>
            </div>

            {/* User Guide & Shortcuts Button */}
            <button
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '600' }}
              onClick={() => setModalUserGuide(true)}
              title="Chamber User Guide & Shortcuts (?)"
            >
              <HelpCircle size={15} color="#2563eb" />
              <span>Guide & Tips</span>
            </button>

            <button
              className="btn-icon"
              title="Recent Notifications"
              onClick={() => showToast(`You have ${pendingAiCount} AI reviews and ${pendingTasksCount} tasks pending.`)}
            >
              <Bell size={18} />
              {(pendingAiCount > 0 || pendingTasksCount > 0) && <span className="badge-dot"></span>}
            </button>

            <button className="btn-primary" onClick={() => setModalNewCase(true)}>
              <Plus size={16} /> New Case
            </button>
          </div>
        </header>

        {/* Global Mandatory Advisory Notice (FR-007) */}
        <div className="page-container" style={{ paddingBottom: '0' }}>
          <div className="advisory-banner">
            <div className="advisory-banner-content">
              <div className="advisory-icon">
                <AlertTriangle size={18} />
              </div>
              <div>
                <b>STATUTORY ADVISORY NOTICE (FR-007 / MVP Baseline)</b>
                <p>AI document summaries and candidate timeline extractions are purely advisory. They must be independently reviewed and verified by a licensed advocate prior to reliance in pleadings or court proceedings.</p>
              </div>
            </div>
            {pendingAiCount > 0 && page !== 'AI Review' && (
              <button className="btn-secondary" onClick={() => setPage('AI Review')}>
                Review {pendingAiCount} AI Items →
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Pages */}
        <div className="page-container">
          {page === 'Dashboard' && (
            <DashboardView
              stats={stats}
              cases={cases}
              hearings={hearings}
              tasks={tasks}
              pendingAiCount={pendingAiCount}
              onSelectCase={openCaseDetail}
              onToggleTask={handleToggleTask}
              onOpenAIReview={() => setPage('AI Review')}
              onOpenCases={() => setPage('Cases')}
              onOpenCalendar={() => setPage('Calendar')}
              onOpenTasks={() => setPage('Tasks')}
              onAskCopilot={(q) => {
                setPage('AI Review');
                setAiReviewTab('copilot');
                handleAskCopilot(q);
              }}
            />
          )}

          {page === 'Cases' && (
            <CasesView
              cases={filteredCases}
              statusFilter={caseStatusFilter}
              setStatusFilter={setCaseStatusFilter}
              typeFilter={caseTypeFilter}
              setTypeFilter={setCaseTypeFilter}
              onSelectCase={openCaseDetail}
              onNewCase={() => setModalNewCase(true)}
              onExportCSV={() => window.open(api.getCSVExportURL(), '_blank')}
              onOpenImport={() => setPage('Integrations')}
            />
          )}

          {page === 'Documents' && (
            <DocumentsView
              documents={filteredDocs}
              categoryFilter={docCategoryFilter}
              setCategoryFilter={setDocCategoryFilter}
              onUpload={() => setModalUploadDoc(true)}
              onDownloadDoc={(d) => window.open(api.getDocumentDownloadURL(d.id), '_blank')}
              onSelectDoc={(d) => {
                setPage('AI Review');
                setAiReviewTab('verifications');
              }}
              onDeleteDoc={async (docId) => {
                if (window.confirm('Delete document from vault?')) {
                  try {
                    await api.deleteDocument(docId);
                    showToast('Document deleted.');
                    refreshAllData();
                  } catch (e) {
                    showToast(e.message);
                  }
                }
              }}
            />
          )}

          {page === 'AI Review' && (
            <AIReviewDeskView
              tab={aiReviewTab}
              setTab={setAiReviewTab}
              summaries={aiSummaries}
              currentUser={currentUser}
              onVerifyFact={handleVerifyFact}
              onApproveSummary={handleApproveSummary}
              chat={copilotChat}
              query={copilotQuery}
              setQuery={setCopilotQuery}
              loading={copilotLoading}
              onAsk={handleAskCopilot}
            />
          )}

          {page === 'Calendar' && (
            <HearingsCalendarView
              hearings={hearings}
              onNewHearing={() => setModalNewHearing(true)}
              onDeleteHearing={async (hId) => {
                if (window.confirm('Delete scheduled hearing?')) {
                  try {
                    await api.deleteHearing(hId);
                    showToast('Hearing removed from calendar.');
                    refreshAllData();
                  } catch (e) {
                    showToast(e.message);
                  }
                }
              }}
            />
          )}

          {page === 'Tasks' && (
            <TasksDeadlinesView
              tasks={tasks}
              currentUser={currentUser}
              onToggleTask={handleToggleTask}
              onNewTask={() => setModalNewTask(true)}
              onDeleteTask={async (taskId) => {
                try {
                  await api.deleteTask(taskId);
                  showToast('Task removed.');
                  refreshAllData();
                } catch (e) {
                  showToast(e.message);
                }
              }}
            />
          )}

          {page === 'Clients' && (
            <ClientsView
              clients={clients}
              onNewClient={() => setModalNewClient(true)}
            />
          )}

          {page === 'Audit Trail' && (
            <AuditTrailView
              logs={auditLogs}
              filter={auditFilter}
              setFilter={setAuditFilter}
              onRefresh={refreshAllData}
              chainProof={auditChainProof}
              onVerifyChain={handleVerifyAuditChain}
            />
          )}

          {page === 'Integrations' && (
            <IntegrationsView
              onExportJSON={handleExportJSON}
              onExportCSV={() => window.open(api.getCSVExportURL(), '_blank')}
              onImportJSON={async (importedCases) => {
                try {
                  await api.importCasesJSON(importedCases);
                  showToast('Cases batch imported successfully!');
                  refreshAllData();
                } catch (e) {
                  showToast(e.message);
                }
              }}
            />
          )}
        </div>

        {/* Footer */}
        <footer className="app-footer">
          <div>
            <b>CasePilot AI Legal Workspace</b> · PS-01 Legal Tech Hackathon Production Baseline
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <span>Compliant with Advocates Act & Indian Evidence Act (Sec 65B/BSA 63)</span>
            <span>• Authenticated: {currentUser.name} ({currentUser.role})</span>
          </div>
        </footer>
      </main>

      {/* ----------------- MODALS ----------------- */}
      {modalNewCase && (
        <ModalNewCase
          onClose={() => setModalNewCase(false)}
          onSubmit={async (caseData) => {
            try {
              await api.createCase(caseData);
              showToast(`Case "${caseData.title}" created successfully.`);
              setModalNewCase(false);
              refreshAllData();
            } catch (e) {
              showToast(e.message);
            }
          }}
        />
      )}

      {modalUploadDoc && (
        <ModalUploadDoc
          cases={cases}
          onClose={() => setModalUploadDoc(false)}
          onSubmit={async (docData) => {
            try {
              const res = await api.uploadDocument(docData);
              showToast(`Document uploaded (SHA-256: ${res.sha256_checksum?.slice(0, 10)}...).`);
              setModalUploadDoc(false);
              refreshAllData();
            } catch (e) {
              showToast(e.message);
            }
          }}
        />
      )}

      {modalNewHearing && (
        <ModalNewHearing
          cases={cases}
          onClose={() => setModalNewHearing(false)}
          onSubmit={async (hData) => {
            try {
              await api.createHearing(hData);
              showToast(`Hearing scheduled for ${hData.hearing_date}.`);
              setModalNewHearing(false);
              refreshAllData();
            } catch (e) {
              showToast(e.message);
            }
          }}
        />
      )}

      {modalNewTask && (
        <ModalNewTask
          cases={cases}
          currentUser={currentUser}
          onClose={() => setModalNewTask(false)}
          onSubmit={async (tData) => {
            try {
              await api.createTask(tData);
              showToast(`Task "${tData.title}" assigned.`);
              setModalNewTask(false);
              refreshAllData();
            } catch (e) {
              showToast(e.message);
            }
          }}
        />
      )}

      {modalNewClient && (
        <ModalNewClient
          onClose={() => setModalNewClient(false)}
          onSubmit={async (cData) => {
            try {
              await api.createClient(cData);
              showToast(`Client "${cData.name}" added to chamber directory.`);
              setModalNewClient(false);
              refreshAllData();
            } catch (e) {
              showToast(e.message);
            }
          }}
        />
      )}

      {selectedCaseDetail && (
        <ModalCaseDetail
          detail={selectedCaseDetail}
          subTab={selectedCaseSubTab}
          setSubTab={setSelectedCaseSubTab}
          currentUser={currentUser}
          onClose={() => setSelectedCaseDetail(null)}
          onChangeStatus={handleChangeCaseStatus}
          onDeleteCase={handleDeleteCase}
          onAddHearing={() => setModalNewHearing(true)}
          onAddDoc={() => setModalUploadDoc(true)}
        />
      )}

      {modalUserGuide && (
        <ModalUserGuide
          currentUser={currentUser}
          onClose={() => setModalUserGuide(false)}
          onSwitchUser={handleSwitchUser}
        />
      )}

      {toast && (
        <div className="toast-notice">
          <CheckCircle2 size={18} color="#34d399" />
          <span>{toast}</span>
          <button onClick={() => setToast('')} style={{ color: '#94a3b8', marginLeft: 'auto' }}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// =====================================================================
// SUB-VIEWS
// =====================================================================

function DashboardView({
  stats, cases, hearings, tasks, pendingAiCount,
  onSelectCase, onToggleTask, onOpenAIReview, onOpenCases,
  onOpenCalendar, onOpenTasks, onAskCopilot
}) {
  return (
    <>
      <div className="page-header">
        <div className="page-header-title">
          <small>LEGAL CHAMBER SUMMARY · {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</small>
          <h1>Counsel Overview</h1>
          <p>Active matters, court lists, and advisory items requiring legal counsel attention.</p>
        </div>
        <button className="btn-secondary" onClick={onOpenAIReview}>
          <Sparkles size={16} /> Open AI Verification Desk
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-top">
            <span>ACTIVE MATTERS</span>
            <div className="stat-icon blue"><FolderKanban size={20} /></div>
          </div>
          <div className="stat-value">{cases.filter(c => c.status === 'Active').length}</div>
          <div className="stat-desc">Across Commercial & Civil divisions</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>UPCOMING HEARINGS</span>
            <div className="stat-icon purple"><CalendarDays size={20} /></div>
          </div>
          <div className="stat-value">{hearings.length}</div>
          <div className="stat-desc">Next 14 calendar days</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span>PENDING TASKS</span>
            <div className="stat-icon orange"><ListChecks size={20} /></div>
          </div>
          <div className="stat-value">{tasks.filter(t => !t.is_completed).length}</div>
          <div className="stat-desc">Urgent & high priority items</div>
        </div>

        <div className="stat-card" style={{ border: pendingAiCount > 0 ? '1px solid #fde68a' : undefined }}>
          <div className="stat-card-top">
            <span>AI REVIEWS AWAITING</span>
            <div className="stat-icon emerald"><Sparkles size={20} /></div>
          </div>
          <div className="stat-value" style={{ color: pendingAiCount > 0 ? '#b45309' : undefined }}>
            {pendingAiCount}
          </div>
          <div className="stat-desc">Mandatory advocate verification</div>
        </div>
      </div>

      <div className="ai-copilot-banner">
        <i><Sparkles size={22} color="#fff" /></i>
        <div>
          <h3>CasePilot Advisory Legal Copilot</h3>
          <p>Instant case timeline queries, limitation period calculations, and draft arguments verified against Indian jurisprudence.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => onAskCopilot('Brief me on Sharma vs Eastern Industries')}>
            Sharma Matter Brief →
          </button>
          <button onClick={() => onAskCopilot('What are the limitation periods for contract breach damages?')}>
            Limitation Periods →
          </button>
        </div>
      </div>

      <div className="dashboard-columns">
        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2>Recent Litigation Matters</h2>
              <p>Active case files and upcoming hearing milestones</p>
            </div>
            <button className="btn-secondary" onClick={onOpenCases} style={{ fontSize: '11px' }}>
              View Directory →
            </button>
          </div>
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Matter / Title</th>
                  <th>Client</th>
                  <th>Forum / Court</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {cases.slice(0, 4).map(c => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => onSelectCase(c)}>
                    <td className="cell-primary">
                      <b>{c.title}</b>
                      <small>{c.case_number} · {c.case_type}</small>
                    </td>
                    <td>{c.client_name}</td>
                    <td>{c.court_jurisdiction || 'High Court of Delhi'}</td>
                    <td>
                      <span className={`badge-status ${c.status.toLowerCase().replace(/\s+/g, '-')}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel-card">
          <div className="panel-header">
            <div>
              <h2>Action Items & Deadlines</h2>
              <p>Assigned advocate tasks</p>
            </div>
            <button className="btn-secondary" onClick={onOpenTasks} style={{ fontSize: '11px' }}>
              Manage Tasks →
            </button>
          </div>
          <div>
            {tasks.slice(0, 4).map(t => (
              <div key={t.id} className="task-item">
                <button
                  className={`task-checkbox ${t.is_completed ? 'completed' : ''}`}
                  onClick={() => onToggleTask(t.id)}
                >
                  {t.is_completed && <Check size={13} strokeWidth={3} />}
                </button>
                <div className="task-info">
                  <b className={t.is_completed ? 'struck' : ''}>{t.title}</b>
                  <div className="task-meta">
                    <span className={`badge-priority ${t.priority.toLowerCase()}`}>{t.priority}</span>
                    <span><Clock3 size={12} style={{ verticalAlign: 'middle', marginRight: '3px' }} />{t.due_date}</span>
                    <span>{t.case_number}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function CasesView({
  cases, statusFilter, setStatusFilter, typeFilter, setTypeFilter,
  onSelectCase, onNewCase, onExportCSV, onOpenImport
}) {
  const statuses = ['All', 'Active', 'In Review', 'Hearing Scheduled', 'On Hold', 'Closed', 'Archived'];
  const caseTypes = ['All', 'Commercial Dispute', 'Property Partition', 'Commercial Contract', 'Employment', 'Intellectual Property'];

  return (
    <>
      <div className="page-header">
        <div className="page-header-title">
          <small>DIRECTORY · MATTER REGISTRY</small>
          <h1>Case Management & Matters</h1>
          <p>Complete directory of legal matters, parties, court assignments, and filing dates.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-secondary" onClick={onExportCSV} title="Export current case roster to CSV for courtroom filing (FR-011)">
            <Download size={15} /> Export CSV
          </button>
          <button className="btn-secondary" onClick={onOpenImport} title="Batch import cases from JSON (FR-011)">
            <Upload size={15} /> Import Cases
          </button>
          <button className="btn-primary" onClick={onNewCase}>
            <Plus size={16} /> New Case
          </button>
        </div>
      </div>

      <div className="tabs-nav">
        {statuses.map(st => (
          <button
            key={st}
            className={`tab-btn ${statusFilter === st ? 'active' : ''}`}
            onClick={() => setStatusFilter(st)}
          >
            {st}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b' }}>
          <span>Case Type:</span>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
          >
            {caseTypes.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <span style={{ fontSize: '12px', color: '#64748b' }}>
          Showing <b>{cases.length}</b> matters
        </span>
      </div>

      <section className="panel-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Case Record</th>
                <th>Client / Entity</th>
                <th>Opposing Party</th>
                <th>Jurisdiction / Bench</th>
                <th>Status</th>
                <th>Next Hearing</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {cases.map(c => (
                <tr key={c.id}>
                  <td className="cell-primary" style={{ cursor: 'pointer' }} onClick={() => onSelectCase(c)}>
                    <b>{c.title}</b>
                    <small>{c.case_number} · {c.case_type}</small>
                  </td>
                  <td>{c.client_name}</td>
                  <td>{c.opposing_party || '—'}</td>
                  <td>{c.court_jurisdiction || 'High Court'}</td>
                  <td>
                    <span className={`badge-status ${c.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    {c.next_hearing_date ? (
                      <span style={{ fontWeight: '600', color: '#1e293b' }}>
                        {c.next_hearing_date}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    <button
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      onClick={() => onSelectCase(c)}
                    >
                      <Eye size={13} /> View File
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function DocumentsView({ documents, categoryFilter, setCategoryFilter, onUpload, onDownloadDoc, onSelectDoc, onDeleteDoc }) {
  const categories = ['All', 'Pleading', 'Petition', 'Affidavit', 'Contract', 'Notice', 'Evidence', 'Order'];

  return (
    <>
      <div className="page-header">
        <div className="page-header-title">
          <small>EVIDENTIARY VAULT · FR-005</small>
          <h1>Legal Documents & Evidentiary Vault</h1>
          <p>Secure repository with SHA-256 cryptographic verification for Section 65B Indian Evidence Act / BSA compliance.</p>
        </div>
        <button className="btn-primary" onClick={onUpload}>
          <Upload size={16} /> Upload Legal Document
        </button>
      </div>

      <div className="tabs-nav">
        {categories.map(cat => (
          <button
            key={cat}
            className={`tab-btn ${categoryFilter === cat ? 'active' : ''}`}
            onClick={() => setCategoryFilter(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <section className="panel-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Document File</th>
                <th>Matter Link</th>
                <th>Category</th>
                <th>Cryptographic SHA-256</th>
                <th>Status</th>
                <th>Uploaded By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map(d => (
                <tr key={d.id}>
                  <td className="cell-primary">
                    <b>{d.filename}</b>
                    <small>Type: {d.file_type.toUpperCase()} · Stored in Vault</small>
                  </td>
                  <td>
                    <b>{d.case_title || d.case_number || 'General Legal File'}</b>
                  </td>
                  <td>
                    <span className="badge-status in-review">{d.category}</span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', background: '#f1f5f9', padding: '3px 6px', borderRadius: '4px', color: '#334155' }} title={d.sha256_checksum}>
                      {d.sha256_checksum ? `${d.sha256_checksum.slice(0, 14)}...` : 'Pre-verified'}
                    </span>
                  </td>
                  <td>
                    <span className="badge-status active">
                      <CheckCircle2 size={12} /> {d.processing_status}
                    </span>
                  </td>
                  <td>{d.uploaded_by}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        onClick={() => onDownloadDoc(d)}
                        title="Download Original Physical File"
                      >
                        <Download size={12} /> Download
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        onClick={() => onSelectDoc(d)}
                        title="Open in AI Review Desk"
                      >
                        <Sparkles size={12} /> AI Summary
                      </button>
                      <button
                        className="btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '11px', color: '#e11d48' }}
                        onClick={() => onDeleteDoc(d.id)}
                        title="Delete Document"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function AIReviewDeskView({
  tab, setTab, summaries, currentUser, onVerifyFact, onApproveSummary,
  chat, query, setQuery, loading, onAsk
}) {
  const [acknowledgedMap, setAcknowledgedMap] = useState({});

  return (
    <>
      <div className="page-header">
        <div className="page-header-title">
          <small>ADVISORY INTELLIGENCE DESK · FR-006 & FR-007</small>
          <h1>AI Document Summaries & Verification</h1>
          <p>Human-in-the-loop review station with active advocate sign-off requirement.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn-secondary ${tab === 'verifications' ? 'btn-primary' : ''}`}
            onClick={() => setTab('verifications')}
          >
            <CheckCircle2 size={15} /> Document Extractions ({summaries.length})
          </button>
          <button
            className={`btn-secondary ${tab === 'copilot' ? 'btn-primary' : ''}`}
            onClick={() => setTab('copilot')}
          >
            <MessageSquare size={15} /> Legal AI Copilot
          </button>
        </div>
      </div>

      {tab === 'verifications' ? (
        <div>
          {summaries.map(s => {
            let facts = [];
            try {
              facts = JSON.parse(s.candidate_facts_json);
            } catch (e) {
              facts = [];
            }
            const isApproved = s.review_status === 'Verified by Counsel';
            const isAcknowledged = acknowledgedMap[s.id] || false;

            return (
              <div key={s.id} className="ai-review-card">
                <div className="ai-review-header">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <h3>{s.document_title}</h3>
                      <span className={`badge-status ${isApproved ? 'active' : 'on-hold'}`}>
                        {s.review_status}
                      </span>
                    </div>
                    <p>Associated Matter: <b>{s.case_number}</b> {s.reviewed_by && `· Approved by: ${s.reviewed_by}`}</p>
                  </div>
                  {!isApproved && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <label style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                        <input
                          type="checkbox"
                          checked={isAcknowledged}
                          onChange={e => setAcknowledgedMap({ ...acknowledgedMap, [s.id]: e.target.checked })}
                        />
                        <span>I have verified candidate dates against original file (FR-007)</span>
                      </label>
                      <button
                        className="btn-primary"
                        onClick={() => onApproveSummary(s.id, isAcknowledged)}
                        disabled={!isAcknowledged}
                        style={{ opacity: isAcknowledged ? 1 : 0.6 }}
                      >
                        <Check size={15} /> Approve & Sign Off (Counsel)
                      </button>
                    </div>
                  )}
                </div>

                <div className="exec-summary-box">
                  <h4>Advisory Executive Summary</h4>
                  <p>{s.executive_summary}</p>
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Identified Statutory Provisions & Jurisprudence:
                  </div>
                  <div className="statutory-tags">
                    {s.statutory_provisions.split(';').map((p, i) => (
                      <span key={i} className="statute-pill">
                        <Scale size={13} /> {p.trim()}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ background: '#fffbeb', border: '1px solid #fef08a', padding: '10px 14px', borderRadius: '6px', marginBottom: '18px' }}>
                  <b style={{ color: '#854d0e', fontSize: '11.5px' }}>Legal Risk Assessment:</b>
                  <p style={{ color: '#a16207', fontSize: '12px', marginTop: '2px' }}>{s.risk_assessment}</p>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>
                      Candidate Facts & Extracted Dates (Requires Advocate Sign-Off)
                    </div>
                    <small style={{ color: '#64748b' }}>Dates not authoritative until verified</small>
                  </div>

                  <table className="facts-table">
                    <thead>
                      <tr>
                        <th>Candidate Fact / Assertion</th>
                        <th>Extracted Date</th>
                        <th>Source Page / Clause</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facts.map(f => (
                        <tr key={f.id} style={{ background: f.rejected ? '#fff1f2' : f.verified ? '#f0fdf4' : '#ffffff' }}>
                          <td style={{ fontWeight: '500', color: '#1e293b' }}>{f.fact_text}</td>
                          <td>
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600', color: '#2563eb' }}>
                              {f.candidate_date || 'N/A'}
                            </span>
                          </td>
                          <td style={{ color: '#64748b' }}>{f.source_page_or_ref}</td>
                          <td>
                            {f.verified ? (
                              <span style={{ color: '#059669', fontWeight: '600', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <CheckCircle2 size={14} /> Verified
                              </span>
                            ) : f.rejected ? (
                              <span style={{ color: '#e11d48', fontWeight: '600', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <XCircle size={14} /> Rejected
                              </span>
                            ) : (
                              <span style={{ color: '#d97706', fontWeight: '600', fontSize: '11px' }}>
                                Awaiting Review
                              </span>
                            )}
                          </td>
                          <td>
                            <div className="fact-action-group">
                              {!f.verified && (
                                <button
                                  className="btn-fact-accept"
                                  onClick={() => onVerifyFact(s.id, f.id, 'accept')}
                                  title="Accept as verified fact"
                                >
                                  <Check size={12} /> Accept
                                </button>
                              )}
                              {!f.rejected && (
                                <button
                                  className="btn-fact-reject"
                                  onClick={() => onVerifyFact(s.id, f.id, 'reject')}
                                  title="Reject unverified claim"
                                >
                                  <X size={12} /> Reject
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="chat-window">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e9f2', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <b style={{ fontSize: '13px', color: '#1e293b' }}>Interactive Legal Copilot Assistant</b>
              <p style={{ fontSize: '11px', color: '#64748b' }}>Sanitized against prompt injection · Queries mapped to Indian statutory frameworks</p>
            </div>
            <span className="badge-status in-review">Advisory Mode</span>
          </div>

          <div className="chat-messages">
            {chat.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role}`}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</div>
                {msg.sources && (
                  <div className="chat-sources">
                    <b>Referenced Authorities:</b> {msg.sources.join(' · ')}
                  </div>
                )}
                {msg.advisory_label && (
                  <div style={{ fontSize: '9.5px', color: '#b45309', marginTop: '6px' }}>
                    {msg.advisory_label}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="chat-bubble assistant">
                <i>Analyzing matter record and preparing legal response...</i>
              </div>
            )}
          </div>

          <div className="chat-input-row">
            <input
              placeholder="Ask about Sharma breach, Mehta property partition, Order 39 interim stay, or limitation periods..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onAsk(); }}
            />
            <button className="btn-primary" onClick={() => onAsk()} disabled={loading}>
              <Sparkles size={15} /> Consult Copilot
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function HearingsCalendarView({ hearings, onNewHearing, onDeleteHearing }) {
  return (
    <>
      <div className="page-header">
        <div className="page-header-title">
          <small>CAUSE LIST · DIARY</small>
          <h1>Hearings & Courtroom Appearances</h1>
          <p>Chronological schedule of listed hearings, courtrooms, judges, and argument preparation status.</p>
        </div>
        <button className="btn-primary" onClick={onNewHearing}>
          <Plus size={16} /> Schedule Hearing
        </button>
      </div>

      <section className="panel-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Matter / Case</th>
                <th>Court / Jurisdiction</th>
                <th>Courtroom & Bench</th>
                <th>Hearing Type</th>
                <th>Preparation Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {hearings.map(h => (
                <tr key={h.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calendar size={15} color="#2563eb" />
                      <div>
                        <b>{h.hearing_date}</b>
                        <small>{h.hearing_time}</small>
                      </div>
                    </div>
                  </td>
                  <td className="cell-primary">
                    <b>{h.case_title}</b>
                    <small>{h.case_number}</small>
                  </td>
                  <td>{h.court_name}</td>
                  <td>
                    <b>{h.courtroom}</b>
                    <small>{h.judge || 'Bench Pending'}</small>
                  </td>
                  <td>
                    <span className="badge-status in-review">{h.hearing_type}</span>
                  </td>
                  <td>
                    <span className={`badge-status ${h.preparation_status.includes('Ready') ? 'active' : 'on-hold'}`}>
                      {h.preparation_status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px', color: '#e11d48' }}
                      onClick={() => onDeleteHearing(h.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function TasksDeadlinesView({ tasks, currentUser, onToggleTask, onNewTask, onDeleteTask }) {
  const [filter, setFilter] = useState('all');

  const displayedTasks = tasks.filter(t => {
    if (filter === 'pending') return !t.is_completed;
    if (filter === 'completed') return t.is_completed;
    return true;
  });

  return (
    <>
      <div className="page-header">
        <div className="page-header-title">
          <small>WORKFLOW & COMPLIANCE · FR-008</small>
          <h1>Chamber Tasks & Deadlines</h1>
          <p>Action items, filing deadlines, witness affidavit prep, and team assignments.</p>
        </div>
        <button className="btn-primary" onClick={onNewTask}>
          <Plus size={16} /> New Task
        </button>
      </div>

      <div className="tabs-nav">
        <button className={`tab-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          All Tasks ({tasks.length})
        </button>
        <button className={`tab-btn ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
          Pending ({tasks.filter(t => !t.is_completed).length})
        </button>
        <button className={`tab-btn ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>
          Completed ({tasks.filter(t => t.is_completed).length})
        </button>
      </div>

      <section className="panel-card">
        <div>
          {displayedTasks.map(t => (
            <div key={t.id} className="task-item">
              <button
                className={`task-checkbox ${t.is_completed ? 'completed' : ''}`}
                onClick={() => onToggleTask(t.id)}
              >
                {t.is_completed && <Check size={13} strokeWidth={3} />}
              </button>
              <div className="task-info">
                <b className={t.is_completed ? 'struck' : ''}>{t.title}</b>
                {t.description && <p>{t.description}</p>}
                <div className="task-meta">
                  <span className={`badge-priority ${t.priority.toLowerCase()}`}>{t.priority}</span>
                  <span><Clock3 size={12} style={{ verticalAlign: 'middle', marginRight: '3px' }} />{t.due_date}</span>
                  {t.case_number && <span>Matter: <b>{t.case_number}</b></span>}
                  <span>Assigned: <b>{t.assigned_to}</b></span>
                </div>
              </div>
              <button
                className="btn-secondary"
                style={{ padding: '4px 8px', fontSize: '11px', color: '#e11d48' }}
                onClick={() => onDeleteTask(t.id)}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function ClientsView({ clients, onNewClient }) {
  return (
    <>
      <div className="page-header">
        <div className="page-header-title">
          <small>CLIENTELE & PARTIES</small>
          <h1>Clients & Representation Directory</h1>
          <p>Roster of individuals, corporations, and institutional clients represented by the firm.</p>
        </div>
        <button className="btn-primary" onClick={onNewClient}>
          <Plus size={16} /> New Client Record
        </button>
      </div>

      <section className="panel-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Client / Entity Name</th>
                <th>Type</th>
                <th>Email Contact</th>
                <th>Phone</th>
                <th>Location / City</th>
                <th>Active Matters</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(c => (
                <tr key={c.id}>
                  <td className="cell-primary">
                    <b>{c.name}</b>
                    <small>{c.notes || 'Client in good standing'}</small>
                  </td>
                  <td>
                    <span className="badge-status in-review">{c.entity_type}</span>
                  </td>
                  <td>{c.contact_email || '—'}</td>
                  <td>{c.contact_phone || '—'}</td>
                  <td>{c.address || 'New Delhi'}</td>
                  <td>
                    <b>{c.active_cases_count} Matter(s)</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function AuditTrailView({ logs, filter, setFilter, onRefresh, chainProof, onVerifyChain }) {
  const categories = ['All', 'Case', 'Document', 'AI Review', 'Hearing', 'Task', 'System', 'Auth'];
  const filtered = logs.filter(l => filter === 'All' || l.entity_type === filter);

  return (
    <>
      <div className="page-header">
        <div className="page-header-title">
          <small>TAMPER-EVIDENT GOVERNANCE · FR-010</small>
          <h1>Audit Trail & Cryptographic Chain</h1>
          <p>SHA-256 hash-chained immutable record meeting Section 65B Indian Evidence Act / BSA 63 standards.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-secondary" onClick={onVerifyChain} style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#059669' }}>
            <ShieldCheck size={15} /> Verify Hash Chain Proof
          </button>
          <button className="btn-secondary" onClick={onRefresh}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {chainProof && (
        <div style={{ background: chainProof.verified ? '#f0fdf4' : '#fff1f2', border: `1px solid ${chainProof.verified ? '#bbf7d0' : '#fecdd3'}`, borderRadius: '8px', padding: '14px', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {chainProof.verified ? <CheckCircle2 color="#16a34a" size={20} /> : <ShieldAlert color="#e11d48" size={20} />}
            <div>
              <b style={{ color: chainProof.verified ? '#166534' : '#991b1b', fontSize: '12.5px' }}>
                {chainProof.verified ? 'Cryptographic Audit Integrity Confirmed' : 'Tamper Alert Detected'}
              </b>
              <p style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                Chain Verified: <b>{chainProof.chain_length} sequential blocks</b> · Latest Root Hash: <code style={{ fontSize: '10px' }}>{chainProof.latest_hash?.slice(0, 24)}...</code>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="tabs-nav">
        {categories.map(c => (
          <button
            key={c}
            className={`tab-btn ${filter === c ? 'active' : ''}`}
            onClick={() => setFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <section className="panel-card">
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Timestamp (UTC)</th>
                <th>Action Code</th>
                <th>Actor & Role</th>
                <th>Cryptographic Hash</th>
                <th>Audit Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#64748b' }}>
                    {l.timestamp ? l.timestamp.replace('T', ' ').slice(0, 19) : 'Just now'}
                  </td>
                  <td>
                    <span className="badge-priority high" style={{ fontSize: '9.5px' }}>
                      {l.action}
                    </span>
                  </td>
                  <td>
                    <b>{l.actor_name}</b>
                    <small style={{ display: 'block', color: '#64748b', fontSize: '10px' }}>{l.actor_role}</small>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', background: '#f1f5f9', padding: '3px 6px', borderRadius: '4px' }} title={l.record_hash}>
                      {l.record_hash ? `${l.record_hash.slice(0, 12)}...` : 'genesis'}
                    </span>
                  </td>
                  <td style={{ color: '#1e293b', fontSize: '12px' }}>{l.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function IntegrationsView({ onExportJSON, onExportCSV, onImportJSON }) {
  const [importJsonText, setImportJsonText] = useState('');
  const [importNotice, setImportNotice] = useState('');

  const handleImportSubmit = (e) => {
    e.preventDefault();
    try {
      const parsed = JSON.parse(importJsonText);
      if (!Array.isArray(parsed)) throw new Error('Input must be a JSON array of case objects.');
      onImportJSON(parsed);
      setImportNotice(`Successfully queued ${parsed.length} cases for import.`);
      setImportJsonText('');
    } catch (err) {
      setImportNotice(`Import Error: ${err.message}`);
    }
  };

  const sampleTemplate = JSON.stringify([
    {
      title: "Singhania vs. Axis Freight Lines",
      client_name: "Singhania Logistics Ltd",
      case_type: "Commercial Dispute",
      court_jurisdiction: "Delhi High Court Commercial Division",
      claim_amount: "₹1,40,00,000",
      notes: "Breach of multi-modal freight transport contract."
    }
  ], null, 2);

  return (
    <>
      <div className="page-header">
        <div className="page-header-title">
          <small>INTEROPERABILITY & DATA CONTROL · FR-011</small>
          <h1>Import, Export & Integration APIs</h1>
          <p>Export case and evidentiary metadata in open standard formats (JSON/CSV) and access REST documentation.</p>
        </div>
      </div>

      <div className="dashboard-columns">
        <section className="panel-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>Export Legal Workspace Data</h2>
          <p style={{ color: '#64748b', marginBottom: '20px', fontSize: '12px' }}>
            Download complete workspace archives including case registries, document metadata, verified AI candidate facts, hearings cause list, and compliance logs.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e5e9f2' }}>
              <div>
                <b style={{ fontSize: '13px' }}>Full Workspace JSON Snapshot</b>
                <p style={{ fontSize: '11px', color: '#64748b' }}>Complete structured export of all tables and relationships.</p>
              </div>
              <button className="btn-primary" onClick={onExportJSON}>
                <Download size={15} /> Export JSON
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e5e9f2' }}>
              <div>
                <b style={{ fontSize: '13px' }}>Cases Directory CSV</b>
                <p style={{ fontSize: '11px', color: '#64748b' }}>Spreadsheet compatible export for courtroom filing rosters.</p>
              </div>
              <button className="btn-secondary" onClick={onExportCSV}>
                <Download size={15} /> Export CSV
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e5e9f2' }}>
              <div>
                <b style={{ fontSize: '13px' }}>Interactive API Documentation (Swagger)</b>
                <p style={{ fontSize: '11px', color: '#64748b' }}>OpenAPI 3.0 specification at http://127.0.0.1:8000/docs.</p>
              </div>
              <a
                href="http://127.0.0.1:8000/docs"
                target="_blank"
                rel="noreferrer"
                className="btn-secondary"
                style={{ textDecoration: 'none' }}
              >
                <ExternalLink size={15} /> View /docs
              </a>
            </div>
          </div>
        </section>

        <section className="panel-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '8px' }}>Batch Import Cases (JSON)</h2>
          <p style={{ color: '#64748b', marginBottom: '14px', fontSize: '12px' }}>
            Import multiple cases directly into CasePilot AI. Paste structured JSON array below:
          </p>

          <form onSubmit={handleImportSubmit}>
            <textarea
              style={{ width: '100%', height: '140px', padding: '10px', fontFamily: 'var(--font-mono)', fontSize: '11px', border: '1px solid #cbd5e1', borderRadius: '6px', marginBottom: '10px' }}
              placeholder={sampleTemplate}
              value={importJsonText}
              onChange={e => setImportJsonText(e.target.value)}
            />
            {importNotice && (
              <div style={{ padding: '8px', background: '#eff6ff', color: '#1d4ed8', fontSize: '11.5px', borderRadius: '4px', marginBottom: '10px' }}>
                {importNotice}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-secondary"
                style={{ fontSize: '11px' }}
                onClick={() => setImportJsonText(sampleTemplate)}
              >
                Insert Sample
              </button>
              <button type="submit" className="btn-primary" disabled={!importJsonText.trim()}>
                <Upload size={14} /> Import Cases
              </button>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}

// =====================================================================
// USER GUIDE & MODAL DIALOGS
// =====================================================================

function ModalUserGuide({ currentUser, onClose, onSwitchUser }) {
  const [guideTab, setGuideTab] = useState('getting-started');

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog" style={{ width: 'min(100%, 820px)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={20} color="#2563eb" />
            </div>
            <div>
              <h2>CasePilot Chamber User Guide & Shortcuts</h2>
              <p>Everything you need to navigate, test RBAC, review AI candidate facts, and verify compliance.</p>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Guide Tabs */}
        <div className="tabs-nav" style={{ margin: '0 0 16px 0', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
          <button className={`tab-btn ${guideTab === 'getting-started' ? 'active' : ''}`} onClick={() => setGuideTab('getting-started')}>
            🚀 60-Sec Quick Start
          </button>
          <button className={`tab-btn ${guideTab === 'personas' ? 'active' : ''}`} onClick={() => setGuideTab('personas')}>
            👥 Roles & RBAC
          </button>
          <button className={`tab-btn ${guideTab === 'ai-review' ? 'active' : ''}`} onClick={() => setGuideTab('ai-review')}>
            ⚖️ AI Review Desk
          </button>
          <button className={`tab-btn ${guideTab === 'vault-audit' ? 'active' : ''}`} onClick={() => setGuideTab('vault-audit')}>
            🔒 Vault & Sec 65B Audit
          </button>
          <button className={`tab-btn ${guideTab === 'shortcuts' ? 'active' : ''}`} onClick={() => setGuideTab('shortcuts')}>
            ⌨️ Shortcuts & Tips
          </button>
        </div>

        <div style={{ overflowY: 'auto', paddingRight: '4px', flex: 1, fontSize: '13px', lineHeight: '1.6' }}>
          {guideTab === 'getting-started' && (
            <div>
              <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <b style={{ color: '#0f172a', fontSize: '14px', display: 'block', marginBottom: '6px' }}>
                  Welcome to CasePilot AI — The Modern Legal Chamber Workspace
                </b>
                <p style={{ color: '#475569', fontSize: '12.5px', margin: 0 }}>
                  CasePilot AI unifies litigation dossiers, court hearing cause lists, evidentiary vault files, and human-in-the-loop AI document summarization under Indian legal practice standards.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#2563eb', color: '#fff', fontSize: '11px', display: 'grid', placeItems: 'center', fontWeight: 'bold' }}>1</span>
                    <b style={{ color: '#1e293b' }}>Manage Legal Matters</b>
                  </div>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                    Track active litigation, judge benches, claim values, and court filings. Export cause rosters directly to CSV for filing with court clerks.
                  </p>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#7c3aed', color: '#fff', fontSize: '11px', display: 'grid', placeItems: 'center', fontWeight: 'bold' }}>2</span>
                    <b style={{ color: '#1e293b' }}>AI Advisory Review</b>
                  </div>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                    AI extracts candidate breach dates and clauses from uploaded agreements. Counsel reviews, accepts/rejects facts, and signs off under BCI ethical rules.
                  </p>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#059669', color: '#fff', fontSize: '11px', display: 'grid', placeItems: 'center', fontWeight: 'bold' }}>3</span>
                    <b style={{ color: '#1e293b' }}>Court Cause List & Tasks</b>
                  </div>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                    Never miss a hearing. Monitor courtroom numbers, daily cause lists, preparation statuses, and high-priority advocate checklists.
                  </p>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#d97706', color: '#fff', fontSize: '11px', display: 'grid', placeItems: 'center', fontWeight: 'bold' }}>4</span>
                    <b style={{ color: '#1e293b' }}>Evidence & Audit Proof</b>
                  </div>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                    Evidentiary files are fingerprinted with SHA-256. Audit events are cryptographically chained to meet Sec 65B Indian Evidence Act / Sec 63 BSA standards.
                  </p>
                </div>
              </div>
            </div>
          )}

          {guideTab === 'personas' && (
            <div>
              <p style={{ color: '#64748b', fontSize: '12px', marginBottom: '14px' }}>
                CasePilot enforces server-side Role-Based Access Control (RBAC). Switch roles below or in the top navigation bar to test permission boundaries:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {USERS.map(u => (
                  <div key={u.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: currentUser.name === u.name ? '#eff6ff' : '#f8fafc', border: `1px solid ${currentUser.name === u.name ? '#93c5fd' : '#e2e8f0'}`, borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: u.color, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 'bold', fontSize: '11px' }}>
                        {u.initials}
                      </div>
                      <div>
                        <b style={{ color: '#0f172a', fontSize: '13px' }}>{u.name}</b>
                        <span style={{ marginLeft: '8px', fontSize: '11px', background: '#e2e8f0', padding: '2px 6px', borderRadius: '4px', color: '#334155' }}>{u.role}</span>
                        <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                          {u.role === 'Managing Attorney' && 'Full permissions: Case deletion, court hearing scheduling, AI final sign-offs, and audit chain verification.'}
                          {u.role === 'Senior Associate' && 'Senior counsel: Create/edit cases, verify AI candidate facts, and sign off. Blocked from case deletion.'}
                          {u.role === 'Paralegal' && 'Support staff: File uploads and task drafting. Server-restricted from deleting cases or signing off on AI drafts.'}
                          {u.role === 'Compliance Officer' && 'Chamber auditor: Inspects Sec 65B hash chains, verifies certificates, and runs full JSON workspace backups.'}
                        </div>
                      </div>
                    </div>
                    {currentUser.name === u.name ? (
                      <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#2563eb', padding: '4px 10px', background: '#dbeafe', borderRadius: '4px' }}>Active</span>
                    ) : (
                      <button className="btn-secondary" style={{ fontSize: '11.5px', padding: '4px 10px' }} onClick={() => onSwitchUser(u)}>
                        Switch
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {guideTab === 'ai-review' && (
            <div>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderLeft: '4px solid #f59e0b', padding: '12px', borderRadius: '6px', marginBottom: '14px' }}>
                <b style={{ color: '#92400e', fontSize: '12.5px' }}>Statutory Safeguard (FR-007 & BCI Compliance)</b>
                <p style={{ color: '#78350f', fontSize: '11.5px', margin: '4px 0 0 0' }}>
                  AI extractions are purely advisory draft aids. Under Bar Council of India professional ethics, lawyers bear primary responsibility for all court submissions.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#2563eb', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 'bold', flexShrink: 0 }}>1</span>
                  <div>
                    <b style={{ color: '#0f172a' }}>Review Candidate Facts</b>
                    <p style={{ color: '#64748b', fontSize: '12px', margin: '2px 0 0 0' }}>Each extracted breach date or milestone includes the original document clause reference (e.g. <i>"Clause 14.2, Page 4"</i>).</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#059669', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 'bold', flexShrink: 0 }}>2</span>
                  <div>
                    <b style={{ color: '#0f172a' }}>Accept or Reject Individual Facts</b>
                    <p style={{ color: '#64748b', fontSize: '12px', margin: '2px 0 0 0' }}>Click <span style={{ color: '#059669', fontWeight: 'bold' }}>Accept</span> to verify or <span style={{ color: '#dc2626', fontWeight: 'bold' }}>Reject</span> to discard. Verified facts record the attorney's name and timestamp.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#7c3aed', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 'bold', flexShrink: 0 }}>3</span>
                  <div>
                    <b style={{ color: '#0f172a' }}>Check the Mandatory Acknowledgment Checkbox</b>
                    <p style={{ color: '#64748b', fontSize: '12px', margin: '2px 0 0 0' }}>The "Sign Off & Approve" button is disabled until you affirmatively check: <i>"I confirm human legal review of this AI draft under BCI ethics & FR-007 advisory requirements"</i>.</p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#d97706', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 'bold', flexShrink: 0 }}>4</span>
                  <div>
                    <b style={{ color: '#0f172a' }}>Digital Chamber Sign-Off</b>
                    <p style={{ color: '#64748b', fontSize: '12px', margin: '2px 0 0 0' }}>Submitting generates an electronic signature (e.g. <code>SIGNED://Arjun Kapoor/BAR-CHAMBER-2026</code>) and chains it into the tamper-evident audit log.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {guideTab === 'vault-audit' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '14px' }}>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', background: '#f8fafc' }}>
                  <b style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>🛡️ Evidentiary File Vault</b>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                    Physical files are stored on disk at <code>backend/storage/vault/</code>. A SHA-256 hash is computed on upload. When downloading, the server re-hashes the file on-the-fly to ensure zero tampering under BSA 2023.
                  </p>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '14px', background: '#f8fafc' }}>
                  <b style={{ color: '#0f172a', display: 'block', marginBottom: '4px' }}>🔗 Cryptographic Audit Trail</b>
                  <p style={{ color: '#64748b', fontSize: '12px', margin: 0 }}>
                    Every user action creates a chained block: <code>Record Hash = SHA256(prev_hash + ts + action + actor + details)</code>. Click "Verify Hash Chain Proof" in Audit Compliance to mathematically prove zero alterations.
                  </p>
                </div>
              </div>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px', borderRadius: '6px' }}>
                <b style={{ color: '#1e40af', fontSize: '12px' }}>Section 65B Indian Evidence Act / Section 63 BSA Compliance Certificate</b>
                <p style={{ color: '#1d4ed8', fontSize: '11.5px', margin: '4px 0 0 0' }}>
                  The verification certificate displayed on the Audit Compliance tab can be printed and filed alongside electronic submissions as statutory certification of electronic record integrity.
                </p>
              </div>
            </div>
          )}

          {guideTab === 'shortcuts' && (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ color: '#475569', fontSize: '12.5px' }}>Global Omni-Search</span>
                  <kbd style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold' }}>/</kbd>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ color: '#475569', fontSize: '12.5px' }}>Open Chamber User Guide</span>
                  <kbd style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold' }}>?</kbd>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ color: '#475569', fontSize: '12.5px' }}>Close Active Modal</span>
                  <kbd style={{ background: '#fff', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 'bold' }}>Esc</kbd>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                  <span style={{ color: '#475569', fontSize: '12.5px' }}>Pending Action Alerts</span>
                  <span style={{ fontSize: '11.5px', color: '#64748b' }}>Click Bell Icon</span>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                <b style={{ color: '#0f172a', fontSize: '12.5px', display: 'block', marginBottom: '4px' }}>💡 Pro-Tips for Courtroom Preparation</b>
                <ul style={{ color: '#64748b', fontSize: '12px', margin: 0, paddingLeft: '18px' }}>
                  <li>Click <b>"Export CSV"</b> on the Cases view to generate a courtroom-ready hearing docket.</li>
                  <li>In the AI Copilot on the Dashboard, ask questions like <i>"What is the limitation period for arbitration challenge under Section 34?"</i> for instant statutory summaries.</li>
                  <li>Click any document's SHA-256 hash in the Document Vault to copy the complete 64-character hash for court pleadings.</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={onClose}>
            Got it, return to Chamber
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalCaseDetail({ detail, subTab, setSubTab, currentUser, onClose, onChangeStatus, onDeleteCase, onAddHearing, onAddDoc }) {
  const c = detail?.case || detail;
  const docs = detail?.documents || [];
  const hearings = detail?.hearings || [];
  const tasks = detail?.tasks || [];

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-dialog" style={{ width: 'min(100%, 750px)' }}>
        <div className="modal-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2>{c.title}</h2>
              <span className={`badge-status ${c.status?.toLowerCase().replace(/\s+/g, '-')}`}>
                {c.status}
              </span>
            </div>
            <p>{c.case_number} · {c.case_type} · Lead Counsel: {c.assigned_to || 'Arjun Kapoor'}</p>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #e5e9f2', padding: '0 24px' }}>
          {['overview', 'documents', 'hearings', 'tasks'].map(tab => (
            <button
              key={tab}
              className={`tab-btn ${subTab === tab ? 'active' : ''}`}
              onClick={() => setSubTab(tab)}
              style={{ textTransform: 'capitalize' }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {subTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-row">
                <div className="form-group">
                  <label>Client Entity / Organization</label>
                  <input readOnly value={c.client_name || ''} />
                </div>
                <div className="form-group">
                  <label>Claim / Monetary Exposure</label>
                  <input readOnly value={c.claim_amount || 'Not Specified'} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Opposing Party</label>
                  <input readOnly value={c.opposing_party || '—'} />
                </div>
                <div className="form-group">
                  <label>Opposing Legal Counsel</label>
                  <input readOnly value={c.opposing_counsel || '—'} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Court & Jurisdiction</label>
                  <input readOnly value={c.court_jurisdiction || 'High Court of Delhi'} />
                </div>
                <div className="form-group">
                  <label>Presiding Judge / Bench</label>
                  <input readOnly value={c.judge_name || 'Designated Commercial Bench'} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Filing Date</label>
                  <input readOnly value={c.filing_date || '2026-07-22'} />
                </div>
                <div className="form-group">
                  <label>Next Scheduled Appearance</label>
                  <input readOnly value={c.next_hearing_date || 'None scheduled'} />
                </div>
              </div>

              {c.notes && (
                <div className="form-group">
                  <label>Litigation Strategy & Notes</label>
                  <textarea readOnly rows={3} value={c.notes} />
                </div>
              )}

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e5e9f2', marginTop: '6px' }}>
                <b style={{ fontSize: '12px' }}>Transition Case Status:</b>
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {['Active', 'In Review', 'Hearing Scheduled', 'Closed', 'Archived'].map(st => (
                    <button
                      key={st}
                      className={`btn-secondary ${c.status === st ? 'btn-primary' : ''}`}
                      style={{ padding: '4px 10px', fontSize: '11px' }}
                      onClick={() => onChangeStatus(c.id, st)}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {subTab === 'documents' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <b>Linked Case Documents ({docs.length})</b>
                <button className="btn-secondary" onClick={onAddDoc} style={{ fontSize: '11px' }}>
                  <Plus size={13} /> Upload to Case
                </button>
              </div>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Category</th>
                    <th>Size</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.map(d => (
                    <tr key={d.id}>
                      <td><b>{d.filename}</b></td>
                      <td>{d.category}</td>
                      <td>{(d.file_size_bytes / 1024).toFixed(0)} KB</td>
                      <td><span className="badge-status active">{d.processing_status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {subTab === 'hearings' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <b>Matter Cause List ({hearings.length})</b>
                <button className="btn-secondary" onClick={onAddHearing} style={{ fontSize: '11px' }}>
                  <Plus size={13} /> Add Hearing
                </button>
              </div>
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Courtroom</th>
                    <th>Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {hearings.map(h => (
                    <tr key={h.id}>
                      <td><b>{h.hearing_date}</b> <small>{h.hearing_time}</small></td>
                      <td>{h.courtroom}</td>
                      <td>{h.hearing_type}</td>
                      <td><span className="badge-status in-review">{h.preparation_status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {subTab === 'tasks' && (
            <div>
              <b>Action Items for this Matter ({tasks.length})</b>
              <div style={{ marginTop: '10px' }}>
                {tasks.map(t => (
                  <div key={t.id} style={{ padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <b style={{ fontSize: '12px' }}>{t.title}</b>
                    <div style={{ fontSize: '10.5px', color: '#64748b' }}>Due: {t.due_date} · Assigned: {t.assigned_to}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          <button
            className="btn-secondary"
            style={{ color: '#e11d48', borderColor: '#fecdd3' }}
            onClick={() => onDeleteCase(c.id)}
          >
            <Trash2 size={14} /> Delete Matter Record
          </button>
          <button className="btn-primary" onClick={onClose}>
            Close Case File
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalNewCase({ onClose, onSubmit }) {
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [opposingParty, setOpposingParty] = useState('');
  const [courtJurisdiction, setCourtJurisdiction] = useState('District Civil Court Saket');
  const [caseType, setCaseType] = useState('Commercial Dispute');
  const [priority, setPriority] = useState('Medium');
  const [claimAmount, setClaimAmount] = useState('₹');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      title,
      client_name: clientName,
      client_email: clientEmail,
      opposing_party: opposingParty,
      court_jurisdiction: courtJurisdiction,
      case_type: caseType,
      priority,
      claim_amount: claimAmount,
      notes,
      status: 'Active'
    });
  };

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal-dialog" onSubmit={handleSubmit}>
        <div className="modal-header">
          <div>
            <h2>Open New Legal Matter</h2>
            <p>Initiate matter file and assign case tracking reference.</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Case / Matter Title *</label>
            <input required autoFocus placeholder="e.g. Sharma vs. Eastern Heavy Industries" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Client / Represented Entity *</label>
              <input required placeholder="Client full name or company" value={clientName} onChange={e => setClientName(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Client Contact Email</label>
              <input type="email" placeholder="client@domain.com" value={clientEmail} onChange={e => setClientEmail(e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Opposing Party</label>
              <input placeholder="Respondent / Defendant name" value={opposingParty} onChange={e => setOpposingParty(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Claim / Relief Value</label>
              <input placeholder="e.g. ₹45,00,000" value={claimAmount} onChange={e => setClaimAmount(e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Forum & Jurisdiction</label>
              <input value={courtJurisdiction} onChange={e => setCourtJurisdiction(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Matter Category</label>
              <select value={caseType} onChange={e => setCaseType(e.target.value)}>
                <option>Commercial Dispute</option>
                <option>Property Partition</option>
                <option>Commercial Contract</option>
                <option>Employment</option>
                <option>Intellectual Property</option>
                <option>Criminal Defense</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Initial Case Notes & Procedural Strategy</label>
            <textarea rows={2} placeholder="Summary of cause of action, key dates, or interim relief prayed for..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary"><Plus size={15} /> Create Case Record</button>
        </div>
      </form>
    </div>
  );
}

function ModalUploadDoc({ cases, onClose, onSubmit }) {
  const [filename, setFilename] = useState('');
  const [caseId, setCaseId] = useState(cases[0]?.id || '');
  const [category, setCategory] = useState('Pleading');
  const [textContent, setTextContent] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const selCase = cases.find(c => c.id === Number(caseId));
    onSubmit({
      filename: filename.endsWith('.pdf') || filename.endsWith('.docx') ? filename : `${filename}.pdf`,
      case_id: Number(caseId),
      case_number: selCase?.case_number,
      case_title: selCase?.title,
      category,
      file_type: 'pdf',
      file_size_bytes: textContent.length || 450000,
      file_content_text: textContent
    });
  };

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal-dialog" onSubmit={handleSubmit}>
        <div className="modal-header">
          <div>
            <h2>Upload Legal Document (Vault)</h2>
            <p>Upload document for SHA-256 integrity hashing and AI advisory extraction.</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="upload-dropzone" onClick={() => {
            if (!filename) setFilename('Petition_for_Interim_Injunction.pdf');
          }}>
            <FileText size={32} />
            <b>Drag and drop court document, or click to populate</b>
            <p>Physical files hashed with SHA-256 for Section 65B BSA compliance</p>
          </div>

          <div className="form-group">
            <label>Document Filename *</label>
            <input required placeholder="e.g. Master_Supply_Agreement_Exhibit_A.pdf" value={filename} onChange={e => setFilename(e.target.value)} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Matter Link *</label>
              <select value={caseId} onChange={e => setCaseId(e.target.value)}>
                {cases.map(c => (
                  <option key={c.id} value={c.id}>{c.case_number} · {c.title}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Document Classification</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                <option>Pleading</option>
                <option>Petition</option>
                <option>Affidavit</option>
                <option>Contract</option>
                <option>Notice</option>
                <option>Evidence</option>
                <option>Court Order</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Document Text Content (NLP Extraction Engine)</label>
            <textarea rows={3} placeholder="Paste operative clauses, notice demands, or affidavit averments..." value={textContent} onChange={e => setTextContent(e.target.value)} />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary"><Upload size={15} /> Store in Vault & Extract</button>
        </div>
      </form>
    </div>
  );
}

function ModalNewHearing({ cases, onClose, onSubmit }) {
  const [caseId, setCaseId] = useState(cases[0]?.id || '');
  const [hearingDate, setHearingDate] = useState('2026-10-30');
  const [hearingTime, setHearingTime] = useState('10:30 AM');
  const [courtroom, setCourtroom] = useState('Courtroom 4');
  const [judge, setJudge] = useState("Hon'ble Judge R. K. Singhal");
  const [hearingType, setHearingType] = useState('Arguments');

  const handleSubmit = (e) => {
    e.preventDefault();
    const selCase = cases.find(c => c.id === Number(caseId));
    onSubmit({
      case_id: Number(caseId),
      case_number: selCase?.case_number || 'CP-2026-024',
      case_title: selCase?.title || 'Matter',
      hearing_date: hearingDate,
      hearing_time: hearingTime,
      court_name: selCase?.court_jurisdiction || 'District Civil Court Saket',
      courtroom,
      judge,
      hearing_type: hearingType,
      preparation_status: 'Preparation Needed'
    });
  };

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal-dialog" onSubmit={handleSubmit}>
        <div className="modal-header">
          <div>
            <h2>Schedule Court Hearing</h2>
            <p>Add listed appearance to the chamber calendar and cause list.</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Matter *</label>
            <select value={caseId} onChange={e => setCaseId(e.target.value)}>
              {cases.map(c => (
                <option key={c.id} value={c.id}>{c.case_number} · {c.title}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Hearing Date *</label>
              <input type="date" required value={hearingDate} onChange={e => setHearingDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Time</label>
              <input value={hearingTime} onChange={e => setHearingTime(e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Courtroom</label>
              <input value={courtroom} onChange={e => setCourtroom(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Bench / Hon'ble Judge</label>
              <input value={judge} onChange={e => setJudge(e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label>Appearance Type</label>
            <select value={hearingType} onChange={e => setHearingType(e.target.value)}>
              <option>Preliminary Hearing & Service Check</option>
              <option>Order 39 Ad-Interim Arguments</option>
              <option>Final Arguments</option>
              <option>Evidence Presentation</option>
              <option>Mediation Meeting</option>
            </select>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary"><CalendarDays size={15} /> Add to Diary</button>
        </div>
      </form>
    </div>
  );
}

function ModalNewTask({ cases, currentUser, onClose, onSubmit }) {
  const [title, setTitle] = useState('');
  const [caseId, setCaseId] = useState(cases[0]?.id || '');
  const [assignedTo, setAssignedTo] = useState(currentUser.name);
  const [dueDate, setDueDate] = useState('Tomorrow · 12:00 PM');
  const [priority, setPriority] = useState('High');

  const handleSubmit = (e) => {
    e.preventDefault();
    const selCase = cases.find(c => c.id === Number(caseId));
    onSubmit({
      title,
      case_id: Number(caseId),
      case_number: selCase?.case_number,
      assigned_to: assignedTo,
      due_date: dueDate,
      priority
    });
  };

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal-dialog" onSubmit={handleSubmit}>
        <div className="modal-header">
          <div>
            <h2>Assign Action Item</h2>
            <p>Create a task linked to matter deadlines.</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Task Description *</label>
            <input required placeholder="e.g. Inspect registry for service report of summons" value={title} onChange={e => setTitle(e.target.value)} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Associated Matter</label>
              <select value={caseId} onChange={e => setCaseId(e.target.value)}>
                {cases.map(c => (
                  <option key={c.id} value={c.id}>{c.case_number} · {c.title}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Assignee</label>
              <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                {USERS.map(u => <option key={u.name} value={u.name}>{u.name} ({u.role})</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Due Date / Target</label>
              <input value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)}>
                <option>Urgent</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary"><Plus size={15} /> Assign Task</button>
        </div>
      </form>
    </div>
  );
}

function ModalNewClient({ onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [entityType, setEntityType] = useState('Individual');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('New Delhi');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      name,
      entity_type: entityType,
      contact_email: email,
      contact_phone: phone,
      address
    });
  };

  return (
    <div className="modal-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal-dialog" onSubmit={handleSubmit}>
        <div className="modal-header">
          <div>
            <h2>Register New Client</h2>
            <p>Add client contact to chamber records.</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body">
          <div className="form-group">
            <label>Client / Entity Name *</label>
            <input required placeholder="Client name or organization" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Entity Classification</label>
              <select value={entityType} onChange={e => setEntityType(e.target.value)}>
                <option>Individual</option>
                <option>Corporate</option>
                <option>Trust/LLP</option>
              </select>
            </div>
            <div className="form-group">
              <label>Contact Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Phone Contact</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} />
            </div>
            <div className="form-group">
              <label>City / Address</label>
              <input value={address} onChange={e => setAddress(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary"><Plus size={15} /> Save Client Record</button>
        </div>
      </form>
    </div>
  );
}
