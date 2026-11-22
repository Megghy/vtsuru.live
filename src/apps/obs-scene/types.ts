import { getObsComponentById } from '@/apps/obs-store/registry'
import type { ObsComponentResolution } from '@/apps/obs-store/registry/types'
import type { GamepadType } from '@/types/gamepad'

import type { ObsLayerMaskShape } from './utils/maskShapes'
import { normalizeMaskShape } from './utils/maskShapes'

export type { ObsLayerMaskShape }

export type ObsSceneTransition = 'none' | 'fade' | 'slide-up' | 'scale'
export type ObsSceneLayerType =
  | 'vtsuru-widget'
  | 'obs-module'
  | 'marquee'
  | 'slideshow'
  | 'image'
  | 'video'
  | 'text'
  | 'shape'
  | 'iframe'
  | 'group'
export type WidgetConfigMode = 'shared' | 'isolated'
export type ObsModuleId =
  | 'danmuji'
  | 'music-request'
  | 'live-request'
  | 'live-request-today'
  | 'queue'
  | 'live-lottery'
  | 'question-display'
  | 'danmaku-vote'

export interface ObsModuleMeta {
  id: ObsModuleId
  name: string
  description: string
  defaultWidth: number
  defaultHeight: number
  requiresToken?: boolean
  managePath?: string
}

export const OBS_MODULE_LIST: ObsModuleMeta[] = [
  {
    id: 'danmuji',
    name: '弹幕机',
    description: '实时弹幕、礼物与醒目留言展示',
    defaultWidth: 420,
    defaultHeight: 680,
    requiresToken: true,
    managePath: '/manage/danmuji',
  },
  {
    id: 'music-request',
    name: '弹幕点歌列表',
    description: '实时展示等待播放的观众点歌队列',
    defaultWidth: 460,
    defaultHeight: 540,
    managePath: '/manage/music-request',
  },
  {
    id: 'live-request',
    name: '互动点播列表',
    description: '实时滚动展示当前待处理的互动点播',
    defaultWidth: 460,
    defaultHeight: 540,
    managePath: '/manage/live-request',
  },
  {
    id: 'live-request-today',
    name: '今日已处理点播',
    description: '展示今日已完成的互动点播清单',
    defaultWidth: 460,
    defaultHeight: 480,
    managePath: '/manage/live-request',
  },
  {
    id: 'queue',
    name: '排队列表',
    description: '观众排队上麦 / 互动游戏队列展示',
    defaultWidth: 460,
    defaultHeight: 520,
    managePath: '/manage/queue',
  },
  {
    id: 'live-lottery',
    name: '直播抽奖',
    description: '实时参与名单与开奖状态挂件',
    defaultWidth: 520,
    defaultHeight: 360,
    managePath: '/manage/lottery',
  },
  {
    id: 'question-display',
    name: '提问箱展示',
    description: '棉花糖 / 提问箱当前上屏问题卡片',
    defaultWidth: 680,
    defaultHeight: 420,
    managePath: '/manage/question-box',
  },
  {
    id: 'danmaku-vote',
    name: '弹幕投票',
    description: '实时弹幕投票选项进度条',
    defaultWidth: 480,
    defaultHeight: 380,
    managePath: '/manage/vote',
  },
]

export function getObsModuleById(id: string): ObsModuleMeta | undefined {
  return OBS_MODULE_LIST.find((item) => item.id === id)
}

export interface ObsSceneLayerCrop {
  top: number
  right: number
  bottom: number
  left: number
}

export interface ObsSceneLayerBase {
  id: string
  name: string
  type: ObsSceneLayerType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  visible: boolean
  locked: boolean
  crop?: ObsSceneLayerCrop
  borderRadius?: number
  /** 形状遮罩（默认 'none' 为标准矩形 + 圆角） */
  maskShape?: ObsLayerMaskShape
  /** 可选：移除组件/图层自带阴影效果，便于嵌入自定义底板 */
  disableShadow?: boolean
}

export interface GamepadWidgetParams {
  type: GamepadType
  bodyId: string
  pressedColor: string
  viewBox?: string
  stickSensitivity: number
}

export interface VtsuruWidgetLayer extends ObsSceneLayerBase {
  type: 'vtsuru-widget'
  widget: {
    componentId: string
    configMode: WidgetConfigMode
    channelId: string
    scaleMode: 'fit' | 'native'
    gamepadParams?: GamepadWidgetParams
  }
}

