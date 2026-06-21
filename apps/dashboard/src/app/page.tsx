export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center">
      <div className="text-center text-white px-6">
        <div className="mb-6 text-7xl">🧾</div>
        <h1 className="text-6xl font-bold tracking-tight mb-4">OmniPOS</h1>
        <p className="text-xl text-primary-200 mb-2">Multi-tenant Cloud POS for Sri Lanka</p>
        <p className="text-sm text-primary-200/60 mb-12 font-mono">Dashboard · port 3001</p>

        <div className="flex gap-4 justify-center flex-wrap">
          <a
            href="http://localhost:3000/health"
            target="_blank"
            rel="noreferrer"
            className="bg-white text-primary-800 px-6 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
          >
            API Health →
          </a>
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noreferrer"
            className="border border-white/40 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors"
          >
            API Root →
          </a>
        </div>
      </div>
    </main>
  );
}
