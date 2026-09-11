'use client';

import { useEffect, useState } from 'react';
import { Puzzle, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

type Gateway = 'STRIPE' | 'PAYPAL' | 'PAYHERE';

interface AddOnModule {
  id: string;
  moduleKey: string;
  name: string;
  description: string | null;
  priceUsdMonthly: string;
  priceLkrMonthly: string | null;
  active: boolean;
}

export default function AddOnsStorePage() {
  const [addOns, setAddOns] = useState<AddOnModule[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [gateway, setGateway] = useState<Gateway>('PAYHERE');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState('');
  // Read directly from the URL (client-only) instead of useSearchParams(),
  // which would force this whole page behind a <Suspense> boundary just for
  // a one-time post-redirect banner.
  const [justPurchased, setJustPurchased] = useState(false);
  useEffect(() => {
    setJustPurchased(new URLSearchParams(window.location.search).get('success') === '1');
  }, []);

  function load() {
    api
      .getAddOns()
      .then(setAddOns)
      .catch(() => setError('Could not load add-ons.'))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const currency = gateway === 'PAYHERE' ? 'LKR' : 'USD';

  async function handleSubscribe(addOnModuleId: string) {
    setBusyId(addOnModuleId);
    setError('');
    try {
      const result = await api.purchaseAddOn(addOnModuleId, { gateway, currency });
      window.location.href = result.redirectUrl;
    } catch (err: any) {
      setError(err.message ?? 'Could not start checkout.');
      setBusyId(null);
    }
  }

  async function handleCancel(addOnModuleId: string) {
    if (!confirm('Cancel this add-on? You will lose access to it.')) return;
    setBusyId(addOnModuleId);
    setError('');
    try {
      await api.cancelAddOn(addOnModuleId);
      setJustPurchased(false);
      load();
    } catch (err: any) {
      setError(err.message ?? 'Could not cancel add-on.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-gray-400 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading…
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Puzzle className="w-6 h-6 text-primary-600" /> Add-ons Store
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Extra capabilities you can switch on for your business, billed monthly on top of your plan.
        </p>
      </div>

      {justPurchased && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Payment received — it may take a few seconds for the add-on to activate.
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}

      {addOns && addOns.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400">
          No add-ons are available for your business type right now.
        </div>
      )}

      {addOns && addOns.length > 0 && (
        <>
          <div className="flex gap-2">
            {(['STRIPE', 'PAYPAL', 'PAYHERE'] as Gateway[]).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGateway(g)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                  gateway === g ? 'bg-primary-700 text-white border-primary-700' : 'border-gray-300 text-gray-600'
                }`}
              >
                {g === 'STRIPE' ? 'Card (Stripe)' : g === 'PAYPAL' ? 'PayPal' : 'PayHere (LKR)'}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {addOns.map((addOn) => {
              const price = currency === 'LKR' ? addOn.priceLkrMonthly : addOn.priceUsdMonthly;
              return (
                <section
                  key={addOn.id}
                  className="bg-white border border-gray-200 rounded-2xl p-6 flex items-center justify-between gap-6"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold text-gray-900">{addOn.name}</h2>
                      {addOn.active && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      )}
                    </div>
                    {addOn.description && <p className="text-sm text-gray-500 mt-1">{addOn.description}</p>}
                    <p className="text-sm text-gray-400 mt-1">
                      {currency === 'LKR' ? 'LKR' : '$'} {price ?? '—'} / month
                    </p>
                  </div>

                  {addOn.active ? (
                    <button
                      onClick={() => handleCancel(addOn.id)}
                      disabled={busyId === addOn.id}
                      className="shrink-0 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 px-4 py-2 rounded-lg text-sm font-semibold"
                    >
                      {busyId === addOn.id ? 'Cancelling…' : 'Cancel'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(addOn.id)}
                      disabled={busyId === addOn.id || price == null}
                      className="shrink-0 bg-primary-700 hover:bg-primary-800 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-semibold"
                    >
                      {busyId === addOn.id ? 'Redirecting…' : 'Subscribe'}
                    </button>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
