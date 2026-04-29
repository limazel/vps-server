'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import { api } from '@/lib/api';

interface Site {
  id: number; name: string; domain: string;
  appType: string; port: number; status: string; runType: string;
}
interface ScanResult {
  domain: string; port: number; pm2Name: string | null;
  pm2Status: string | null; alreadyImported: boolean;
}

const statusStyle: Record<string, string> = {
  running:   'bg-green-500/15 text-green-400 border-green-500/20',
  stopped:   'bg-zinc-700/30 text-zinc-400 border-zinc-700/30',
  deploying: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  failed:    'bg-red-500/15 text-red-400 border-red-500/20',
  pending:   'bg-blue-500/15 text-blue-400 border-blue-500/20',
};

export default function SitesPage() {
  const [sites,     setSites]     = useState<Site[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [scanning,  setScanning]  = useState(false);
  const [importing, setImporting] = useState(false);
  const [scanData,  setScanData]  = useState<ScanResult[] | null>(null);
  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [toast,     setToast]     = useState('');

  const load = useCallback(() =>
    api.get('/api/sites').then(r => r.json()).then(d => setSites(d.sites ?? [])).finally(() => setLoading(false))
  , []);

  useEffect(() => { load(); }, [load]);

  async function scan() {
    setScanning(true);
    try {
      const res  = await api.get('/api/import/scan');
      const data = await res.json();
      setScanData(data.sites ?? []);
      setSelected(new Set(data.sites.filter((s: ScanResult) => !s.alreadyImported).map((s: ScanResult) => s.domain)));
    } catch { setToast('Tarama başarısız'); }
    finally { setScanning(false); }
  }

  async function doImport() {
    setImporting(true);
    const sites = scanData!.filter(s => selected.has(s.domain));
    try {
      const res  = await api.post('/api/import', { sites });
      const data = await res.json();
      setToast(`${data.count} site içe aktarıldı`);
      setScanData(null);
      load();
    } catch { setToast('İçe aktarma başarısız'); }
    finally { setImporting(false); }
  }

  function toggle(domain: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(domain) ? next.delete(domain) : next.add(domain);
      return next;
    });
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-zinc-950">
        <Sidebar />
        <main className="flex-1 ml-56 p-8">

          {toast && (
            <div className="fixed top-4 right-4 bg-zinc-800 border border-zinc-700 text-white text-sm px-4 py-3 rounded-lg z-50">
              {toast}
              <button onClick={() => setToast('')} className="ml-3 text-zinc-400">✕</button>
            </div>
          )}

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-xl font-semibold text-white">Sites</h1>
              <p className="text-zinc-500 text-sm mt-0.5">{sites.length} site</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={scan}
                disabled={scanning}
                className="text-zinc-300 text-sm px-4 py-2 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors disabled:opacity-50"
              >
                {scanning ? 'Taranıyor...' : '⤓ Siteleri Tara'}
              </button>
              <Link href="/sites/new" className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
                + New Site
              </Link>
            </div>
          </div>

          {/* Scan Modal */}
          {scanData && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40 p-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg">
                <div className="flex items-center justify-between p-5 border-b border-zinc-800">
                  <h2 className="text-white font-medium">Bulunan PM2 Siteleri</h2>
                  <button onClick={() => setScanData(null)} className="text-zinc-500 hover:text-white">✕</button>
                </div>

                <div className="p-5 space-y-2 max-h-80 overflow-y-auto">
                  {scanData.length === 0 ? (
                    <p className="text-zinc-500 text-sm">Hiç site bulunamadı. nginx sites-enabled + pm2 kontrol et.</p>
                  ) : scanData.map((s) => (
                    <label key={s.domain} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      s.alreadyImported ? 'border-zinc-800 opacity-50 cursor-not-allowed' :
                      selected.has(s.domain) ? 'border-blue-500/40 bg-blue-500/5' : 'border-zinc-800 hover:border-zinc-700'
                    }`}>
                      <input
                        type="checkbox"
                        checked={selected.has(s.domain)}
                        disabled={s.alreadyImported}
                        onChange={() => toggle(s.domain)}
                        className="accent-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{s.domain}</p>
                        <p className="text-zinc-500 text-xs">port:{s.port} · pm2:{s.pm2Name || '?'}</p>
                      </div>
                      <span className={`text-xs border px-2 py-0.5 rounded-full ${statusStyle[s.pm2Status === 'online' ? 'running' : 'stopped']}`}>
                        {s.pm2Status || 'unknown'}
                      </span>
                      {s.alreadyImported && <span className="text-xs text-zinc-600">zaten var</span>}
                    </label>
                  ))}
                </div>

                <div className="flex gap-2 p-5 border-t border-zinc-800">
                  <button
                    onClick={doImport}
                    disabled={importing || selected.size === 0}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                  >
                    {importing ? 'Aktarılıyor...' : `${selected.size} Siteyi Aktar`}
                  </button>
                  <button onClick={() => setScanData(null)} className="text-zinc-400 text-sm px-4 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700">
                    İptal
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Site List */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl h-16 animate-pulse" />)}
            </div>
          ) : sites.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
              <p className="text-zinc-500 text-sm">Henüz site yok.</p>
              <p className="text-zinc-600 text-xs mt-1">Yeni site ekle veya mevcut PM2 sitelerini tara.</p>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {['Name', 'Domain', 'Type', 'Port', 'Status', ''].map(h => (
                      <th key={h} className="text-left text-xs text-zinc-500 font-medium px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {sites.map((site) => (
                    <tr key={site.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-white font-medium">{site.name}</p>
                          {site.runType === 'pm2' && (
                            <span className="text-xs bg-purple-500/15 text-purple-400 border border-purple-500/20 px-1.5 py-0.5 rounded">pm2</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-300">{site.domain}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">{site.appType}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-400">{site.port}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs border px-2 py-0.5 rounded-full ${statusStyle[site.status] ?? statusStyle.pending}`}>
                          {site.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/sites/${site.id}`} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    </AuthGuard>
  );
}
