<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue'

import type { BlockPageTheme, PageThemeMode } from '@/apps/user-page/block/schema'

import { UserPageEditorKey } from '../context'
import BackgroundSettingsEditor from './BackgroundSettingsEditor.vue'
import type { BackgroundSettingsTarget } from './BackgroundSettingsEditor.vue'
import PropsGrid from './PropsGrid.vue'
import ThemeAdvancedOptions from './ThemeAdvancedOptions.vue'
import type { ThemeAppearanceTarget } from './ThemeAdvancedOptions.vue'
import ThemeTextColorEditor from './ThemeTextColorEditor.vue'
import type { ThemeTextColorTarget } from './ThemeTextColorEditor.vue'

const show = defineModel<boolean>('show', { required: true })
const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const themePresets = [
  {
    label: '极简黑白',
    value: 'mono',
    theme: { primaryColor: '#111111', backgroundColor: '#ffffff', textColor: '#111111', radius: 12, spacing: 'normal' },
  },
  {
    label: '赛博朋克',
    value: 'cyber',
    theme: {
      primaryColor: '#00e5ff',
      backgroundColor: '#0b1020',
      textColor: '#e6f7ff',
      radius: 14,
      spacing: 'relaxed',
    },
  },
  {
    label: '少女粉',
    value: 'pink',
    theme: { primaryColor: '#ff4d9d', backgroundColor: '#fff0f6', textColor: '#2b2b2b', radius: 16, spacing: 'normal' },
  },
] satisfies Array<{ label: string; value: string; theme: BlockPageTheme }>

const themePresetKey = ref<string | null>(null)
const themePresetOptions = themePresets.map(({ label, value }) => ({ label, value }))
const exportModal = ref(false)
const exportJson = ref('')
const importModal = ref(false)
const importJson = ref('')

watch(
  () => editor.currentKey.value,
  () => {
    themePresetKey.value = null
    show.value = false
  },
)

function ensureTheme() {
  const project = editor.currentProject.value
  if (!project) throw new Error('当前页不是区块模式')
  return (project.theme ??= {})
}

function colorModel(key: 'primaryColor' | 'backgroundColor') {
  return computed<string | undefined>({
    get: () => editor.currentProject.value?.theme?.[key],
    set: (value) => {
      if (value?.trim()) ensureTheme()[key] = value
      else delete ensureTheme()[key]
    },
  })
}

const primaryColor = colorModel('primaryColor')
const backgroundColor = colorModel('backgroundColor')
const textColorTarget: ThemeTextColorTarget = {
  get: () => editor.currentProject.value?.theme,
  ensure: ensureTheme,
}
const appearanceTarget: ThemeAppearanceTarget = {
  get: () => editor.currentProject.value?.theme,
  ensure: ensureTheme,
}
const pageThemeMode = computed<PageThemeMode>({
  get: () => editor.currentProject.value?.theme?.pageThemeMode ?? 'auto',
  set: (value) => {
    if (value === 'auto') delete ensureTheme().pageThemeMode
    else ensureTheme().pageThemeMode = value
  },
})
const backgroundTarget: BackgroundSettingsTarget = {
  get: () => editor.currentProject.value?.theme,
  ensure: ensureTheme,
  uploadImage: editor.triggerUploadPageBackground,
  clearImage: editor.clearPageBackgroundImageFile,
}

function applyThemePreset(key: string | null) {
  const preset = themePresets.find((item) => item.value === key)
  if (preset) Object.assign(ensureTheme(), preset.theme)
}

function openExportModal() {
  try {
    exportJson.value = editor.exportCurrentBlockPageJson()
    exportModal.value = true
  } catch (error) {
    editor.message.error((error as Error).message || String(error))
  }
}

async function copyExportJson() {
  try {
    await navigator.clipboard.writeText(exportJson.value)
    editor.message.success('已复制到剪贴板')
  } catch (error) {
    editor.message.error((error as Error).message || String(error))
  }
}

