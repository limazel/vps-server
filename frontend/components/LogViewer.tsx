'use client';

import { useEffect, useRef } from 'react';

interface Props {
  lines:   string[];
  loading: boolean;
  warning?: string;
}

export default function LogViewer({ lines, loading, warning }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  return (
    <div
      ref={ref}
      className="h-80 overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-zinc-300 leading-5"
    >
      {loading && (
        <p className="text-zinc-500 animate-pulse">Loading logs...</p>
      )}
      {!loading && warning && (
        <p className="text-zinc-500">{warning}</p>
      )}
      {!loading && !warning && lines.length === 0 && (
        <p className="text-zinc-600">No logs yet.</p>
      )}
      {lines.map((line, i) => (
        <div key={i} className="whitespace-pre-wrap break-all hover:bg-zinc-900/50">
          <span className="text-zinc-600 select-none mr-2">{String(i + 1).padStart(4, ' ')}</span>
          {line}
        </div>
      ))}
    </div>
  );
}
