const STORAGE_KEY = "yuzha:local-data";
const CHANGE_EVENT = "yuzha:local-data:changed";

export type ModuleSubmissionRecord = {
  id: string;
  user_id: string;
  module_name: string;
  submission_data: Record<string, unknown>;
  submission_status?: string;
  created_at: string;
};

export type UserConfigRecord = {
  id: string;
  user_id: string;
  profile_name: string;
  config_type: string;
  config_data: Record<string, unknown>;
  updated_at: string;
};

type DataStore = {
  module_submissions: ModuleSubmissionRecord[];
  user_configs: UserConfigRecord[];
};

let memoryStore: DataStore = {
  module_submissions: [],
  user_configs: []
};

function deepClone<T>(value: T): T {
  if (typeof globalThis.structuredClone === "function") {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function normaliseModuleSubmission(entry: any): ModuleSubmissionRecord {
  return {
    id: String(entry?.id ?? ""),
    user_id: String(entry?.user_id ?? ""),
    module_name: String(entry?.module_name ?? ""),
    submission_data: typeof entry?.submission_data === "object" && entry?.submission_data !== null
      ? deepClone(entry.submission_data as Record<string, unknown>)
      : {},
    submission_status: entry?.submission_status !== undefined && entry?.submission_status !== null
      ? String(entry.submission_status)
      : undefined,
    created_at: typeof entry?.created_at === "string" ? entry.created_at : new Date().toISOString()
  };
}

function normaliseUserConfig(entry: any): UserConfigRecord {
  return {
    id: String(entry?.id ?? ""),
    user_id: String(entry?.user_id ?? ""),
    profile_name: String(entry?.profile_name ?? ""),
    config_type: String(entry?.config_type ?? ""),
    config_data: typeof entry?.config_data === "object" && entry?.config_data !== null
      ? deepClone(entry.config_data as Record<string, unknown>)
      : {},
    updated_at: typeof entry?.updated_at === "string" ? entry.updated_at : new Date().toISOString()
  };
}

function readStore(): DataStore {
  const storage = safeLocalStorage();
  if (!storage) {
    return deepClone(memoryStore);
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return { module_submissions: [], user_configs: [] };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DataStore>;
    const module_submissions = Array.isArray(parsed.module_submissions)
      ? parsed.module_submissions.map(normaliseModuleSubmission)
      : [];
    const user_configs = Array.isArray(parsed.user_configs)
      ? parsed.user_configs.map(normaliseUserConfig)
      : [];
    const store: DataStore = { module_submissions, user_configs };
    memoryStore = deepClone(store);
    return store;
  } catch {
    return { module_submissions: [], user_configs: [] };
  }
}

function writeStore(store: DataStore): void {
  memoryStore = deepClone(store);
  const storage = safeLocalStorage();
  if (storage) {
    storage.setItem(STORAGE_KEY, JSON.stringify(memoryStore));
  }
  notifyChange();
}

function notifyChange(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
}

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export async function listModuleSubmissions(filter?: { moduleName?: string }): Promise<ModuleSubmissionRecord[]> {
  const store = readStore();
  const rows = filter?.moduleName
    ? store.module_submissions.filter((row) => row.module_name === filter.moduleName)
    : store.module_submissions;
  return deepClone(rows);
}

export async function insertModuleSubmission(entry: {
  user_id: string;
  module_name: string;
  submission_data: Record<string, unknown>;
  submission_status?: string;
}): Promise<ModuleSubmissionRecord> {
  const store = readStore();
  const record: ModuleSubmissionRecord = {
    id: generateId(),
    user_id: entry.user_id,
    module_name: entry.module_name,
    submission_data: deepClone(entry.submission_data),
    submission_status: entry.submission_status,
    created_at: new Date().toISOString()
  };
  store.module_submissions = [record, ...store.module_submissions];
  writeStore(store);
  return deepClone(record);
}

export async function deleteModuleSubmission(id: string): Promise<boolean> {
  const store = readStore();
  const next = store.module_submissions.filter((row) => row.id !== id);
  const changed = next.length !== store.module_submissions.length;
  if (!changed) return false;
  store.module_submissions = next;
  writeStore(store);
  return true;
}

export async function listUserConfigs(): Promise<UserConfigRecord[]> {
  const store = readStore();
  return deepClone(store.user_configs);
}

export async function upsertUserConfig(entry: {
  user_id: string;
  profile_name: string;
  config_type: string;
  config_data: Record<string, unknown>;
}): Promise<UserConfigRecord> {
  const store = readStore();
  const now = new Date().toISOString();
  const existingIndex = store.user_configs.findIndex(
    (row) =>
      row.user_id === entry.user_id &&
      row.profile_name === entry.profile_name &&
      row.config_type === entry.config_type
  );
  const existing = existingIndex >= 0 ? store.user_configs[existingIndex] : undefined;
  const record: UserConfigRecord = {
    id: existing?.id ?? generateId(),
    user_id: entry.user_id,
    profile_name: entry.profile_name,
    config_type: entry.config_type,
    config_data: deepClone(entry.config_data),
    updated_at: now
  };
  if (existingIndex >= 0) {
    store.user_configs[existingIndex] = record;
  } else {
    store.user_configs = [record, ...store.user_configs];
  }
  writeStore(store);
  return deepClone(record);
}

export function subscribeToLocalData(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = () => listener();
  window.addEventListener(CHANGE_EVENT, handler);
  const storageHandler = (event: StorageEvent) => {
    if (event.key && event.key !== STORAGE_KEY) return;
    listener();
  };
  window.addEventListener("storage", storageHandler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("storage", storageHandler);
  };
}

export function clearLocalData(): void {
  const store: DataStore = { module_submissions: [], user_configs: [] };
  writeStore(store);
}
