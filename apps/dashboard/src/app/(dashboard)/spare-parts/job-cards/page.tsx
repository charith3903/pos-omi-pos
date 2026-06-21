'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Plus, Wrench, Loader2, CheckCircle2, Clock, Truck, XCircle, RefreshCw } from 'lucide-react';

const STATUSES = ['ALL', 'RECEIVED', 'DIAGNOSING', 'REPAIRING', 'READY', 'DELIVERED'];

const STATUS_META: Record<string, { label: string; color: string }> = {
  RECEIVED:   { label: 'Received',   color: 'bg-gray-100 text-gray-700' },
  DIAGNOSING: { label: 'Diagnosing', color: 'bg-blue-100 text-blue-700' },
  REPAIRING:  { label: 'Repairing',  color: 'bg-amber-100 text-amber-700' },
  READY:      { label: 'Ready',      color: 'bg-green-100 text-green-700' },
  DELIVERED:  { label: 'Delivered',  color: 'bg-purple-100 text-purple-700' },
};

interface Job {
  id: string;
  deviceMake: string;
  deviceModel: string;
  imei: string | null;
  issue: string;
  status: string;
  technicianNotes: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  receivedAt: string;
  completedAt: string | null;
  createdAt: string;
}

const EMPTY_FORM = {
  customerName: '',
  customerPhone: '',
  deviceMake: '',
  deviceModel: '',
  registration: '',
  issue: '',
  technicianNotes: '',
  estimatedCost: '',
};

export default function JobCardsPage() {
  const [tab, setTab] = useState('ALL');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewJob, setViewJob] = useState<Job | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getRepairJobs(tab === 'ALL' ? undefined : tab);
      setJobs(data as Job[]);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const filtered = jobs.filter((j) => {
    const s = search.toLowerCase();
    return !s || j.deviceMake.toLowerCase().includes(s) || j.deviceModel.toLowerCase().includes(s) || (j.imei ?? '').toLowerCase().includes(s) || j.issue.toLowerCase().includes(s);
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createRepairJob({
        deviceMake: form.deviceMake,
        deviceModel: `${form.deviceModel}${form.registration ? ` (${form.registration})` : ''}`,
        imei: form.registration || null,
        issue: form.issue,
        technicianNotes: form.technicianNotes || null,
        estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : null,
      });
      setShowModal(false);
      setForm(EMPTY_FORM);
      fetchJobs();
    } catch {
      // keep modal open on error
    } finally {
      setSaving(false);
    }
  }

  async function advanceStatus(job: Job) {
    const order = ['RECEIVED', 'DIAGNOSING', 'REPAIRING', 'READY', 'DELIVERED'];
    const idx = order.indexOf(job.status);
    if (idx >= order.length - 1) return;
    const next = order[idx + 1];
    setUpdatingId(job.id);
    try {
      await api.updateRepairJob(job.id, { status: next });
      fetchJobs();
    } finally {
      setUpdatingId(null);
    }
  }

  const stats = {
    total: jobs.length,
    active: jobs.filter((j) => !['DELIVERED'].includes(j.status)).length,
    ready: jobs.filter((j) => j.status === 'READY').length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Cards</h1>
          <p className="text-sm text-gray-500 mt-1">Track vehicle / device repair jobs</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> New Job Card
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[{ label: 'Total Jobs', value: stats.total, icon: <Wrench className="w-5 h-5" />, color: 'text-blue-600 bg-blue-50' },
          { label: 'Active', value: stats.active, icon: <Clock className="w-5 h-5" />, color: 'text-amber-600 bg-amber-50' },
          { label: 'Ready to Collect', value: stats.ready, icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-green-600 bg-green-50' }].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
            <div className={`p-2 rounded-xl ${s.color}`}>{s.icon}</div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setTab(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s === 'ALL' ? 'All' : STATUS_META[s].label}
            </button>
          ))}
        </div>
        <input
          placeholder="Search by make, model, reg…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        />
        <button onClick={fetchJobs} className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No job cards found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Make / Model', 'Reg / IMEI', 'Issue', 'Estimated', 'Status', 'Received', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{job.deviceMake} {job.deviceModel}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{job.imei || '—'}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">{job.issue}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {job.estimatedCost ? `Rs ${Number(job.estimatedCost).toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_META[job.status]?.color ?? 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_META[job.status]?.label ?? job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(job.receivedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setViewJob(job)} className="text-xs text-blue-600 hover:underline font-medium">View</button>
                      {job.status !== 'DELIVERED' && (
                        <button
                          onClick={() => advanceStatus(job)}
                          disabled={updatingId === job.id}
                          className="text-xs text-green-600 hover:underline font-medium disabled:opacity-50"
                        >
                          {updatingId === job.id ? '…' : '→ Next'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">New Job Card</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Vehicle / Device Make *</label>
                  <input required value={form.deviceMake} onChange={(e) => setForm({ ...form, deviceMake: e.target.value })}
                    placeholder="Toyota / Samsung"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Model / Year *</label>
                  <input required value={form.deviceModel} onChange={(e) => setForm({ ...form, deviceModel: e.target.value })}
                    placeholder="Corolla 2019"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Reg No / IMEI / Serial</label>
                <input value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })}
                  placeholder="ABC-1234"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Problem / Issue *</label>
                <textarea required rows={2} value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })}
                  placeholder="Describe the problem…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Technician Notes</label>
                  <input value={form.technicianNotes} onChange={(e) => setForm({ ...form, technicianNotes: e.target.value })}
                    placeholder="Initial assessment…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Estimated Cost (Rs)</label>
                  <input type="number" min={0} value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })}
                    placeholder="0.00"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium">Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-semibold">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewJob && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Job Details</h2>
              <button onClick={() => setViewJob(null)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Vehicle / Device</span>
                <span className="text-sm font-semibold text-gray-900">{viewJob.deviceMake} {viewJob.deviceModel}</span>
              </div>
              {viewJob.imei && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Reg / IMEI</span>
                  <span className="text-sm font-mono text-gray-900">{viewJob.imei}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_META[viewJob.status]?.color}`}>{STATUS_META[viewJob.status]?.label}</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Issue</span>
                <p className="text-sm text-gray-900 mt-1">{viewJob.issue}</p>
              </div>
              {viewJob.technicianNotes && (
                <div>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Technician Notes</span>
                  <p className="text-sm text-gray-900 mt-1">{viewJob.technicianNotes}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-100">
                <div>
                  <div className="text-xs text-gray-500">Estimated</div>
                  <div className="text-sm font-semibold">{viewJob.estimatedCost ? `Rs ${Number(viewJob.estimatedCost).toLocaleString()}` : '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Actual</div>
                  <div className="text-sm font-semibold">{viewJob.actualCost ? `Rs ${Number(viewJob.actualCost).toLocaleString()}` : '—'}</div>
                </div>
              </div>
              {viewJob.status !== 'DELIVERED' && (
                <button
                  onClick={() => { advanceStatus(viewJob); setViewJob(null); }}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 text-white py-2.5 rounded-xl text-sm font-semibold mt-2"
                >
                  <Truck className="w-4 h-4" /> Advance Status
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
