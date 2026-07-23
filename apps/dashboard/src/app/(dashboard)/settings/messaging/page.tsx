'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Send, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

const STATUS_STYLE: Record<string, string> = {
  SENT: 'bg-green-50 text-green-700',
  DELIVERED: 'bg-green-50 text-green-700',
  FAILED: 'bg-red-50 text-red-700',
  PENDING: 'bg-amber-50 text-amber-700',
};

export default function MessagingSettingsPage() {
  const [settings, setSettings] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [testChannel, setTestChannel] = useState<'WHATSAPP' | 'SMS'>('WHATSAPP');
  const [testTo, setTestTo] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  function load() {
    Promise.all([api.getNotificationSettings(), api.getMessageLogs()])
      .then(([s, l]) => {
        setSettings(s);
        setLogs(l.items ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function set(field: string, value: any) {
    setSettings((prev: any) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.updateNotificationSettings(settings);
      setSettings(updated);
      setSaved(true);
    } catch (err: any) {
      alert(err.message ?? 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestSend() {
    if (!testTo.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.sendNotification({ channel: testChannel, to: testTo.trim(), body: 'Test message from OmniPOS 👋' });
      setTestResult(result.status === 'SENT' ? 'Sent successfully!' : `Failed: ${result.errorMessage ?? 'unknown error'}`);
      load();
    } catch (err: any) {
      setTestResult(err.message ?? 'Failed to send');
    } finally {
      setTesting(false);
    }
  }

  if (loading || !settings) {
    return <div className="p-8 text-gray-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><MessageCircle className="w-6 h-6 text-primary-600" /> Messaging</h1>
        <p className="text-sm text-gray-500 mt-1">Send sale receipts, promos and supplier notices via WhatsApp or SMS.</p>
      </div>

      {/* WhatsApp */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">WhatsApp (Meta Cloud API)</h2>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={!!settings.whatsappEnabled} onChange={(e) => set('whatsappEnabled', e.target.checked)} />
            Enabled
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Phone Number ID</label>
            <input value={settings.whatsappPhoneNumberId ?? ''} onChange={(e) => set('whatsappPhoneNumberId', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="1234567890" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Business Account ID</label>
            <input value={settings.whatsappBusinessAcctId ?? ''} onChange={(e) => set('whatsappBusinessAcctId', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Optional" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-500 mb-1">Access Token</label>
            <input
              value={settings.whatsappAccessToken ?? ''}
              onChange={(e) => set('whatsappAccessToken', e.target.value)}
              onFocus={(e) => { if (e.target.value.startsWith('••••••••')) set('whatsappAccessToken', ''); }}
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Permanent access token from Meta Business Suite"
            />
          </div>
        </div>
      </section>

      {/* SMS */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">SMS (smsapi.com)</h2>
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={!!settings.smsEnabled} onChange={(e) => set('smsEnabled', e.target.checked)} />
            Enabled
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sender Name</label>
            <input value={settings.smsSenderName ?? ''} onChange={(e) => set('smsSenderName', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Verified sender name" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">API Token (OAuth)</label>
            <input
              value={settings.smsApiToken ?? ''}
              onChange={(e) => set('smsApiToken', e.target.value)}
              onFocus={(e) => { if (e.target.value.startsWith('••••••••')) set('smsApiToken', ''); }}
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="From smsapi.com API Tokens panel"
            />
          </div>
        </div>
      </section>

      {/* Auto-send */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
        <h2 className="font-semibold text-gray-900">Automatic receipts</h2>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={!!settings.autoSendReceiptWhatsapp} onChange={(e) => set('autoSendReceiptWhatsapp', e.target.checked)} />
          Send a WhatsApp receipt automatically after every sale (if the customer has a phone number)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input type="checkbox" checked={!!settings.autoSendReceiptSms} onChange={(e) => set('autoSendReceiptSms', e.target.checked)} />
          Send an SMS receipt automatically after every sale
        </label>
      </section>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="bg-primary-700 hover:bg-primary-800 disabled:opacity-40 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors">
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        {saved && <span className="text-green-600 text-sm flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Saved</span>}
      </div>

      {/* Test send */}
      <section className="bg-white border border-gray-200 rounded-2xl p-6 space-y-3">
        <h2 className="font-semibold text-gray-900">Send a test message</h2>
        <div className="flex gap-2">
          {(['WHATSAPP', 'SMS'] as const).map((c) => (
            <button key={c} onClick={() => setTestChannel(c)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${testChannel === c ? 'bg-primary-700 text-white border-primary-700' : 'border-gray-300 text-gray-600'}`}>{c}</button>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="+94771234567" className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          <button onClick={handleTestSend} disabled={testing || !testTo.trim()} className="bg-gray-900 hover:bg-black disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5">
            <Send className="w-4 h-4" /> {testing ? 'Sending…' : 'Send Test'}
          </button>
        </div>
        {testResult && <p className="text-sm text-gray-600">{testResult}</p>}
      </section>

      {/* Log */}
      <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <h2 className="font-semibold text-gray-900 px-6 pt-6 pb-3">Recent messages</h2>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-gray-400 text-xs uppercase tracking-wider border-y border-gray-100">
              <th className="px-6 py-2 font-medium">Channel</th>
              <th className="px-6 py-2 font-medium">To</th>
              <th className="px-6 py-2 font-medium">Status</th>
              <th className="px-6 py-2 font-medium">Sent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.map((l) => (
              <tr key={l.id} className="text-sm">
                <td className="px-6 py-3 text-gray-700">{l.channel}</td>
                <td className="px-6 py-3 text-gray-700">{l.recipientPhone}</td>
                <td className="px-6 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLE[l.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {l.status === 'FAILED' ? <XCircle className="w-3 h-3 inline mr-1" /> : l.status === 'SENT' || l.status === 'DELIVERED' ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : null}
                    {l.status}
                  </span>
                </td>
                <td className="px-6 py-3 text-gray-500">{new Date(l.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">No messages sent yet.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
