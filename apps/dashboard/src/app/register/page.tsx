'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { saveSession } from '@/lib/auth';

import { ShoppingCart, Utensils, Wrench, Zap, Shirt, Smartphone, Home as HomeIcon } from 'lucide-react';

// ── Business type definitions ─────────────────────────────────────────────────

const BUSINESS_TYPES = [
  {
    key: 'SUPERMARKET',
    icon: <ShoppingCart className="w-8 h-8" />,
    label: 'Supermarket',
    desc: 'Grocery, FMCG & retail items',
    color: 'from-green-500 to-emerald-600',
    bg: 'bg-green-500/10 border-green-500/30 hover:border-green-400/60',
    activeBg: 'bg-green-500/20 border-green-400',
  },
  {
    key: 'RESTAURANT',
    icon: <Utensils className="w-8 h-8" />,
    label: 'Restaurant',
    desc: 'Food & beverage, KOT, tables',
    color: 'from-orange-500 to-red-500',
    bg: 'bg-orange-500/10 border-orange-500/30 hover:border-orange-400/60',
    activeBg: 'bg-orange-500/20 border-orange-400',
  },
  {
    key: 'SPARE_PARTS',
    icon: <Wrench className="w-8 h-8" />,
    label: 'Spare Parts',
    desc: 'Auto & machinery parts shop',
    color: 'from-gray-500 to-slate-600',
    bg: 'bg-gray-500/10 border-gray-500/30 hover:border-gray-400/60',
    activeBg: 'bg-gray-500/20 border-gray-400',
  },
  {
    key: 'ELECTRICAL',
    icon: <Zap className="w-8 h-8" />,
    label: 'Electrical',
    desc: 'Electronics & home appliances',
    color: 'from-yellow-500 to-amber-500',
    bg: 'bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-400/60',
    activeBg: 'bg-yellow-500/20 border-yellow-400',
  },
  {
    key: 'TEXTILE',
    icon: <Shirt className="w-8 h-8" />,
    label: 'Textile',
    desc: 'Clothing, fabric & fashion',
    color: 'from-pink-500 to-rose-500',
    bg: 'bg-pink-500/10 border-pink-500/30 hover:border-pink-400/60',
    activeBg: 'bg-pink-500/20 border-pink-400',
  },
  {
    key: 'MOBILE',
    icon: <Smartphone className="w-8 h-8" />,
    label: 'Mobile',
    desc: 'Phones, IMEI & accessories',
    color: 'from-blue-500 to-indigo-500',
    bg: 'bg-blue-500/10 border-blue-500/30 hover:border-blue-400/60',
    activeBg: 'bg-blue-500/20 border-blue-400',
  },
  {
    key: 'RENTAL',
    icon: <HomeIcon className="w-8 h-8" />,
    label: 'Rental',
    desc: 'Rental & leasing agreements',
    color: 'from-purple-500 to-violet-600',
    bg: 'bg-purple-500/10 border-purple-500/30 hover:border-purple-400/60',
    activeBg: 'bg-purple-500/20 border-purple-400',
  },
] as const;

type BusinessTypeKey = (typeof BUSINESS_TYPES)[number]['key'];

// ── Form state ────────────────────────────────────────────────────────────────

interface FormData {
  businessType: BusinessTypeKey | '';
  tenantName: string;
  subdomain: string;
  ownerName: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

const EMPTY: FormData = {
  businessType: '',
  tenantName: '',
  subdomain: '',
  ownerName: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
};

// ── Helper: auto-generate subdomain from tenant name ─────────────────────────
function toSubdomain(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 30);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormData>(EMPTY);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Auto-fill subdomain when tenant name changes
  function handleTenantName(value: string) {
    setForm((f) => ({
      ...f,
      tenantName: value,
      subdomain: toSubdomain(value),
    }));
  }