export interface ImageLayer extends ObsSceneLayerBase {
  type: 'image'
  image: {
    url: string
    objectFit: 'contain' | 'cover' | 'fill'
  }
}

export interface VideoLayer extends ObsSceneLayerBase {
  type: 'video'
  video: {
    url: string
    objectFit: 'contain' | 'cover' | 'fill'
    loop: boolean
    muted: boolean
  }
}

export interface TextLayer extends ObsSceneLayerBase {
  type: 'text'
  text: {
    content: string
    fontFamily: string
    fontSize: number
    fontWeight: number
    color: string
    align: 'left' | 'center' | 'right'
    lineHeight: number
    strokeWidth: number
    strokeColor: string
    shadow: string
    backgroundColor: string
    padding: number
  }
}

export interface ShapeLayer extends ObsSceneLayerBase {
  type: 'shape'
  shape: {
    fill: string
    borderColor: string
    borderWidth: number
    backdropBlur: number
  }
}

export interface ObsModuleLayer extends ObsSceneLayerBase {
  type: 'obs-module'
  module: {
    moduleId: ObsModuleId
    /** 列表类组件风格: classic | fresh | minimal | glass | transparent; 抽奖: slate | transparent | champagne | classic */
    style?: string
    /** 抽奖布局模式: card | banner | compact | grid */
    lotteryMode?: 'card' | 'banner' | 'compact' | 'grid'
    /** 列表滚动倍率 */
    speedMultiplier?: number
    /** 弹幕投票最大条数 */
    maxDisplay?: number
    /** 弹幕机快捷参数 */
    danmujiPreset?: 'classic' | 'bubble' | 'minimal'
    danmujiFontSize?: number
    danmujiFontFamily?: string
    danmujiOpacity?: number
    danmujiReverse?: boolean
    danmujiPinned?: boolean
    danmujiAutoHide?: number
    danmujiPinnedMinPrice?: number
    /** 弹幕投票专属：布局形态、独立字体与实时票数覆盖 */
    voteLayout?: 'auto' | 'card' | 'banner'
    voteFontFamily?: string
    voteShowResults?: boolean
  }
}

export interface MarqueeImageItem {
  id: string
  url: string
  label?: string
}

export interface MarqueeLayer extends ObsSceneLayerBase {
  type: 'marquee'
  marquee: {
    mode: 'text' | 'image'
    direction: 'left' | 'right' | 'up' | 'down'
    /** 滚动速度（px/秒） */
    speed: number
    /** 项之间的间距（px） */
    gap: number
    /** 文字走马灯内容（每行一条公告） */
    items: string[]
    separator: string
    fontFamily: string
    fontSize: number
    fontWeight: number
    color: string
    strokeWidth: number
    strokeColor: string
    shadow: string
    backgroundColor: string
    padding: number
    /** 图片走马灯素材列表 */
    images: MarqueeImageItem[]
    imageHeight: number
    imageRadius: number
  }
}

export interface SlideshowLayer extends ObsSceneLayerBase {
  type: 'slideshow'
  slideshow: {
    images: MarqueeImageItem[]
    /** 切换间隔（秒） */
    intervalSec: number
    transition: 'fade' | 'slide' | 'none'
    objectFit: 'contain' | 'cover'
    showDots: boolean
    backgroundColor: string
  }
}

export interface IframeLayer extends ObsSceneLayerBase {
  type: 'iframe'
  iframe: {
    url: string
    interactable: boolean
  }
}

export interface GroupLayer extends ObsSceneLayerBase {
  type: 'group'
  group: {
    /** 子图层 ID（bottom -> top），支持嵌套子组 */
    childIds: string[]
    /** 是否裁切超出组边界的内容（默认 false，类似 Figma Group；开启后类似 Frame 裁切） */
    clipContent?: boolean
    /** 缩放组时是否按比例联动缩放子图层（默认 true） */
    scaleChildren?: boolean
    /** 仅编辑器左侧图层树折叠态 */
    collapsed?: boolean
  }
}

export type ObsSceneLayer =
  | VtsuruWidgetLayer
  | ObsModuleLayer
  | MarqueeLayer
  | SlideshowLayer
  | ImageLayer
  | VideoLayer
  | TextLayer
  | ShapeLayer
  | IframeLayer
  | GroupLayer

export interface ObsSceneItem {
  id: string
  name: string
  layerIds: string[]
  transition: ObsSceneTransition
  obsSceneBinding?: string
}

