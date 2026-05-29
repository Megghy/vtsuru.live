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
import { NGrid, NGridItem, NIcon, NText, NTooltip } from 'naive-ui'
import { useRouter } from 'vue-router'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'

const router = useRouter()

type RunMode = 'local' | 'cloud' | 'both'

interface ToolDefinition {
  name: string
  displayName: string
  description: string
  routeName: string
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
      { name: 'MediaConvert', displayName: '音视频转换/压缩', description: '基于本地 FFmpeg 转换格式、压缩体积、截取片段和提取音频。', routeName: 'ManageToolMediaConvert', icon: MediaIcon, mode: 'local' },
    ],
  },
  {
    label: '图片处理',
    tools: [
      { name: 'DynamicNineGrid', displayName: '动态九图生成器', description: '快速创建用于B站动态的九宫格图片，支持自定义拼接。', routeName: 'ManageToolDynamicNineGrid', icon: NineGridIcon, mode: 'local' },
      { name: 'ImageStitch', displayName: '图片拼接', description: '可视化拖拽排序，生成长图、横向对比图和多列网格拼图。', routeName: 'ManageToolImageStitch', icon: StitchIcon, mode: 'local' },
      { name: 'ImageCompress', displayName: '图片压缩/格式转换', description: '一站式处理图片尺寸和格式，适配B站各处限制。', routeName: 'ManageToolImageCompress', icon: CompressIcon, mode: 'local' },
      { name: 'StickerMaker', displayName: '表情包制作', description: '裁剪、加文字、调整尺寸，导出符合B站表情包规格。', routeName: 'ManageToolStickerMaker', icon: StickerIcon, mode: 'local' },
      { name: 'RemoveBg', displayName: '去背景', description: '通过 AI 在本地去除图片背景', routeName: 'tools-remove-bg', icon: RemoveBgIcon, mode: 'local' },
    ],
  },
  {
    label: '设计制作',
    tools: [
      { name: 'CoverMaker', displayName: '直播封面生成器', description: '模板化制作直播封面，预设B站推荐尺寸，支持文字和立绘合成。', routeName: 'ManageToolCoverMaker', icon: CoverIcon, mode: 'local' },
      { name: 'TextToImage', displayName: '文字转图片', description: '长文转图片发动态，自定义字体、背景和排版样式。', routeName: 'ManageToolTextToImage', icon: TextIcon, mode: 'local' },
    ],
  },
  {
    label: '实用工具',
    tools: [
      { name: 'Qrcode', displayName: '二维码生成', description: '生成直播间、粉丝群等链接的二维码图片。', routeName: 'ManageToolQrcode', icon: QrcodeIcon, mode: 'local' },
      { name: 'Ocr', displayName: '文字识别 (OCR)', description: '基于 PP-OCRv5，从图片中提取文字，支持中英日韩等多语言。', routeName: 'ManageToolOcr', icon: OcrIcon, mode: 'local' },
      { name: 'Translate', displayName: '翻译工具', description: '支持浏览器内置翻译和云端 AI 翻译，中英日韩等多语言互译。', routeName: 'ManageToolTranslate', icon: TranslateIcon, mode: 'both' },
    ],
  },
]

function navigateToTool(routeName: string) {
  router.push({ name: routeName })
}
</script>

<template>
  <div class="tools-dashboard">
    <ManagePageHeader title="直播工具箱" subtitle="常用工具快捷入口" />

    <div v-for="cat in categories" :key="cat.label" class="tool-category">
      <NText strong class="category-label">
        {{ cat.label }}
      </NText>
      <NGrid cols="1 s:2 m:3 l:3 xl:4" responsive="screen" :x-gap="14" :y-gap="14">
        <NGridItem v-for="tool in cat.tools" :key="tool.name">
          <div class="tool-card" @click="navigateToTool(tool.routeName)">
            <div class="tool-card__icon">
              <NIcon :component="tool.icon" size="24" />
            </div>
            <div class="tool-card__body">
              <NText strong style="font-size: 14px">
                {{ tool.displayName }}
              </NText>
              <NText depth="3" style="font-size: 12px; line-height: 1.4">
                {{ tool.description }}
              </NText>
            </div>
            <div class="tool-card__badges">
              <NTooltip v-if="tool.mode === 'local' || tool.mode === 'both'">
                <template #trigger>
                  <NIcon :component="DesktopOutline" size="13" class="badge badge-local" />
                </template>
                本地运行
              </NTooltip>
              <NTooltip v-if="tool.mode === 'cloud' || tool.mode === 'both'">
                <template #trigger>
                  <NIcon :component="Cloud" size="13" class="badge badge-cloud" />
                </template>
                云端支持
              </NTooltip>
            </div>
          </div>
        </NGridItem>
      </NGrid>
    </div>
  </div>
</template>

<style scoped>
.tools-dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.tool-category {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.category-label {
  font-size: 15px;
  padding-left: 2px;
}

.tool-card {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--n-border-color);
  border-radius: 10px;
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.2s, border-color 0.2s;
}
.tool-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
  border-color: var(--primary-color, #18a058);
}

.tool-card__badges {
  position: absolute;
  top: 6px;
  right: 8px;
  display: flex;
  gap: 3px;
}
.badge {
  opacity: 0.5;
  transition: opacity 0.2s;
}
.tool-card:hover .badge {
  opacity: 0.8;
}
.badge-local {
  color: var(--primary-color, #18a058);
}
.badge-cloud {
  color: #2080f0;
}

.tool-card__icon {
  flex: none;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  background: var(--n-color-embedded);
  border: 1px solid var(--n-border-color);
  color: var(--primary-color, #18a058);
}

.tool-card__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>
