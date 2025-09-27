/**
 * Basic Layer System - Asset Management
 * 
 * Asset loading and resolution logic adapted from rawcode LogicConfig.ts
 * for use with the Three.js-based layer system.
 */

import * as THREE from 'three'
import type { LogicConfig, ImageRef } from './LayerBasicTypes'

// Asset resolution logic using dynamic imports
import starbgUrl from '@shared/Asset/STARBG.png?url'
import gear1Url from '@shared/Asset/GEAR1.png?url'
import gear2Url from '@shared/Asset/GEAR2.png?url'
import gear3Url from '@shared/Asset/GEAR3.png?url'

const assetManifest: Record<string, string> = {
  'STARBG.png': starbgUrl,
  'GEAR1.png': gear1Url,
  'GEAR2.png': gear2Url,
  'GEAR3.png': gear3Url,
  // Legacy path support
  'shared/Asset/STARBG.png': starbgUrl,
  'shared/Asset/GEAR1.png': gear1Url,
  'shared/Asset/GEAR2.png': gear2Url,
  'shared/Asset/GEAR3.png': gear3Url,
  '/shared/Asset/STARBG.png': starbgUrl,
  '/shared/Asset/GEAR1.png': gear1Url,
  '/shared/Asset/GEAR2.png': gear2Url,
  '/shared/Asset/GEAR3.png': gear3Url,
}

function resolveBundledAsset(path: string): string | null {
  // Direct lookup in manifest
  const mapped = assetManifest[path]
  if (mapped) return mapped
  
  // Extract filename and try lookup
  const filename = path.split('/').pop()
  if (filename && assetManifest[filename]) {
    return assetManifest[filename]
  }
  
  console.warn('[LayerBasicAssets] Missing bundled asset for', path)
  return null
}

export function remapRegistry(cfg: LogicConfig): LogicConfig {
  const registry = { ...cfg.imageRegistry }
  for (const [key, value] of Object.entries(registry)) {
    const mapped = resolveBundledAsset(value)
    if (mapped) registry[key] = mapped
  }
  return { ...cfg, imageRegistry: registry }
}

export function getUrlForImageRef(cfg: LogicConfig, ref: ImageRef): string | null {
  if (ref.kind === 'url') return ref.url
  const url = cfg.imageRegistry[ref.id]
  return url ?? null
}

// Three.js texture loading with error handling
const textureLoader = new THREE.TextureLoader()
const textureCache = new Map<string, THREE.Texture>()

export async function loadTexture(url: string): Promise<THREE.Texture> {
  if (textureCache.has(url)) {
    return textureCache.get(url)!
  }

  return new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (texture) => {
        texture.wrapS = THREE.ClampToEdgeWrapping
        texture.wrapT = THREE.ClampToEdgeWrapping
        texture.minFilter = THREE.LinearFilter
        texture.magFilter = THREE.LinearFilter
        textureCache.set(url, texture)
        resolve(texture)
      },
      undefined,
      (error) => {
        console.error('[LayerBasicAssets] Failed to load texture:', url, error)
        reject(error)
      }
    )
  })
}

export function disposeTextureCache(): void {
  textureCache.forEach((texture) => texture.dispose())
  textureCache.clear()
}