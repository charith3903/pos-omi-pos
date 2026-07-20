'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';

interface Plan {
  id: string;
  name: string;
  businessType: string;
  priceUsdMonthly: string;
  priceUsdAnnual: string | null;
  priceLkrMonthly: string | null;
  priceLkrAnnual: string | null;
  trialDays: number;
  includedModules: string[];
}

type Gateway = 'STRIPE' | 'PAYPAL' | 'PAYHERE';
type Cycle = 'MONTHLY' | 'ANNUAL';

const MODULE_LABELS: Record<string, string> = {
  catalog: 'Product Catalogue',
  invoices: 'Invoicing & Billing',
  stock: 'Stock Management',
  suppliers: 'Supplier Management',
  mobile: 'Repair Jobs & IMEI Tracking',
  warranty: 'Warranty Claims',
  purchasing: 'Purchase Orders & GRN',
  refunds: 'Returns & Refunds',
  restaurant: 'Restaurant / KOT-BOT',
  promotions: 'Promotions',
};

export default function OnboardingPlanPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<Cycle>('MONTHLY');
  const [gateway, setGateway] = useState<Gateway>('STRIPE');
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState('');

  const session = getSession();
  const businessType = session?.tenant?.businessType;

  useEffect(() => {
    if (!businessType) return;
    api
      .getPlans(businessType)
      .then((plans) => setPlan(plans[0] ?? null))
      .catch(() => setError('Could not load plan details.'))
      .finally(() => setLoading(false));
  }, [businessType]);

  const currency = gateway === 'PAYHERE' ? 'LKR' : 'USD';
  const price = plan
    ? currency === 'LKR'
      ? cycle === 'ANNUAL'
        ? plan.priceLkrAnnual
        : plan.priceLkrMonthly
      : cycle === 'ANNUAL'
        ? plan.priceUsdAnnual
        : plan.priceUsdMonthly
    : null;

  async function handlePayNow() {
    setCheckingOut(true);
    setError('');
    try {
      const result = await api.createCheckout({ gateway, billingCycle: cycle, currency });
      window.location.href = result.redirectUrl;
    } catch (err: any) {
      setError(err.message ?? 'Could not start checkout.');
      setCheckingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex flex-col">
      <header className="flex items-center justify-between px-8 py-5">
        <Link href="/" className="flex items-center gap-3">
          <span className="text-2xl">🧾</span>
          <span className="text-white font-bold text-lg tracking-tight">OmniPOS</span>
        </Link>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">You&apos;re all set!</h1>
            <p className="text-slate-400">
              Your {plan?.trialDays ?? 14}-day free trial has already started — no card required. Review
              your plan below, or start using OmniPOS right away.
            </p>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading plan…
            </div>
          )}

          {plan && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6">
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">{plan.name}</h2>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">
                    {currency === 'LKR' ? 'LKR' : '$'} {price ?? '—'}
                  </div>
                  <div className="text-xs text-slate-400">per {cycle === 'ANNUAL' ? 'year' : 'month'}</div>
                </div>
              </div>

              <ul className="space-y-2 mb-2">
                {plan.includedModules.map((m) => (
                  <li key={m} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    {MODULE_LABELS[m] ?? m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={() => router.push('/billing')}
            className="w-full mb-6 py-3.5 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 transition-all"
          >
            Start free trial — go to my dashboard
          </button>

          <div className="border-t border-white/10 pt-6">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Or activate now and skip the trial</h3>

            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setCycle('MONTHLY')}
                className={`flex-1 py-2 rounded-lg text-sm border ${cycle === 'MONTHLY' ? 'bg-blue-500/20 border-blue-400 text-white' : 'border-white/10 text-slate-400'}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setCycle('ANNUAL')}
                className={`flex-1 py-2 rounded-lg text-sm border ${cycle === 'ANNUAL' ? 'bg-blue-500/20 border-blue-400 text-white' : 'border-white/10 text-slate-400'}`}
              >
                Annual (save ~17%)
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              {(['STRIPE', 'PAYPAL', 'PAYHERE'] as Gateway[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGateway(g)}
                  className={`flex-1 py-2 rounded-lg text-sm border ${gateway === g ? 'bg-blue-500/20 border-blue-400 text-white' : 'border-white/10 text-slate-400'}`}
                >
                  {g === 'STRIPE' ? 'Card (Stripe)' : g === 'PAYPAL' ? 'PayPal' : 'PayHere (LKR)'}
                </button>
              ))}
            </div>

            {error && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={checkingOut || !plan}
              onClick={handlePayNow}
              className="w-full py-3 rounded-xl font-medium text-white bg-white/10 hover:bg-white/15 border border-white/10 disabled:opacity-50 transition-all"
            >
              {checkingOut ? 'Redirecting…' : `Pay ${currency === 'LKR' ? 'LKR' : '$'}${price ?? ''} now`}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
