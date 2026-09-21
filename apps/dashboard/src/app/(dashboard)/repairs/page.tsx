'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Modal } from '../billing/BillingModals';
import {
  Plus, Wrench, Loader2, CheckCircle2, RefreshCw, Receipt, Trash2, Clock,
} from 'lucide-react';

const STATUSES = ['ALL', 'RECEIVED', 'DIAGNOSING', 'REPAIRING', 'READY', 'DELIVERED', 'CANCELLED'];

const STATUS_META: Record<string, { label: string; color: string }> = {
  RECEIVED: { label: 'Received', color: 'bg-gray-100 text-gray-700' },
  DIAGNOSING: { label: 'Diagnosing', color: 'bg-blue-100 text-blue-700' },
  REPAIRING: { label: 'Repairing', color: 'bg-amber-100 text-amber-700' },
  READY: { label: 'Ready', color: 'bg-green-100 text-green-700' },
  DELIVERED: { label: 'Delivered', color: 'bg-purple-100 text-purple-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

const ADVANCE_ORDER = ['RECEIVED', 'DIAGNOSING', 'REPAIRING', 'READY', 'DELIVERED'];

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';
const btnPrimary = 'bg-primary-700 hover:bg-primary-800 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold';

function fmt(n: number) {
  return `LKR ${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function variantLabel(v?: { attributes?: Record<string, unknown> } | null) {
  if (!v?.attributes) return '';
  return Object.values(v.attributes).filter(Boolean).join(' / ');
}

interface RepairPart {
  id: string;
  productId: string;
  variantId: string | null;
  qty: number;
  unitPrice: number;
  product: { id: string; name: string };
  variant?: { id: string; attributes?: Record<string, unknown> } | null;
}

interface RepairJob {
  id: string;
  outletId: string | null;
  customerId: string | null;
  technicianId: string | null;
  invoiceId: string | null;
  deviceMake: string;
  deviceModel: string;
  imei: string | null;
  issue: string;
  diagnosis: string | null;
  status: string;
  technicianNotes: string | null;
  laborCharge: number;
  estimatedCost: number | null;
  actualCost: number | null;
  receivedAt: string;
  completedAt: string | null;
  customer?: { id: string; name: string; phone: string | null } | null;
  technician?: { id: string; name: string } | null;
  outlet?: { id: string; name: string } | null;
  parts: RepairPart[];
}

function jobTotal(j: RepairJob) {
  const partsTotal = j.parts.reduce((s, p) => s + Number(p.qty) * Number(p.unitPrice), 0);
  return partsTotal + Number(j.laborCharge || 0);
}

export default function RepairsPage() {
  const [tab, setTab] = useState('ALL');
  const [jobs, setJobs] = useState<RepairJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [outlets, setOutlets] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getRepairJobs(tab === 'ALL' ? undefined : tab);
      setJobs(data as RepairJob[]);
    } catch (e: any) {
      setJobs([]);
      setError(e.message ?? 'Failed to load repair jobs');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);
  useEffect(() => {
    api.getOutlets().then(setOutlets).catch(() => {});
    api.getUsers().then(setTechnicians).catch(() => {});
  }, []);

  const filtered = jobs.filter((j) => {
    const s = search.toLowerCase();
    return (
      !s ||
      j.deviceMake.toLowerCase().includes(s) ||
      j.deviceModel.toLowerCase().includes(s) ||
      (j.imei ?? '').toLowerCase().includes(s) ||
      j.issue.toLowerCase().includes(s) ||
      (j.customer?.name ?? '').toLowerCase().includes(s)
    );
  });

  const stats = {
    total: jobs.length,
    active: jobs.filter((j) => !['DELIVERED', 'CANCELLED'].includes(j.status)).length,
    ready: jobs.filter((j) => j.status === 'READY').length,
    billed: jobs.filter((j) => j.invoiceId).length,
  };

  const activeJob = jobs.find((j) => j.id === activeJobId) ?? null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Repair Jobs</h1>
          <p className="text-sm text-gray-500 mt-1">Intake devices, assign technicians, track parts &amp; labor, and bill straight to an invoice</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> New Repair Job
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Jobs', value: stats.total, icon: <Wrench className="w-5 h-5" />, color: 'text-blue-600 bg-blue-50' },
          { label: 'Active', value: stats.active, icon: <Clock className="w-5 h-5" />, color: 'text-amber-600 bg-amber-50' },
          { label: 'Ready to Collect', value: stats.ready, icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-green-600 bg-green-50' },
          { label: 'Billed', value: stats.billed, icon: <Receipt className="w-5 h-5" />, color: 'text-purple-600 bg-purple-50' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
            <div className={`p-2 rounded-xl ${s.color}`}>{s.icon}</div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setTab(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {s === 'ALL' ? 'All' : STATUS_META[s].label}
            </button>
          ))}
        </div>
        <input
          placeholder="Search by device, IMEI, customer…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        />
        <button onClick={fetchJobs} className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No repair jobs found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Device', 'Customer', 'Technician', 'Issue', 'Total', 'Status', 'Received', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((job) => (
                <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{job.deviceMake} {job.deviceModel}</div>
                    {job.imei && <div className="text-xs text-gray-400 font-mono">{job.imei}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{job.customer?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{job.technician?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">{job.issue}</td>
                  <td className="px-4 py-3 text-gray-700 font-medium">
                    {job.invoiceId ? fmt(job.actualCost ?? jobTotal(job)) : fmt(jobTotal(job))}
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
                    <button onClick={() => setActiveJobId(job.id)} className="text-xs text-blue-600 hover:underline font-medium">Manage</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreateJobModal
          outlets={outlets}
          technicians={technicians}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchJobs(); }}
        />
      )}

      {activeJob && (
        <JobDetailModal
          job={activeJob}
          outlets={outlets}
          technicians={technicians}
          onClose={() => setActiveJobId(null)}
          onChanged={fetchJobs}
        />
      )}
    </div>
  );
}

// ─── Create job ────────────────────────────────────────────────────────────

function CreateJobModal({
  outlets, technicians, onClose, onCreated,
}: { outlets: any[]; technicians: any[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    deviceMake: '', deviceModel: '', imei: '', issue: '', estimatedCost: '',
    outletId: outlets.find((o) => o.isDefault)?.id ?? '',
    technicianId: '',
  });
  const [custSearch, setCustSearch] = useState('');
  const [custResults, setCustResults] = useState<any[]>([]);
  const [customer, setCustomer] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!custSearch.trim()) { setCustResults([]); return; }
    const t = setTimeout(() => {
      api.getCustomers(custSearch).then(setCustResults).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [custSearch]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr('');
    try {
      await api.createRepairJob({
        outletId: form.outletId || undefined,
        customerId: customer?.id,
        technicianId: form.technicianId || undefined,
        deviceMake: form.deviceMake,
        deviceModel: form.deviceModel,
        imei: form.imei || undefined,
        issue: form.issue,
        estimatedCost: form.estimatedCost ? Number(form.estimatedCost) : undefined,
      });
      onCreated();
    } catch (e: any) {
      setErr(e.message ?? 'Failed to create job');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New Repair Job" onClose={onClose} width="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        {err && <p className="text-red-600 text-xs">{err}</p>}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Brand / Make *</label>
            <input required value={form.deviceMake} onChange={(e) => setForm({ ...form, deviceMake: e.target.value })}
              placeholder="Samsung / Apple"
              className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Model *</label>
            <input required value={form.deviceModel} onChange={(e) => setForm({ ...form, deviceModel: e.target.value })}
              placeholder="Galaxy A54"
              className={inputCls} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">IMEI / Serial</label>
          <input value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Reported Issue *</label>
          <textarea required rows={2} value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })}
            placeholder="Cracked screen, won't charge…"
            className={`${inputCls} resize-none`} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Customer</label>
          {customer ? (
            <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <span>{customer.name}{customer.phone ? ` · ${customer.phone}` : ''}</span>
              <button type="button" onClick={() => setCustomer(null)} className="text-xs text-red-500 hover:underline">Remove</button>
            </div>
          ) : (
            <div className="relative">
              <input value={custSearch} onChange={(e) => setCustSearch(e.target.value)} placeholder="Search customer (optional — walk-in if blank)" className={inputCls} />
              {custResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-40 overflow-auto">
                  {custResults.map((c) => (
                    <button type="button" key={c.id} onClick={() => { setCustomer(c); setCustResults([]); setCustSearch(''); }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50">
                      {c.name}{c.phone ? ` · ${c.phone}` : ''}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Technician</label>
            <select value={form.technicianId} onChange={(e) => setForm({ ...form, technicianId: e.target.value })} className={inputCls}>
              <option value="">Unassigned</option>
              {technicians.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Outlet</label>
            <select value={form.outletId} onChange={(e) => setForm({ ...form, outletId: e.target.value })} className={inputCls}>
              <option value="">—</option>
              {outlets.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Estimated Cost (optional quote)</label>
          <input type="number" min={0} value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} className={inputCls} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium">Cancel</button>
          <button type="submit" disabled={saving} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2 rounded-xl text-sm font-semibold">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Add a part ─────────────────────────────────────────────────────────────

function PartAdder({ jobId, onAdded }: { jobId: string; onAdded: () => void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [picked, setPicked] = useState<any>(null);
  const [variantId, setVariantId] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!q.trim() || picked) { setResults([]); return; }
    const t = setTimeout(() => {
      api.getProducts({ search: q, limit: 8 }).then((r) => setResults(r.items)).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [q, picked]);

  function pick(p: any) {
    setPicked(p);
    setResults([]);
    setQ(p.name);
    setPrice(String(p.effectivePrice ?? p.price));
    setVariantId('');
  }

  async function add() {
    if (!picked) return;
    if (picked.variants?.length > 0 && !variantId) { setErr('Pick a variant first'); return; }
    setSaving(true);
    setErr('');
    try {
      await api.addRepairPart(jobId, {
        productId: picked.id,
        variantId: variantId || undefined,
        qty: Number(qty),
        unitPrice: price ? Number(price) : undefined,
      });
      setPicked(null); setQ(''); setQty('1'); setPrice(''); setVariantId('');
      onAdded();
    } catch (e: any) {
      setErr(e.message ?? 'Failed to add part');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-dashed border-gray-300 rounded-lg p-3 space-y-2">
      <div className="relative">
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setPicked(null); }}
          placeholder="Search part / product to add…"
          className={inputCls}
        />
        {results.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-auto">
            {results.map((p) => (
              <button key={p.id} type="button" onClick={() => pick(p)} className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-primary-50">
                <span>{p.name}</span>
                <span className="text-gray-400">{fmt(p.effectivePrice ?? p.price)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {picked && (
        <div className="flex flex-wrap gap-2 items-center">
          {picked.variants?.length > 0 && (
            <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className={`${inputCls} max-w-[160px]`}>
              <option value="">Select variant…</option>
              {picked.variants.map((v: any) => (<option key={v.id} value={v.id}>{variantLabel(v)}</option>))}
            </select>
          )}
          <input type="number" min="0.001" step="0.001" value={qty} onChange={(e) => setQty(e.target.value)} className={`${inputCls} w-20`} placeholder="Qty" />
          <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={`${inputCls} w-28`} placeholder="Unit price" />
          <button type="button" onClick={add} disabled={saving} className={btnPrimary}>
            {saving ? '…' : 'Add Part'}
          </button>
        </div>
      )}
      {err && <p className="text-red-600 text-xs">{err}</p>}
    </div>
  );
}

// ─── Job detail / manage ────────────────────────────────────────────────────

function JobDetailModal({
  job, outlets, technicians, onClose, onChanged,
}: { job: RepairJob; outlets: any[]; technicians: any[]; onClose: () => void; onChanged: () => void }) {
  const [diagnosis, setDiagnosis] = useState(job.diagnosis ?? '');
  const [notes, setNotes] = useState(job.technicianNotes ?? '');
  const [laborCharge, setLaborCharge] = useState(String(job.laborCharge ?? 0));
  const [savingField, setSavingField] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [payMethod, setPayMethod] = useState('CASH');
  const [discount, setDiscount] = useState('0');
  const [outletId, setOutletId] = useState(job.outletId ?? outlets.find((o) => o.isDefault)?.id ?? '');
  const [checkoutErr, setCheckoutErr] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);

  const isBilled = !!job.invoiceId;
  const partsTotal = job.parts.reduce((s, p) => s + Number(p.qty) * Number(p.unitPrice), 0);
  const grandTotal = partsTotal + Number(laborCharge || 0);
  const dueAmount = Math.max(0, grandTotal - Number(discount || 0));

  async function saveField(patch: any, key: string) {
    setSavingField(key);
    try {
      await api.updateRepairJob(job.id, patch);
      onChanged();
    } finally {
      setSavingField(null);
    }
  }

  async function advance(next: string) {
    await api.updateRepairJob(job.id, { status: next });
    onChanged();
  }

  async function removePart(partId: string) {
    await api.removeRepairPart(job.id, partId);
    onChanged();
  }

  async function checkout() {
    setCheckingOut(true);
    setCheckoutErr('');
    try {
      const invoice = await api.checkoutRepairJob(job.id, {
        outletId,
        customerId: job.customerId ?? undefined,
        discount: Number(discount || 0),
        laborCharge: Number(laborCharge || 0),
        payments: [{ method: payMethod, amount: dueAmount }],
      });
      setReceipt(invoice);
      onChanged();
    } catch (e: any) {
      setCheckoutErr(e.message ?? 'Checkout failed');
    } finally {
      setCheckingOut(false);
    }
  }

  const nextStatus = ADVANCE_ORDER[ADVANCE_ORDER.indexOf(job.status) + 1];

  return (
    <Modal title={`${job.deviceMake} ${job.deviceModel}`} onClose={onClose} width="max-w-2xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_META[job.status]?.color ?? 'bg-gray-100 text-gray-600'}`}>
            {STATUS_META[job.status]?.label ?? job.status}
          </span>
          {job.imei && <span className="text-xs font-mono text-gray-500">IMEI {job.imei}</span>}
          <span className="text-xs text-gray-400">Received {new Date(job.receivedAt).toLocaleString()}</span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Customer</div>
            <div className="text-gray-900">{job.customer?.name ?? '— walk-in —'}</div>
            {job.customer?.phone && <div className="text-xs text-gray-400">{job.customer.phone}</div>}
          </div>
          <div>
            <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Technician</div>
            <select
              defaultValue={job.technicianId ?? ''}
              onChange={(e) => saveField({ technicianId: e.target.value || undefined }, 'technician')}
              className={inputCls}
            >
              <option value="">Unassigned</option>
              {technicians.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Reported Issue</div>
          <p className="text-sm text-gray-800">{job.issue}</p>
        </div>

        <div>
          <label className="text-xs text-gray-400 uppercase font-semibold mb-1 block">Diagnosis</label>
          <textarea rows={2} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} className={`${inputCls} resize-none`} />
          <button onClick={() => saveField({ diagnosis }, 'diagnosis')} disabled={savingField === 'diagnosis'} className="text-xs text-primary-700 hover:underline mt-1">
            {savingField === 'diagnosis' ? 'Saving…' : 'Save diagnosis'}
          </button>
        </div>

        <div>
          <label className="text-xs text-gray-400 uppercase font-semibold mb-1 block">Technician Notes</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} resize-none`} />
          <button onClick={() => saveField({ technicianNotes: notes }, 'notes')} disabled={savingField === 'notes'} className="text-xs text-primary-700 hover:underline mt-1">
            {savingField === 'notes' ? 'Saving…' : 'Save notes'}
          </button>
        </div>

        {job.status !== 'DELIVERED' && job.status !== 'CANCELLED' && (
          <div className="flex flex-wrap gap-2">
            {nextStatus && (
              <button onClick={() => advance(nextStatus)} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-500">
                Advance to {STATUS_META[nextStatus].label}
              </button>
            )}
            <button onClick={() => advance('CANCELLED')} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
              Cancel Job
            </button>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase font-semibold">Parts Used</span>
            <span className="text-xs text-gray-400">{fmt(partsTotal)}</span>
          </div>
          <div className="space-y-1 mb-2">
            {job.parts.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                <div>
                  <div className="font-medium text-gray-900">
                    {p.product.name}{p.variant ? ` (${variantLabel(p.variant)})` : ''}
                  </div>
                  <div className="text-xs text-gray-400">{Number(p.qty)} × {fmt(p.unitPrice)}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{fmt(Number(p.qty) * Number(p.unitPrice))}</span>
                  {!isBilled && (
                    <button onClick={() => removePart(p.id)} className="text-gray-300 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {job.parts.length === 0 && <p className="text-xs text-gray-400">No parts added yet.</p>}
          </div>
          {!isBilled && <PartAdder jobId={job.id} onAdded={onChanged} />}
        </div>

        <div>
          <label className="text-xs text-gray-400 uppercase font-semibold mb-1 block">Labor Charge</label>
          <div className="flex gap-2">
            <input type="number" min="0" value={laborCharge} onChange={(e) => setLaborCharge(e.target.value)} disabled={isBilled} className={inputCls} />
            {!isBilled && (
              <button onClick={() => saveField({ laborCharge: Number(laborCharge) }, 'labor')} disabled={savingField === 'labor'} className={btnPrimary}>
                {savingField === 'labor' ? '…' : 'Save'}
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4">
          {isBilled ? (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-green-800">Billed</div>
                <div className="text-xs text-green-600">Invoice total {fmt(job.actualCost ?? grandTotal)}</div>
              </div>
              <Receipt className="w-6 h-6 text-green-500" />
            </div>
          ) : receipt ? (
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <div className="text-sm font-semibold text-green-800">Invoice {receipt.number} created</div>
              <div className="text-xs text-green-600">Total {fmt(receipt.total)}</div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm font-semibold mb-3">
                <span>Total Due</span>
                <span>{fmt(dueAmount)}</span>
              </div>
              {!checkoutOpen ? (
                <button
                  onClick={() => setCheckoutOpen(true)}
                  disabled={grandTotal <= 0}
                  className="w-full bg-primary-700 hover:bg-primary-800 disabled:opacity-40 text-white py-2.5 rounded-xl text-sm font-semibold"
                >
                  Bill &amp; Checkout
                </button>
              ) : (
                <div className="space-y-3 bg-gray-50 rounded-xl p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Outlet</label>
                      <select value={outletId} onChange={(e) => setOutletId(e.target.value)} className={inputCls}>
                        {outlets.map((o) => (<option key={o.id} value={o.id}>{o.name}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Payment Method</label>
                      <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className={inputCls}>
                        {['CASH', 'CARD', 'TRANSFER', 'CHEQUE', 'CREDIT'].map((m) => (<option key={m} value={m}>{m}</option>))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Discount</label>
                    <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} className={inputCls} />
                  </div>
                  {checkoutErr && <p className="text-red-600 text-xs">{checkoutErr}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => setCheckoutOpen(false)} className="flex-1 text-sm text-gray-600 py-2">Cancel</button>
                    <button onClick={checkout} disabled={checkingOut || !outletId} className="flex-1 bg-primary-700 hover:bg-primary-800 disabled:opacity-40 text-white py-2 rounded-lg text-sm font-semibold">
                      {checkingOut ? 'Processing…' : `Charge ${fmt(dueAmount)}`}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
