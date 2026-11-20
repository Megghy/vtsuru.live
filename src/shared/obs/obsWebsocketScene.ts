import type OBSWebSocket from 'obs-websocket-js'

import type {
  RpcObsSceneItemRef,
  RpcObsSceneItemsResult,
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