export interface ObsSceneDocument {
  version: 1
  canvas: {
    width: number
    height: number
    background?: string
  }
  activeSceneId: string
  globalLayerIds: string[]
  sceneOrder: string[]
  scenes: Record<string, ObsSceneItem>
  layers: Record<string, ObsSceneLayer>
}

export const CANVAS_PRESETS = [
  { label: '1080p 横屏 (1920×1080)', width: 1920, height: 1080 },
  { label: '2K 横屏 (2560×1440)', width: 2560, height: 1440 },
  { label: '720p 横屏 (1280×720)', width: 1280, height: 720 },
  { label: '1080p 竖屏 (1080×1920)', width: 1080, height: 1920 },
] as const

export const BRIDGE_WIDGET_IDS = new Set([
  'clock',
  'counter',
  'goal',
  'wheel',
  'subtitle',
  'keycast',
  'typing-cat',
  'pngtuber',
])

export function isBridgeWidget(componentId: string): boolean {
  return BRIDGE_WIDGET_IDS.has(componentId)
}

export function createShortId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8)
  const ts = Date.now().toString(36).slice(-4)
  return `${prefix}_${ts}${rand}`
}

export function buildIsolatedChannelId(layerId: string): string {
  const cleaned = layerId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48)
  return `sc_${cleaned || createShortId('ch')}`
}

export function parseResolution(resolution?: ObsComponentResolution | string): { width: number; height: number } {
  if (!resolution) return { width: 480, height: 240 }
  if (typeof resolution === 'object') {
    return {
      width: Math.max(120, Math.round(resolution.width) || 480),
      height: Math.max(80, Math.round(resolution.height) || 240),
    }
  }
  const match = resolution.match(/(\d+)\s*[x×]\s*(\d+)/i)
  if (!match) return { width: 480, height: 240 }
  return {
    width: Math.max(120, Number(match[1]) || 480),
    height: Math.max(80, Number(match[2]) || 240),
  }
}

export function createDefaultSceneDocument(): ObsSceneDocument {
  return {
    version: 1,
    canvas: { width: 1920, height: 1080 },
    activeSceneId: 'scene_main',
    globalLayerIds: [],
    sceneOrder: ['scene_main'],
    scenes: {
      scene_main: {
        id: 'scene_main',
        name: '主场景',
        layerIds: [],
        transition: 'fade',
      },
    },
    layers: {},
  }
}

function normalizeGamepadType(raw: unknown): GamepadType {
  if (raw === 'ps' || raw === 'ps5') return 'ps'
  if (raw === 'nintendo' || raw === 'switch') return 'nintendo'
  return 'xbox'
}

export function normalizeGamepadParams(raw?: Partial<GamepadWidgetParams>): GamepadWidgetParams {
  const type = normalizeGamepadType(raw?.type)
  const rawBodyId = typeof raw?.bodyId === 'string' ? raw.bodyId.trim() : ''
  const bodyId = rawBodyId === 'xbox-black' ? 'xsx-black' : rawBodyId
  const rawViewBox = typeof raw?.viewBox === 'string' ? raw.viewBox.trim() : ''
  const viewBox = rawViewBox === '0 0 800 600' ? '' : rawViewBox
  const rawSens = Number(raw?.stickSensitivity)
  const stickSensitivity = Number.isFinite(rawSens) && rawSens > 1 ? rawSens : 15
  return {
    type,
    bodyId,
    pressedColor: typeof raw?.pressedColor === 'string' ? raw.pressedColor : '#10b981',
    viewBox,
    stickSensitivity,
  }
}

