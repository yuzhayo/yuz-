import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePasskeySession } from '@shared/PasskeySession';
import {
  listModuleSubmissions,
  subscribeToLocalData,
  type ModuleSubmissionRecord
} from '@shared/storage/localData';

type SubmissionRow = ModuleSubmissionRecord;

export default function App() {
  const { status } = usePasskeySession({ moduleId: 'm3_database' });
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!mountedRef.current || status !== 'authenticated') return;
    setLoading(true);
    setError(null);
    try {
      const data = await listModuleSubmissions();
      if (mountedRef.current) {
        setRows(data);
      }
    } catch (err) {
      console.error('[3Database] Failed to load submissions', err);
      if (mountedRef.current) {
        setError('Tidak dapat memuat data lokal');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') {
      setRows([]);
      setError(null);
      setLoading(false);
      return;
    }

    void loadData();
    const unsubscribe = subscribeToLocalData(() => {
      void loadData();
    });

    return () => {
      unsubscribe();
    };
  }, [status, loadData]);

  const summary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.module_name, (counts.get(row.module_name) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([module, total]) => ({ module, total }));
  }, [rows]);

  if (status === 'checking') {
    return (
      <div className="app-shell flex items-center justify-center">
        <p className="text-neutral-400">Menyiapkan modul...</p>
      </div>
    );
  }

  return (
    <div className="app-shell px-6 py-10 text-neutral-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">DATABASE</h1>
          <p className="text-sm text-neutral-400">Ikhtisar semua data modul.</p>
          <p className="text-xs text-neutral-500">Total entri: {rows.length}</p>
        </header>

        <section className="rounded-xl border border-neutral-700 bg-neutral-900/60 p-6">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-medium text-white">Ringkasan per Modul</h2>
            <button
              onClick={() => void loadData()}
              className="rounded-md border border-neutral-600 px-3 py-1 text-sm hover:bg-neutral-800"
              disabled={loading}
            >
              {loading ? 'Memuat...' : 'Refresh'}
            </button>
          </div>
          {summary.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">Belum ada data tersimpan.</p>
          ) : (
            <table className="mt-4 w-full text-left text-sm">
              <thead className="text-neutral-400">
                <tr>
                  <th className="py-2">Modul</th>
                  <th className="py-2">Total Entri</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((item) => (
                  <tr key={item.module} className="border-t border-neutral-700">
                    <td className="py-2 font-medium text-neutral-100">{item.module}</td>
                    <td className="py-2">{item.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-6">
          <h2 className="text-lg font-medium text-white">Detail Terbaru</h2>
          {loading && rows.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">Memuat data...</p>
          ) : rows.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">Belum ada entri.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm text-neutral-300">
              {rows.slice(0, 10).map((row) => (
                <li key={row.id} className="rounded-md border border-neutral-700 bg-neutral-900/60 p-3">
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>{row.module_name}</span>
                    <span>{new Date(row.created_at).toLocaleString('id-ID')}</span>
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded bg-neutral-950/70 p-3 text-xs">
                    {JSON.stringify(row.submission_data, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </section>
      </div>
    </div>
  );
}
