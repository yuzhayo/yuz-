import React, { useEffect, useState } from 'react';
import { usePasskeySession } from '@shared/hooks/usePasskeySession';
import { listUserConfigs, upsertUserConfig, type UserConfigRecord } from '@shared/storage/localData';

const DEFAULT_FORM = {
  theme: 'light',
  timezone: 'UTC',
  language: 'id-ID'
};

type UserConfigRow = UserConfigRecord;

export default function App() {
  const { status, session } = usePasskeySession({ moduleId: 'm0_setting' });
  const [configs, setConfigs] = useState<UserConfigRow[]>([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && session) {
      void loadConfigs();
    }
  }, [status, session]);

  async function loadConfigs() {
    setLoading(true);
    setError(null);
    try {
      const data = await listUserConfigs();
      setConfigs(data);
      const current = data.find((row) => row.config_type === 'settings');
      if (current && typeof current.config_data === 'object') {
        setForm({ ...DEFAULT_FORM, ...(current.config_data as Record<string, string>) });
      } else {
        setForm(DEFAULT_FORM);
      }
    } catch (err) {
      console.error('[settings] Failed to load configs', err);
      setError('Tidak dapat memuat konfigurasi lokal');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      await upsertUserConfig({
        user_id: session.user.id,
        profile_name: 'default',
        config_type: 'settings',
        config_data: form
      });
      setMessage('Konfigurasi tersimpan!');
      await loadConfigs();
    } catch (err) {
      console.error('[settings] Failed to save config', err);
      setError('Gagal menyimpan konfigurasi');
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
          <h1 className="text-3xl font-semibold">SETTING</h1>
          <p className="text-sm text-neutral-400">Kelola konfigurasi profil dan preferensi tampilan.</p>
          <p className="text-xs text-neutral-500">Data tersimpan di browser Anda.</p>
        </header>

        <section className="rounded-xl border border-neutral-700 bg-neutral-900/60 p-6">
          <h2 className="text-lg font-medium text-white">Konfigurasi Aktif</h2>
          <form onSubmit={handleSave} className="mt-4 grid gap-4">
            <label className="grid gap-2 text-sm">
              <span className="text-neutral-300">Tema</span>
              <select
                className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2"
                value={form.theme}
                onChange={(event) => setForm((prev) => ({ ...prev, theme: event.target.value }))}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">Ikuti Sistem</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm">
              <span className="text-neutral-300">Zona Waktu</span>
              <input
                className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2"
                value={form.timezone}
                onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
              />
            </label>

            <label className="grid gap-2 text-sm">
              <span className="text-neutral-300">Bahasa</span>
              <input
                className="rounded-md border border-neutral-600 bg-neutral-800 px-3 py-2"
                value={form.language}
                onChange={(event) => setForm((prev) => ({ ...prev, language: event.target.value }))}
              />
            </label>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? 'Menyimpan...' : 'Simpan Konfigurasi'}
              </button>
              {message && <span className="text-sm text-green-400">{message}</span>}
              {error && <span className="text-sm text-red-400">{error}</span>}
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-neutral-700 bg-neutral-900/40 p-6">
          <h2 className="text-lg font-medium text-white">Riwayat Konfigurasi</h2>
          {configs.length === 0 ? (
            <p className="mt-3 text-sm text-neutral-500">Belum ada konfigurasi tersimpan.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm text-neutral-300">
              {configs.map((cfg) => (
                <li key={cfg.id} className="rounded-md border border-neutral-700 bg-neutral-900/60 p-3">
                  <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span>{cfg.profile_name} - {cfg.config_type}</span>
                    {cfg.updated_at && <span>{new Date(cfg.updated_at).toLocaleString('id-ID')}</span>}
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded bg-neutral-950/70 p-3 text-xs">
                    {JSON.stringify(cfg.config_data, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
