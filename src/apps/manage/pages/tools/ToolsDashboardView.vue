<script setup lang="ts">
import { useRouter } from 'vue-router'

import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'

const router = useRouter()

type RunMode = 'local' | 'cloud' | 'both'
interface ToolDefinition { name: string; displayName: string; description: string; routeName: string; icon: string; mode: RunMode }
interface ToolCategory { label: string; tools: ToolDefinition[] }

const categories: ToolCategory[] = [
  { label: '音视频处理', tools: [{ name: 'MediaConvert', displayName: '音视频转换/压缩', description: '基于本地 FFmpeg 转换格式、压缩体积、截取片段和提取音频。', routeName: 'ManageToolMediaConvert', icon: 'i-lucide-film', mode: 'local' }] },
  { label: '图片处理', tools: [
    { name: 'DynamicNineGrid', displayName: '动态九图生成器', description: '快速创建用于B站动态的九宫格图片，支持自定义拼接。', routeName: 'ManageToolDynamicNineGrid', icon: 'i-lucide-images', mode: 'local' },
    { name: 'ImageStitch', displayName: '图片拼接', description: '可视化拖拽排序，生成长图、横向对比图和多列网格拼图。', routeName: 'ManageToolImageStitch', icon: 'i-lucide-panels-top-left', mode: 'local' },
    { name: 'ImageCompress', displayName: '图片压缩/格式转换', description: '一站式处理图片尺寸和格式，适配B站各处限制。', routeName: 'ManageToolImageCompress', icon: 'i-lucide-image', mode: 'local' },
    { name: 'StickerMaker', displayName: '表情包制作', description: '裁剪、加文字、调整尺寸，导出符合B站表情包规格。', routeName: 'ManageToolStickerMaker', icon: 'i-lucide-palette', mode: 'local' },
    { name: 'RemoveBg', displayName: '去背景', description: '通过 AI 在本地去除图片背景', routeName: 'tools-remove-bg', icon: 'i-lucide-wand-sparkles', mode: 'local' },
  ] },
  { label: '设计制作', tools: [
    { name: 'CoverMaker', displayName: '直播封面生成器', description: '模板化制作直播封面，预设B站推荐尺寸，支持文字和立绘合成。', routeName: 'ManageToolCoverMaker', icon: 'i-lucide-video', mode: 'local' },
    { name: 'TextToImage', displayName: '文字转图片', description: '长文转图片发动态，自定义字体、背景和排版样式。', routeName: 'ManageToolTextToImage', icon: 'i-lucide-file-text', mode: 'local' },
  ] },
  { label: '实用工具', tools: [
    { name: 'Qrcode', displayName: '二维码生成', description: '生成直播间、粉丝群等链接的二维码图片。', routeName: 'ManageToolQrcode', icon: 'i-lucide-qr-code', mode: 'local' },
    { name: 'Ocr', displayName: '文字识别 (OCR)', description: '基于 PP-OCRv5，从图片中提取文字，支持中英日韩等多语言。', routeName: 'ManageToolOcr', icon: 'i-lucide-scan-text', mode: 'local' },
    { name: 'Translate', displayName: '翻译工具', description: '支持浏览器内置翻译和云端 AI 翻译，中英日韩等多语言互译。', routeName: 'ManageToolTranslate', icon: 'i-lucide-languages', mode: 'both' },
  ] },
]
</script>

<template>
  <div class="tools-dashboard">
    <ManagePageHeader title="直播工具箱" subtitle="常用工具快捷入口" />
    <section v-for="category in categories" :key="category.label" class="tool-category">
      <h2>{{ category.label }}</h2>
      <div class="tool-grid">
        <button v-for="tool in category.tools" :key="tool.name" class="tool-card" type="button" @click="router.push({ name: tool.routeName })">
          <span class="tool-card__icon"><UIcon :name="tool.icon" /></span>
          <span class="tool-card__body"><strong>{{ tool.displayName }}</strong><small>{{ tool.description }}</small></span>
          <span class="tool-card__badges">
            <UTooltip v-if="tool.mode !== 'cloud'" text="本地运行"><UIcon name="i-lucide-monitor" /></UTooltip>
            <UTooltip v-if="tool.mode !== 'local'" text="云端支持"><UIcon name="i-lucide-cloud" /></UTooltip>
          </span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.tools-dashboard,.tool-category,.tool-card__body { display:flex; flex-direction:column; }
.tools-dashboard { gap:24px; }.tool-category { gap:12px; }.tool-category h2 { margin:0; font-size:15px; }.tool-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:14px; }
.tool-card { position:relative; display:flex; align-items:flex-start; gap:14px; padding:16px; color:inherit; text-align:left; background:var(--vtsuru-bg-elevated); border:1px solid var(--vtsuru-border); border-radius:8px; cursor:pointer; }
.tool-card:hover { border-color:var(--vtsuru-brand); background:var(--vtsuru-brand-soft); }.tool-card__icon { display:grid; width:44px; height:44px; place-items:center; color:var(--vtsuru-brand); background:var(--vtsuru-bg-muted); border:1px solid var(--vtsuru-border); border-radius:8px; }.tool-card__icon :deep(svg) { width:24px;height:24px; }
.tool-card__body { gap:4px; padding-right:24px; }.tool-card__body strong { font-size:14px; }.tool-card__body small { color:var(--vtsuru-fg-muted); font-size:12px; line-height:1.4; }.tool-card__badges { position:absolute; top:8px; right:8px; display:flex; gap:6px; color:var(--vtsuru-fg-muted); }.tool-card__badges :deep(svg) { width:14px;height:14px; }
</style>
