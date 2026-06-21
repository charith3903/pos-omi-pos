'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSession } from '@/lib/auth';

const BUSINESS_TYPES = [
  { key: 'SUPERMARKET',  icon: '🛒', label: 'Supermarket',   desc: 'Grocery & retail store' },
  { key: 'RESTAURANT',   icon: '🍽️', label: 'Restaurant',    desc: 'Food & beverage outlet' },
  { key: 'SPARE_PARTS',  icon: '🔧', label: 'Spare Parts',   desc: 'Auto & machinery parts' },
  { key: 'ELECTRICAL',   icon: '⚡', label: 'Electrical',    desc: 'Electronics & appliances' },
  { key: 'TEXTILE',      icon: '👗', label: 'Textile',       desc: 'Clothing & fabric store' },
  { key: 'MOBILE',       icon: '📱', label: 'Mobile',        desc: 'Phones & accessories' },
  { key: 'RENTAL',       icon: '🏠', label: 'Rental',        desc: 'Rental & leasing business' },
];

export default function LandingPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // If already logged in, skip to dashboard
    if (getSession()) {
      router.replace('/billing');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex flex-col">
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🧾</span>
          <span className="text-white font-bold text-xl tracking-tight">OmniPOS</span>
        </div>
        <Link
          href="/login"
          className="text-sm text-blue-300 hover:text-white border border-blue-700 hover:border-blue-400 px-4 py-2 rounded-lg transition-all"
        >
          Sign in →
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center py-16">
        <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-semibold px-4 py-1.5 rounded-full mb-8 tracking-wider uppercase">
          Multi-tenant Cloud POS · Sri Lanka
        </div>

        <h1 className="text-5xl sm:text-6xl font-extrabold text-white mb-5 leading-tight">
          One POS Platform for
          <br />
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Every Business
          </span>
        </h1>

        <p className="text-slate-400 text-lg max-w-xl mb-12">
          Create your store in minutes. Manage sales, stock, billing, and reports
          — all in one place, tailored to your business type.
        </p>

        {/* CTA Cards */}
        <div className="flex flex-col sm:flex-row gap-5 w-full max-w-lg mb-16">
          <Link
            href="/register"
            className="flex-1 group bg-blue-600 hover:bg-blue-500 text-white rounded-2xl p-6 text-left transition-all hover:shadow-2xl hover:shadow-blue-500/30 hover:-translate-y-0.5"
          >
            <div className="text-3xl mb-3">🏪</div>
            <div className="font-bold text-lg mb-1">Create a Store</div>
            <div className="text-blue-200 text-sm">New to OmniPOS? Set up your business in 2 minutes.</div>
            <div className="mt-4 text-blue-200 text-sm font-semibold group-hover:text-white transition-colors">
              Get started free →
            </div>
          </Link>

          <Link
            href="/login"
            className="flex-1 group bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25 text-white rounded-2xl p-6 text-left transition-all hover:-translate-y-0.5"
          >
            <div className="text-3xl mb-3">🔑</div>
            <div className="font-bold text-lg mb-1">Login to Store</div>
            <div className="text-slate-400 text-sm">Already have a store? Sign in to your dashboard.</div>
            <div className="mt-4 text-slate-400 text-sm font-semibold group-hover:text-white transition-colors">
              Sign in →
            </div>
          </Link>
        </div>

        {/* Business Type Showcase */}
        <div className="w-full max-w-3xl">
          <p className="text-slate-500 text-xs uppercase tracking-widest font-semibold mb-5">
            Supported business types
          </p>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
            {BUSINESS_TYPES.map((bt) => (
              <div
                key={bt.key}
                className="flex flex-col items-center gap-2 bg-white/5 border border-white/8 rounded-xl p-3 hover:bg-white/10 hover:border-white/20 transition-all cursor-default"
              >
                <span className="text-2xl">{bt.icon}</span>
                <span className="text-slate-400 text-xs font-medium leading-tight text-center">{bt.label}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-slate-600 text-xs py-6">
        © 2024 OmniPOS · Multi-tenant Cloud POS for Sri Lanka
      </footer>
    </div>
  );
}
