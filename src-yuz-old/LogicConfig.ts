export type ImageRegistry = Record<string, string>

export type ImageRef =
  | { kind: 'urlId'; id: string }
  | { kind: 'url'; url: string }

export type LayerConfig = {
  id: string
  imageRef: ImageRef
  position: { xPct: number; yPct: number }
  scale?: { pct?: number }
  spinRPM?: number | null
  spinDir?: 'cw' | 'ccw'
  orbitRPM?: number | null
  orbitDir?: 'cw' | 'ccw'
  orbitCenter?: { xPct: number; yPct: number }
  orbitPhaseDeg?: number | null
  orbitOrientPolicy?: 'none' | 'auto' | 'override'
  orbitOrientDeg?: number | null
}

export type LogicConfig = {
  layersID: string[]
  imageRegistry: ImageRegistry
  layers: LayerConfig[]
}

// @ts-ignore - JSON import without type
import rawConfig from './LogicConfig.json'

const assetManifest = import.meta.glob('../../../shared/asset/**/*.{png,jpg,jpeg,gif,webp,avif,svg}', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>

const SRC_ASSET_PREFIXES = ['/asset/', 'asset/']

function resolveBundledAsset(path: string): string | null {
  for (const prefix of SRC_ASSET_PREFIXES) {
    if (path.startsWith(prefix)) {
      const relative = path.slice(prefix.length)
      const manifestKey = `../../../shared/asset/${relative}`
      const mapped = assetManifest[manifestKey]
      if (mapped) return mapped
      console.warn('[logic] Missing bundled asset for', path)
      return null
    }
  }
  return null
}

function remapRegistry(cfg: LogicConfig): LogicConfig {
  const registry = { ...cfg.imageRegistry }
  for (const [key, value] of Object.entries(registry) as Array<[string, string]>) {
    const mapped = resolveBundledAsset(value)
    if (mapped) registry[key] = mapped
  }
  return { ...cfg, imageRegistry: registry }
}

const config = remapRegistry(rawConfig as LogicConfig)

export default config
