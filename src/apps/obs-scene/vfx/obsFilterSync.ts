import { hexToObsAbgr, VTSURU_OBS_FILTER_PREFIX } from '@/shared/obs/obsWebsocketFilters'
import type {
  RpcObsFilterCapabilities,
  RpcObsManagedFilterItem,
  RpcObsStageFilterAssetParams,
  RpcObsStageFilterAssetResult,
  RpcObsSyncFiltersParams,
  RpcObsSyncFiltersResult,
} from '@/shared/rpc/contract'

import type { ObsSceneDocument } from '../types'
import { generateBuiltinCubeLut, getObsShaderFilterPreset } from './presets'
import type { ObsNativeFilterConfig } from './types'
import { hasActiveObsNativeFilters } from './types'

export interface ObsFilterSyncExecutor {
  capabilities: RpcObsFilterCapabilities
  syncSourceFilters: (params: RpcObsSyncFiltersParams) => Promise<RpcObsSyncFiltersResult>
  stageFilterAsset: (params: RpcObsStageFilterAssetParams) => Promise<RpcObsStageFilterAssetResult>
}

function shortHash(text: string): string {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

function guessExtFromUrl(url: string, fallback: string): string {
  const clean = url.split(/[?#]/)[0].toLowerCase()
  const m = clean.match(/\.(cube|png|shader|effect|hlsl)$/)
  return m ? `.${m[1]}` : fallback
}

export async function buildManagedObsFiltersForConfig(
  config: ObsNativeFilterConfig | undefined,
  executor: ObsFilterSyncExecutor,
): Promise<{ filters: RpcObsManagedFilterItem[]; warnings: string[] }> {
  const warnings: string[] = []
  const enabledAll = Boolean(config?.enabled)
  const filters: RpcObsManagedFilterItem[] = []

  // 1. OBS 内置色彩校正 (color_filter_v2)
  const color = config?.color
  filters.push({
    filterName: `${VTSURU_OBS_FILTER_PREFIX}色彩校正`,
    filterKind: 'color_filter_v2',
    enabled: Boolean(enabledAll && color?.enabled),
    settings: color
      ? {
          gamma: color.gamma,
          contrast: color.contrast,
          brightness: color.brightness,
          saturation: color.saturation,
          hue_shift: color.hueShift,
          opacity: color.opacity,
          color_multiply: hexToObsAbgr(color.colorMultiply || '#ffffff', 255),
          color_add: hexToObsAbgr(color.colorAdd || '#000000', 255),
        }
      : {},
  })

  // 2. OBS 内置锐化 (sharpness_filter_v2)
  const sharpness = config?.sharpness
  filters.push({
    filterName: `${VTSURU_OBS_FILTER_PREFIX}画面锐化`,
    filterKind: 'sharpness_filter_v2',
    enabled: Boolean(enabledAll && sharpness?.enabled),
    settings: sharpness ? { sharpness: sharpness.amount } : {},
  })

  // 3. OBS 内置 3D LUT 调色 (color_grade_filter)
  const lut = config?.lut
  let lutPath = ''
  const lutActive = Boolean(enabledAll && lut?.enabled)
  if (lutActive && lut) {
    if (lut.presetId !== 'custom') {
      if (executor.capabilities.canStageLocalAssets) {
        const cubeText = generateBuiltinCubeLut(lut.presetId)
        const staged = await executor.stageFilterAsset({
          fileName: `lut_builtin_${lut.presetId}.cube`,
          content: cubeText,
        })
        if (staged.ok && staged.localPath) {
          lutPath = staged.localPath
        } else {
          warnings.push(`内置 LUT 落盘失败: ${staged.message || '未知错误'}`)
        }
      } else {
        warnings.push('内置 3D LUT 需要通过 VTsuru 桌面客户端自动写入本地缓存路径，网页直连模式请改为填写本机 LUT 绝对路径')
      }
    } else if (lut.customPath?.trim()) {
      lutPath = lut.customPath.trim()
    } else if (lut.inlineCubeText?.trim()) {
      if (executor.capabilities.canStageLocalAssets) {
        const staged = await executor.stageFilterAsset({
          fileName: `lut_inline_${shortHash(lut.inlineCubeText)}.cube`,
          content: lut.inlineCubeText,
        })
        if (staged.ok && staged.localPath) lutPath = staged.localPath
        else warnings.push(`自定义 LUT 落盘失败: ${staged.message || '未知错误'}`)
      } else {
        warnings.push('自定义内联 LUT 需要通过 VTsuru 桌面客户端自动缓存落盘')
      }
    } else if (lut.customUrl?.trim()) {
      if (executor.capabilities.canStageLocalAssets) {
        const ext = guessExtFromUrl(lut.customUrl, '.cube')
        const staged = await executor.stageFilterAsset({
          fileName: `lut_url_${shortHash(lut.customUrl)}${ext}`,
          url: lut.customUrl.trim(),
        })
        if (staged.ok && staged.localPath) lutPath = staged.localPath
        else warnings.push(`云端 LUT 下载落盘失败: ${staged.message || '未知错误'}`)
      } else {
        warnings.push('云端 LUT 需通过桌面客户端自动下载到本地后供 OBS 加载')
      }
    } else {
      warnings.push('已开启 3D LUT 但尚未选择预设或填写文件')
    }
  }

  filters.push({
    filterName: `${VTSURU_OBS_FILTER_PREFIX}LUT 调色`,
    filterKind: 'color_grade_filter',
    enabled: Boolean(lutActive && lutPath),
    settings: lutPath
      ? {
          image_path: lutPath,
          clut_amount: lut?.amount ?? 0.75,
        }
      : {},
  })

  // 4. obs-shaderfilter 高级像素后处理（仅检测到 OBS 已装插件时启用）
  const sf = config?.shaderFilter
  const sfActive = Boolean(enabledAll && sf?.enabled)
  if (executor.capabilities.hasShaderFilter) {
    let shaderPath = ''
    let useText = false
    let shaderText = ''

    if (sfActive && sf) {
      const code = sf.presetId === 'custom' ? (sf.customCode || '') : getObsShaderFilterPreset(sf.presetId).hlslCode
      if (sf.presetId === 'custom' && sf.customPath?.trim()) {
        shaderPath = sf.customPath.trim()
      } else if (code.trim()) {
        if (executor.capabilities.canStageLocalAssets) {
          const staged = await executor.stageFilterAsset({
            fileName: `shader_${sf.presetId}_${shortHash(code)}.shader`,
            content: code,
          })
          if (staged.ok && staged.localPath) {
            shaderPath = staged.localPath
          } else {
            useText = true
            shaderText = code
          }
        } else {
          // 网页直连无写盘能力时，obs-shaderfilter 支持 from_effect_file=false + shader_text 直传！
          useText = true
          shaderText = code
        }
      }
    }

    filters.push({
      filterName: `${VTSURU_OBS_FILTER_PREFIX}Shader 滤镜`,
      filterKind: 'shader_filter',
      enabled: Boolean(sfActive && (shaderPath || shaderText)),
      settings: sf
        ? {
            from_effect_file: !useText && Boolean(shaderPath),
            shader_file_name: shaderPath,
            shader_text: useText ? shaderText : '',
            reload_effect: true,
            intensity: sf.intensity,
            speed: sf.speed,
            param1: sf.param1,
            param2: sf.param2,
          }
        : {},
    })
  } else if (sfActive) {
    warnings.push('当前 OBS 未检测到 obs-shaderfilter 插件，已跳过高级 Shader 后处理滤镜')
  }

  return { filters, warnings }
}

/**
 * 同步某一个目标（OBS 场景或本地 OBS 源）的原生滤镜
 */
export async function applyObsNativeFilterConfig(
  sourceName: string,
  config: ObsNativeFilterConfig | undefined,
  executor: ObsFilterSyncExecutor,
): Promise<RpcObsSyncFiltersResult> {
  const { filters, warnings } = await buildManagedObsFiltersForConfig(config, executor)
  const res = await executor.syncSourceFilters({
    sourceName,
    managedPrefix: VTSURU_OBS_FILTER_PREFIX,
    filters,
  })
  const mergedWarnings = [...warnings, ...(res.warnings ?? [])]
  return {
    ...res,
    warnings: mergedWarnings.length > 0 ? mergedWarnings : undefined,
  }
}

/**
 * 同步当前子场景的场景级原生滤镜 + 所有已绑定本地源的独立原生滤镜
 */
export async function syncActiveSceneObsNativeFilters(options: {
  doc: ObsSceneDocument
  sceneId: string
  obsSceneName: string
  executor: ObsFilterSyncExecutor
}): Promise<{ ok: boolean; appliedCount: number; warnings: string[] }> {
  const { doc, sceneId, obsSceneName, executor } = options
  const scene = doc.scenes[sceneId]
  if (!scene) return { ok: true, appliedCount: 0, warnings: [] }

  const warnings: string[] = []
  let appliedCount = 0

  // 1. 场景级原生滤镜（只要场景定义过 obsFilters 或已启用，都同步以支持关闭回退）
  if (obsSceneName.trim() && scene.obsFilters) {
    const res = await applyObsNativeFilterConfig(obsSceneName.trim(), scene.obsFilters, executor)
    appliedCount += res.appliedCount ?? 0
    if (!res.ok && res.message) warnings.push(res.message)
    if (res.warnings) warnings.push(...res.warnings)
  }

  // 2. 当前子场景内所有已绑定 obs-source 的独立原生滤镜
  for (const layerId of scene.layerIds) {
    const layer = doc.layers[layerId]
    if (!layer || layer.type !== 'obs-source') continue
    const boundName = layer.obsSource.sourceName.trim()
    if (!boundName || !layer.obsSource.filters) continue
    const res = await applyObsNativeFilterConfig(boundName, layer.obsSource.filters, executor)
    appliedCount += res.appliedCount ?? 0
    if (!res.ok && res.message) warnings.push(res.message)
    if (res.warnings) warnings.push(...res.warnings)
  }

  return { ok: warnings.length === 0 || appliedCount > 0, appliedCount, warnings }
}

export function documentHasAnyObsNativeFilters(doc: ObsSceneDocument): boolean {
  for (const sc of Object.values(doc.scenes)) {
    if (hasActiveObsNativeFilters(sc.obsFilters)) return true
  }
  for (const layer of Object.values(doc.layers)) {
    if (layer.type === 'obs-source' && hasActiveObsNativeFilters(layer.obsSource.filters)) return true
  }
  return false
}