function downloadExportJson() {
  try {
    const blob = new Blob([editor.exportCurrentBlockPageJson()], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `vtsuru-block-page_${editor.currentKey.value}.json`
    link.click()
    URL.revokeObjectURL(url)
    editor.message.success('已开始下载')
  } catch (error) {
    editor.message.error((error as Error).message || String(error))
  }
}

function confirmImportJson() {
  try {
    editor.importCurrentBlockPageJson(importJson.value)
    importModal.value = false
    importJson.value = ''
  } catch (error) {
    editor.message.error((error as Error).message || String(error))
  }
}
</script>

<template>
  <UModal
    v-model:open="show"
    title="页面主题"
    style="width: 720px; max-width: 95vw"
  >
    <template #body
      ><div
        class="builder-scroll"
        style="max-height: min(78vh, 720px)"
      >
        <div class="modal-content">
          <UAlert
            type="info"
            :show-icon="true"
            style="margin-bottom: 12px"
          >
            这里的设置仅应用于当前区块页，页面级和全局设置仍可覆盖对应选项。
          </UAlert>

          <USeparator style="margin: 10px 0"> 背景 </USeparator>
          <BackgroundSettingsEditor
            :target="backgroundTarget"
            none-hint="未设置区块页背景时，将优先使用页面或全局背景，否则使用默认背景。"
          />

          <USeparator style="margin: 12px 0 10px"> 主题 </USeparator>
          <div class="builder-form">
            <UFormField label="主题预设">
              <USelect
                v-model="themePresetKey"
                :items="themePresetOptions"
                clearable
                placeholder="选择后会覆盖主题颜色、圆角和密度"
                @update:model-value="applyThemePreset"
              />
            </UFormField>
            <PropsGrid :min-item-width="240">
              <UFormField label="主题主色">
                <UColorPicker
                  v-model="primaryColor"
                  :modes="['hex']"
                />
              </UFormField>
              <UFormField label="页面主题模式">
                <USelect
                  v-model="pageThemeMode"
                  :items="[
                    { label: '跟随站点', value: 'auto' },
                    { label: '强制亮色', value: 'light' },
                    { label: '强制暗色', value: 'dark' },
                  ]"
                />
              </UFormField>
              <UFormField label="内容区域底色">
                <UColorPicker
                  v-model="backgroundColor"
                  :modes="['hex']"
                />
              </UFormField>
            </PropsGrid>
            <ThemeTextColorEditor :target="textColorTarget" />
            <ThemeAdvancedOptions :target="appearanceTarget" />
          </div>

          <USeparator style="margin: 12px 0 10px"> 导入 / 导出 </USeparator>
          <div class="builder-row">
            <UButton
              size="sm"
              variant="soft"
              @click="openExportModal"
            >
              导出 JSON
            </UButton>
            <UButton
              size="sm"
              variant="soft"
              @click="importModal = true"
            >
              导入 JSON
            </UButton>
          </div>
        </div>
      </div></template
    >
  </UModal>

  <UModal
    v-model:open="exportModal"
    title="导出区块页 JSON"
    style="width: min(720px, 92vw)"
  >
    <template #body
      ><div class="builder-stack">
        <UAlert
          type="info"
          :show-icon="true"
        >
          这是当前页面的区块配置 JSON，仅包含当前页。导入到其他账号或页面时，图片等资源引用可能需要重新上传替换。
        </UAlert>
        <UTextarea
          v-model="exportJson"
          :autosize="{ minRows: 10, maxRows: 18 }"
          readonly
        />
        <div class="builder-row">
          <UButton
            size="sm"
            variant="soft"
            @click="copyExportJson"
          >
            复制
          </UButton>
          <UButton
            size="sm"
            variant="soft"
            @click="downloadExportJson"
          >
            下载
          </UButton>
        </div>
      </div></template
    >
  </UModal>

  <UModal
    v-model:open="importModal"
    title="导入区块页 JSON"
    style="width: min(720px, 92vw)"
  >
    <template #body
      ><div class="builder-stack">
        <UAlert
          type="warning"
          :show-icon="true"
        >
          导入会覆盖当前页面的区块配置，不可自动回退，建议先导出备份。
        </UAlert>
        <UTextarea
          v-model="importJson"
          :autosize="{ minRows: 10, maxRows: 18 }"
          placeholder="粘贴导出的 JSON，支持 vtsuru-block-page 包装或直接 BlockPageProject"
        />
        <div class="builder-row">
          <UButton
            variant="soft"
            @click="importModal = false"
          >
            取消
          </UButton>
          <UButton
            color="primary"
            :disabled="!importJson.trim().length"
            @click="confirmImportJson"
          >
            导入并覆盖
          </UButton>
        </div>
      </div></template
    >
  </UModal>
</template>

<style scoped>
.modal-content {
  padding-right: 16px;
  padding-bottom: 16px;
}
</style>
