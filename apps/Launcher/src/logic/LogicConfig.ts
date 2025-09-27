import type { LogicConfig } from './sceneTypes'
// Temporary shim: expose config from original location under the new logic/ path
// @ts-ignore - JSON import without type
import rawConfig from './LogicConfig.json'

const assetManifest = import.meta.glob('../../../../shared/asset/**/*.{png,jpg,jpeg,gif,webp,avif,svg}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const SRC_ASSET_PREFIXES = ['/shared/asset/', 'shared/asset/']

function resolveBundledAsset(path: string): string | null {
  for (const prefix of SRC_ASSET_PREFIXES) {
    if (path.startsWith(prefix)) {
      const relative = path.slice(prefix.length)
      const manifestKey = `../../../../shared/asset/${relative}`
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
  for (const [key, value] of Object.entries(registry)) {
    const mapped = resolveBundledAsset(value)
    if (mapped) registry[key] = mapped
  }
  return { ...cfg, imageRegistry: registry }
}

const config = remapRegistry(rawConfig as LogicConfig)

export default config

