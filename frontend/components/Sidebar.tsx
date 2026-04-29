'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearToken } from '@/lib/api';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: '◈' },
  { href: '/sites',     label: 'Sites',     icon: '⬡' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();

  function logout() {
    clearToken();
    router.push('/login');
  }

  return (
    <aside className="fixed top-0 left-0 h-full w-56 bg-zinc-900 border-r border-zinc-800 flex flex-col z-10">
      <div className="px-5 py-5 border-b border-zinc-800">
        <span className="text-white font-bold text-lg tracking-tight">Kovente</span>
        <span className="ml-1 text-blue-500 text-sm">panel</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-zinc-800">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
        >
          <span>⇤</span> Logout
        </button>
      </div>
    </aside>
  );
}
