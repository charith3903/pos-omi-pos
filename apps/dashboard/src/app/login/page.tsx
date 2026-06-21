'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { saveSession, getSession } from '@/lib/auth';
import { Store, KeyRound, FlaskConical } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ subdomain: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, skip to dashboard
  useEffect(() => {
    if (getSession()) router.replace('/billing');
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(form);
      saveSession({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
        user: res.user,
        tenant: res.tenant ?? { id: res.user.tenantId, name: '', subdomain: form.subdomain },
      });
      router.push('/billing');
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-5">
        <Link href="/" className="flex items-center gap-3">
          <div className="bg-blue-600 p-1.5 rounded-lg">
            <Store className="w-5 h-5 text-white" />
          </div>
          <span className="text-white font-bold text-lg tracking-tight">OmniPOS</span>
        </Link>
        <Link
          href="/register"
          className="text-sm text-blue-300 hover:text-white border border-blue-700 hover:border-blue-400 px-4 py-2 rounded-lg transition-all"
        >
          Create a store →
        </Link>
      </header>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4 text-blue-400">
              <KeyRound className="w-12 h-12" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Sign in to your store</h1>
            <p className="text-sm text-slate-400 mt-1">Sign in to manage your store&apos;s operations.</p>
          </div>

          {error && (
            <div className="mb-5 bg-red-500/10 border border-red-500/30 text-red-300 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Store Subdomain</label>
              <input
                type="text"
                required
                placeholder="my-store"
                value={form.subdomain}
                onChange={(e) => setForm({ ...form, subdomain: e.target.value })}
                className="w-full bg-white/5 border border-white/15 focus:border-blue-500 text-white placeholder-slate-600 rounded-lg px-3 py-2.5 outline-none transition-colors text-sm"
              />
              <p className="text-slate-600 text-xs mt-1">The subdomain you chose when creating your store</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Email</label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-white/5 border border-white/15 focus:border-blue-500 text-white placeholder-slate-600 rounded-lg px-3 py-2.5 outline-none transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-white/5 border border-white/15 focus:border-blue-500 text-white placeholder-slate-600 rounded-lg px-3 py-2.5 outline-none transition-colors text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-all hover:shadow-lg hover:shadow-blue-500/25 mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Signing in…
                </span>
              ) : (
                'Sign in →'
              )}
            </button>
          </form>

          {/* Demo hint */}
          <div className="mt-5 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
            <p className="text-blue-300 text-xs font-semibold mb-2 flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5" /> Demo credentials
            </p>
            <p className="text-slate-400 text-xs">Subdomain: <span className="text-white font-mono">demo</span></p>
            <p className="text-slate-400 text-xs">Email: <span className="text-white font-mono">admin@demo.com</span></p>
            <p className="text-slate-400 text-xs">Password: <span className="text-white font-mono">admin123</span></p>
          </div>

          <p className="text-center text-slate-500 text-sm mt-6">
            Don&apos;t have a store?{` `}
            <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
              Create one for free →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
