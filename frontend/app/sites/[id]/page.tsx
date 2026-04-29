'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import LogViewer from '@/components/LogViewer';
import { api } from '@/lib/api';

interface Site {
  id: number; name: string; domain: string;
  repoUrl: string; branch: string; appType: string;
  port: number; status: string; runType: string; pm2Name: string | null;
  createdAt: string; updatedAt: string;
}

interface LogResult { lines: string[]; warning?: string; }

type LogTab = 'deploy' | 'container' | 'nginx-error' | 'nginx-access';

const statusStyle: Record<string, string> = {
  running:   'bg-green-500/15 text-green-400 border-green-500/20',
  stopped:   'bg-zinc-700/30 text-zinc-400 border-zinc-700/30',
  deploying: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
  failed:    'bg-red-500/15 text-red-400 border-red-500/20',
  pending:   'bg-blue-500/15 text-blue-400 border-blue-500/20',
};

function ActionBtn({
  label, onClick, variant = 'default', loading = false, disabled = false,
}: {
  label: string; onClick: () => void;
  variant?: 'default' | 'danger' | 'success' | 'warning';
  loading?: boolean; disabled?: boolean;
}) {
  const styles = {
    default: 'border-zinc-700 text-zinc-300 hover:border-zinc-600 hover:text-white',
    danger:  'border-red-500/30 text-red-400 hover:bg-red-500/10',
    success: 'border-green-500/30 text-green-400 hover:bg-green-500/10',
    warning: 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10',
  };

  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`border px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 ${styles[variant]}`}
    >
      {loading ? '...' : label}
    </button>
  );
}

