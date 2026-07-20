'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { CreditCard, AlertTriangle, CheckCircle2, Loader2, History } from 'lucide-react';
import { api } from '@/lib/api';

type Gateway = 'STRIPE' | 'PAYPAL' | 'PAYHERE';
type Cycle = 'MONTHLY' | 'ANNUAL';

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  TRIALING: { label: 'Free Trial', className: 'bg-blue-50 text-blue-700' },
  ACTIVE: { label: 'Active', className: 'bg-green-50 text-green-700' },
  PAST_DUE: { label: 'Payment Failed', className: 'bg-amber-50 text-amber-700' },
  SUSPENDED: { label: 'Suspended', className: 'bg-red-50 text-red-700' },
  CANCELLED: { label: 'Cancelled', className: 'bg-gray-100 text-gray-600' },
};

export default function AccountSubscriptionPage() {
  const params = useSearchParams();
  const expired = params.get('reason') === 'expired';

  const [subscription, setSubscription] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<Cycle>('MONTHLY');
  const [gateway, setGateway] = useState<Gateway>('STRIPE');
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.getSubscription(), api.getBillingHistory()])
      .then(([sub, hist]) => {
        setSubscription(sub);
        setHistory(hist);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const currency = gateway === 'PAYHERE' ? 'LKR' : 'USD';
  const plan = subscription?.plan;
  const price = plan
    ? currency === 'LKR'
      ? cycle === 'ANNUAL' ? plan.priceLkrAnnual : plan.priceLkrMonthly
      : cycle === 'ANNUAL' ? plan.priceUsdAnnual : plan.priceUsdMonthly
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

  const statusInfo = subscription ? STATUS_LABEL[subscription.status] ?? { label: subscription.status, className: 'bg-gray-100 text-gray-600' } : null;
  const needsAction = subscription && ['PAST_DUE', 'SUSPENDED'].includes(subscription.status);
  const trialEndsAt = subscription?.trialEndsAt ? new Date(subscription.trialEndsAt) : null;
  const daysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Subscription & Billing</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your OmniPOS plan and payment method.</p>
      </div>

      {(expired || needsAction) && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            {subscription?.status === 'SUSPENDED'
              ? 'Your subscription is suspended. Reactivate below to restore access.'
              : subscription?.status === 'PAST_DUE'
                ? 'Your last payment failed. Please update your payment method to avoid suspension.'
                : 'Your trial has ended. Choose a payment option below to keep using OmniPOS.'}
          </span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 py-10">
          <Loader2 className="w-5 h-5 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{plan?.name ?? 'No plan'}</h2>
              {statusInfo && (
                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${statusInfo.className}`}>
                  {statusInfo.label}
                </span>
              )}
            </div>
            {subscription?.status === 'TRIALING' && daysLeft !== null && (
              <p className="text-sm text-gray-500 mb-2">{daysLeft} day{daysLeft === 1 ? '' : 's'} left in your free trial.</p>
            )}
            {subscription?.currentPeriodEnd && subscription.status === 'ACTIVE' && (
              <p className="text-sm text-gray-500 mb-2">
                Renews on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}.
              </p>
            )}
            {plan && (
              <p className="text-sm text-gray-500">
                ${plan.priceUsdMonthly}/mo (${plan.priceUsdAnnual}/yr) &middot; LKR {plan.priceLkrMonthly}/mo via PayHere
              </p>
            )}
          </div>

          {(subscription?.status === 'TRIALING' || needsAction) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> {needsAction ? 'Reactivate subscription' : 'Activate now (skip trial)'}
              </h3>

              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setCycle('MONTHLY')}
                  className={`flex-1 py-2 rounded-lg text-sm border ${cycle === 'MONTHLY' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'border-gray-200 text-gray-500'}`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setCycle('ANNUAL')}
                  className={`flex-1 py-2 rounded-lg text-sm border ${cycle === 'ANNUAL' ? 'bg-blue-50 border-blue-400 text-blue-700' : 'border-gray-200 text-gray-500'}`}
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
                    className={`flex-1 py-2 rounded-lg text-sm border ${gateway === g ? 'bg-blue-50 border-blue-400 text-blue-700' : 'border-gray-200 text-gray-500'}`}
                  >
                    {g === 'STRIPE' ? 'Card (Stripe)' : g === 'PAYPAL' ? 'PayPal' : 'PayHere (LKR)'}
                  </button>
                ))}
              </div>

              {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {error}
                </div>
              )}

              <button
                type="button"
                disabled={checkingOut}
                onClick={handlePayNow}
                className="w-full py-3 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {checkingOut ? 'Redirecting…' : `Pay ${currency === 'LKR' ? 'LKR' : '$'}${price ?? ''} now`}
              </button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <History className="w-4 h-4 text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-900">Billing history</h3>
            </div>
            {history.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">No transactions yet</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-b border-gray-50 last:border-0">
                      <td className="px-6 py-3 text-gray-500">{new Date(h.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-3 text-gray-700">{h.description}</td>
                      <td className="px-6 py-3 text-gray-500">{h.gateway}</td>
                      <td className="px-6 py-3 text-right font-medium text-gray-900">
                        {h.currency} {h.amount}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {h.status === 'SUCCEEDED' ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                          </span>
                        ) : (
                          <span className="text-red-600 text-xs">{h.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
