'use client';

import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

export default function OnboardingSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-8 h-8 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Payment received</h1>
        <p className="text-slate-400 mb-8">
          Your subscription is now active. It may take a few seconds for the payment provider&apos;s
          confirmation to reach us — if your dashboard still shows a trial banner, refresh in a moment.
        </p>
        <Link
          href="/billing"
          className="inline-block px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 transition-all"
        >
          Go to my dashboard
        </Link>
      </div>
    </div>
  );
}
