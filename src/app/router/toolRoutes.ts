import type { RouteRecordRaw } from 'vue-router'

const tools = [
  {
    key: 'DynamicNineGrid',
    path: 'dynamic-nine-grid',
    manageName: 'ManageToolDynamicNineGrid',
    title: '动态九图生成器',
    component: async () => import('@/apps/manage/pages/tools/ToolDynamicNineGrid.vue'),
  },
  {
    key: 'ImageStitch',
    path: 'image-stitch',
    manageName: 'ManageToolImageStitch',
    title: '图片拼接',
    component: async () => import('@/apps/manage/pages/tools/ToolImageStitch.vue'),
  },
  {
    key: 'MediaConvert',
    path: 'media-convert',
    manageName: 'ManageToolMediaConvert',
    title: '音视频转换/压缩',
    component: async () => import('@/apps/manage/pages/tools/ToolMediaConvert.vue'),
  },
  {
    key: 'CoverMaker',
    path: 'cover-maker',
    manageName: 'ManageToolCoverMaker',
    title: '直播封面生成器',
    component: async () => import('@/apps/manage/pages/tools/ToolCoverMaker.vue'),
  },
  {
    key: 'TextToImage',
    path: 'text-to-image',
    manageName: 'ManageToolTextToImage',
    title: '文字转图片',
    component: async () => import('@/apps/manage/pages/tools/ToolTextToImage.vue'),
  },
  {
    key: 'StickerMaker',
    path: 'sticker-maker',
    manageName: 'ManageToolStickerMaker',
    title: '表情包制作',
    component: async () => import('@/apps/manage/pages/tools/ToolStickerMaker.vue'),
  },
  {
    key: 'ImageCompress',
    path: 'image-compress',
    manageName: 'ManageToolImageCompress',
    title: '图片压缩',
    component: async () => import('@/apps/manage/pages/tools/ToolImageCompress.vue'),
  },
  {
    key: 'Qrcode',
    path: 'qrcode',
    manageName: 'ManageToolQrcode',
    title: '二维码生成',
    component: async () => import('@/apps/manage/pages/tools/ToolQrcode.vue'),
  },
  {
    key: 'RemoveBg',
    path: 'remove-bg',
    manageName: 'tools-remove-bg',
    title: '去背景',
    component: async () => import('@/apps/manage/pages/tools/ToolRemoveBg.vue'),
  },
  {
    key: 'Ocr',
    path: 'ocr',
    manageName: 'ManageToolOcr',
    title: '文字识别 (OCR)',
    component: async () => import('@/apps/manage/pages/tools/ToolOcr.vue'),
  },
  {
    key: 'Translate',
    path: 'translate',
    manageName: 'ManageToolTranslate',
    title: '翻译工具',
    component: async () => import('@/apps/manage/pages/tools/ToolTranslate.vue'),
  },
] as const

export type ToolKey = (typeof tools)[number]['key']
export type ToolRouteScope = 'manage' | 'open-live'

export function getToolRouteName(key: ToolKey, scope: ToolRouteScope) {
  const tool = tools.find((item) => item.key === key)
  if (!tool) throw new Error(`未知工具: ${key}`)
  return scope === 'manage' ? tool.manageName : `open-live-tool-${tool.path}`
}

export function createToolRoutes(scope: ToolRouteScope): RouteRecordRaw[] {
  const parent = scope === 'manage' ? 'manage-tools-dashboard' : 'open-live-tools'

  return tools.map((tool) => ({
    path: `tools/${tool.path}`,
    name: getToolRouteName(tool.key, scope),
    component: tool.component,
    meta: {
      title: tool.title,
      parent,
      pageWidth: 'xl',
      openLiveAuth: scope === 'open-live' ? false : undefined,
    },
  }))
}
