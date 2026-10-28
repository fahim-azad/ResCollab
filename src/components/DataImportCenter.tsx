import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  DownloadCloud,
  Database,
  Radio,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Play,
  Settings,
  Search,
  ExternalLink,
  FileText,
  Layers,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  X,
  FileCode,
  Sparkles,
  FileWarning
} from 'lucide-react';
import './DataImportCenter.css';

const API_BASE_URL = 'http://localhost:5000/api';

// ==========================================
// INTERFACES & TYPES
// ==========================================

export interface SourceStatusSummary {
  sourceId: number;
  sourceKey: string;
  name: string;
  collectionMethod: string;
  isActive: boolean;
  totalRecordsIngested: number;
  totalDuplicatesFiltered: number;
  lastSuccessfulRun?: string;
  lastJobStatus?: string;
}

export interface ExternalDataSource {
  id: number;
  sourceKey: string;
  name: string;
  baseUrl: string;
  collectionMethod: string;
  apiKey?: string;
  rateLimitPerMinute: number;
  isActive: boolean;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IngestionJobLog {
  id: number;
  sourceId: number;
  status: string;
  recordsFetched: number;
  recordsNormalized: number;
  duplicatesSkipped: number;
  errorsCount: number;
  durationMs: number;
  summaryMessage?: string;
  startedAt: string;
  completedAt?: string;
  source?: ExternalDataSource;
}

export interface ExternalResearchRecord {
  id: number;
  sourceId?: number;
  externalId: string;
  title: string;
  normalizedTitleHash?: string;
  authors: string;
  abstract?: string;
  doi?: string;
  publicationYear?: number;
  publicationDate?: string;
  journalOrVenue?: string;
  primaryField?: string;
  originalUrl: string;
  pdfDownloadUrl?: string;
  license?: string;
  ingestionStatus: string;
  collectedAt: string;
  source?: ExternalDataSource;
}

export interface IngestionErrorRecord {
  id: number;
  jobLogId: number;
  rawPayload: string;
  errorCode: string;
  errorMessage: string;
  occurredAt: string;
}

export interface NormalizedRecordResult {
  isValid: boolean;
  validationErrors: string[];
  title: string;
  normalizedTitleHash: string;
  authors: string;
  firstAuthor: string;
  abstract?: string;
  doi?: string;
  publicationYear?: number;
  publicationDate?: string;
  journalOrVenue?: string;
  primaryField?: string;
  originalUrl: string;
  pdfDownloadUrl?: string;
  license?: string;
}

export interface DeduplicationRunSummary {
  totalScanned: number;
  duplicatesIdentified: number;
  mergedRecords: number;
  durationMs: number;
  message: string;
}

const PRESET_TOPICS = [
  'Artificial Intelligence',
  'Deep Learning Transformers',
  'Quantum Computing',
  'CRISPR Gene Editing',
  'Renewable Energy Storage',
  'Cybersecurity & Cryptography',
  'Biomedical Signal Processing'
];

export const DataImportCenter: React.FC = () => {
  // Navigation Tabs: 'status' | 'harvest' | 'jobs' | 'quarantine' | 'records'
  const [activeTab, setActiveTab] = useState<'status' | 'harvest' | 'jobs' | 'quarantine' | 'records'>('status');

  // Authentication & Permissions
  const token = localStorage.getItem('token');
  const userStr = localStorage.getItem('user');
  const currentUser = useMemo(() => (userStr ? JSON.parse(userStr) : null), [userStr]);
  const userRole = (currentUser?.role || currentUser?.userType || '').toLowerCase();
  const isStaff = userRole === 'admin' || userRole === 'moderator' || userRole === 'institutionaladmin';

  // Source Statuses & Config States
  const [sources, setSources] = useState<SourceStatusSummary[]>([]);
  const [loadingSources, setLoadingSources] = useState<boolean>(true);
  const [editingSource, setEditingSource] = useState<ExternalDataSource | null>(null);
  const [editBaseUrl, setEditBaseUrl] = useState<string>('');
  const [editRateLimit, setEditRateLimit] = useState<number>(60);
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editApiKey, setEditApiKey] = useState<string>('');
  const [savingConfig, setSavingConfig] = useState<boolean>(false);

  // Harvesting Trigger States
  const [harvestSourceKey, setHarvestSourceKey] = useState<string>('ARXIV');
  const [harvestQuery, setHarvestQuery] = useState<string>('Artificial Intelligence');
  const [harvestMaxRecords, setHarvestMaxRecords] = useState<number>(25);
  const [harvesting, setHarvesting] = useState<boolean>(false);
  const [latestJobResult, setLatestJobResult] = useState<IngestionJobLog | null>(null);
  const [harvestError, setHarvestError] = useState<string | null>(null);

  // Normalization Sandbox States
  const [sandboxTitle, setSandboxTitle] = useState<string>('Attention Is All You Need: Transformer Models in NLP');
  const [sandboxAuthors, setSandboxAuthors] = useState<string>('Vaswani, Ashish; Shazeer, Noam; Parmar, Niki; Uszkoreit, Jakob');
  const [sandboxDoi, setSandboxDoi] = useState<string>('https://doi.org/10.48550/arXiv.1706.03762');
  const [sandboxVenue, setSandboxVenue] = useState<string>('Advances in Neural Information Processing Systems (NeurIPS)');
  const [sandboxUrl, setSandboxUrl] = useState<string>('https://arxiv.org/abs/1706.03762');
  const [sandboxResult, setSandboxResult] = useState<NormalizedRecordResult | null>(null);
  const [testingNormalization, setTestingNormalization] = useState<boolean>(false);

  // Job History Logs States
  const [jobLogs, setJobLogs] = useState<IngestionJobLog[]>([]);
  const [loadingJobs, setLoadingJobs] = useState<boolean>(false);
  const [selectedJobDetail, setSelectedJobDetail] = useState<IngestionJobLog | null>(null);

