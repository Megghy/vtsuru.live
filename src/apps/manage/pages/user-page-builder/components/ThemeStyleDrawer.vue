<script setup lang="ts">
import { Check, Code2, Palette, Sparkles, Trash2 } from 'lucide-vue-next'
import { computed, defineAsyncComponent, inject, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { PageThemeMode } from '@/apps/user-page/block/schema'
import { extractThemeFromImage, type ExtractedThemePalette } from '@/apps/user-page/colorExtraction'
import {
  resolveSiteTemplateId,
  SITE_TEMPLATES,
  type SiteTemplateId,
} from '@/apps/user-page/site-templates/registry'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { FormField } from '@/shared/ui/form-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { useMessage } from '@/shared/utils'

import { UserPageEditorKey } from '../context'
import BackgroundSettingsEditor, { type BackgroundSettingsTarget } from './BackgroundSettingsEditor.vue'
import ThemeAdvancedOptions, { type ThemeAppearanceTarget } from './ThemeAdvancedOptions.vue'
import ThemeTextColorEditor, { type ThemeTextColorTarget } from './ThemeTextColorEditor.vue'

const GlobalCssEditorModal = defineAsyncComponent(() => import('./GlobalCssEditorModal.vue'))

const show = defineModel<boolean>('show', { required: true })
const initialScope = defineModel<'global' | 'page'>('scope', { default: 'global' })

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const message = useMessage()
const account = useAccount()
const cssEditorVisible = ref(false)
const hasOpenedCssEditor = ref(false)
function openCssEditor() {
  hasOpenedCssEditor.value = true
  cssEditorVisible.value = true
}
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

const activeSiteTemplateId = computed<SiteTemplateId>({
  get: () => resolveSiteTemplateId(editor.settings.value.siteTemplate),
  set: (id) => {
    if (id === 'default') delete editor.settings.value.siteTemplate
    else editor.settings.value.siteTemplate = id
  },
})

function selectSiteTemplate(id: SiteTemplateId) {
  activeSiteTemplateId.value = id
  const tpl = SITE_TEMPLATES.find((item) => item.id === id)
  if (tpl) message.success(`已切换整站模板为「${tpl.name}」（保存并发布后生效）`)
}

const PAGE_BG_LEGACY_KEYS = [
  'pageBackgroundType',
  'pageBackgroundColor',
  'pageBackgroundImageFile',
  'pageBackgroundImageFit',
  'pageBackgroundCoverSidebar',
  'pageBackgroundBlurMode',
  'pageBackgroundBlur',
  'pageBackgroundScrimMode',
  'pageBackgroundScrimStrength',
] as const

function cleanupLegacyProjectTheme() {
  const project = editor.currentProject.value
  if (project?.theme && Object.keys(project.theme).length === 0) {
    delete project.theme
  }
}

function stripLegacyProjectBackgroundKeys() {
  const projectTheme = editor.currentProject.value?.theme as Record<string, any> | undefined
  if (!projectTheme) return
  PAGE_BG_LEGACY_KEYS.forEach((key) => {
    delete projectTheme[key]
  })
  cleanupLegacyProjectTheme()
}

function readPageThemeObject() {
  const pageTheme = editor.currentPage.value.theme as Record<string, any> | undefined
  const projectTheme = editor.currentProject.value?.theme as Record<string, any> | undefined
  if (!pageTheme && !projectTheme) return undefined
  return { ...projectTheme, ...pageTheme }
}

// --- 数据 Target 统一适配（页级统一写入 page.theme / page.background，兼容所有页面模式） ---
function ensureCurrentTheme(): Record<string, any> {
  if (isPageScope.value) {
    const pageTheme = (editor.currentPage.value.theme ??= {}) as Record<string, any>
    const projectTheme = editor.currentProject.value?.theme as Record<string, any> | undefined
    if (projectTheme) {
      for (const key of Object.keys(projectTheme)) {
        if ((PAGE_BG_LEGACY_KEYS as readonly string[]).includes(key)) continue
        if (pageTheme[key] === undefined) pageTheme[key] = projectTheme[key]
        delete projectTheme[key]
      }
      cleanupLegacyProjectTheme()
    }
    return pageTheme
  }
  return (editor.settings.value.theme ??= {}) as Record<string, any>
}

function cleanupCurrentTheme() {
  if (isPageScope.value) {
    const pageTheme = editor.currentPage.value.theme as Record<string, any> | undefined
    if (pageTheme && Object.keys(pageTheme).length === 0) {
      delete editor.currentPage.value.theme
    }
    cleanupLegacyProjectTheme()
    return
  }
  const theme = editor.settings.value.theme
  if (theme && Object.keys(theme).length === 0) {
    delete editor.settings.value.theme
  }
}

function deleteThemeKey(key: string) {
  if (isPageScope.value) {
    if (editor.currentPage.value.theme) delete (editor.currentPage.value.theme as Record<string, any>)[key]
    if (editor.currentProject.value?.theme) delete (editor.currentProject.value.theme as Record<string, any>)[key]
    cleanupCurrentTheme()
    return
  }
  if (editor.settings.value.theme) delete (editor.settings.value.theme as Record<string, any>)[key]
  cleanupCurrentTheme()
}

const backgroundTarget = computed<BackgroundSettingsTarget>(() => {
  if (isPageScope.value) {
    return {
      get: () => {
        const bg = editor.currentPage.value.background as Record<string, any> | undefined
        if (bg && Object.keys(bg).length > 0) return bg
        const legacyTheme = editor.currentProject.value?.theme as Record<string, any> | undefined
        return legacyTheme?.pageBackgroundType ? legacyTheme : bg
      },
      ensure: () => {
        const bg = (editor.currentPage.value.background ??= {}) as Record<string, any>
        const legacyTheme = editor.currentProject.value?.theme as Record<string, any> | undefined
        if (legacyTheme) {
          PAGE_BG_LEGACY_KEYS.forEach((key) => {
            if (bg[key] === undefined && legacyTheme[key] !== undefined) bg[key] = legacyTheme[key]
          })
          stripLegacyProjectBackgroundKeys()
        }
        return bg
      },
      uploadImage: () => {
        stripLegacyProjectBackgroundKeys()
        editor.triggerUploadPageBackgroundOverride()
      },
      clearImage: () => {
        editor.clearPageBackgroundOverrideImageFile()
        stripLegacyProjectBackgroundKeys()
      },
    }
  }
  return {
    get: () => editor.settings.value.background as Record<string, any> | undefined,
    ensure: () => (editor.settings.value.background ??= {}) as Record<string, any>,
    uploadImage: editor.triggerUploadGlobalBackground,
    clearImage: editor.clearGlobalBackgroundImageFile,
  }
})

const textColorTarget = computed<ThemeTextColorTarget>(() => ({
  get: () => (isPageScope.value ? readPageThemeObject() : editor.settings.value.theme),
  ensure: ensureCurrentTheme,
  cleanup: cleanupCurrentTheme,
}))

const appearanceTarget = computed<ThemeAppearanceTarget>(() => ({
  get: () => (isPageScope.value ? readPageThemeObject() : editor.settings.value.theme),
  ensure: ensureCurrentTheme,
  cleanup: cleanupCurrentTheme,
}))

function getThemeField(key: 'primaryColor' | 'backgroundColor') {
  return computed<string | undefined>({
    get: () => {
      const theme = isPageScope.value ? readPageThemeObject() : editor.settings.value.theme
      return typeof theme?.[key] === 'string' ? theme[key] : undefined
    },
    set: (value) => {
      if (value?.trim()) ensureCurrentTheme()[key] = value
      else deleteThemeKey(key)
    },
  })
}

const primaryColor = getThemeField('primaryColor')
const backgroundColor = getThemeField('backgroundColor')

const themeMode = computed<'auto' | 'light' | 'dark'>({
  get: () => {
    const theme = isPageScope.value ? readPageThemeObject() : editor.settings.value.theme
    const mode = theme?.pageThemeMode
    return mode === 'light' || mode === 'dark' ? mode : 'auto'
  },
  set: (value) => {
    if (value === 'auto') deleteThemeKey('pageThemeMode')
    else ensureCurrentTheme().pageThemeMode = value
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
  return backgroundTarget.value.get()?.pageBackgroundImageFile?.path ?? ''
})

function clearCurrentTheme() {
  if (isPageScope.value) {
    delete editor.currentPage.value.theme
    delete editor.currentPage.value.background
    const project = editor.currentProject.value
    if (project) delete project.theme
    message.success('已清除本页专属样式，恢复继承全局默认')
    return
  }
  delete editor.settings.value.theme
  message.success('已清空全局主题配置')
}
</script>

<template>
  <Sheet v-model:open="show">
    <SheetContent
      side="right"
      class="w-full sm:max-w-md p-0 flex flex-col"
    >
      <SheetHeader class="p-4 border-b border-border">
        <SheetTitle class="flex items-center gap-2 text-base">
          <component
            :is="Palette"
            class="size-5 text-primary"
          />
          <span>主页外观与主题</span>
        </SheetTitle>
      </SheetHeader>

      <div class="flex-1 overflow-y-auto scrollbar-thin p-4 flex flex-col gap-4">
        <!-- 作用域控制：主页时固定，子页时可选 -->
        <div class="bg-muted border border-border rounded-lg py-2.5 px-3.5">
          <template v-if="isCurrentHome">
            <div class="flex items-center gap-2">
              <Badge variant="default"> 全局主页 </Badge>
              <span class="block text-xs text-muted-foreground mt-1 leading-snug"
                >配置将直接应用到主页，并作为全站各页面的默认底色。</span
              >
            </div>
          </template>
          <template v-else>
            <div class="flex-between">
              <span class="text-[13px] font-medium">配置作用范围：</span>
              <ToggleGroup
                type="single"
                size="xs"
                :model-value="currentScope"
                @update:model-value="
                  (val) => {
                    if (val === 'global' || val === 'page') currentScope = val
                  }
                "
              >
                <ToggleGroupItem value="global">全局通用</ToggleGroupItem>
                <ToggleGroupItem value="page">本页专属</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <span class="block text-xs text-muted-foreground mt-1 leading-snug">
              {{
                isPageScope
                  ? '当前正在为当前子页面定制独立专属外观，将优先覆盖全局主题。'
                  : '当前正在编辑全局默认外观，未单独设置外观的子页面均会继承此配置。'
              }}
            </span>
          </template>
        </div>

        <!-- 整站展示模板（仅全局作用域） -->
        <div
          v-if="!isPageScope"
          class="flex flex-col gap-2"
        >
          <div class="flex-between">
            <span class="text-xs font-semibold text-foreground">整站展示模板</span>
            <span class="text-[11px] text-muted-foreground">作用于导航壳、全部子页与经典主页</span>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="tpl in SITE_TEMPLATES"
              :key="tpl.id"
              type="button"
              class="group relative flex flex-col gap-1.5 rounded-lg border p-2.5 text-left transition-colors duration-150"
              :class="
                activeSiteTemplateId === tpl.id
                  ? 'border-primary bg-primary/8'
                  : 'border-border bg-card hover:border-foreground/30 hover:bg-muted/50'
              "
              @click="selectSiteTemplate(tpl.id)"
            >
              <div class="flex-between gap-1.5">
                <div class="flex items-center gap-1">
                  <span
                    v-for="(swatch, sIdx) in tpl.previewSwatches"
                    :key="sIdx"
                    class="size-3 rounded-full border border-border/60"
                    :style="{ backgroundColor: swatch }"
                  />
                </div>
                <span class="text-[10px] text-muted-foreground">{{ tpl.shellLabel }}</span>
              </div>
              <div class="flex items-center justify-between gap-1">
                <span class="text-xs font-semibold text-foreground truncate">{{ tpl.name }}</span>
                <Check
                  v-if="activeSiteTemplateId === tpl.id"
                  class="size-3.5 text-primary shrink-0"
                />
              </div>
              <p class="text-[11px] leading-snug text-muted-foreground line-clamp-2 m-0">
                {{ tpl.tagline }}
              </p>
            </button>
          </div>
        </div>

        <!-- 智能提取板块 -->
        <div
          class="bg-primary/5 border border-dashed border-border rounded-lg py-2.5 px-3.5"
        >
          <div class="flex-between">
            <div class="flex items-center gap-1.5 font-semibold text-xs text-foreground">
              <Sparkles class="size-4 text-primary" />
              <span>智能提取配色</span>
            </div>
            <div class="flex items-center gap-1.5">
              <Button
                size="xs"
                variant="outline"
                :disabled="isExtracting || !avatarUrl"
                @click="runExtractFromUrl(avatarUrl, '头像')"
              >
                从头像提取
              </Button>
              <Button
                v-if="currentBackgroundImageUrl"
                size="xs"
                variant="outline"
                :disabled="isExtracting"
                @click="runExtractFromUrl(currentBackgroundImageUrl, '背景图')"
              >
                从壁纸提取
              </Button>
            </div>
          </div>

          <!-- 提取结果展示与一键应用 -->
          <div
            v-if="extractedResult"
            class="mt-2.5 pt-2 border-t border-border"
          >
            <div class="flex-between mb-2">
              <div class="flex items-center gap-1.5 text-xs font-medium">
                <span
                  class="inline-block size-3.5 rounded-full border border-border"
                  :style="{ backgroundColor: extractedResult.primaryColor }"
                />
                <span>主色：{{ extractedResult.primaryColor }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <Button
                  size="xs"
                  variant="outline"
                  @click="applyExtracted('light')"
                >
                  套用浅色
                </Button>
                <Button
                  size="xs"
                  @click="applyExtracted('dark')"
                >
                  套用深色
                </Button>
              </div>
            </div>

            <div
              v-if="extractedResult.swatches.length > 1"
              class="flex items-center gap-1.5 mt-1.5"
            >
              <span class="text-[11px] text-muted-foreground">候选色彩：</span>
              <Button
                v-for="swatch in extractedResult.swatches"
                :key="swatch"
                size="none"
                variant="outline"
                class="size-5 rounded border-border p-0 transition-transform duration-150 hover:scale-110"
                :style="{ backgroundColor: swatch }"
                :aria-label="`设为主题色 ${swatch}`"
                @click="applyCustomSwatch(swatch)"
              />
            </div>
          </div>
        </div>

        <!-- 推荐精选预设卡片 -->
        <div class="presets-section">
          <div class="text-xs font-semibold text-muted-foreground mb-2">推荐预设配色</div>
          <div class="grid grid-cols-3 gap-2">
            <Button
              v-for="preset in PRESET_THEMES"
              :key="preset.id"
              variant="outline"
              class="h-auto flex-col items-stretch bg-popover p-1.5 text-left font-normal"
              @click="applyPreset(preset)"
            >
              <div
                class="relative h-[38px] rounded border border-border flex-between px-2 mb-1"
                :style="{ backgroundColor: preset.backgroundColor }"
              >
                <span
                  class="size-3.5 rounded-full"
                  :style="{ backgroundColor: preset.primaryColor }"
                />
                <span
                  class="text-[13px] font-bold"
                  :style="{ color: preset.textColor }"
                >
                  Aa
                </span>
              </div>
              <div class="text-[11px] text-foreground text-center font-medium">{{ preset.name }}</div>
            </Button>
          </div>
        </div>

        <Separator class="my-1" />

        <!-- 三大选项卡配置 -->
        <Tabs
          v-model="activeTab"
          class="w-full"
        >
          <TabsList class="grid grid-cols-3 w-full">
            <TabsTrigger value="colors">色彩与模式</TabsTrigger>
            <TabsTrigger value="background">壁纸与背景</TabsTrigger>
            <TabsTrigger value="advanced">排版与质感</TabsTrigger>
          </TabsList>

          <TabsContent
            value="colors"
            class="pt-3 flex flex-col gap-3"
          >
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                label="主题主色"
                class="min-w-0"
              >
                <ColorPicker v-model="primaryColor" />
              </FormField>
              <FormField
                label="内容底色"
                class="min-w-0"
              >
                <ColorPicker v-model="backgroundColor" />
              </FormField>
            </div>

            <FormField label="主题模式">
              <Select v-model="themeMode">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="主题模式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">模板默认 / 跟随站点</SelectItem>
                  <SelectItem value="light">强制浅色</SelectItem>
                  <SelectItem value="dark">强制深色</SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <div class="pt-2 border-t border-border flex flex-col gap-2">
              <span class="text-xs font-semibold text-muted-foreground uppercase">文字与对比度</span>
              <ThemeTextColorEditor :target="textColorTarget" />
            </div>
          </TabsContent>

          <TabsContent
            value="background"
            class="pt-3"
          >
            <BackgroundSettingsEditor
              :target="backgroundTarget"
              :none-hint="isPageScope ? '未设置时继承全局默认壁纸背景。' : '未设置时使用站点默认背景。'"
            />
          </TabsContent>

          <TabsContent
            value="advanced"
            class="pt-3 flex flex-col gap-3"
          >
            <ThemeAdvancedOptions :target="appearanceTarget" />

            <div class="pt-2 border-t border-border">
              <SettingRow
                title="全局自定义 CSS"
                :badge="isPageScope ? '作用于全部页面' : undefined"
                :description="
                  editor.settings.value.customCss ? '已配置全局 CSS（实时同步到预览）' : '未配置全局 CSS'
                "
                variant="card"
              >
                <Button
                  variant="outline"
                  class="gap-1.5"
                  @click="openCssEditor"
                >
                  <Code2 class="size-3.5" />
                  编辑 CSS
                </Button>
              </SettingRow>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <SheetFooter class="p-3 border-t border-border flex-between sm:justify-between">
        <Popconfirm
          title="确定要清空当前的样式与主题配置吗？"
          ok-text="确定清空"
          cancel-text="取消"
          @confirm="clearCurrentTheme"
        >
          <Button
            variant="destructive"
            class="gap-1.5"
          >
            <Trash2 class="size-3.5" />
            {{ isPageScope ? '重置为继承全局' : '清空当前主题' }}
          </Button>
        </Popconfirm>

        <Button
          class="gap-1.5"
          @click="show = false"
        >
          <Check class="size-3.5" />
          完成
        </Button>
      </SheetFooter>

      <GlobalCssEditorModal
        v-if="hasOpenedCssEditor"
        v-model:show="cssEditorVisible"
      />
    </SheetContent>
  </Sheet>
</template>
