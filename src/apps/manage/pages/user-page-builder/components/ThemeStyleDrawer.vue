<script setup lang="ts">
import {
  ColorPaletteOutline,
  SparklesOutline,
  ImageOutline,
  ContrastOutline,
  TextOutline,
  CodeSlashOutline,
  TrashOutline,
  CheckmarkOutline,
  RefreshOutline,
  ArrowUndoOutline,
} from '@vicons/ionicons5'
import {
  NAlert,
  NButton,
  NColorPicker,
  NDivider,
  NDrawer,
  NDrawerContent,
  NFlex,
  NForm,
  NFormItem,
  NIcon,
  NPopconfirm,
  NRadio,
  NRadioButton,
  NRadioGroup,
  NScrollbar,
  NSelect,
  NSpin,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, inject, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { BlockPageTheme, PageThemeMode } from '@/apps/user-page/block/schema'
import { extractThemeFromImage, type ExtractedThemePalette } from '@/apps/user-page/colorExtraction'
import type { UserPageAppearanceTheme } from '@/apps/user-page/themeConfig'

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
  <NDrawer
    v-model:show="show"
    :width="460"
    placement="right"
    :mask="false"
    class="theme-style-drawer"
  >
    <NDrawerContent
      closable
      body-content-style="padding: 16px 20px;"
    >
      <template #header>
        <NFlex
          align="center"
          :size="8"
        >
          <NIcon
            size="20"
            color="var(--vtsuru-primary)"
          >
            <ColorPaletteOutline />
          </NIcon>
          <span style="font-weight: 600; font-size: 16px">主页外观与主题</span>
        </NFlex>
      </template>

      <!-- 作用域控制：主页时固定，子页时可选 -->
      <div class="scope-control-box">
        <template v-if="isCurrentHome">
          <div class="scope-tip">
            <NTag
              size="small"
              type="primary"
              secondary
              round
            >
              全局主页
            </NTag>
            <span class="scope-desc">配置将直接应用到主页，并作为全站各页面的默认底色。</span>
          </div>
        </template>
        <template v-else>
          <NFlex
            justify="space-between"
            align="center"
          >
            <span class="scope-title">配置作用范围：</span>
            <NRadioGroup
              v-model:value="currentScope"
              size="small"
            >
              <NRadioButton value="global"> 全局通用 </NRadioButton>
              <NRadioButton value="page"> 本页专属 </NRadioButton>
            </NRadioGroup>
          </NFlex>
          <NText
            depth="3"
            class="scope-desc"
          >
            {{
              isPageScope
                ? '当前正在为当前子页面定制独立专属外观，将优先覆盖全局主题。'
                : '当前正在编辑全局默认外观，未单独设置外观的子页面均会继承此配置。'
            }}
          </NText>
        </template>
      </div>

      <!-- 智能提取板块 -->
      <div class="smart-extract-card">
        <NFlex
          justify="space-between"
          align="center"
        >
          <NFlex
            align="center"
            :size="6"
          >
            <NIcon
              color="var(--vtsuru-primary)"
              size="16"
            >
              <SparklesOutline />
            </NIcon>
            <span style="font-weight: 600; font-size: 13px">智能提取配色</span>
          </NFlex>
          <NFlex :size="8">
            <NButton
              size="tiny"
              type="primary"
              secondary
              :loading="isExtracting"
              :disabled="!avatarUrl"
              @click="runExtractFromUrl(avatarUrl, '头像')"
            >
              从头像提取
            </NButton>
            <NButton
              v-if="currentBackgroundImageUrl"
              size="tiny"
              secondary
              :loading="isExtracting"
              @click="runExtractFromUrl(currentBackgroundImageUrl, '背景图')"
            >
              从壁纸提取
            </NButton>
          </NFlex>
        </NFlex>

        <!-- 提取结果展示与一键应用 -->
        <div
          v-if="extractedResult"
          class="extract-result"
        >
          <NFlex
            align="center"
            justify="space-between"
            style="margin-bottom: 8px"
          >
            <NFlex
              align="center"
              :size="6"
            >
              <span
                class="color-dot"
                :style="{ backgroundColor: extractedResult.primaryColor }"
              />
              <span style="font-size: 12px; font-weight: 500">
                主色：{{ extractedResult.primaryColor }}
              </span>
            </NFlex>
            <NFlex :size="6">
              <NButton
                size="tiny"
                @click="applyExtracted('light')"
              >
                套用浅色
              </NButton>
              <NButton
                size="tiny"
                type="primary"
                @click="applyExtracted('dark')"
              >
                套用深色
              </NButton>
            </NFlex>
          </NFlex>

          <div
            v-if="extractedResult.swatches.length > 1"
            class="swatches-row"
          >
            <span style="font-size: 11px; color: var(--vtsuru-fg-muted)">候选色彩：</span>
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

      <NDivider style="margin: 16px 0 12px" />

      <!-- 三大选项卡配置 -->
      <NTabs
        v-model:value="activeTab"
        type="segment"
        size="small"
        animated
      >
        <NTabPane
          name="colors"
          tab="色彩与模式"
        >
          <div class="tab-body">
            <NForm
              label-placement="top"
              size="small"
            >
              <NFlex
                :wrap="true"
                style="gap: 12px"
              >
                <NFormItem
                  label="主题主色"
                  class="field-col"
                >
                  <NColorPicker
                    v-model:value="primaryColor"
                    :modes="['hex']"
                  />
                </NFormItem>
                <NFormItem
                  label="内容底色"
                  class="field-col"
                >
                  <NColorPicker
                    v-model:value="backgroundColor"
                    :modes="['hex']"
                  />
                </NFormItem>
                <NFormItem
                  label="主题模式"
                  class="field-col"
                >
                  <NSelect
                    v-model:value="themeMode"
                    :options="[
                      { label: '跟随站点 (自适应)', value: 'auto' },
                      { label: '强制浅色', value: 'light' },
                      { label: '强制深色', value: 'dark' },
                    ]"
                  />
                </NFormItem>
              </NFlex>

              <NDivider style="margin: 12px 0 8px"> 文字与对比度 </NDivider>
              <ThemeTextColorEditor :target="textColorTarget" />
            </NForm>
          </div>
        </NTabPane>

        <NTabPane
          name="background"
          tab="壁纸与背景"
        >
          <div class="tab-body">
            <BackgroundSettingsEditor
              :target="backgroundTarget"
              :none-hint="isPageScope ? '未设置时继承全局默认壁纸背景。' : '未设置时使用站点默认背景。'"
            />
          </div>
        </NTabPane>

        <NTabPane
          name="advanced"
          tab="排版与质感"
        >
          <div class="tab-body">
            <ThemeAdvancedOptions :target="appearanceTarget" />

            <NDivider style="margin: 16px 0 12px"> 自定义 CSS </NDivider>
            <NFlex
              justify="space-between"
              align="center"
              class="css-bar"
            >
              <span class="css-label">
                {{ editor.settings.value.customCss ? '已配置全局 CSS' : '未配置全局 CSS' }}
              </span>
              <NButton
                size="small"
                secondary
                @click="cssEditorVisible = true"
              >
                <template #icon>
                  <NIcon><CodeSlashOutline /></NIcon>
                </template>
                编辑 CSS
              </NButton>
            </NFlex>
          </div>
        </NTabPane>
      </NTabs>

      <template #footer>
        <NFlex
          justify="space-between"
          align="center"
          style="width: 100%"
        >
          <NPopconfirm
            @positive-click="clearCurrentTheme"
          >
            <template #trigger>
              <NButton
                size="small"
                quaternary
                type="error"
              >
                <template #icon>
                  <NIcon><TrashOutline /></NIcon>
                </template>
                {{ isPageScope ? '重置为继承全局' : '清空当前主题' }}
              </NButton>
            </template>
            确定要清空当前的样式与主题配置吗？
          </NPopconfirm>

          <NButton
            size="small"
            type="primary"
            @click="show = false"
          >
            <template #icon>
              <NIcon><CheckmarkOutline /></NIcon>
            </template>
            完成
          </NButton>
        </NFlex>
      </template>

      <GlobalCssEditorModal v-model:show="cssEditorVisible" />
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.scope-control-box {
  background: var(--vtsuru-bg-muted);
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 12px;
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
  color: var(--vtsuru-fg-muted);
  margin-top: 4px;
  line-height: 1.4;
}

.smart-extract-card {
  background: var(--vtsuru-brand-tint, rgba(99, 102, 241, 0.05));
  border: 1px dashed var(--vtsuru-border);
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 14px;
}

.extract-result {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--vtsuru-border);
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
  color: var(--vtsuru-fg-muted);
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
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}

.preset-card:hover {
  border-color: var(--vtsuru-primary);
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
  color: var(--vtsuru-fg);
  text-align: center;
  font-weight: 500;
}

.tab-body {
  padding-top: 10px;
}

.field-col {
  flex: 1;
  min-width: 180px;
}

.css-bar {
  background: var(--vtsuru-bg-muted);
  padding: 8px 12px;
  border-radius: 6px;
}

.css-label {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}
</style>
