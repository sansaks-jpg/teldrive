import { useCallback, useSyncExternalStore } from "react";

// Per-app, per-browser settings for the Photos and Docs workspaces. They live in
// localStorage because they only affect client-side presentation.

export type PhotosSettings = {
  showVideosInTimeline: boolean;
  showScreenshots: boolean;
  memoriesBanner: boolean;
  browserNotifications: boolean;
};

export type DocsSettings = {
  paginatedLayout: boolean;
  showWordCount: boolean;
  autoSaveDrafts: boolean;
};

const PHOTOS_SETTINGS_KEY = "teldrive:photos-settings:v1";
const DOCS_SETTINGS_KEY = "teldrive:docs-settings:v1";

const DEFAULT_PHOTOS_SETTINGS: PhotosSettings = {
  showVideosInTimeline: true,
  showScreenshots: true,
  memoriesBanner: true,
  browserNotifications: false,
};

const DEFAULT_DOCS_SETTINGS: DocsSettings = {
  paginatedLayout: true,
  showWordCount: true,
  autoSaveDrafts: true,
};

const CHANGE_EVENT = "teldrive:app-settings-change";
const snapshots = new Map<string, { raw: string | null; value: unknown }>();

function readSettings<T extends Record<string, boolean>>(key: string, defaults: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    raw = null;
  }
  const cached = snapshots.get(key);
  if (cached && cached.raw === raw) return cached.value as T;
  let value = defaults;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const next = { ...defaults };
      for (const field of Object.keys(defaults) as (keyof T)[]) {
        const stored = parsed[field as string];
        if (typeof stored === "boolean") next[field] = stored as T[keyof T];
      }
      value = next;
    } catch {
      value = defaults;
    }
  }
  snapshots.set(key, { raw, value });
  return value;
}

function writeSettings<T extends Record<string, boolean>>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable or full; keep the in-memory value for this session.
    snapshots.set(key, { raw: null, value });
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }));
}

function subscribeSettings(key: string, onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) onChange();
  };
  const onLocal = (event: Event) => {
    if ((event as CustomEvent<string>).detail === key) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onLocal);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onLocal);
  };
}

function useLocalSettings<T extends Record<string, boolean>>(key: string, defaults: T) {
  const subscribe = useCallback((onChange: () => void) => subscribeSettings(key, onChange), [key]);
  const settings = useSyncExternalStore(
    subscribe,
    () => readSettings(key, defaults),
    () => defaults,
  );
  const update = useCallback(
    (patch: Partial<T>) => writeSettings(key, { ...readSettings(key, defaults), ...patch }),
    [key, defaults],
  );
  return [settings, update] as const;
}

export function usePhotosSettings() {
  return useLocalSettings(PHOTOS_SETTINGS_KEY, DEFAULT_PHOTOS_SETTINGS);
}

export function useDocsSettings() {
  return useLocalSettings(DOCS_SETTINGS_KEY, DEFAULT_DOCS_SETTINGS);
}

export function readPhotosSettings(): PhotosSettings {
  return readSettings(PHOTOS_SETTINGS_KEY, DEFAULT_PHOTOS_SETTINGS);
}

// Matches common screenshot / screen-recording file names across Android, iOS, macOS,
// and Windows without catching unrelated words such as "photoshoot".
const SCREENSHOT_NAME =
  /(screen[\s_-]?shot|screen[\s_-]?record|screencast|^scr[_-]|bildschirmfoto|tangkapan[\s_-]?layar)/i;

export function isScreenshotName(name: string): boolean {
  return SCREENSHOT_NAME.test(name);
}
