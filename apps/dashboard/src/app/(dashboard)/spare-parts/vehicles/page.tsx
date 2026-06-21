'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Car, Search } from 'lucide-react';

const MAKES = [
  { name: 'Toyota', icon: <Car className="w-8 h-8" />, color: 'from-red-600 to-red-700', parts: 247 },
  { name: 'Honda', icon: <Car className="w-8 h-8" />, color: 'from-blue-600 to-blue-700', parts: 189 },
  { name: 'Nissan', icon: <Car className="w-8 h-8" />, color: 'from-slate-600 to-slate-700', parts: 156 },
  { name: 'Mitsubishi', icon: <Car className="w-8 h-8" />, color: 'from-purple-600 to-purple-700', parts: 134 },
  { name: 'Suzuki', icon: <Car className="w-8 h-8" />, color: 'from-green-600 to-green-700', parts: 98 },
  { name: 'Mazda', icon: <Car className="w-8 h-8" />, color: 'from-orange-600 to-orange-700', parts: 87 },
  { name: 'BMW', icon: <Car className="w-8 h-8" />, color: 'from-indigo-600 to-indigo-700', parts: 76 },
  { name: 'Mercedes-Benz', icon: <Car className="w-8 h-8" />, color: 'from-gray-600 to-gray-700', parts: 65 },
];

const MOCK_JOBS = [
  { id: 'JC-001', date: '2026-06-21', vehicle: 'Toyota Corolla (2015)', reg: 'WP-CAB-1234', desc: 'Engine oil leak, brake pad replacement', amount: 5500 },
  { id: 'JC-005', date: '2026-06-22', vehicle: 'Toyota Prado (2019)', reg: 'WP-CAA-7777', desc: 'Transmission oil change', amount: 15000 },
];

export default function VehiclesPage() {
  const [selectedMake, setSelectedMake] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedMake) {
      setLoading(true);
      // Simulate API call for parts related to the vehicle make
      api.getProducts({ search: selectedMake, limit: 10 })
        .then(res => setParts(res.items || []))
        .catch(() => setParts([]))
        .finally(() => setLoading(false));
    } else {
      setParts([]);
    }
  }, [selectedMake]);

  return (
    <div className="min-h-full bg-slate-900 text-slate-200 p-8 flex flex-col h-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
          <Car className="w-8 h-8 text-blue-400" /> Vehicle & Parts Lookup
        </h1>
        <p className="text-slate-400 text-sm">Find compatible parts for any vehicle and view service history.</p>
      </div>

      {/* Search Bar */}
      <div className="mb-10 max-w-3xl">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Enter vehicle make, model or registration number (e.g. Corolla 2018 or WP-CAB-1234)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-800 border-2 border-slate-700 focus:border-blue-500 rounded-2xl pl-12 pr-6 py-4 text-white placeholder-slate-500 text-lg transition-all shadow-lg outline-none"
          />
        </div>
      </div>

      <div className="flex gap-8 flex-1 min-h-0">
        
        {/* Main Content (Left) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider text-slate-400">Select Vehicle Make</h2>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 flex-shrink-0">
            {MAKES.map(m => (
              <button 
                key={m.name}
                onClick={() => setSelectedMake(m.name)}
                className={`relative overflow-hidden rounded-xl p-4 text-left transition-all ${selectedMake === m.name ? 'ring-4 ring-blue-500 ring-offset-2 ring-offset-slate-900 scale-[1.02]' : 'hover:scale-[1.02] hover:shadow-xl'} bg-gradient-to-br ${m.color}`}
              >
                <div className="relative z-10">
                  <div className="text-3xl mb-2">{m.icon}</div>
                  <h3 className="font-bold text-white text-lg">{m.name}</h3>
                  <p className="text-white/80 text-xs font-medium">{m.parts} parts available</p>
                </div>
                <div className="absolute -right-4 -bottom-4 text-6xl opacity-20 transform -rotate-12">{m.icon}</div>
              </button>
            ))}
          </div>

          {selectedMake && (
            <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl flex flex-col min-h-0">
              <div className="p-5 border-b border-slate-700 flex justify-between items-center bg-slate-800/80">
                <h3 className="font-bold text-white text-lg">Parts for {selectedMake}</h3>
                <div className="flex gap-3">
                  <select className="bg-slate-900 border border-slate-700 text-sm rounded-lg px-3 py-1.5 text-slate-300">
                    <option>All Models</option>
                    <option>Corolla</option>
                    <option>Prius</option>
                    <option>Yaris</option>
                  </select>
                  <select className="bg-slate-900 border border-slate-700 text-sm rounded-lg px-3 py-1.5 text-slate-300">
                    <option>Any Year</option>
                    <option>2020+</option>
                    <option>2015-2019</option>
                  </select>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto">
                {loading ? (
                  <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                    Loading compatible parts...
                  </div>
                ) : parts.length > 0 ? (
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-900/50 text-slate-400 uppercase text-xs font-semibold sticky top-0">
                      <tr>
                        <th className="px-6 py-3">Part Info</th>
                        <th className="px-6 py-3">Price (LKR)</th>
                        <th className="px-6 py-3">Stock</th>
                        <th className="px-6 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {parts.map(p => (
                        <tr key={p.id} className="hover:bg-slate-700/30">
                          <td className="px-6 py-4">
                            <div className="font-medium text-white">{p.name}</div>
                            <div className="text-xs text-slate-400 mt-1">Part #: <span className="font-mono text-slate-300">{p.attributes?.part_number || p.sku || 'N/A'}</span></div>
                          </td>
                          <td className="px-6 py-4 font-semibold text-white">{Number(p.price).toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded text-xs font-medium">In Stock</span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button className="bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded font-medium text-xs transition-colors shadow-lg shadow-orange-500/20">
                              + Add to Job
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="p-12 text-center text-slate-500">
                    <div className="text-4xl mb-3">🔧</div>
                    <p>No parts found for this selection.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar (Right) - History */}
        <div className="w-80 flex flex-col">
          <h2 className="text-lg font-bold text-white mb-4 uppercase tracking-wider text-slate-400">Recent Service History</h2>
          <div className="flex-1 bg-slate-800 border border-slate-700 rounded-xl p-4 overflow-y-auto space-y-4">
            {MOCK_JOBS.map(job => (
              <div key={job.id} className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 hover:border-slate-500 transition-colors cursor-pointer">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-blue-400 font-bold text-sm">{job.id}</span>
                  <span className="text-xs text-slate-400">{job.date}</span>
                </div>
                <div className="font-medium text-white text-sm mb-1">{job.vehicle}</div>
                <div className="text-xs text-slate-400 font-mono bg-slate-800 inline-block px-1.5 py-0.5 rounded mb-2">{job.reg}</div>
                <p className="text-xs text-slate-300 line-clamp-2">{job.desc}</p>
              </div>
            ))}
            
            <button className="w-full py-2 border border-dashed border-slate-600 rounded-lg text-slate-400 hover:text-white hover:border-slate-400 text-sm font-medium transition-colors">
              View All History →
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
