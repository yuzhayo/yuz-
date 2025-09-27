import React from "react";

export type MainScreenUpdaterProps = {
  visible: boolean;
};

async function clearCachesAndReload() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs)
        try {
          await r.unregister();
        } catch {}
    }
  } catch {}
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {}
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("_ts", String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

export default function MainScreenUpdater(props: MainScreenUpdaterProps) {
  if (!props.visible) return null;
  return (
    <button
      type="button"
      onClick={clearCachesAndReload}
      className="main-screen-updater"
      aria-label="Force update and reload"
    >
      Update
    </button>
  );
}