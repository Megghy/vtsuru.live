import type OBSWebSocket from 'obs-websocket-js'

import type {
  RpcObsSceneItemRef,
  RpcObsSceneItemsResult,
  RpcObsSourceScreenshotParams,
  RpcObsSourceScreenshotResult,
  RpcObsSyncSceneLayoutParams,
  RpcObsSyncSceneLayoutResult,
  RpcObsUpsertBrowserSourceParams,
  RpcObsUpsertBrowserSourceResult,
} from '@/shared/rpc/contract'

interface RawSceneItemTransform {
  positionX?: number
  positionY?: number
  width?: number
  height?: number
  sourceWidth?: number
  sourceHeight?: number
  scaleX?: number
  scaleY?: number
  rotation?: number
  alignment?: number
}

interface RawSceneItem {
  sceneItemId?: number
  sourceName?: string
  inputKind?: string | null
  sceneItemEnabled?: boolean
  sceneItemTransform?: RawSceneItemTransform
}

/**
 * 将 OBS alignment（位掩码：1=左 2=右 4=顶 8=底 0=居中）折算为左上角偏移
 */
function computeTopLeftFromAlignment(
  positionX: number,
  positionY: number,
  width: number,
  height: number,
  alignment: number,
): { x: number; y: number } {
  let x = positionX
  let y = positionY

  if ((alignment & 1) !== 0) {
    // left
    x = positionX
  } else if ((alignment & 2) !== 0) {
    // right
    x = positionX - width
  } else {
    // horizontal center
    x = positionX - width / 2
  }

  if ((alignment & 4) !== 0) {
    // top
    y = positionY
  } else if ((alignment & 8) !== 0) {
    // bottom
    y = positionY - height
  } else {
    // vertical center
    y = positionY - height / 2
  }

  return { x: Math.round(x), y: Math.round(y) }
}

export async function fetchObsVideoCanvasSize(obs: OBSWebSocket): Promise<{ baseWidth: number; baseHeight: number }> {
  try {
    const res = await obs.call('GetVideoSettings')
    const baseWidth = typeof res.baseWidth === 'number' && res.baseWidth > 0 ? res.baseWidth : 1920
    const baseHeight = typeof res.baseHeight === 'number' && res.baseHeight > 0 ? res.baseHeight : 1080
    return { baseWidth, baseHeight }
  } catch {
    return { baseWidth: 1920, baseHeight: 1080 }
  }
}

export async function fetchObsSceneItems(obs: OBSWebSocket, sceneName: string): Promise<RpcObsSceneItemsResult> {
  const [{ baseWidth, baseHeight }, listRes] = await Promise.all([
    fetchObsVideoCanvasSize(obs),
    obs.call('GetSceneItemList', { sceneName }),
  ])

  const rawItems = (listRes.sceneItems ?? []) as unknown as RawSceneItem[]
  const items: RpcObsSceneItemRef[] = rawItems.map((raw) => {
    const t = raw.sceneItemTransform ?? {}
    const width = Math.round(
      typeof t.width === 'number' && t.width > 0
        ? t.width
        : (t.sourceWidth ?? 0) * (t.scaleX ?? 1),
    )
    const height = Math.round(
      typeof t.height === 'number' && t.height > 0
        ? t.height
        : (t.sourceHeight ?? 0) * (t.scaleY ?? 1),
    )
    const alignment = typeof t.alignment === 'number' ? t.alignment : 5
    const { x, y } = computeTopLeftFromAlignment(t.positionX ?? 0, t.positionY ?? 0, width, height, alignment)

    return {
      sceneItemId: Number(raw.sceneItemId ?? 0),
      sourceName: String(raw.sourceName ?? ''),
      inputKind: String(raw.inputKind ?? 'unknown'),
      x,
      y,
      width,
      height,
      rotation: Math.round(Number(t.rotation ?? 0)),
      enabled: raw.sceneItemEnabled !== false,
    }
  })

  return { sceneName, baseWidth, baseHeight, items }
}

