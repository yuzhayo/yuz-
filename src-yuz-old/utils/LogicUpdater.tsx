import React from 'react'

export type LogicUpdaterProps = {
  visible: boolean
}

async function clearCachesAndReload() {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const r of regs) try { await r.unregister() } catch {}
    }
  } catch {}
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
  } catch {}
  try {
    const url = new URL(window.location.href)
    url.searchParams.set('_ts', String(Date.now()))
    window.location.replace(url.toString())
  } catch {
    window.location.reload()
  }
}

export default function LogicUpdater(props: LogicUpdaterProps) {
  if (!props.visible) return null
  return (
    <button
      type="button"
      onClick={clearCachesAndReload}
      className="fixed top-9 right-3 z-[9998] text-[10px] px-2 py-0.5 rounded bg-pink-600/80 hover:bg-pink-500/80 active:bg-pink-600 text-white shadow-sm border border-white/10"
      aria-label="Force update and reload"
    >
      Update
    </button>
  )
}