export default function SiteDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [site,      setSite]      = useState<Site | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [toast,     setToast]     = useState<{ msg: string; ok: boolean } | null>(null);
  const [activeTab, setActiveTab] = useState<LogTab>('deploy');
  const [logData,   setLogData]   = useState<Record<LogTab, LogResult>>({
    'deploy': { lines: [] }, 'container': { lines: [] },
    'nginx-error': { lines: [] }, 'nginx-access': { lines: [] },
  });
  const [logLoading, setLogLoading] = useState<Record<LogTab, boolean>>({
    'deploy': false, 'container': false, 'nginx-error': false, 'nginx-access': false,
  });
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSite = useCallback(async () => {
    try {
      const res = await api.get(`/api/sites/${id}`);
      if (res.ok) setSite((await res.json()).site);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchSite(); }, [fetchSite]);

  const fetchLog = useCallback(async (tab: LogTab) => {
    setLogLoading((prev) => ({ ...prev, [tab]: true }));
    try {
      const path =
        tab === 'deploy'        ? `/api/sites/${id}/logs/deploy` :
        tab === 'container'     ? `/api/sites/${id}/logs/container` :
        tab === 'nginx-error'   ? `/api/sites/${id}/logs/nginx?type=error` :
                                  `/api/sites/${id}/logs/nginx?type=access`;
      const res = await api.get(path);
      if (res.ok) {
        const data = await res.json();
        setLogData((prev) => ({ ...prev, [tab]: { lines: data.lines ?? [], warning: data.warning } }));
      }
    } catch {
      setLogData((prev) => ({ ...prev, [tab]: { lines: [], warning: 'Failed to load' } }));
    } finally {
      setLogLoading((prev) => ({ ...prev, [tab]: false }));
    }
  }, [id]);

  useEffect(() => { fetchLog(activeTab); }, [activeTab, fetchLog]);

  async function action(key: string, method: () => Promise<Response>) {
    setBusy((b) => ({ ...b, [key]: true }));
    try {
      const res  = await method();
      const data = await res.json();
      if (res.ok) {
        showToast(data.message ?? 'Done', true);
        await fetchSite();
      } else {
        showToast(data.error ?? 'Error', false);
      }
    } catch {
      showToast('Connection error', false);
    } finally {
      setBusy((b) => ({ ...b, [key]: false }));
    }
  }

  const TABS: { key: LogTab; label: string }[] = [
    { key: 'deploy',       label: 'Deploy' },
    { key: 'container',    label: 'Container' },
    { key: 'nginx-error',  label: 'Nginx Error' },
    { key: 'nginx-access', label: 'Nginx Access' },
  ];

  if (loading) {
    return (
      <AuthGuard>
        <div className="flex min-h-screen bg-zinc-950">
          <Sidebar />
          <main className="flex-1 ml-56 p-8 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </main>
        </div>
      </AuthGuard>
    );
  }

  if (!site) {
    return (
      <AuthGuard>
        <div className="flex min-h-screen bg-zinc-950">
          <Sidebar />
          <main className="flex-1 ml-56 p-8">
            <p className="text-zinc-400">Site not found.</p>
            <Link href="/sites" className="text-blue-400 text-sm hover:underline mt-2 inline-block">← Sites</Link>
          </main>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-zinc-950">
        <Sidebar />
        <main className="flex-1 ml-56 p-8 max-w-5xl">

          {/* Toast */}
          {toast && (
            <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg text-sm font-medium shadow-xl border z-50 ${
              toast.ok
                ? 'bg-green-500/15 border-green-500/30 text-green-300'
                : 'bg-red-500/15 border-red-500/30 text-red-300'
            }`}>
              {toast.msg}
            </div>
          )}

          {/* Header */}
          <div className="mb-6">
            <Link href="/sites" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
              ← Sites
            </Link>
            <div className="flex items-center gap-3 mt-2">
              <h1 className="text-xl font-semibold text-white">{site.name}</h1>
              <span className={`text-xs border px-2 py-0.5 rounded-full ${statusStyle[site.status] ?? statusStyle.pending}`}>
                {site.status}
              </span>
            </div>
            <div className="flex gap-4 mt-1 text-sm text-zinc-400">
              <span>{site.domain}</span>
              <span>·</span>
              <span>Port {site.port}</span>
              <span>·</span>
              <span>{site.appType}</span>
              <span>·</span>
              <span>{site.branch}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-medium text-zinc-400">Actions</h2>
              {site.runType === 'pm2' && (
                <span className="text-xs bg-purple-500/15 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded">PM2</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {site.runType !== 'pm2' && (
                <ActionBtn
                  label="Deploy"
                  variant="success"
                  loading={busy.deploy}
                  onClick={() => action('deploy', () => api.post(`/api/sites/${id}/deploy`))}
                />
              )}
              <ActionBtn
                label="Nginx Config"
                loading={busy.nginx}
                onClick={() => action('nginx', () => api.post(`/api/sites/${id}/nginx`))}
              />
              <ActionBtn
                label="Install SSL"
                loading={busy.ssl}
                onClick={() => action('ssl', () => api.post(`/api/sites/${id}/ssl`))}
              />
              <ActionBtn
                label="Start"
                variant="success"
                loading={busy.start}
                disabled={site.status === 'running'}
                onClick={() => action('start', () => api.post(`/api/sites/${id}/start`))}
              />
              <ActionBtn
                label="Stop"
                variant="danger"
                loading={busy.stop}
                disabled={site.status === 'stopped'}
                onClick={() => action('stop', () => api.post(`/api/sites/${id}/stop`))}
              />
              <ActionBtn
                label="Restart"
                variant="warning"
                loading={busy.restart}
                onClick={() => action('restart', () => api.post(`/api/sites/${id}/restart`))}
              />
            </div>
          </div>

          {/* Site Info */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 mb-6">
            <h2 className="text-sm font-medium text-zinc-400 mb-4">Info</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              {[
                ['Repo',    site.repoUrl],
                ['Branch',  site.branch],
                ['App Type', site.appType],
                ['Port',    String(site.port)],
                ['Created', new Date(site.createdAt).toLocaleDateString()],
                ['Updated', new Date(site.updatedAt).toLocaleDateString()],
              ].map(([k, v]) => (
                <div key={k}>
                  <p className="text-zinc-500 text-xs">{k}</p>
                  <p className="text-zinc-200 mt-0.5 break-all">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Logs */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-1">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                      activeTab === t.key
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => fetchLog(activeTab)}
                className="text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
              >
                ↻ Refresh
              </button>
            </div>
            <LogViewer
              lines={logData[activeTab].lines}
              loading={logLoading[activeTab]}
              warning={logData[activeTab].warning}
            />
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
