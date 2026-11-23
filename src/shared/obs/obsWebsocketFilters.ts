import type OBSWebSocket from 'obs-websocket-js'

import type {
  RpcObsFilterCapabilities,
  RpcObsSyncFiltersParams,
  RpcObsSyncFiltersResult,
} from '@/shared/rpc/contract'

export const VTSURU_OBS_FILTER_PREFIX = '[VTsuru] '

/**
 * 将 #RRGGBB 转为 OBS color_filter_v2 使用的 ABGR 无符号 32 位整数 (0xAABBGGRR)
 */
export function hexToObsAbgr(hex: string, alpha = 255): number {
  const clean = hex.trim().replace(/^#/, '')
  let r = 255
  let g = 255
  let b = 255
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16)
    g = parseInt(clean[1] + clean[1], 16)
    b = parseInt(clean[2] + clean[2], 16)
  } else if (clean.length >= 6) {
    r = parseInt(clean.slice(0, 2), 16)
    g = parseInt(clean.slice(2, 4), 16)
    b = parseInt(clean.slice(4, 6), 16)
  }
  const a = Math.max(0, Math.min(255, Math.round(alpha)))
  return (((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff)) >>> 0
}

/**
 * 探测当前连接的 OBS 安装了哪些滤镜类型（含第三方 obs-shaderfilter / obs-composite-blur）
 */
export async function fetchObsFilterCapabilities(
  obs: OBSWebSocket,
  canStageLocalAssets: boolean,
): Promise<RpcObsFilterCapabilities> {
  try {
    const res = await obs.call('GetSourceFilterKindList')
    const filterKinds = Array.isArray(res.sourceFilterKinds)
      ? res.sourceFilterKinds.map((k) => String(k))
      : []
    const lowerSet = new Set(filterKinds.map((k) => k.toLowerCase()))
    return {
      filterKinds,
      hasShaderFilter: lowerSet.has('shader_filter'),
      hasCompositeBlur: lowerSet.has('obs_composite_blur') || lowerSet.has('composite_blur_filter'),
      canStageLocalAssets,
    }
  } catch {
    return {
      filterKinds: [],
      hasShaderFilter: false,
      hasCompositeBlur: false,
      canStageLocalAssets,
    }
  }
}

interface RawObsFilterItem {
  filterName?: string
  filterKind?: string
  filterEnabled?: boolean
}

/**
 * 将一组受管滤镜幂等同步到目标 OBS 源（场景名或具体输入源名）。
 * 仅操作以 managedPrefix（默认 `[VTsuru] `）命名的滤镜，绝不触碰用户手动创建的滤镜。
 */
export async function syncObsSourceFilters(
  obs: OBSWebSocket,
  params: RpcObsSyncFiltersParams,
): Promise<RpcObsSyncFiltersResult> {
  const sourceName = params.sourceName.trim()
  if (!sourceName) {
    return { ok: false, message: '目标 OBS 源或场景名不能为空' }
  }

  const prefix = params.managedPrefix ?? VTSURU_OBS_FILTER_PREFIX
  const warnings: string[] = []
  let appliedCount = 0

  try {
    const listRes = await obs.call('GetSourceFilterList', { sourceName })
    const existing = ((listRes.filters ?? []) as unknown as RawObsFilterItem[]).filter(
      (f) => typeof f.filterName === 'string' && f.filterName.startsWith(prefix),
    )
    const existingByName = new Map(existing.map((f) => [f.filterName!, f]))
    const desiredNames = new Set(params.filters.map((f) => f.filterName))

    // 1. 先停用不在期望列表中的旧受管滤镜
    for (const old of existing) {
      if (!old.filterName || desiredNames.has(old.filterName)) continue
      if (old.filterEnabled !== false) {
        await obs.call('SetSourceFilterEnabled', {
          sourceName,
          filterName: old.filterName,
          filterEnabled: false,
        }).catch(() => {})
      }
    }

    // 2. 逐个写入或更新期望的受管滤镜
    for (const spec of params.filters) {
      const prev = existingByName.get(spec.filterName)
      try {
        if (!prev) {
          if (!spec.enabled) continue
          await obs.call('CreateSourceFilter', {
            sourceName,
            filterName: spec.filterName,
            filterKind: spec.filterKind,
            filterSettings: spec.settings as Record<string, never>,
          })
          appliedCount += 1
        } else if (prev.filterKind && prev.filterKind !== spec.filterKind) {
          await obs.call('RemoveSourceFilter', {
            sourceName,
            filterName: spec.filterName,
          })
          if (spec.enabled) {
            await obs.call('CreateSourceFilter', {
              sourceName,
              filterName: spec.filterName,
              filterKind: spec.filterKind,
              filterSettings: spec.settings as Record<string, never>,
            })
            appliedCount += 1
          }
        } else {
          if (spec.enabled) {
            await obs.call('SetSourceFilterSettings', {
              sourceName,
              filterName: spec.filterName,
              filterSettings: spec.settings as Record<string, never>,
              overlay: false,
            })
            appliedCount += 1
          }
          await obs.call('SetSourceFilterEnabled', {
            sourceName,
            filterName: spec.filterName,
            filterEnabled: spec.enabled,
          })
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        warnings.push(`滤镜「${spec.filterName}」同步失败: ${msg}`)
      }
    }

    return {
      ok: warnings.length === 0 || appliedCount > 0,
      appliedCount,
      warnings: warnings.length > 0 ? warnings : undefined,
      message:
        warnings.length > 0
          ? `已同步 ${appliedCount} 项滤镜到「${sourceName}」（${warnings.length} 项提示）`
          : `已同步 ${appliedCount} 项原生滤镜到「${sourceName}」`,
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    }
  }
}