  // Quarantined Errors States
  const [quarantined, setQuarantined] = useState<IngestionErrorRecord[]>([]);
  const [loadingQuarantine, setLoadingQuarantine] = useState<boolean>(false);
  const [quarantinePage, setQuarantinePage] = useState<number>(1);
  const [totalQuarantine, setTotalQuarantine] = useState<number>(0);
  const [reprocessingId, setReprocessingId] = useState<number | null>(null);

  // Deduplication Pass State
  const [runningDedup, setRunningDedup] = useState<boolean>(false);
  const [dedupSummary, setDedupSummary] = useState<DeduplicationRunSummary | null>(null);

  // Ingested Records Explorer States
  const [records, setRecords] = useState<ExternalResearchRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState<boolean>(false);
  const [recordSourceFilter, setRecordSourceFilter] = useState<string>('All');
  const [recordStatusFilter, setRecordStatusFilter] = useState<string>('All');
  const [recordSearch, setRecordSearch] = useState<string>('');
  const [debouncedRecordSearch, setDebouncedRecordSearch] = useState<string>('');
  const [recordsPage, setRecordsPage] = useState<number>(1);
  const [recordsTotalCount, setRecordsTotalCount] = useState<number>(0);
  const [recordsTotalPages, setRecordsTotalPages] = useState<number>(1);