export function normalizeSceneDocument(raw: unknown): ObsSceneDocument {
  const fallback = createDefaultSceneDocument()
  if (!raw || typeof raw !== 'object') return fallback
  const obj = raw as Partial<ObsSceneDocument>

  const canvasWidth = Number(obj.canvas?.width)
  const canvasHeight = Number(obj.canvas?.height)
  const canvas = {
    width: Number.isFinite(canvasWidth) && canvasWidth >= 320 ? Math.round(canvasWidth) : 1920,
    height: Number.isFinite(canvasHeight) && canvasHeight >= 240 ? Math.round(canvasHeight) : 1080,
    background: typeof obj.canvas?.background === 'string' ? obj.canvas.background : undefined,
  }

  const layers: Record<string, ObsSceneLayer> = {}
  if (obj.layers && typeof obj.layers === 'object') {
    for (const [id, layer] of Object.entries(obj.layers)) {
      if (layer && typeof layer === 'object' && typeof layer.type === 'string') {
        const normalized = {
          ...layer,
          id,
          visible: layer.visible !== false,
          locked: Boolean(layer.locked),
          opacity: typeof layer.opacity === 'number' ? Math.min(1, Math.max(0, layer.opacity)) : 1,
          rotation: typeof layer.rotation === 'number' ? layer.rotation : 0,
          maskShape: normalizeMaskShape(layer.maskShape),
        } as ObsSceneLayer
        if (normalized.type === 'vtsuru-widget' && normalized.widget?.componentId === 'gamepad') {
          normalized.widget = {
            ...normalized.widget,
            gamepadParams: normalizeGamepadParams(normalized.widget.gamepadParams),
          }
        }
        if (normalized.type === 'group') {
          const rawGroup = normalized.group
          normalized.group = {
            childIds: Array.isArray(rawGroup?.childIds)
              ? rawGroup.childIds.filter((cid): cid is string => typeof cid === 'string' && cid !== id)
              : [],
            clipContent: Boolean(rawGroup?.clipContent),
            scaleChildren: rawGroup?.scaleChildren !== false,
            collapsed: Boolean(rawGroup?.collapsed),
          }
        }
        layers[id] = normalized
      }
    }
  }

  // 保证树结构单一归属与无环：先清理所有组的非法/重复/环引用子节点，再从顶层列表剔除已归属子树的节点
  const claimedAsChild = new Set<string>()
  const sanitizeGroupChildren = (groupId: string, ancestors: Set<string>) => {
    const node = layers[groupId]
    if (!node || node.type !== 'group') return
    const nextIds: string[] = []
    for (const cid of node.group.childIds) {
      if (!layers[cid] || ancestors.has(cid) || claimedAsChild.has(cid)) continue
      claimedAsChild.add(cid)
      nextIds.push(cid)
      if (layers[cid].type === 'group') {
        ancestors.add(cid)
        sanitizeGroupChildren(cid, ancestors)
        ancestors.delete(cid)
      }
    }
    node.group.childIds = nextIds
  }
  for (const [id, layer] of Object.entries(layers)) {
    if (layer.type === 'group' && !claimedAsChild.has(id)) {
      sanitizeGroupChildren(id, new Set([id]))
    }
  }

  const scenes: Record<string, ObsSceneItem> = {}
  if (obj.scenes && typeof obj.scenes === 'object') {
    for (const [id, sc] of Object.entries(obj.scenes)) {
      if (!sc || typeof sc !== 'object') continue
      scenes[id] = {
        id,
        name: typeof sc.name === 'string' && sc.name.trim() ? sc.name.trim() : '未命名场景',
        layerIds: Array.isArray(sc.layerIds)
          ? [...new Set(sc.layerIds.filter((lid) => Boolean(layers[lid]) && !claimedAsChild.has(lid)))]
          : [],
        transition:
          sc.transition === 'none' || sc.transition === 'fade' || sc.transition === 'slide-up' || sc.transition === 'scale'
            ? sc.transition
            : 'fade',
        obsSceneBinding: typeof sc.obsSceneBinding === 'string' ? sc.obsSceneBinding : undefined,
      }
    }
  }

  const sceneKeys = Object.keys(scenes)
  if (sceneKeys.length === 0) {
    scenes.scene_main = fallback.scenes.scene_main
    sceneKeys.push('scene_main')
  }

  const sceneOrder = Array.isArray(obj.sceneOrder)
    ? [...new Set([...obj.sceneOrder.filter((id) => Boolean(scenes[id])), ...sceneKeys])]
    : sceneKeys

  const activeSceneId =
    typeof obj.activeSceneId === 'string' && scenes[obj.activeSceneId]
      ? obj.activeSceneId
      : sceneOrder[0]

  const globalLayerIds = Array.isArray(obj.globalLayerIds)
    ? [...new Set(obj.globalLayerIds.filter((lid) => Boolean(layers[lid]) && !claimedAsChild.has(lid)))]
    : []

  return {
    version: 1,
    canvas,
    activeSceneId,
    globalLayerIds,
    sceneOrder,
    scenes,
    layers,
  }
}