  function set(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function goToStep2() {
    if (!form.businessType) {
      setError('Please select a business type to continue.');
      return;
    }
    setError('');
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(form.subdomain)) {
      setError('Subdomain can only contain lowercase letters, numbers, and hyphens.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.registerTenant({
        tenantName: form.tenantName,
        subdomain: form.subdomain,
        businessType: form.businessType as BusinessTypeKey,
        ownerName: form.ownerName,
        email: form.email,
        phone: form.phone || undefined,
        password: form.password,
      });
      saveSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
        tenant: res.tenant ?? { id: res.user.tenantId, name: form.tenantName, subdomain: form.subdomain, businessType: form.businessType },
      });
      router.push('/billing');
    } catch (err: any) {
      setError(err.message ?? 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const selectedBusiness = BUSINESS_TYPES.find((b) => b.key === form.businessType);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-2xl">🧾</span>
          <span className="text-white font-bold text-lg tracking-tight">OmniPOS</span>
        </Link>
        <Link
          href="/login"
          className="text-sm text-blue-300 hover:text-white border border-blue-700 hover:border-blue-400 px-4 py-2 rounded-lg transition-all"
        >
          Already have a store? Sign in →
        </Link>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl">

          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <StepDot active={step === 1} done={step === 2} label="1" />
              <div className={`flex-1 h-0.5 rounded transition-all ${step === 2 ? 'bg-blue-500' : 'bg-white/10'}`} />
              <StepDot active={step === 2} done={false} label="2" />
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span className={step === 1 ? 'text-blue-400 font-semibold' : 'text-slate-500'}>Business Type</span>
              <span className={step === 2 ? 'text-blue-400 font-semibold' : 'text-slate-500'}>Store Details</span>
            </div>
          </div>

          {/* ─── Step 1: Business Type ─────────────────────────────────────── */}
          {step === 1 && (
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">What type of business are you?</h1>
                <p className="text-slate-400">We&apos;ll tailor the POS features to match your business.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                {BUSINESS_TYPES.map((bt) => {
                  const isSelected = form.businessType === bt.key;
                  return (
                    <button
                      key={bt.key}
                      type="button"
                      onClick={() => { set('businessType', bt.key); setError(''); }}
                      className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer
                        ${isSelected ? bt.activeBg : `border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/25`}
                      `}
                    >
                      <div className="text-3xl mb-3">{bt.icon}</div>
                      <div className="text-white font-semibold text-sm mb-1">{bt.label}</div>
                      <div className="text-slate-400 text-xs leading-snug">{bt.desc}</div>
                      {isSelected && (
                        <div className="mt-2 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
                          <span className="text-blue-300 text-xs font-medium">Selected</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {error && (
                <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={goToStep2}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-semibold text-base transition-all hover:shadow-lg hover:shadow-blue-500/25"
              >
                Continue →
              </button>
            </div>
          )}

          {/* ─── Step 2: Store Details ─────────────────────────────────────── */}
          {step === 2 && (
            <form onSubmit={handleSubmit}>
              <div className="mb-8 flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-1">Set up your store</h1>
                  <p className="text-sm text-slate-400 mt-1">Register to start managing your store&apos;s operations.</p>
                </div>
                {/* Selected business type badge */}
                {selectedBusiness && (
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex items-center gap-2 bg-white/5 border border-white/10 hover:border-white/25 px-3 py-2 rounded-xl transition-all"
                  >
                    <span className="text-xl">{selectedBusiness.icon}</span>
                    <div className="text-left">
                      <div className="text-white text-xs font-semibold">{selectedBusiness.label}</div>
                      <div className="text-slate-500 text-xs">Change ↩</div>
                    </div>
                  </button>
                )}
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">

                {/* Store section */}
                <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold">Store Info</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    label="Store Name"
                    placeholder="My Shop"
                    value={form.tenantName}
                    onChange={(v) => handleTenantName(v)}
                    required
                  />
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1.5">
                      Subdomain
                    </label>
                    <div className="flex items-center">
                      <input
                        type="text"
                        required
                        value={form.subdomain}
                        onChange={(e) => set('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="my-shop"
                        className="flex-1 min-w-0 bg-white/5 border border-white/15 focus:border-blue-500 text-white placeholder-slate-600 rounded-l-lg px-3 py-2.5 outline-none transition-colors text-sm"
                      />
                      <span className="bg-white/10 border border-l-0 border-white/15 text-slate-400 text-xs px-3 py-2.5 rounded-r-lg whitespace-nowrap">
                        .omnipos
                      </span>
                    </div>
                    <p className="text-slate-600 text-xs mt-1">Lowercase letters, numbers, hyphens only</p>
                  </div>
                </div>

                <hr className="border-white/10" />

                {/* Owner section */}
                <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold">Owner Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Your Name" placeholder="John Silva" value={form.ownerName} onChange={(v) => set('ownerName', v)} required />
                  <FormField label="Phone (optional)" type="tel" placeholder="+94 77 123 4567" value={form.phone} onChange={(v) => set('phone', v)} />
                </div>
                <FormField label="Email Address" type="email" placeholder="you@example.com" value={form.email} onChange={(v) => set('email', v)} required />

                <hr className="border-white/10" />

                {/* Password section */}
                <p className="text-slate-400 text-xs uppercase tracking-widest font-semibold">Password</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Password" type="password" placeholder="Min. 8 characters" value={form.password} onChange={(v) => set('password', v)} required />
                  <FormField label="Confirm Password" type="password" placeholder="Repeat password" value={form.confirmPassword} onChange={(v) => set('confirmPassword', v)} required />
                </div>
              </div>

              {error && (
                <div className="mt-4 bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-6 py-3.5 rounded-xl border border-white/15 text-slate-300 hover:text-white hover:border-white/30 font-semibold transition-all text-sm"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-blue-500/25 text-base"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                      </svg>
                      Creating store…
                    </span>
                  ) : (
                    '🚀 Create Store & Go to Dashboard'
                  )}
                </button>
              </div>
            </form>
          )}

        </div>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepDot({ active, done, label }: { active: boolean; done: boolean; label: string }) {
  if (done) {
    return (
      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        ✓
      </div>
    );
  }
  return (
    <div
      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${
        active
          ? 'border-blue-500 bg-blue-600 text-white'
          : 'border-white/20 bg-white/5 text-slate-500'
      }`}
    >
      {label}
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">{label}</label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/15 focus:border-blue-500 text-white placeholder-slate-600 rounded-lg px-3 py-2.5 outline-none transition-colors text-sm"
      />
    </div>
  );
}
