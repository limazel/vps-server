'use client';

import { useEffect, useState, useCallback } from 'react';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import StatCard from '@/components/StatCard';
import { api } from '@/lib/api';

interface Stats {
  cpu:    { usage: number; cores: number; model: string };
  memory: { total: number; used: number; free: number; usagePercent: number };
  disk:   { total: number; used: number; free: number; usagePercent: number; mount: string };
  uptime: { seconds: number; human: string };
  os:     { platform: string; distro: string; release: string; arch: string; hostname: string };
}

function mb(val: number) {
  return val >= 1024 ? `${(val / 1024).toFixed(1)} GB` : `${val} MB`;
}

export default function DashboardPage() {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/api/system/stats');
      if (res.ok) setStats(await res.json());
      else setError('Failed to load stats');
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const t = setInterval(fetchStats, 30_000);
    return () => clearInterval(t);
  }, [fetchStats]);

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-zinc-950">
        <Sidebar />
        <main className="flex-1 ml-56 p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-xl font-semibold text-white">Dashboard</h1>
              <p className="text-zinc-500 text-sm mt-0.5">System overview</p>
            </div>
            <button
              onClick={fetchStats}
              className="text-zinc-400 hover:text-white text-sm px-3 py-1.5 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              ↻ Refresh
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm mb-6">
              {error}
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 h-32 animate-pulse" />
              ))}
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard
                  label="CPU Usage"
                  value={`${stats.cpu.usage}%`}
                  sub={`${stats.cpu.cores} cores · ${stats.cpu.model.split(' ').slice(0, 3).join(' ')}`}
                  percent={stats.cpu.usage}
                  icon="⚡"
                  color={stats.cpu.usage > 80 ? 'red' : stats.cpu.usage > 50 ? 'yellow' : 'blue'}
                />
                <StatCard
                  label="Memory"
                  value={`${stats.memory.usagePercent}%`}
                  sub={`${mb(stats.memory.used)} / ${mb(stats.memory.total)}`}
                  percent={stats.memory.usagePercent}
                  icon="◉"
                  color={stats.memory.usagePercent > 80 ? 'red' : stats.memory.usagePercent > 60 ? 'yellow' : 'green'}
                />
                <StatCard
                  label="Disk"
                  value={`${stats.disk.usagePercent}%`}
                  sub={`${mb(stats.disk.used)} / ${mb(stats.disk.total)} (${stats.disk.mount})`}
                  percent={stats.disk.usagePercent}
                  icon="◫"
                  color={stats.disk.usagePercent > 90 ? 'red' : stats.disk.usagePercent > 70 ? 'yellow' : 'green'}
                />
                <StatCard
                  label="Uptime"
                  value={stats.uptime.human}
                  icon="◷"
                  color="blue"
                />
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
                <h2 className="text-sm font-medium text-zinc-400 mb-4">System Info</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {[
                    ['Hostname', stats.os.hostname],
                    ['OS',       `${stats.os.distro} ${stats.os.release}`],
                    ['Platform', stats.os.platform],
                    ['Arch',     stats.os.arch],
                    ['Free RAM', mb(stats.memory.free)],
                    ['Free Disk', mb(stats.disk.free)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <p className="text-zinc-500 text-xs">{k}</p>
                      <p className="text-zinc-200 text-sm mt-0.5 font-medium">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </main>
      </div>
    </AuthGuard>
  );
}
