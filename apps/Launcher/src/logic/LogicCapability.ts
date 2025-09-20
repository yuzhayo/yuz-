export type RendererMode = 'auto' | 'pixi' | 'dom'

export function isWebGLAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

function getOverride(): 'pixi' | 'dom' | null {
  try {
    const sp = new URLSearchParams(window.location.search)
    const q = sp.get('renderer')
    if (q === 'pixi' || q === 'dom') return q
  } catch {}
  try {
    const ls = localStorage.getItem('renderer')
    if (ls === 'pixi' || ls === 'dom') return ls
  } catch {}
  return null
}

export function detectRenderer(mode: RendererMode = 'auto'): 'pixi' | 'dom' {
  if (mode === 'pixi' || mode === 'dom') return mode
  const ov = getOverride()
  if (ov) return ov
  // Conservative: prefer Pixi if WebGL exists; else DOM
  return isWebGLAvailable() ? 'pixi' : 'dom'
}

