'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import Sidebar from '@/components/Sidebar';
import { api } from '@/lib/api';

const APP_TYPES = ['nextjs', 'react', 'node', 'static'];

export default function NewSitePage() {
  const router = useRouter();

  const [form, setForm] = useState({
    name: '', domain: '', repoUrl: '', branch: 'main', appType: 'node',
  });
  const [errors,  setErrors]  = useState<Record<string, string>>({});
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => { const next = { ...e }; delete next[key]; return next; });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res  = await api.post('/api/sites', form);
      const data = await res.json();

      if (!res.ok) {
        if (data.errors) { setErrors(data.errors); return; }
        setError(data.error || 'Failed to create site');
        return;
      }

      router.push(`/sites/${data.site.id}`);
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }

  function field(label: string, key: string, opts?: { placeholder?: string; type?: string }) {
    return (
      <div>
        <label className="block text-zinc-400 text-sm mb-1.5">{label}</label>
        <input
          type={opts?.type ?? 'text'}
          value={(form as Record<string, string>)[key]}
          onChange={(e) => set(key, e.target.value)}
          placeholder={opts?.placeholder}
          className={`w-full bg-zinc-800 border rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors ${
            errors[key] ? 'border-red-500' : 'border-zinc-700'
          }`}
        />
        {errors[key] && <p className="text-red-400 text-xs mt-1">{errors[key]}</p>}
      </div>
    );
  }

  return (
    <AuthGuard>
      <div className="flex min-h-screen bg-zinc-950">
        <Sidebar />
        <main className="flex-1 ml-56 p-8">
          <div className="mb-8">
            <Link href="/sites" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
              ← Sites
            </Link>
            <h1 className="text-xl font-semibold text-white mt-2">New Site</h1>
          </div>

          <form onSubmit={handleSubmit} className="max-w-lg space-y-4">
            {field('Site Name', 'name', { placeholder: 'My Blog' })}
            {field('Domain', 'domain', { placeholder: 'blog.example.com' })}
            {field('GitHub Repo URL', 'repoUrl', { placeholder: 'https://github.com/user/repo' })}
            {field('Branch', 'branch', { placeholder: 'main' })}

            <div>
              <label className="block text-zinc-400 text-sm mb-1.5">App Type</label>
              <div className="grid grid-cols-4 gap-2">
                {APP_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('appType', t)}
                    className={`py-2 rounded-lg text-sm border transition-colors ${
                      form.appType === t
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg px-5 py-2.5 text-sm transition-colors"
              >
                {loading ? 'Creating...' : 'Create Site'}
              </button>
              <Link
                href="/sites"
                className="px-5 py-2.5 text-sm text-zinc-400 hover:text-white border border-zinc-800 rounded-lg transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        </main>
      </div>
    </AuthGuard>
  );
}