export async function upsertObsBrowserSource(
  obs: OBSWebSocket,
  params: RpcObsUpsertBrowserSourceParams,
): Promise<RpcObsUpsertBrowserSourceResult> {
  const sceneName = params.sceneName.trim()
  const sourceName = params.sourceName.trim()
  const width = Math.max(16, Math.round(params.width))
  const height = Math.max(16, Math.round(params.height))

  if (!sceneName || !sourceName || !params.url) {
    return { ok: false, message: '场景名、源名称和 URL 不能为空' }
  }

  const inputSettings = {
    url: params.url,
    width,
    height,
    reroute_audio: false,
    shutdown: false,
    restart_when_active: false,
  }

  try {
    // 1. 先检查目标场景内是否已有同名源
    const listRes = await obs.call('GetSceneItemList', { sceneName })
    const rawItems = (listRes.sceneItems ?? []) as unknown as RawSceneItem[]
    const existingInScene = rawItems.find((item) => item.sourceName === sourceName)

    if (existingInScene && typeof existingInScene.sceneItemId === 'number') {
      await obs.call('SetInputSettings', {
        inputName: sourceName,
        inputSettings,
        overlay: true,
      })
      await obs.call('SetSceneItemEnabled', {
        sceneName,
        sceneItemId: existingInScene.sceneItemId,
        sceneItemEnabled: true,
      })
      return {
        ok: true,
        created: false,
        sceneItemId: existingInScene.sceneItemId,
        message: `已更新场景「${sceneName}」中的浏览器源「${sourceName}」`,
      }
    }

    // 2. 检查全局输入列表是否存在同名源（存在于其他场景）
    const inputsRes = await obs.call('GetInputList', { inputKind: 'browser_source' })
    const existingInput = (inputsRes.inputs ?? []).find(
      (input) => String((input as Record<string, unknown>).inputName ?? '') === sourceName,
    )

    let sceneItemId: number
    let created = false

    if (existingInput) {
      await obs.call('SetInputSettings', {
        inputName: sourceName,
        inputSettings,
        overlay: true,
      })
      const createdItem = await obs.call('CreateSceneItem', {
        sceneName,
        sourceName,
        sceneItemEnabled: true,
      })
      sceneItemId = createdItem.sceneItemId
    } else {
      const createdRes = await obs.call('CreateInput', {
        sceneName,
        inputName: sourceName,
        inputKind: 'browser_source',
        inputSettings,
        sceneItemEnabled: true,
      })
      sceneItemId = createdRes.sceneItemId
      created = true
    }

    // 3. 对齐左上角 (0, 0) 并适配画布尺寸
    const { baseWidth, baseHeight } = await fetchObsVideoCanvasSize(obs)
    await obs.call('SetSceneItemTransform', {
      sceneName,
      sceneItemId,
      sceneItemTransform: {
        alignment: 5, // Top-Left
        positionX: 0,
        positionY: 0,
        boundsType: 'OBS_BOUNDS_SCALE_INNER',
        boundsAlignment: 5,
        boundsWidth: baseWidth,
        boundsHeight: baseHeight,
      },
    })

    return {
      ok: true,
      created,
      sceneItemId,
      message: created
        ? `已在场景「${sceneName}」中创建全屏浏览器源「${sourceName}」`
        : `已将浏览器源「${sourceName}」添加到场景「${sceneName}」`,
    }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

/** 抓取 OBS 指定源的 PNG 透明快照，供场景编辑器画布可视化排版 */
export async function fetchObsSourceScreenshot(
  obs: OBSWebSocket,
  params: RpcObsSourceScreenshotParams,
): Promise<RpcObsSourceScreenshotResult> {
  const sourceName = params.sourceName.trim()
  if (!sourceName) {
    return { ok: false, message: '源名称不能为空' }
  }
  try {
    const res = await obs.call('GetSourceScreenshot', {
      sourceName,
      imageFormat: 'png',
      imageWidth: Math.max(120, Math.min(1280, Math.round(params.width ?? 640))),
      imageHeight: Math.max(80, Math.min(720, Math.round(params.height ?? 360))),
    })
    return { ok: true, imageData: res.imageData }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * 同步完整多段切片布局到目标 OBS 场景：
 * 1. 创建/更新全部所需浏览器源槽位（含跨子场景保留槽位，切场不销毁重载）
 * 2. 查找/补加本地原生源并应用显隐与像素级 Transform/Crop（以中心对齐匹配 CSS 旋转中心）
 * 3. 按 items（bottom -> top）顺序使用 SetSceneItemIndex 排好精确 Z 轴夹心顺序
 */
export async function syncObsSceneLayout(
  obs: OBSWebSocket,
  params: RpcObsSyncSceneLayoutParams,
): Promise<RpcObsSyncSceneLayoutResult> {
  const sceneName = params.sceneName.trim()
  if (!sceneName) {
    return { ok: false, message: '目标 OBS 场景名不能为空' }
  }

  const warnings: string[] = []
  try {
    const { baseWidth, baseHeight } = await fetchObsVideoCanvasSize(obs)
    const sx = baseWidth / Math.max(1, params.canvasWidth)
    const sy = baseHeight / Math.max(1, params.canvasHeight)

    // 1. 先确保所有跨场景保留但当前为空的浏览器源槽位已存在（保持透明且不断流）
    for (const unused of params.unusedBrowserSlots ?? []) {
      const res = await upsertObsBrowserSource(obs, {
        sceneName,
        sourceName: unused.sourceName,
        url: unused.url,
        width: unused.width,
        height: unused.height,
      })
      if (!res.ok) warnings.push(`槽位「${unused.sourceName}」同步失败: ${res.message ?? '未知错误'}`)
    }

    // 2. 创建/更新当前激活栈中的浏览器源槽位
    const browserSlotItemIds = new Map<string, number>()
    for (const item of params.items) {
      if (item.kind !== 'browser-slot') continue
      const res = await upsertObsBrowserSource(obs, {
        sceneName,
        sourceName: item.sourceName,
        url: item.url,
        width: item.width,
        height: item.height,
      })
      if (res.ok && typeof res.sceneItemId === 'number') {
        browserSlotItemIds.set(item.sourceName, res.sceneItemId)
      } else {
        warnings.push(`槽位「${item.sourceName}」写入失败: ${res.message ?? '未知错误'}`)
      }
    }

    // 3. 拉取当前场景源列表 + 全局输入列表，解析并更新所有本地 obs-source
    const [sceneListRes, globalInputsRes] = await Promise.all([
      obs.call('GetSceneItemList', { sceneName }),
      obs.call('GetInputList'),
    ])
    const sceneItems = (sceneListRes.sceneItems ?? []) as unknown as RawSceneItem[]
    const globalInputNames = new Set(
      (globalInputsRes.inputs ?? []).map((input) => String((input as Record<string, unknown>).inputName ?? '')),
    )

    const orderedManagedIds: number[] = []

    for (const item of params.items) {
      if (item.kind === 'browser-slot') {
        const sid = browserSlotItemIds.get(item.sourceName)
        if (sid !== undefined) orderedManagedIds.push(sid)
        continue
      }

      const sourceName = item.sourceName.trim()
      if (!sourceName) {
        warnings.push('存在未绑定 OBS 源名称的本地源图层，已跳过')
        continue
      }

      let sceneItemId = sceneItems.find((raw) => raw.sourceName === sourceName)?.sceneItemId
      if (typeof sceneItemId !== 'number') {
        if (globalInputNames.has(sourceName)) {
          const created = await obs.call('CreateSceneItem', {
            sceneName,
            sourceName,
            sceneItemEnabled: item.visible,
          })
          sceneItemId = created.sceneItemId
          sceneItems.push({ sceneItemId, sourceName, sceneItemEnabled: item.visible })
        } else {
          warnings.push(`OBS 中未找到源「${sourceName}」，请先在 OBS 中添加或重新绑定`)
          continue
        }
      }

      await obs.call('SetSceneItemEnabled', {
        sceneName,
        sceneItemId,
        sceneItemEnabled: item.visible,
      })

      if (item.applyTransform) {
        const scaledW = Math.max(16, Math.round(item.width * sx))
        const scaledH = Math.max(16, Math.round(item.height * sy))
        const centerX = Math.round((item.x + item.width / 2) * sx)
        const centerY = Math.round((item.y + item.height / 2) * sy)

        await obs.call('SetSceneItemTransform', {
          sceneName,
          sceneItemId,
          sceneItemTransform: {
            alignment: 0, // Center-Center，保证旋转中心与编辑器 CSS center center 一致
            positionX: centerX,
            positionY: centerY,
            rotation: item.rotation,
            boundsType: 'OBS_BOUNDS_SCALE_INNER',
            boundsAlignment: 0,
            boundsWidth: scaledW,
            boundsHeight: scaledH,
            ...(item.crop
              ? {
                  cropTop: Math.max(0, Math.round(item.crop.top * sy)),
                  cropRight: Math.max(0, Math.round(item.crop.right * sx)),
                  cropBottom: Math.max(0, Math.round(item.crop.bottom * sy)),
                  cropLeft: Math.max(0, Math.round(item.crop.left * sx)),
                }
              : {}),
          },
        })
      }

      orderedManagedIds.push(sceneItemId)
    }

    // 4. 按 bottom -> top 顺序依次置顶，确保所有受管项以精确相对 Z 序叠在场景最上方
    const latestList = await obs.call('GetSceneItemList', { sceneName })
    const topIndex = Math.max(0, (latestList.sceneItems?.length ?? orderedManagedIds.length) - 1)
    for (const sceneItemId of orderedManagedIds) {
      await obs.call('SetSceneItemIndex', {
        sceneName,
        sceneItemId,
        sceneItemIndex: topIndex,
      })
    }

    return {
      ok: true,
      syncedCount: orderedManagedIds.length,
      warnings: warnings.length > 0 ? warnings : undefined,
      message:
        warnings.length > 0
          ? `已同步 ${orderedManagedIds.length} 个 OBS 图层（${warnings.length} 项提示）`
          : `已按精确层级顺序同步 ${orderedManagedIds.length} 个图层到场景「${sceneName}」`,
    }
  } catch (err) {
    return {
      ok: false,
      warnings: warnings.length > 0 ? warnings : undefined,
      message: err instanceof Error ? err.message : String(err),
    }
  }
}
