import React, { useEffect, useMemo, useState } from 'react';
import { usePasskeySession } from '@shared/hooks/usePasskeySession';
import {
  insertModuleSubmission,
  listModuleSubmissions,
  type ModuleSubmissionRecord
} from '@shared/storage/localData';

const MODULE_NAME = '1Meng';

type SubmissionRow = ModuleSubmissionRecord;

type FormState = {
  title: string;
  amount: string;
  note: string;
};

const initialForm: FormState = {
  title: '',
  amount: '',
  note: ''
};

export default function App() {
  const { status, session } = usePasskeySession({ moduleId: 'm1_meng' });
  const [form, setForm] = useState(initialForm);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session) {
      void loadSubmissions();
    }
  }, [status, session]);

  async function loadSubmissions() {
    setLoading(true);
    setError(null);
    try {
      const data = await listModuleSubmissions({ moduleName: MODULE_NAME });
      setSubmissions(data);
    } catch (err) {
      console.error('[1Meng] Failed to load submissions', err);
      setError('Tidak dapat memuat data lokal');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    const amountValue = Number(form.amount);
    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setError('Nominal harus angka positif');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      await insertModuleSubmission({
        user_id: session.user.id,
        module_name: MODULE_NAME,
        submission_data: {
          title: form.title,
          amount: amountValue,
          note: form.note
        },
        submission_status: 'pending'
      });
      setForm(initialForm);
      setMessage('Pengajuan berhasil disimpan');
      await loadSubmissions();
    } catch (err) {
      console.error('[1Meng] Failed to save submission', err);
      setError('Gagal menyimpan catatan');
    } finally {
      setLoading(false);
    }
  }

  const totalSpent = useMemo(() => {
    return submissions.reduce((sum, row) => sum + (Number(row.submission_data.amount) || 0), 0);
  }, [submissions]);

  if (status === 'checking' || !session) {
    return (
      <div className="app-shell flex items-center justify-center">
        <p className="text-neutral-400">Menyiapkan modul...</p>
      </div>
    );
  }

  return (
    <div className="app-shell px-6 py-10 text-neutral-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold">1MENG</h1>
          <p className="text-sm text-neutral-400">Catat pemasukan harian dengan cepat.</p>
          <p className="text-xs text-neutral-500">Total tercatat: Rp {totalSpent.toLocaleString('id-ID')}</p>
        </header>

        <section className="rounded-xl border border-neutral-700 bg-neutral-900/60 p-6">
          <h2 className="text-lg font-medium text-white">Tambah Catatan</h2>
          <form onSubmit={handleSubmit} className="mt-4 grid gap-4">
            <label className="grid gap-1 text-sm">
              <span className="text-neutral-300">Judul</span>
              <input
                className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2"
                value={form.title}
                onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-neutral-300">Nominal (Rp)</span>
              <input
                className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2"
                value={form.amount}
                onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-neutral-300">Catatan</span>
              <textarea
                rows={3}
                className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2"
                value={form.note}
                onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
              />
            </label>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? 'Menyimpan...' : 'Simpan'}
              </button>
              {message && <span className="text-sm text-green-400">{message}</span>}
              {error && <span className="text-sm text-red-400">{error}</span>}
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-6">
          <h2 className="text-lg font-medium text-white">Riwayat</h2>
          {loading && submissions.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">Memuat data...</p>
          ) : submissions.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">Belum ada catatan.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm text-neutral-300">
              {submissions.map((item) => {
                const title = typeof item.submission_data.title === 'string' ? item.submission_data.title : 'Tanpa Judul';
                const amountValue = typeof item.submission_data.amount === 'number' ? item.submission_data.amount : Number(item.submission_data.amount) || 0;
                const note = typeof item.submission_data.note === 'string' ? item.submission_data.note : null;
                return (
                  <li key={item.id} className="rounded-md border border-neutral-700 bg-neutral-900/60 p-3">
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span>{title}</span>
                      <span>{new Date(item.created_at).toLocaleString('id-ID')}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span>Rp {amountValue.toLocaleString('id-ID')}</span>
                      {note && (
                        <span className="text-neutral-400">{note}</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