export function formatCleanWidgetName(rawName: string): string {
  const cleaned = rawName.replace(/\s*[（(][A-Za-z0-9\s&/._+-]+[)）]\s*$/g, '').trim()
  return cleaned || rawName.trim()
}

export function createWidgetLayer(componentId: string, canvas: { width: number; height: number }): VtsuruWidgetLayer {
  const def = getObsComponentById(componentId)
  const size = parseResolution(def?.defaultResolution)
  const width = Math.min(size.width, Math.round(canvas.width * 0.6))
  const height = Math.min(size.height, Math.round(canvas.height * 0.6))
  const id = createShortId('w')

  return {
    id,
    name: formatCleanWidgetName(def?.name ?? componentId),
    type: 'vtsuru-widget',
    x: Math.round((canvas.width - width) / 2),
    y: Math.round((canvas.height - height) / 2),
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    widget: {
      componentId,
      configMode: 'shared',
      channelId: 'default',
      scaleMode: 'fit',
      ...(componentId === 'gamepad'
        ? {
            gamepadParams: {
              type: 'xbox' as GamepadType,
              bodyId: 'xsx-black',
              pressedColor: '#10b981',
              viewBox: '',
              stickSensitivity: 15,
            },
          }
        : {}),
    },
  }
}

export function createTextLayer(canvas: { width: number; height: number }): TextLayer {
  const width = 520
  const height = 120
  return {
    id: createShortId('txt'),
    name: '文本图层',
    type: 'text',
    x: Math.round((canvas.width - width) / 2),
    y: Math.round((canvas.height - height) / 2),
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    borderRadius: 8,
    text: {
      content: '欢迎来到直播间',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 44,
      fontWeight: 700,
      color: '#ffffff',
      align: 'center',
      lineHeight: 1.3,
      strokeWidth: 0,
      strokeColor: '#000000',
      shadow: '0 2px 12px rgba(0, 0, 0, 0.55)',
      backgroundColor: 'transparent',
      padding: 12,
    },
  }
}

export function createShapeLayer(canvas: { width: number; height: number }): ShapeLayer {
  const width = 460
  const height = 260
  return {
    id: createShortId('shp'),
    name: '装饰框',
    type: 'shape',
    x: Math.round((canvas.width - width) / 2),
    y: Math.round((canvas.height - height) / 2),
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    borderRadius: 16,
    shape: {
      fill: 'rgba(15, 23, 42, 0.55)',
      borderColor: 'rgba(255, 255, 255, 0.2)',
      borderWidth: 2,
      backdropBlur: 12,
    },
  }
}

export function createImageLayer(
  canvas: { width: number; height: number },
  url = '',
  naturalWidth = 480,
  naturalHeight = 320,
  name = '图片图层',
): ImageLayer {
  const scale = Math.min(1, (canvas.width * 0.5) / Math.max(1, naturalWidth), (canvas.height * 0.5) / Math.max(1, naturalHeight))
  const width = Math.max(80, Math.round(naturalWidth * scale))
  const height = Math.max(80, Math.round(naturalHeight * scale))
  return {
    id: createShortId('img'),
    name,
    type: 'image',
    x: Math.round((canvas.width - width) / 2),
    y: Math.round((canvas.height - height) / 2),
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    borderRadius: 0,
    image: {
      url,
      objectFit: 'contain',
    },
  }
}

export function createVideoLayer(canvas: { width: number; height: number }, url = ''): VideoLayer {
  const width = 640
  const height = 360
  return {
    id: createShortId('vid'),
    name: '视频图层',
    type: 'video',
    x: Math.round((canvas.width - width) / 2),
    y: Math.round((canvas.height - height) / 2),
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    borderRadius: 0,
    video: {
      url,
      objectFit: 'cover',
      loop: true,
      muted: true,
    },
  }
}

export function createIframeLayer(canvas: { width: number; height: number }, url = ''): IframeLayer {
  const width = 640
  const height = 360
  return {
    id: createShortId('web'),
    name: '外部网页源',
    type: 'iframe',
    x: Math.round((canvas.width - width) / 2),
    y: Math.round((canvas.height - height) / 2),
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    borderRadius: 0,
    iframe: {
      url,
      interactable: false,
    },
  }
}