  // Toast Notifications
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const getAuthHeader = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }, [token]);

  // Debounce search in records explorer
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRecordSearch(recordSearch);
      setRecordsPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [recordSearch]);

  // ==========================================
  // FETCH SOURCE HEALTH STATUSES
  // ==========================================
  const fetchSourcesStatus = useCallback(async () => {
    setLoadingSources(true);
    try {
      const res = await fetch(`${API_BASE_URL}/external-data/sources/status`, {
        headers: getAuthHeader()
      });
      if (res.ok) {
        const data: SourceStatusSummary[] = await res.json();
        setSources(data);
      }
    } catch (err) {
      console.error('Error fetching source statuses:', err);
      showToast('Could not fetch source health status.');
    } finally {
      setLoadingSources(false);
    }
  }, [getAuthHeader]);

  // ==========================================
  // FETCH JOB HISTORY LOGS
  // ==========================================
  const fetchJobLogs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const res = await fetch(`${API_BASE_URL}/external-data/jobs?limit=30`, {
        headers: getAuthHeader()
      });
      if (res.ok) {
        const data: IngestionJobLog[] = await res.json();
        setJobLogs(data);
      }
    } catch (err) {
      console.error('Error fetching job logs:', err);
    } finally {
      setLoadingJobs(false);
    }
  }, [getAuthHeader]);

  // ==========================================
  // FETCH QUARANTINED RECORDS
  // ==========================================
  const fetchQuarantined = useCallback(async () => {
    if (!isStaff) return;
    setLoadingQuarantine(true);
    try {
      const res = await fetch(`${API_BASE_URL}/external-data/quarantine?page=${quarantinePage}&pageSize=15`, {
        headers: getAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        setQuarantined(data.items || []);
        setTotalQuarantine(data.totalCount || 0);
      }
    } catch (err) {
      console.error('Error fetching quarantined records:', err);
    } finally {
      setLoadingQuarantine(false);
    }
  }, [isStaff, quarantinePage, getAuthHeader]);

  // ==========================================
  // FETCH INGESTED RESEARCH RECORDS
  // ==========================================
  const fetchIngestedRecords = useCallback(async () => {
    setLoadingRecords(true);
    try {
      const params = new URLSearchParams();
      if (recordSourceFilter && recordSourceFilter !== 'All') params.append('sourceKey', recordSourceFilter);
      if (recordStatusFilter && recordStatusFilter !== 'All') params.append('status', recordStatusFilter);
      if (debouncedRecordSearch.trim()) params.append('search', debouncedRecordSearch.trim());
      params.append('page', recordsPage.toString());
      params.append('pageSize', '15');

      const res = await fetch(`${API_BASE_URL}/external-data/records?${params.toString()}`, {
        headers: getAuthHeader()
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.items || []);
        setRecordsTotalCount(data.totalCount || 0);
        setRecordsTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching records:', err);
    } finally {
      setLoadingRecords(false);
    }
  }, [recordSourceFilter, recordStatusFilter, debouncedRecordSearch, recordsPage, getAuthHeader]);

  useEffect(() => {
    fetchSourcesStatus();
  }, [fetchSourcesStatus]);

  useEffect(() => {
    if (activeTab === 'jobs') fetchJobLogs();
    if (activeTab === 'quarantine') fetchQuarantined();
    if (activeTab === 'records') fetchIngestedRecords();
  }, [activeTab, fetchJobLogs, fetchQuarantined, fetchIngestedRecords]);

  // ==========================================
  // TRIGGER HARVEST RUN
  // ==========================================
  const handleTriggerHarvest = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setHarvesting(true);
    setHarvestError(null);
    setLatestJobResult(null);

    try {
      const payload = {
        sourceKey: harvestSourceKey,
        queryKeyword: harvestQuery.trim() || undefined,
        maxRecords: harvestMaxRecords
      };

      const res = await fetch(`${API_BASE_URL}/external-data/harvest`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || `Harvest job failed with status ${res.status}`);
      }

      setLatestJobResult(data);
      showToast(`✓ Ingestion complete! ${data.recordsNormalized} records normalized from ${harvestSourceKey}.`);
      fetchSourcesStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Harvest job encountered an unexpected error.';
      setHarvestError(msg);
      showToast('Data collection failed.');
    } finally {
      setHarvesting(false);
    }
  };

  // Quick Harvest Shortcut from a Source Card
  const handleQuickHarvestSource = (key: string) => {
    setHarvestSourceKey(key);
    setActiveTab('harvest');
  };

  // ==========================================
  // RUN NORMALIZATION SANDBOX TEST
  // ==========================================
  const handleRunNormalizationTest = async () => {
    setTestingNormalization(true);
    try {
      const payload = {
        title: sandboxTitle,
        authors: sandboxAuthors,
        doi: sandboxDoi,
        journalOrVenue: sandboxVenue,
        originalUrl: sandboxUrl
      };

      const res = await fetch(`${API_BASE_URL}/external-data/normalize`, {
        method: 'POST',
        headers: getAuthHeader(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data: NormalizedRecordResult = await res.json();
        setSandboxResult(data);
        showToast('Normalization payload processed.');
      } else {
        showToast('Normalization test failed.');
      }
    } catch {
      showToast('Error executing normalization sandbox.');
    } finally {
      setTestingNormalization(false);
    }
  };

  // ==========================================
  // RUN BATCH DEDUPLICATION PASS
  // ==========================================
  const handleRunDeduplication = async () => {
    if (!isStaff) return;
    setRunningDedup(true);
    setDedupSummary(null);

    try {
      const res = await fetch(`${API_BASE_URL}/external-data/deduplicate`, {
        method: 'POST',
        headers: getAuthHeader()
      });

      if (res.ok) {
        const data: DeduplicationRunSummary = await res.json();
        setDedupSummary(data);
        showToast(`✓ Deduplication complete: ${data.duplicatesIdentified} duplicates identified.`);
        fetchSourcesStatus();
      } else {
        showToast('Deduplication pass failed.');
      }
    } catch {
      showToast('Error during deduplication pass.');
    } finally {
      setRunningDedup(false);
    }
  };

  // ==========================================
  // REPROCESS QUARANTINED RECORD
  // ==========================================
  const handleReprocessQuarantine = async (id: number) => {
    setReprocessingId(id);
    try {
      const res = await fetch(`${API_BASE_URL}/external-data/quarantine/${id}/reprocess`, {
        method: 'POST',
        headers: getAuthHeader()
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Record successfully reprocessed and normalized!');
        fetchQuarantined();
        fetchSourcesStatus();
      } else {
        showToast(data.message || 'Reprocessing failed: data still malformed.');
      }
    } catch {
      showToast('Error reprocessing quarantined entry.');
    } finally {
      setReprocessingId(null);
    }
  };

  // ==========================================
  // OPEN SOURCE CONFIG MODAL
  // ==========================================
  const handleOpenSourceConfig = async (sourceId: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/external-data/sources/${sourceId}`, {
        headers: getAuthHeader()
      });
      if (res.ok) {
        const data: ExternalDataSource = await res.json();
        setEditingSource(data);
        setEditBaseUrl(data.baseUrl);
        setEditRateLimit(data.rateLimitPerMinute);
        setEditIsActive(data.isActive);
        setEditApiKey(data.apiKey || '');
      }
    } catch {
      showToast('Failed to load source details.');
    }
  };

  // Save Source Configuration
  const handleSaveSourceConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSource) return;

    setSavingConfig(true);
    try {
      const payload = {
        ...editingSource,
        baseUrl: editBaseUrl.trim(),
        rateLimitPerMinute: editRateLimit,
        isActive: editIsActive,
        apiKey: editApiKey.trim() || undefined
      };

      const res = await fetch(`${API_BASE_URL}/external-data/sources/${editingSource.id}`, {
        method: 'PUT',
        headers: getAuthHeader(),
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast(`✓ Settings updated for ${editingSource.name}.`);
        setEditingSource(null);
        fetchSourcesStatus();
      } else {
        showToast('Failed to update source configuration.');
      }
    } catch {
      showToast('Error saving configuration.');
    } finally {
      setSavingConfig(false);
    }
  };

  // Aggregated Summary Statistics
  const totalIngested = useMemo(() => sources.reduce((acc, s) => acc + s.totalRecordsIngested, 0), [sources]);
  const totalDuplicates = useMemo(() => sources.reduce((acc, s) => acc + s.totalDuplicatesFiltered, 0), [sources]);
  const activeSourcesCount = useMemo(() => sources.filter(s => s.isActive).length, [sources]);

  // Helpers
  const formatRelativeTime = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDays = Math.floor(diffHour / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const getSourceIconBadge = (key: string) => {
    switch (key.toUpperCase()) {
      case 'ARXIV':
        return <span className="source-avatar-chip arxiv">arXiv</span>;
      case 'CROSSREF':
        return <span className="source-avatar-chip crossref">CR</span>;
      case 'OPENALEX':
        return <span className="source-avatar-chip openalex">OA</span>;
      case 'WIKICFP':
        return <span className="source-avatar-chip wikicfp">CFP</span>;
      case 'INSTITUTIONAL':
        return <span className="source-avatar-chip institutional">DSpace</span>;
      default:
        return <span className="source-avatar-chip default">{key.slice(0, 2)}</span>;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'Success':
        return <span className="status-badge success"><CheckCircle2 size={12} /> Success</span>;
      case 'Running':
        return <span className="status-badge running"><RefreshCw size={12} className="animate-spin" /> In Progress</span>;
      case 'PartialFailure':
        return <span className="status-badge partial"><AlertTriangle size={12} /> Partial</span>;
      case 'Failed':
        return <span className="status-badge failed"><XCircle size={12} /> Failed</span>;
      default:
        return <span className="status-badge neutral"><Clock size={12} /> Ready</span>;
    }
  };

  return (
    <div className="import-center-container" id="data-import-center-page">
      {/* =========================================================================
          1. HEADER & HERO OVERVIEW
          ========================================================================= */}
      <div className="import-header">
        <div className="import-title-group">
          <div className="import-icon-box">
            <DownloadCloud size={30} className="text-indigo" />
          </div>
          <div>
            <h1>External Data Import & Source Status</h1>
            <p>
              Harvest, canonicalize, and deduplicate research preprints, peer-reviewed publications, and academic CFPs from permitted scholarly repositories.
            </p>
          </div>
        </div>

        <div className="import-header-actions">
          {isStaff && (
            <button
              className="btn-action-outline"
              id="btn-global-dedup"
              disabled={runningDedup}
              onClick={handleRunDeduplication}
              title="Execute global deduplication algorithm"
            >
              <Layers size={16} className={runningDedup ? 'animate-spin' : ''} />
              <span>{runningDedup ? 'Deduplicating...' : 'Run Deduplication Pass'}</span>
            </button>
          )}

          <button
            className="btn-action-primary"
            id="btn-refresh-sources"
            onClick={() => {
              fetchSourcesStatus();
              showToast('Source status metrics refreshed.');
            }}
            title="Refresh source health"
          >
            <RefreshCw size={16} className={loadingSources ? 'animate-spin' : ''} />
            <span>Sync Health</span>
          </button>
        </div>
      </div>

      {/* =========================================================================
          2. METRICS & SUMMARY CARDS
          ========================================================================= */}
      <div className="import-metrics-grid" id="import-metrics-summary">
        <div className="import-metric-card" id="card-metric-sources">
          <div className="metric-card-top">
            <span className="metric-label">Permitted Repositories</span>
            <Radio size={18} className="metric-icon text-indigo" />
          </div>
          <div className="metric-number">
            {activeSourcesCount} <span className="metric-total-sub">/ {sources.length} Active</span>
          </div>
          <div className="metric-footer">Whitelisted academic endpoints</div>
        </div>

        <div className="import-metric-card" id="card-metric-records">
          <div className="metric-card-top">
            <span className="metric-label">Harvested Records</span>
            <Database size={18} className="metric-icon text-emerald" />
          </div>
          <div className="metric-number text-emerald">{totalIngested.toLocaleString()}</div>
          <div className="metric-footer">Normalized research artifacts</div>
        </div>

        <div className="import-metric-card" id="card-metric-duplicates">
          <div className="metric-card-top">
            <span className="metric-label">Duplicates Resolved</span>
            <Layers size={18} className="metric-icon text-amber" />
          </div>
          <div className="metric-number text-amber">{totalDuplicates.toLocaleString()}</div>
          <div className="metric-footer">
            {totalIngested > 0
              ? `${((totalDuplicates / (totalIngested + totalDuplicates)) * 100).toFixed(1)}% Collision filtering rate`
              : 'Deduplication shield active'}
          </div>
        </div>

        <div className="import-metric-card" id="card-metric-pipeline">
          <div className="metric-card-top">
            <span className="metric-label">Pipeline Architecture</span>
            <ShieldCheck size={18} className="metric-icon text-blue" />
          </div>
          <div className="metric-number text-blue">REST + OAI</div>
          <div className="metric-footer">Fallback Dublin Core & Atom feeds</div>
        </div>
      </div>

      {/* Global Deduplication Banner Result */}
      {dedupSummary && (
        <div className="dedup-result-banner animate-fade-in" id="dedup-summary-banner">
          <CheckCircle2 size={20} className="text-emerald" />
          <div className="banner-text">
            <strong>Deduplication Sweep Completed:</strong> {dedupSummary.message} (Scanned {dedupSummary.totalScanned} records in {dedupSummary.durationMs}ms).
          </div>
          <button className="btn-close-banner" onClick={() => setDedupSummary(null)}><X size={15} /></button>
        </div>
      )}

      {/* =========================================================================
          3. NAVIGATION TABS
          ========================================================================= */}
      <div className="import-tabs-bar" role="tablist" id="import-navigation-tabs">
        <button
          className={`import-tab-btn ${activeTab === 'status' ? 'active' : ''}`}
          id="tab-sources-status"
          onClick={() => setActiveTab('status')}
        >
          <Radio size={16} />
          <span>Source Health & Repositories ({sources.length})</span>
        </button>

        <button
          className={`import-tab-btn ${activeTab === 'harvest' ? 'active' : ''}`}
          id="tab-harvest-import"
          onClick={() => setActiveTab('harvest')}
        >
          <Play size={16} />
          <span>Harvest & Import Console</span>
        </button>

        <button
          className={`import-tab-btn ${activeTab === 'jobs' ? 'active' : ''}`}
          id="tab-job-logs"
          onClick={() => setActiveTab('jobs')}
        >
          <Clock size={16} />
          <span>Ingestion Audit Logs</span>
        </button>

        {isStaff && (
          <button
            className={`import-tab-btn ${activeTab === 'quarantine' ? 'active' : ''}`}
            id="tab-quarantine-errors"
            onClick={() => setActiveTab('quarantine')}
          >
            <FileWarning size={16} />
            <span>Quarantined Records ({totalQuarantine})</span>
          </button>
        )}

        <button
          className={`import-tab-btn ${activeTab === 'records' ? 'active' : ''}`}
          id="tab-ingested-records"
          onClick={() => setActiveTab('records')}
        >
          <FileText size={16} />
          <span>Harvested Research Explorer</span>
        </button>
      </div>

      {/* =========================================================================
          4. TAB 1: SOURCE HEALTH & REPOSITORIES
          ========================================================================= */}
      {activeTab === 'status' && (
        <div className="import-section" id="section-source-health">
          <div className="section-intro-bar">
            <div>
              <h2>Whitelisted Repository Registry</h2>
              <p>Monitors API rate limits, collection modalities, sync telemetry, and health statuses.</p>
            </div>
            <button
              className="btn-trigger-all-harvest"
              id="btn-goto-harvest"
              onClick={() => setActiveTab('harvest')}
            >
              <Play size={14} /> Open Harvest Trigger
            </button>
          </div>

          {loadingSources ? (
            <div className="import-loading-state">
              <RefreshCw size={28} className="animate-spin text-indigo" />
              <span>Querying repository health endpoints...</span>
            </div>
          ) : (
            <div className="source-cards-grid" id="source-cards-container">
              {sources.map(source => (
                <div key={source.sourceId} className="source-status-card" id={`source-card-${source.sourceKey.toLowerCase()}`}>
                  <div className="source-card-header">
                    <div className="source-card-title-row">
                      {getSourceIconBadge(source.sourceKey)}
                      <div>
                        <h3>{source.name}</h3>
                        <span className="source-key-badge">{source.sourceKey}</span>
                      </div>
                    </div>
                    <div className="source-active-indicator">
                      {source.isActive ? (
                        <span className="indicator-online" title="Repository is active for scheduled harvesting">
                          <span className="dot pulse"></span> Online
                        </span>
                      ) : (
                        <span className="indicator-offline" title="Repository collection is currently paused">
                          <span className="dot"></span> Paused
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Method & Stats Row */}
                  <div className="source-details-box">
                    <div className="source-meta-item">
                      <span className="meta-label">Modalities:</span>
                      <span className="method-pill">{source.collectionMethod}</span>
                    </div>

                    <div className="source-stats-row">
                      <div>
                        <span className="meta-label">Total Ingested</span>
                        <div className="stat-val font-bold text-slate-800">{source.totalRecordsIngested.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="meta-label">Duplicates Cleaned</span>
                        <div className="stat-val font-bold text-amber">{source.totalDuplicatesFiltered.toLocaleString()}</div>
                      </div>
                      <div>
                        <span className="meta-label">Last Job Status</span>
                        <div>{getStatusBadge(source.lastJobStatus)}</div>
                      </div>
                    </div>

                    <div className="source-last-run-row">
                      <Clock size={13} className="text-slate-400" />
                      <span>Last sync: <strong>{formatRelativeTime(source.lastSuccessfulRun)}</strong></span>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="source-card-actions">
                    <button
                      className="btn-source-harvest"
                      id={`btn-harvest-source-${source.sourceKey.toLowerCase()}`}
                      onClick={() => handleQuickHarvestSource(source.sourceKey)}
                    >
                      <Play size={13} /> Harvest Now
                    </button>

                    {isStaff && (
                      <button
                        className="btn-source-config"
                        id={`btn-config-source-${source.sourceId}`}
                        title="Configure repository settings"
                        onClick={() => handleOpenSourceConfig(source.sourceId)}
                      >
                        <Settings size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          5. TAB 2: HARVEST & IMPORT CONSOLE
          ========================================================================= */}
      {activeTab === 'harvest' && (
        <div className="import-section" id="section-harvest-console">
          <div className="harvest-grid-layout">
            {/* Left Column: Harvest Trigger Form */}
            <div className="harvest-form-card">
              <div className="card-header-styled">
                <Play size={18} className="text-indigo" />
                <div>
                  <h3>Initiate Data Harvesting Run</h3>
                  <p>Execute live collection queries against authorized scholarly search engines.</p>
                </div>
              </div>

              {harvestError && (
                <div className="harvest-alert-error" id="harvest-error-banner">
                  <AlertTriangle size={18} />
                  <span>{harvestError}</span>
                </div>
              )}

              <form onSubmit={handleTriggerHarvest} id="form-trigger-harvest">
                {/* Target Source Dropdown */}
                <div className="form-field-group">
                  <label htmlFor="select-harvest-source">Target Repository Endpoint *</label>
                  <select
                    id="select-harvest-source"
                    className="styled-select"
                    value={harvestSourceKey}
                    onChange={e => setHarvestSourceKey(e.target.value)}
                  >
                    <option value="ARXIV">arXiv.org (e-Print Archive)</option>
                    <option value="CROSSREF">Crossref (Metadata Registry & DOIs)</option>
                    <option value="OPENALEX">OpenAlex (Global Scholarly Graph)</option>
                    <option value="WIKICFP">WikiCFP (Academic Calls for Papers)</option>
                    <option value="INSTITUTIONAL">Institutional Open Access (DSpace/EPrints)</option>
                  </select>
                </div>

                {/* Research Keyword Query */}
                <div className="form-field-group">
                  <label htmlFor="input-harvest-query">Scholarly Query Keyword / Topic</label>
                  <input
                    type="text"
                    id="input-harvest-query"
                    className="styled-input"
                    placeholder="e.g. quantum computing, crispr, transformer architecture..."
                    value={harvestQuery}
                    onChange={e => setHarvestQuery(e.target.value)}
                  />
                  <div className="preset-topics-bar">
                    <span className="presets-label">Preset Topics:</span>
                    {PRESET_TOPICS.map((topic, i) => (
                      <button
                        key={i}
                        type="button"
                        className="preset-topic-chip"
                        onClick={() => setHarvestQuery(topic)}
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Maximum Records Slider */}
                <div className="form-field-group">
                  <div className="field-label-between">
                    <label htmlFor="input-harvest-max-records">Harvest Batch Limit</label>
                    <span className="slider-counter">{harvestMaxRecords} records</span>
                  </div>
                  <input
                    type="range"
                    id="input-harvest-max-records"
                    className="styled-slider"
                    min="10"
                    max="100"
                    step="5"
                    value={harvestMaxRecords}
                    onChange={e => setHarvestMaxRecords(parseInt(e.target.value, 10))}
                  />
                  <span className="field-hint">Respects upstream rate-limiting policies and politeness rules.</span>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  id="btn-run-harvest"
                  className="btn-trigger-run"
                  disabled={harvesting}
                >
                  {harvesting ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      <span>Harvesting & Normalizing from {harvestSourceKey}...</span>
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      <span>Start Collection Pipeline</span>
                    </>
                  )}
                </button>
              </form>

              {/* Real-time Job Progress/Result */}
              {latestJobResult && (
                <div className="harvest-result-card animate-fade-in" id="harvest-latest-result">
                  <div className="result-card-header">
                    <CheckCircle2 size={20} className="text-emerald" />
                    <h4>Harvest Job #{latestJobResult.id} Succeeded</h4>
                  </div>
                  <div className="result-metrics-grid">
                    <div className="result-metric">
                      <span className="label">Fetched</span>
                      <span className="val">{latestJobResult.recordsFetched}</span>
                    </div>
                    <div className="result-metric">
                      <span className="label">Normalized</span>
                      <span className="val text-emerald font-bold">{latestJobResult.recordsNormalized}</span>
                    </div>
                    <div className="result-metric">
                      <span className="label">Duplicates</span>
                      <span className="val text-amber">{latestJobResult.duplicatesSkipped}</span>
                    </div>
                    <div className="result-metric">
                      <span className="label">Latency</span>
                      <span className="val">{latestJobResult.durationMs}ms</span>
                    </div>
                  </div>
                  <div className="result-summary-text">
                    {latestJobResult.summaryMessage}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Normalization Engine Test Sandbox */}
            <div className="sandbox-card">
              <div className="card-header-styled">
                <FileCode size={18} className="text-emerald" />
                <div>
                  <h3>Normalization & Parsing Sandbox</h3>
                  <p>Test the pre-validation and canonical title-DOI hash generator with raw metadata.</p>
                </div>
              </div>

              <div className="sandbox-form">
                <div className="form-field-group">
                  <label htmlFor="input-sandbox-title">Raw Title</label>
                  <input
                    type="text"
                    id="input-sandbox-title"
                    className="styled-input"
                    value={sandboxTitle}
                    onChange={e => setSandboxTitle(e.target.value)}
                  />
                </div>

                <div className="form-field-group">
                  <label htmlFor="input-sandbox-authors">Raw Authors (delimited)</label>
                  <input
                    type="text"
                    id="input-sandbox-authors"
                    className="styled-input"
                    value={sandboxAuthors}
                    onChange={e => setSandboxAuthors(e.target.value)}
                  />
                </div>

                <div className="form-field-group">
                  <label htmlFor="input-sandbox-doi">Raw DOI</label>
                  <input
                    type="text"
                    id="input-sandbox-doi"
                    className="styled-input"
                    value={sandboxDoi}
                    onChange={e => setSandboxDoi(e.target.value)}
                  />
                </div>

                <div className="form-field-group">
                  <label htmlFor="input-sandbox-venue">Journal or Venue</label>
                  <input
                    type="text"
                    id="input-sandbox-venue"
                    className="styled-input"
                    value={sandboxVenue}
                    onChange={e => setSandboxVenue(e.target.value)}
                  />
                </div>

                <div className="form-field-group">
                  <label htmlFor="input-sandbox-url">Source Permalink</label>
                  <input
                    type="text"
                    id="input-sandbox-url"
                    className="styled-input"
                    value={sandboxUrl}
                    onChange={e => setSandboxUrl(e.target.value)}
                  />
                </div>

                <button
                  type="button"
                  id="btn-test-normalization"
                  className="btn-sandbox-test"
                  disabled={testingNormalization}
                  onClick={handleRunNormalizationTest}
                >
                  {testingNormalization ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>Test Normalization Engine</span>
                </button>

                {sandboxResult && (
                  <div className="sandbox-output-box animate-fade-in" id="sandbox-output-results">
                    <h4>Canonical Normalized Output</h4>
                    <div className="sandbox-json-display">
                      <div className="json-field">
                        <strong>Cleaned Title:</strong> {sandboxResult.title}
                      </div>
                      <div className="json-field">
                        <strong>Canonical DOI:</strong> <span className="text-emerald">{sandboxResult.doi || 'None'}</span>
                      </div>
                      <div className="json-field">
                        <strong>First Author:</strong> {sandboxResult.firstAuthor}
                      </div>
                      <div className="json-field">
                        <strong>Title SHA256 Hash:</strong>
                        <code className="hash-code">{sandboxResult.normalizedTitleHash}</code>
                      </div>
                      <div className="json-field">
                        <strong>Integrity Status:</strong>{' '}
                        {sandboxResult.isValid ? (
                          <span className="badge-valid">Valid Entity</span>
                        ) : (
                          <span className="badge-invalid">Validation Errors: {sandboxResult.validationErrors.join(', ')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          6. TAB 3: INGESTION JOB HISTORY LOGS
          ========================================================================= */}
      {activeTab === 'jobs' && (
        <div className="import-section" id="section-job-history">
          <div className="section-intro-bar">
            <div>
              <h2>Ingestion Execution Audit Logs</h2>
              <p>Chronological audit log tracking harvest duration, records fetched, and quarantine errors.</p>
            </div>
            <button className="btn-refresh-inline" onClick={fetchJobLogs}>
              <RefreshCw size={14} /> Refresh Logs
            </button>
          </div>

          {loadingJobs ? (
            <div className="import-loading-state">
              <RefreshCw size={28} className="animate-spin text-indigo" />
              <span>Loading ingestion audit logs...</span>
            </div>
          ) : jobLogs.length === 0 ? (
            <div className="import-empty-state">
              <Clock size={36} className="text-slate-400" />
              <p>No historical collection jobs found. Trigger a harvest to generate audit entries.</p>
            </div>
          ) : (
            <div className="import-table-wrapper">
              <table className="styled-table" id="table-job-logs">
                <thead>
                  <tr>
                    <th>Job ID</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>Fetched</th>
                    <th>Normalized</th>
                    <th>Duplicates</th>
                    <th>Errors</th>
                    <th>Latency</th>
                    <th>Started</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobLogs.map(job => (
                    <tr key={job.id} id={`row-job-${job.id}`}>
                      <td><span className="table-id-badge">#{job.id}</span></td>
                      <td>
                        <strong>{job.source?.name || `Source #${job.sourceId}`}</strong>
                        <span className="sub-key">{job.source?.sourceKey}</span>
                      </td>
                      <td>{getStatusBadge(job.status)}</td>
                      <td>{job.recordsFetched}</td>
                      <td><span className="text-emerald font-bold">{job.recordsNormalized}</span></td>
                      <td><span className="text-amber">{job.duplicatesSkipped}</span></td>
                      <td>{job.errorsCount > 0 ? <span className="text-rose font-bold">{job.errorsCount}</span> : 0}</td>
                      <td>{job.durationMs}ms</td>
                      <td><span className="date-sub">{new Date(job.startedAt).toLocaleTimeString()}</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn-inspect-job"
                          onClick={() => setSelectedJobDetail(job)}
                          title="Inspect run telemetry"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          7. TAB 4: QUARANTINED RECORDS (STAFF ONLY)
          ========================================================================= */}
      {activeTab === 'quarantine' && isStaff && (
        <div className="import-section" id="section-quarantine-errors">
          <div className="section-intro-bar">
            <div>
              <h2>Quarantined Records & Fault Isolation</h2>
              <p>Malformed payloads with missing required attributes are isolated here without breaking pipelines.</p>
            </div>
            <button className="btn-refresh-inline" onClick={fetchQuarantined}>
              <RefreshCw size={14} /> Refresh Quarantine
            </button>
          </div>

          {loadingQuarantine ? (
            <div className="import-loading-state">
              <RefreshCw size={28} className="animate-spin text-indigo" />
              <span>Examining quarantine logs...</span>
            </div>
          ) : quarantined.length === 0 ? (
            <div className="import-empty-state">
              <CheckCircle2 size={36} className="text-emerald" />
              <p>Zero quarantined records. All upstream harvested payloads complied with validation constraints.</p>
            </div>
          ) : (
            <>
              <div className="import-table-wrapper">
                <table className="styled-table" id="table-quarantined-records">
                  <thead>
                    <tr>
                      <th>Quarantine ID</th>
                      <th>Job ID</th>
                      <th>Error Code</th>
                      <th>Error Reason</th>
                      <th>Raw Payload Preview</th>
                      <th>Occurred</th>
                      <th style={{ textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quarantined.map(err => (
                      <tr key={err.id} id={`row-quarantine-${err.id}`}>
                        <td><span className="table-id-badge">#{err.id}</span></td>
                        <td>#{err.jobLogId}</td>
                        <td><span className="error-code-badge">{err.errorCode}</span></td>
                        <td><span className="error-msg-text">{err.errorMessage}</span></td>
                        <td>
                          <code className="payload-snippet" title={err.rawPayload}>
                            {err.rawPayload.slice(0, 60)}...
                          </code>
                        </td>
                        <td><span className="date-sub">{formatRelativeTime(err.occurredAt)}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn-reprocess-action"
                            id={`btn-reprocess-${err.id}`}
                            disabled={reprocessingId === err.id}
                            onClick={() => handleReprocessQuarantine(err.id)}
                          >
                            {reprocessingId === err.id ? 'Reprocessing...' : 'Reprocess'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalQuarantine > 15 && (
                <div className="records-pagination-bar" id="quarantine-pagination">
                  <span className="pagination-text">
                    Page {quarantinePage} of {Math.ceil(totalQuarantine / 15)} ({totalQuarantine} total quarantined)
                  </span>
                  <div className="pagination-controls">
                    <button
                      className="btn-page"
                      disabled={quarantinePage <= 1}
                      onClick={() => setQuarantinePage(p => Math.max(1, p - 1))}
                    >
                      <ChevronLeft size={16} /> Prev
                    </button>
                    <span className="page-indicator">{quarantinePage}</span>
                    <button
                      className="btn-page"
                      disabled={quarantinePage >= Math.ceil(totalQuarantine / 15)}
                      onClick={() => setQuarantinePage(p => p + 1)}
                    >
                      Next <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* =========================================================================
          8. TAB 5: INGESTED RESEARCH REPOSITORY EXPLORER
          ========================================================================= */}
      {activeTab === 'records' && (
        <div className="import-section" id="section-harvested-explorer">
          <div className="section-intro-bar">
            <div>
              <h2>Ingested Research Repository</h2>
              <p>Explore normalized preprints, publications, and papers harvested across all permitted sources.</p>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="records-filter-toolbar">
            <div className="records-search-wrap">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                id="input-search-records"
                className="styled-input records-search-input"
                placeholder="Search ingested papers by title, author, venue, or DOI..."
                value={recordSearch}
                onChange={e => setRecordSearch(e.target.value)}
              />
              {recordSearch && (
                <button className="btn-clear" onClick={() => setRecordSearch('')}><X size={14} /></button>
              )}
            </div>

            <div className="records-dropdowns">
              <select
                id="select-records-source"
                className="styled-select"
                value={recordSourceFilter}
                onChange={e => {
                  setRecordSourceFilter(e.target.value);
                  setRecordsPage(1);
                }}
              >
                <option value="All">All Sources</option>
                <option value="ARXIV">arXiv</option>
                <option value="CROSSREF">Crossref</option>
                <option value="OPENALEX">OpenAlex</option>
                <option value="WIKICFP">WikiCFP</option>
                <option value="INSTITUTIONAL">Institutional</option>
              </select>

              <select
                id="select-records-status"
                className="styled-select"
                value={recordStatusFilter}
                onChange={e => {
                  setRecordStatusFilter(e.target.value);
                  setRecordsPage(1);
                }}
              >
                <option value="All">All Statuses</option>
                <option value="Normalized">Normalized</option>
                <option value="Duplicate">Duplicate</option>
                <option value="Merged">Merged</option>
              </select>
            </div>
          </div>

          {/* Records Cards View */}
          {loadingRecords ? (
            <div className="import-loading-state">
              <RefreshCw size={28} className="animate-spin text-indigo" />
              <span>Fetching staged research records...</span>
            </div>
          ) : records.length === 0 ? (
            <div className="import-empty-state">
              <FileText size={36} className="text-slate-400" />
              <p>No ingested records found matching your filters. Try a different keyword or trigger a harvest.</p>
            </div>
          ) : (
            <div className="records-feed-list" id="records-feed-container">
              {records.map(record => (
                <article key={record.id} className="record-item-card" id={`record-card-${record.id}`}>
                  <div className="record-card-top-row">
                    <span className="record-source-tag">{record.source?.name || 'External Source'}</span>
                    <span className={`status-pill status-${record.ingestionStatus.toLowerCase()}`}>
                      {record.ingestionStatus}
                    </span>
                    {record.publicationYear && (
                      <span className="record-year-tag">{record.publicationYear}</span>
                    )}
                  </div>

                  <h3 className="record-title">
                    <a href={record.originalUrl} target="_blank" rel="noreferrer">
                      {record.title}
                    </a>
                  </h3>

                  <div className="record-authors-line">
                    <strong>Authors:</strong> {record.authors}
                  </div>

                  {record.abstract && (
                    <p className="record-abstract-snippet">
                      {record.abstract.slice(0, 240)}...
                    </p>
                  )}

                  <div className="record-meta-bar">
                    {record.journalOrVenue && (
                      <span className="meta-chip">Venue: {record.journalOrVenue}</span>
                    )}
                    {record.doi && (
                      <a
                        href={`https://doi.org/${record.doi}`}
                        target="_blank"
                        rel="noreferrer"
                        className="doi-chip"
                      >
                        DOI: {record.doi} <ExternalLink size={11} />
                      </a>
                    )}
                    {record.primaryField && (
                      <span className="field-chip">{record.primaryField}</span>
                    )}
                    {record.pdfDownloadUrl && (
                      <a
                        href={record.pdfDownloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="pdf-link-btn"
                      >
                        PDF Download
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {recordsTotalPages > 1 && (
            <div className="records-pagination-bar" id="records-pagination">
              <span className="pagination-text">
                Showing {records.length} of {recordsTotalCount} records (Page {recordsPage} of {recordsTotalPages})
              </span>
              <div className="pagination-controls">
                <button
                  className="btn-page"
                  disabled={recordsPage <= 1}
                  onClick={() => setRecordsPage(p => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} /> Prev
                </button>
                <span className="page-indicator">{recordsPage}</span>
                <button
                  className="btn-page"
                  disabled={recordsPage >= recordsTotalPages}
                  onClick={() => setRecordsPage(p => Math.min(recordsTotalPages, p + 1))}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          9. SOURCE CONFIGURATION MODAL (STAFF ONLY)
          ========================================================================= */}
      {editingSource && (
        <div className="import-modal-backdrop" id="modal-source-config" onClick={() => setEditingSource(null)}>
          <div className="import-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Configure {editingSource.name || 'Repository'}</h3>
              <button className="btn-close-modal" onClick={() => setEditingSource(null)}><X size={18} /></button>
            </div>

            <form onSubmit={handleSaveSourceConfig} className="modal-body">
              <div className="form-field-group">
                <label>Base Endpoint URL *</label>
                <input
                  type="text"
                  className="styled-input"
                  value={editBaseUrl}
                  onChange={e => setEditBaseUrl(e.target.value)}
                  required
                />
              </div>

              <div className="form-field-group">
                <label>Rate Limit (Requests per Minute)</label>
                <input
                  type="number"
                  className="styled-input"
                  min="5"
                  max="500"
                  value={editRateLimit}
                  onChange={e => setEditRateLimit(parseInt(e.target.value, 10))}
                />
              </div>

              <div className="form-field-group">
                <label>Optional API Key / Bearer Token</label>
                <input
                  type="password"
                  className="styled-input"
                  placeholder="Leave empty for public OAI-PMH / Open Access endpoints"
                  value={editApiKey}
                  onChange={e => setEditApiKey(e.target.value)}
                />
              </div>

              <div className="form-field-checkbox">
                <input
                  type="checkbox"
                  id="chk-source-active"
                  checked={editIsActive}
                  onChange={e => setEditIsActive(e.target.checked)}
                />
                <label htmlFor="chk-source-active">Active for automated collection jobs</label>
              </div>

              <div className="modal-footer-actions">
                <button type="button" className="btn-cancel" onClick={() => setEditingSource(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn-save" disabled={savingConfig}>
                  {savingConfig ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          10. JOB DETAIL MODAL
          ========================================================================= */}
      {selectedJobDetail && (
        <div className="import-modal-backdrop" id="modal-job-detail" onClick={() => setSelectedJobDetail(null)}>
          <div className="import-modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Job Execution Telemetry #{selectedJobDetail.id}</h3>
              <button className="btn-close-modal" onClick={() => setSelectedJobDetail(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="job-detail-grid">
                <div><strong>Status:</strong> {getStatusBadge(selectedJobDetail.status)}</div>
                <div><strong>Duration:</strong> {selectedJobDetail.durationMs}ms</div>
                <div><strong>Records Fetched:</strong> {selectedJobDetail.recordsFetched}</div>
                <div><strong>Records Normalized:</strong> {selectedJobDetail.recordsNormalized}</div>
                <div><strong>Duplicates Filtered:</strong> {selectedJobDetail.duplicatesSkipped}</div>
                <div><strong>Errors Quarantined:</strong> {selectedJobDetail.errorsCount}</div>
                <div><strong>Started:</strong> {new Date(selectedJobDetail.startedAt).toLocaleString()}</div>
                <div><strong>Completed:</strong> {selectedJobDetail.completedAt ? new Date(selectedJobDetail.completedAt).toLocaleString() : 'In Progress'}</div>
              </div>
              <div className="job-summary-note">
                <strong>Execution Log Note:</strong>
                <p>{selectedJobDetail.summaryMessage || 'No specific telemetry warnings reported.'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div className="import-toast" id="import-toast">
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default DataImportCenter;
