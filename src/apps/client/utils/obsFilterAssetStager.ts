import { appCacheDir, join } from '@tauri-apps/api/path'
import { mkdir, writeFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

import type { RpcObsStageFilterAssetParams, RpcObsStageFilterAssetResult } from '@/shared/rpc/contract'

const ALLOWED_EXTENSIONS = new Set(['.cube', '.png', '.shader', '.effect', '.hlsl'])
const MAX_ASSET_BYTES = 16 * 1024 * 1024

function sanitizeFileName(raw: string): string | null {
  const base = raw.trim().replace(/^.*[\\/]/, '')
  const match = base.match(/^([a-zA-Z0-9._-]{1,80})(\.[a-zA-Z0-9]+)$/)
  if (!match) return null
  const ext = match[2].toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(ext)) return null
  const stem = match[1].replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'asset'
  return `${stem}${ext}`
}

/**
 * 桌面客户端本地滤镜资产落盘器：
 * 将内置/云端 .cube LUT、.png LUT 或 .shader/.effect 写入 $APPCACHE/obs-filters 目录，
 * 返回 OBS 可直接读取的本地绝对路径。
 */
export async function stageObsFilterAssetLocally(
  params: RpcObsStageFilterAssetParams,
): Promise<RpcObsStageFilterAssetResult> {
  const safeName = sanitizeFileName(params.fileName)
  if (!safeName) {
    return {
      ok: false,
      message: '不支持的滤镜资产扩展名（仅允许 .cube / .png / .shader / .effect / .hlsl）',
    }
  }

  try {
    const cacheRoot = await appCacheDir()
    const filterDir = await join(cacheRoot, 'obs-filters')
    await mkdir(filterDir, { recursive: true })
    const localPath = await join(filterDir, safeName)

    if (typeof params.content === 'string') {
      if (params.content.length > MAX_ASSET_BYTES) {
        return { ok: false, message: '滤镜文件体积超出限制 (16 MB)' }
      }
      await writeTextFile(localPath, params.content)
      return { ok: true, localPath }
    }

    if (params.url && /^https?:\/\//i.test(params.url.trim())) {
      const resp = await tauriFetch(params.url.trim())
      if (!resp.ok) {
        return { ok: false, message: `下载滤镜资产失败 (HTTP ${resp.status})` }
      }
      const bytes = new Uint8Array(await resp.arrayBuffer())
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_ASSET_BYTES) {
        return { ok: false, message: '下载的滤镜资产为空或超过 16 MB 上限' }
      }
      await writeFile(localPath, bytes)
      return { ok: true, localPath }
    }

    return { ok: false, message: '缺少滤镜资产内容或有效 URL' }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    }
  }
}