export function createObsModuleLayer(
  moduleId: ObsModuleId,
  canvas: { width: number; height: number },
): ObsModuleLayer {
  const meta = getObsModuleById(moduleId)
  const width = Math.min(meta?.defaultWidth ?? 460, Math.round(canvas.width * 0.65))
  const height = Math.min(meta?.defaultHeight ?? 480, Math.round(canvas.height * 0.75))
  return {
    id: createShortId('mod'),
    name: meta?.name ?? moduleId,
    type: 'obs-module',
    x: Math.round((canvas.width - width) / 2),
    y: Math.round((canvas.height - height) / 2),
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    borderRadius: moduleId === 'question-display' || moduleId === 'danmaku-vote' ? 20 : 0,
    disableShadow: false,
    module: {
      moduleId,
      style: moduleId === 'live-lottery' ? 'slate' : moduleId === 'danmaku-vote' ? 'glass' : 'classic',
      lotteryMode: 'card',
      speedMultiplier: 1,
      maxDisplay: 6,
      voteLayout: 'auto',
      danmujiPreset: 'classic',
      danmujiFontSize: 18,
      danmujiOpacity: 1,
      danmujiReverse: true,
      danmujiPinned: false,
      danmujiAutoHide: 0,
      danmujiPinnedMinPrice: 30,
    },
  }
}

export function createMarqueeLayer(
  canvas: { width: number; height: number },
  mode: 'text' | 'image' = 'text',
): MarqueeLayer {
  const width = mode === 'text' ? 960 : 880
  const height = mode === 'text' ? 76 : 160
  return {
    id: createShortId('mq'),
    name: mode === 'text' ? '文字走马灯' : '图片走马灯',
    type: 'marquee',
    x: Math.round((canvas.width - width) / 2),
    y: Math.round((canvas.height - height) / 2),
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    borderRadius: 12,
    disableShadow: false,
    marquee: {
      mode,
      direction: 'left',
      speed: 80,
      gap: mode === 'text' ? 48 : 24,
      items: ['欢迎来到直播间，点个关注不迷路', '今日直播内容：杂谈 + 互动点歌', '投喂或上舰可在弹幕机触发专属特效'],
      separator: '✦',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: 28,
      fontWeight: 700,
      color: '#ffffff',
      strokeWidth: 0,
      strokeColor: '#000000',
      shadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
      backgroundColor: mode === 'text' ? 'rgba(15, 23, 42, 0.58)' : 'transparent',
      padding: 12,
      images: [],
      imageHeight: 120,
      imageRadius: 10,
    },
  }
}

export function createSlideshowLayer(canvas: { width: number; height: number }): SlideshowLayer {
  const width = 480
  const height = 270
  return {
    id: createShortId('sld'),
    name: '图片轮播',
    type: 'slideshow',
    x: Math.round((canvas.width - width) / 2),
    y: Math.round((canvas.height - height) / 2),
    width,
    height,
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    borderRadius: 12,
    disableShadow: false,
    slideshow: {
      images: [],
      intervalSec: 5,
      transition: 'fade',
      objectFit: 'cover',
      showDots: true,
      backgroundColor: 'rgba(15, 23, 42, 0.35)',
    },
  }
}

export function createGroupLayer(
  name: string,
  rect: { x: number; y: number; width: number; height: number },
  childIds: string[],
): GroupLayer {
  return {
    id: createShortId('grp'),
    name,
    type: 'group',
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.max(24, Math.round(rect.width)),
    height: Math.max(24, Math.round(rect.height)),
    rotation: 0,
    opacity: 1,
    visible: true,
    locked: false,
    borderRadius: 0,
    disableShadow: false,
    group: {
      childIds: [...childIds],
      clipContent: false,
      scaleChildren: true,
      collapsed: false,
    },
  }
}

export function documentRequiresAuthToken(doc: ObsSceneDocument): boolean {
  for (const layer of Object.values(doc.layers)) {
    if (layer.type === 'obs-module') {
      const meta = getObsModuleById(layer.module.moduleId)
      if (meta?.requiresToken) return true
    }
  }
  return false
}

export function buildObsScenePlayerUrl(shareKey: string, origin?: string, authToken?: string): string {
  const host = origin || (typeof window !== 'undefined' ? window.location.origin : '')
  const base = `${host}/obs/scene?key=${encodeURIComponent(shareKey)}`
  if (authToken && authToken.trim()) {
    return `${base}&token=${encodeURIComponent(authToken.trim())}`
  }
  return base
}

export function isSafeHttpUrl(raw: string): boolean {
  const trimmed = raw.trim()
  if (!trimmed) return true
  try {
    const u = new URL(trimmed)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
