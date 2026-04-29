'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import { api } from '@/lib/api';

interface Site {
  id:        number;
  name:      string;
  domain:    string;
  repoUrl:   string;
  branch:    string;
  appType:   string;
  port:      number;
  status:    string;
  createdAt: string;
}

const statusStyle: Record<string, string> = {
  running:   'bg-green-500/15 text-green-400 border-green-500/20',
  stopped:   'bg-zinc-700/30 text-zinc-400 border-zinc-700/30',
  deploying: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  failed:    'bg-red-500/15 text-red-400 border-red-500/20',
  pending:   'bg-blue-500/15 text-blue-400 border-blue-500/20',
};

export default function SitesPage() {
  const [sites,   setSites]   = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.get('/api/sites')
      .then((r) => r.json())
      .then((d) => setSites(d.sites ?? []))
      .catch(() => setError('Failed to load sites'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-zinc-950">
        <Sidebar />
        <main className="flex-1 ml-56 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-xl font-semibold text-white">Sites</h1>
              <p className="text-zinc-500 text-sm mt-0.5">{sites.length} site</p>
            </div>
            <Link
              href="/sites/new"
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              + New Site
            </Link>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm mb-6">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl h-16 animate-pulse" />
              ))}
            </div>
          ) : sites.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
              <p className="text-zinc-500 text-sm">No sites yet.</p>
              <Link href="/sites/new" className="text-blue-400 text-sm hover:underline mt-2 inline-block">
                Add your first site →
              </Link>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {['Name', 'Domain', 'Type', 'Port', 'Status', ''].map((h) => (
                      <th key={h} className="text-left text-xs text-zinc-500 font-medium px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {sites.map((site) => (
                    <tr key={site.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm text-white font-medium">{site.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{site.branch}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-300">{site.domain}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                          {site.appType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-400">{site.port}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs border px-2 py-0.5 rounded-full ${statusStyle[site.status] ?? statusStyle.pending}`}>
                          {site.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/sites/${site.id}`}
                          className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                        >
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
