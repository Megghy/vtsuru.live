<script setup lang="ts">
import {
  ArrowUndoOutline,
  CheckmarkOutline,
  CodeSlashOutline,
  ColorPaletteOutline,
  ContrastOutline,
  ImageOutline,
  RefreshOutline,
  SparklesOutline,
  TextOutline,
  TrashOutline,
} from '@vicons/ionicons5'
import { computed, inject, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { BlockPageTheme, PageThemeMode } from '@/apps/user-page/block/schema'
import { extractThemeFromImage, type ExtractedThemePalette } from '@/apps/user-page/colorExtraction'
import type { UserPageAppearanceTheme } from '@/apps/user-page/themeConfig'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { Popconfirm } from '@/shared/ui/popconfirm'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/shared/ui/sheet'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/ui/tabs'
import { useMessage } from '@/shared/utils'

import { UserPageEditorKey } from '../context'
import BackgroundSettingsEditor, { type BackgroundSettingsTarget } from './BackgroundSettingsEditor.vue'
import GlobalCssEditorModal from './GlobalCssEditorModal.vue'
import ThemeAdvancedOptions, { type ThemeAppearanceTarget } from './ThemeAdvancedOptions.vue'
import ThemeTextColorEditor, { type ThemeTextColorTarget } from './ThemeTextColorEditor.vue'

const show = defineModel<boolean>('show', { required: true })
const initialScope = defineModel<'global' | 'page'>('scope', { default: 'global' })

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const message = useMessage()
const account = useAccount()
const cssEditorVisible = ref(false)
const activeTab = ref<'background' | 'colors' | 'advanced'>('colors')

// 作用域控制：在首页强制为 global，在子页可切换 global / page
const currentScope = ref<'global' | 'page'>('global')
const isCurrentHome = computed(() => editor.currentKey.value === 'home')

watch(
  show,
  (visible) => {
    if (visible) {
      currentScope.value = isCurrentHome.value ? 'global' : initialScope.value
    }
  },
  { immediate: true },
)

const isPageScope = computed(() => !isCurrentHome.value && currentScope.value === 'page')

// --- 数据 Target 统一适配 ---
function ensureCurrentTheme() {
  if (isPageScope.value) {
    const project = editor.currentProject.value
    if (!project) throw new Error('当前页面无可用区块工程')
    return (project.theme ??= {})
  }
  return ((editor.settings.value as any).theme ??= {})
}

function cleanupCurrentTheme() {
  if (isPageScope.value) {
    const project = editor.currentProject.value
    if (project?.theme && Object.keys(project.theme).length === 0) {
      delete project.theme
    }
    return
  }
  const theme = (editor.settings.value as any).theme
  if (theme && Object.keys(theme).length === 0) {
    delete (editor.settings.value as any).theme
  }
}

const backgroundTarget = computed<BackgroundSettingsTarget>(() => {
  if (isPageScope.value) {
    return {
      get: () => editor.currentProject.value?.theme,
      ensure: ensureCurrentTheme,
      uploadImage: editor.triggerUploadPageBackground,
      clearImage: editor.clearPageBackgroundImageFile,
    }
  }
  return {
    get: () => (editor.settings.value as any).background,
    ensure: () => ((editor.settings.value as any).background ??= {}),
    uploadImage: editor.triggerUploadGlobalBackground,
    clearImage: editor.clearGlobalBackgroundImageFile,
  }
})

const textColorTarget = computed<ThemeTextColorTarget>(() => ({
  get: () => (isPageScope.value ? editor.currentProject.value?.theme : (editor.settings.value as any).theme),
  ensure: ensureCurrentTheme,
  cleanup: cleanupCurrentTheme,
}))

const appearanceTarget = computed<ThemeAppearanceTarget>(() => ({
  get: () => (isPageScope.value ? editor.currentProject.value?.theme : (editor.settings.value as any).theme),
  ensure: ensureCurrentTheme,
  cleanup: cleanupCurrentTheme,
}))

function getThemeField(key: 'primaryColor' | 'backgroundColor') {
  return computed<string | undefined>({
    get: () => {
      const theme = isPageScope.value
        ? editor.currentProject.value?.theme
        : (editor.settings.value as any).theme
      return typeof theme?.[key] === 'string' ? theme[key] : undefined
    },
    set: (value) => {
      if (value?.trim()) ensureCurrentTheme()[key] = value
      else {
        const theme = isPageScope.value
          ? editor.currentProject.value?.theme
          : (editor.settings.value as any).theme
        if (theme) delete theme[key]
        cleanupCurrentTheme()
      }
    },
  })
}

const primaryColor = getThemeField('primaryColor')
const backgroundColor = getThemeField('backgroundColor')

const themeMode = computed<'auto' | 'light' | 'dark'>({
  get: () => {
    const theme = isPageScope.value
      ? editor.currentProject.value?.theme
      : (editor.settings.value as any).theme
    const mode = theme?.pageThemeMode
    return mode === 'light' || mode === 'dark' ? mode : 'auto'
  },
  set: (value) => {
    if (value === 'auto') {
      const theme = isPageScope.value
        ? editor.currentProject.value?.theme
        : (editor.settings.value as any).theme
      if (theme) delete theme.pageThemeMode
      cleanupCurrentTheme()
    } else {
      ensureCurrentTheme().pageThemeMode = value
    }
  },
})

// --- 预设主题方案 ---
interface PresetThemeItem {
  id: string
  name: string
  desc: string
  primaryColor: string
  backgroundColor: string
  textColor: string
  mode: PageThemeMode
  radius: number
  spacing: 'normal' | 'compact' | 'relaxed'
}

const PRESET_THEMES: PresetThemeItem[] = [
  {
    id: 'minimal',
    name: '极简黑白',
    desc: '纯粹高对比，适合极简与文字阅读',
    primaryColor: '#18181b',
    backgroundColor: '#ffffff',
    textColor: '#18181b',
    mode: 'light',
    radius: 12,
    spacing: 'normal',
  },
  {
    id: 'midnight',
    name: '暗夜沉浸',
    desc: '纯正黑夜科技风，保护视力',
    primaryColor: '#6366f1',
    backgroundColor: '#09090b',
    textColor: '#fafafa',
    mode: 'dark',
    radius: 14,
    spacing: 'normal',
  },
  {
    id: 'sakura',
    name: '甜系樱粉',
    desc: '日系柔美温暖，浅粉质感底',
    primaryColor: '#ec4899',
    backgroundColor: '#fff1f5',
    textColor: '#27272a',
    mode: 'light',
    radius: 16,
    spacing: 'normal',
  },
  {
    id: 'cyber',
    name: '赛博幻境',
    desc: '霓虹荧光青与暗蓝科技夜空',
    primaryColor: '#06b6d4',
    backgroundColor: '#0b1120',
    textColor: '#e2e8f0',
    mode: 'dark',
    radius: 14,
    spacing: 'relaxed',
  },
  {
    id: 'mint',
    name: '薄荷葱翠',
    desc: '清新自然薄荷绿，舒缓明亮',
    primaryColor: '#10b981',
    backgroundColor: '#f2fbf7',
    textColor: '#1f2937',
    mode: 'light',
    radius: 14,
    spacing: 'normal',
  },
  {
    id: 'amber',
    name: '暖阳落霞',
    desc: '温润琥珀与暖杏底色',
    primaryColor: '#f59e0b',
    backgroundColor: '#fffbf0',
    textColor: '#292524',
    mode: 'light',
    radius: 16,
    spacing: 'normal',
  },
]

function applyPreset(preset: PresetThemeItem) {
  const target = ensureCurrentTheme()
  target.primaryColor = preset.primaryColor
  target.backgroundColor = preset.backgroundColor
  target.textColor = preset.textColor
  target.pageThemeMode = preset.mode
  target.radius = preset.radius
  target.spacing = preset.spacing
  message.success(`已应用「${preset.name}」风格`)
}

// --- 智能色彩提取 ---
const isExtracting = ref(false)
const extractedResult = ref<ExtractedThemePalette | null>(null)
const avatarUrl = computed(() => {
  return account.value?.streamerInfo?.faceUrl || account.value?.faceUrl || ''
})

async function runExtractFromUrl(url: string, label: string) {
  if (!url) {
    message.warning(`未找到${label}图片`)
    return
  }
  isExtracting.value = true
  try {
    const res = await extractThemeFromImage(url)
    extractedResult.value = res
    message.success(`已从${label}分析提取到主题配色！`)
  } catch (error: any) {
    message.error(error.message || '色彩分析失败')
  } finally {
    isExtracting.value = false
  }
}

function applyExtracted(mode: 'light' | 'dark') {
  if (!extractedResult.value) return
  const res = extractedResult.value
  const target = ensureCurrentTheme()
  target.primaryColor = res.primaryColor
  target.backgroundColor = mode === 'dark' ? res.backgroundColorDark : res.backgroundColorLight
  target.textColor = mode === 'dark' ? res.textColorDark : res.textColorLight
  target.pageThemeMode = mode
  message.success(`已应用提取的${mode === 'dark' ? '暗色' : '亮色'}主题`)
}

function applyCustomSwatch(colorHex: string) {
  primaryColor.value = colorHex
  message.info(`已将主题色设为 ${colorHex}`)
}

// 从当前已上传背景提取
const currentBackgroundImageUrl = computed(() => {
  const bg = backgroundTarget.value.get()
  return bg?.pageBackgroundImageFile || ''
})

function clearCurrentTheme() {
  if (isPageScope.value) {
    const project = editor.currentProject.value
    if (project) delete project.theme
    message.success('已清除本页专属样式，恢复继承全局默认')
    return
  }
  delete (editor.settings.value as any).theme
  message.success('已清空全局主题配置')
}
</script>

<template>
  <Sheet v-model:open="show">
    <SheetContent side="right" class="w-full sm:max-w-md p-0 flex flex-col">
      <SheetHeader class="p-4 border-b border-border">
        <SheetTitle class="flex items-center gap-2 text-base font-semibold">
          <component :is="ColorPaletteOutline" class="size-5 text-primary" />
          <span>主页外观与主题</span>
        </SheetTitle>
      </SheetHeader>

      <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <!-- 作用域控制：主页时固定，子页时可选 -->
        <div class="scope-control-box">
          <template v-if="isCurrentHome">
            <div class="scope-tip">
              <Badge variant="default" class="text-xs">
                全局主页
              </Badge>
              <span class="scope-desc">配置将直接应用到主页，并作为全站各页面的默认底色。</span>
            </div>
          </template>
          <template v-else>
            <div class="flex items-center justify-between">
              <span class="scope-title">配置作用范围：</span>
              <div class="grid grid-cols-2 gap-1 bg-muted p-0.5 rounded-lg">
                <Button :variant="currentScope === 'global' ? 'default' : 'ghost'" class="px-2.5" @click="currentScope = 'global'">
                  全局通用
                </Button>
                <Button :variant="currentScope === 'page' ? 'default' : 'ghost'" class="px-2.5" @click="currentScope = 'page'">
                  本页专属
                </Button>
              </div>
            </div>
            <span class="scope-desc">
              {{
                isPageScope
                  ? '当前正在为当前子页面定制独立专属外观，将优先覆盖全局主题。'
                  : '当前正在编辑全局默认外观，未单独设置外观的子页面均会继承此配置。'
              }}
            </span>
          </template>
        </div>

        <!-- 智能提取板块 -->
        <div class="smart-extract-card">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5 font-semibold text-xs text-foreground">
              <component :is="SparklesOutline" class="size-4 text-primary" />
              <span>智能提取配色</span>
            </div>
            <div class="flex items-center gap-1.5">
              <Button variant="outline" class="h-6 px-2" :disabled="isExtracting || !avatarUrl" @click="runExtractFromUrl(avatarUrl, '头像')">
                从头像提取
              </Button>
              <Button v-if="currentBackgroundImageUrl" variant="outline" class="h-6 px-2" :disabled="isExtracting" @click="runExtractFromUrl(currentBackgroundImageUrl, '背景图')">
                从壁纸提取
              </Button>
            </div>
          </div>

          <!-- 提取结果展示与一键应用 -->
          <div
            v-if="extractedResult"
            class="extract-result"
          >
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-1.5 text-xs font-medium">
                <span
                  class="color-dot"
                  :style="{ backgroundColor: extractedResult.primaryColor }"
                />
                <span>主色：{{ extractedResult.primaryColor }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <Button variant="outline" class="h-6 px-2" @click="applyExtracted('light')">
                  套用浅色
                </Button>
                <Button class="h-6 px-2" @click="applyExtracted('dark')">
                  套用深色
                </Button>
              </div>
            </div>

            <div
              v-if="extractedResult.swatches.length > 1"
              class="swatches-row"
            >
              <span class="text-[11px] text-muted-foreground">候选色彩：</span>
              <button
                v-for="swatch in extractedResult.swatches"
                :key="swatch"
                type="button"
                class="swatch-btn"
                :style="{ backgroundColor: swatch }"
                :title="`设为主题色 ${swatch}`"
                @click="applyCustomSwatch(swatch)"
              />
            </div>
          </div>
        </div>

        <!-- 推荐精选预设卡片 -->
        <div class="presets-section">
          <div class="section-title">推荐预设配色</div>
          <div class="presets-grid">
            <button
              v-for="preset in PRESET_THEMES"
              :key="preset.id"
              type="button"
              class="preset-card"
              @click="applyPreset(preset)"
            >
              <div
                class="preset-preview"
                :style="{ backgroundColor: preset.backgroundColor }"
              >
                <span
                  class="preset-accent"
                  :style="{ backgroundColor: preset.primaryColor }"
                />
                <span
                  class="preset-text"
                  :style="{ color: preset.textColor }"
                >
                  Aa
                </span>
              </div>
              <div class="preset-name">{{ preset.name }}</div>
            </button>
          </div>
        </div>

        <div class="h-px bg-border my-1" />

        <!-- 三大选项卡配置 -->
        <Tabs v-model="activeTab" class="w-full">
          <TabsList class="grid grid-cols-3 w-full">
            <TabsTrigger value="colors" class="text-xs">色彩与模式</TabsTrigger>
            <TabsTrigger value="background" class="text-xs">壁纸与背景</TabsTrigger>
            <TabsTrigger value="advanced" class="text-xs">排版与质感</TabsTrigger>
          </TabsList>

          <TabsContent value="colors" class="pt-3 flex flex-col gap-3">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">主题主色</label>
                <ColorPicker v-model="primaryColor" />
              </div>
              <div class="flex flex-col gap-1">
                <label class="text-xs text-muted-foreground">内容底色</label>
                <ColorPicker v-model="backgroundColor" />
              </div>
            </div>

            <div class="flex flex-col gap-1">
              <label class="text-xs text-muted-foreground">主题模式</label>
              <Select v-model="themeMode">
                <SelectTrigger>
                  <SelectValue placeholder="主题模式" />
                </SelectTrigger>
                <SelectContent class="text-xs">
                  <SelectItem value="auto">跟随站点 (自适应)</SelectItem>
                  <SelectItem value="light">强制浅色</SelectItem>
                  <SelectItem value="dark">强制深色</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="pt-2 border-t border-border flex flex-col gap-2">
              <span class="text-xs font-semibold text-muted-foreground uppercase">文字与对比度</span>
              <ThemeTextColorEditor :target="textColorTarget" />
            </div>
          </TabsContent>

          <TabsContent value="background" class="pt-3">
            <BackgroundSettingsEditor
              :target="backgroundTarget"
              :none-hint="isPageScope ? '未设置时继承全局默认壁纸背景。' : '未设置时使用站点默认背景。'"
            />
          </TabsContent>

          <TabsContent value="advanced" class="pt-3 flex flex-col gap-3">
            <ThemeAdvancedOptions :target="appearanceTarget" />

            <div class="pt-2 border-t border-border flex flex-col gap-2">
              <span class="text-xs font-semibold text-muted-foreground uppercase">自定义 CSS</span>
              <div class="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted text-xs">
                <span class="text-muted-foreground">
                  {{ editor.settings.value.customCss ? '已配置全局 CSS' : '未配置全局 CSS' }}
                </span>
                <Button variant="outline" @click="cssEditorVisible = true">
                  <component :is="CodeSlashOutline" class="size-3.5 mr-1" />
                  编辑 CSS
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <SheetFooter class="p-3 border-t border-border flex items-center justify-between sm:justify-between">
        <Popconfirm
          title="确定要清空当前的样式与主题配置吗？"
          ok-text="确定清空"
          cancel-text="取消"
          @confirm="clearCurrentTheme"
        >
          <Button variant="destructive">
            <component :is="TrashOutline" class="size-3.5 mr-1" />
            {{ isPageScope ? '重置为继承全局' : '清空当前主题' }}
          </Button>
        </Popconfirm>

        <Button @click="show = false">
          <component :is="CheckmarkOutline" class="size-3.5 mr-1" />
          完成
        </Button>
      </SheetFooter>

      <GlobalCssEditorModal v-model:show="cssEditorVisible" />
    </SheetContent>
  </Sheet>
</template>

<style scoped>
.scope-control-box {
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 10px 14px;
}

.scope-tip {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scope-title {
  font-size: 13px;
  font-weight: 500;
}

.scope-desc {
  display: block;
  font-size: 12px;
  color: var(--muted-foreground);
  margin-top: 4px;
  line-height: 1.4;
}

.smart-extract-card {
  background: var(--brand-tint, rgba(99, 102, 241, 0.05));
  border: 1px dashed var(--border);
  border-radius: 8px;
  padding: 10px 14px;
}

.extract-result {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.color-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.swatches-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
}

.swatch-btn {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.15);
  cursor: pointer;
  padding: 0;
  transition: transform 0.15s ease;
}

.swatch-btn:hover {
  transform: scale(1.2);
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted-foreground);
  margin-bottom: 8px;
}

.presets-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.preset-card {
  display: flex;
  flex-direction: column;
  background: var(--popover);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}

.preset-card:hover {
  border-color: var(--primary);
  transform: translateY(-1px);
}

.preset-preview {
  position: relative;
  height: 38px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  margin-bottom: 4px;
}

.preset-accent {
  width: 14px;
  height: 14px;
  border-radius: 50%;
}

.preset-text {
  font-size: 13px;
  font-weight: 700;
}

.preset-name {
  font-size: 11px;
  color: var(--foreground);
  text-align: center;
  font-weight: 500;
}
</style>
