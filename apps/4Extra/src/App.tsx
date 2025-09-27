import React, { useEffect, useState } from 'react';
import { usePasskeySession } from '@shared/PasskeySession';
import {
  deleteModuleSubmission,
  insertModuleSubmission,
  listModuleSubmissions,
  type ModuleSubmissionRecord
} from '@shared/storage/localData';

const MODULE_NAME = '4Extra';

type ExtraItem = ModuleSubmissionRecord;

type FormState = {
  title: string;
  description: string;
};

const defaultForm: FormState = {
  title: '',
  description: ''
};

export default function App() {
  const { status, session } = usePasskeySession({ moduleId: 'm4_extra' });
  const [items, setItems] = useState<ExtraItem[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session) {
      void loadItems();
    }
  }, [status, session]);

  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const data = await listModuleSubmissions({ moduleName: MODULE_NAME });
      setItems(data);
    } catch (err) {
      console.error('[4Extra] Failed to load submissions', err);
      setError('Tidak dapat memuat data lokal');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    if (!form.title.trim()) {
      setError('Judul tidak boleh kosong');
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
          description: form.description
        }
      });
      setMessage('Catatan tersimpan');
      setForm(defaultForm);
      await loadItems();
    } catch (err) {
      console.error('[4Extra] Failed to save submission', err);
      setError('Gagal menyimpan catatan');
    } finally {
      setLoading(false);
    }
  }

  async function removeItem(id: string) {
    setLoading(true);
    setError(null);
    try {
      await deleteModuleSubmission(id);
      await loadItems();
    } catch (err) {
      console.error('[4Extra] Failed to delete submission', err);
      setError('Gagal menghapus catatan');
    } finally {
      setLoading(false);
    }
  }

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
          <h1 className="text-3xl font-semibold">EXTRA</h1>
          <p className="text-sm text-neutral-400">List catatan bebas: ide, tautan, reminder.</p>
          <p className="text-xs text-neutral-500">Semua catatan disimpan di browser ini.</p>
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
              <span className="text-neutral-300">Deskripsi</span>
              <textarea
                rows={3}
                className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2"
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              />
            </label>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-md bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-60"
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
          <h2 className="text-lg font-medium text-white">Daftar Catatan</h2>
          {loading && items.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">Memuat data...</p>
          ) : items.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">Belum ada catatan.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm text-neutral-300">
              {items.map((item) => {
                const title = typeof item.submission_data.title === 'string' ? item.submission_data.title : 'Tanpa Judul';
                const description = typeof item.submission_data.description === 'string' ? item.submission_data.description : null;
                return (
                  <li key={item.id} className="rounded-md border border-neutral-700 bg-neutral-900/60 p-3">
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span>{new Date(item.created_at).toLocaleString('id-ID')}</span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-xs text-red-300 hover:text-red-200"
                        disabled={loading}
                      >
                        Hapus
                      </button>
                    </div>
                    <h3 className="mt-1 text-sm font-semibold text-neutral-100">{title}</h3>
                    {description && (
                      <p className="mt-1 text-sm text-neutral-400">{description}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </section>
      </div>
    </div>
  );
}

