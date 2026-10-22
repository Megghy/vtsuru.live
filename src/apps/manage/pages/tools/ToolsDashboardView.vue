<script setup lang="ts">
import {
  AlbumsOutline as StitchIcon,
  Cloud,
  ColorPaletteOutline as StickerIcon,
  ColorWandOutline as RemoveBgIcon,
  DesktopOutline,
  DocumentTextOutline as TextIcon,
  FilmOutline as MediaIcon,
  ImagesOutline as NineGridIcon,
  ImageOutline as CompressIcon,
  LanguageOutline as TranslateIcon,
  QrCodeOutline as QrcodeIcon,
  ScanOutline as OcrIcon,
  VideocamOutline as CoverIcon,
} from '@vicons/ionicons5'
import { useRoute, useRouter } from 'vue-router'

import { getToolRouteName } from '@/app/router/toolRoutes'
import type { ToolKey } from '@/app/router/toolRoutes'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { Card } from '@/shared/ui/card'

const route = useRoute()
const router = useRouter()

type RunMode = 'local' | 'cloud' | 'both'

interface ToolDefinition {
  name: ToolKey
  displayName: string
  description: string
  icon?: any
  mode: RunMode
}

interface ToolCategory {
  label: string
  tools: ToolDefinition[]
}

const categories: ToolCategory[] = [
  {
    label: '音视频处理',
    tools: [
      {
        name: 'MediaConvert',
        displayName: '音视频转换/压缩',
        description: '基于本地 FFmpeg 转换格式、压缩体积、截取片段和提取音频。',
        icon: MediaIcon,
        mode: 'local',
      },
    ],
  },
  {
    label: '图片处理',
    tools: [
      {
        name: 'DynamicNineGrid',
        displayName: '动态九图生成器',
        description: '快速创建用于B站动态的九宫格图片，支持自定义拼接。',
        icon: NineGridIcon,
        mode: 'local',
      },
      {
        name: 'ImageStitch',
        displayName: '图片拼接',
        description: '可视化拖拽排序，生成长图、横向对比图和多列网格拼图。',
        icon: StitchIcon,
        mode: 'local',
      },
      {
        name: 'ImageCompress',
        displayName: '图片压缩/格式转换',
        description: '一站式处理图片尺寸和格式，适配B站各处限制。',
        icon: CompressIcon,
        mode: 'local',
      },
      {
        name: 'StickerMaker',
        displayName: '表情包制作',
        description: '裁剪、加文字、调整尺寸，导出符合B站表情包规格。',
        icon: StickerIcon,
        mode: 'local',
      },
      {
        name: 'RemoveBg',
        displayName: '去背景',
        description: '通过 AI 在本地去除图片背景',
        icon: RemoveBgIcon,
        mode: 'local',
      },
    ],
  },
  {
    label: '设计制作',
    tools: [
      {
        name: 'CoverMaker',
        displayName: '直播封面生成器',
        description: '模板化制作直播封面，预设B站推荐尺寸，支持文字和立绘合成。',
        icon: CoverIcon,
        mode: 'local',
      },
      {
        name: 'TextToImage',
        displayName: '文字转图片',
        description: '长文转图片发动态，自定义字体、背景和排版样式。',
        icon: TextIcon,
        mode: 'local',
      },
    ],
  },
  {
    label: '实用工具',
    tools: [
      {
        name: 'Qrcode',
        displayName: '二维码生成',
        description: '生成直播间、粉丝群等链接的二维码图片。',
        icon: QrcodeIcon,
        mode: 'local',
      },
      {
        name: 'Ocr',
        displayName: '文字识别 (OCR)',
        description: '基于 PP-OCRv5，从图片中提取文字，支持中英日韩等多语言。',
        icon: OcrIcon,
        mode: 'local',
      },
      {
        name: 'Translate',
        displayName: '翻译工具',
        description: '支持浏览器内置翻译和云端 AI 翻译，中英日韩等多语言互译。',
        icon: TranslateIcon,
        mode: 'both',
      },
    ],
  },
]

function navigateToTool(key: ToolKey) {
  const isOpenLive = route.path.startsWith('/open-live')
  router.push({
    name: getToolRouteName(key, isOpenLive ? 'open-live' : 'manage'),
    query: isOpenLive ? route.query : undefined,
  })
}
</script>

<template>
  <div class="space-y-6 w-full">
    <ManagePageHeader
      title="直播工具箱"
      subtitle="常用工具快捷入口"
    />

    <div
      v-for="cat in categories"
      :key="cat.label"
      class="space-y-3"
    >
      <h3 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {{ cat.label }}
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        <Card
          v-for="tool in cat.tools"
          :key="tool.name"
          class="p-3.5 hover:border-brand/40 hover:bg-muted/30 cursor-pointer transition-all flex flex-col justify-between space-y-2 group"
          @click="navigateToTool(tool.name)"
        >
          <div class="flex items-start gap-3">
            <div
              class="p-2 rounded-lg bg-muted text-foreground group-hover:text-brand group-hover:bg-brand-soft/20 transition-colors shrink-0"
            >
              <component
                :is="tool.icon"
                class="h-5 w-5"
              />
            </div>
            <div class="min-w-0 flex-1 space-y-1">
              <div class="text-sm font-semibold text-foreground group-hover:text-brand transition-colors">
                {{ tool.displayName }}
              </div>
              <div class="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {{ tool.description }}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5 pt-1 text-muted-foreground justify-end text-[11px]">
            <span
              v-if="tool.mode === 'local' || tool.mode === 'both'"
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/60"
              title="本地运行"
            >
              <component
                :is="DesktopOutline"
                class="h-3 w-3"
              />
              本地
            </span>
            <span
              v-if="tool.mode === 'cloud' || tool.mode === 'both'"
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/60"
              title="云端支持"
            >
              <component
                :is="Cloud"
                class="h-3 w-3"
              />
              云端
            </span>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
