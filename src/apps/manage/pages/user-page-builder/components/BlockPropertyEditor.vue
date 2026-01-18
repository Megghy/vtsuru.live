<script setup lang="ts">
import { NAlert, NAutoComplete, NButton, NCard, NCollapse, NCollapseItem, NColorPicker, NDivider, NFlex, NForm, NFormItem, NInput, NInputNumber, NModal, NProgress, NRadioButton, NRadioGroup, NSelect, NSpace, NSwitch, NText } from 'naive-ui'
import { computed, inject, ref } from 'vue'
import ContribConfigEditor from '@/apps/manage/components/ContribConfigEditor.vue'
import { UserPageEditorKey } from '../context'
import BlockTypeEditor from './BlockTypeEditor.vue'
import BackgroundSettingsEditor from './BackgroundSettingsEditor.vue'
import type {BackgroundSettingsTarget} from './BackgroundSettingsEditor.vue';
import ErrorBoundary from './ErrorBoundary.vue'
import LegacyIndexSettings from './LegacyIndexSettings.vue'
import PropsGrid from './PropsGrid.vue'

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')

const uploadInput = editor.uploadInput

const themePresets = [
  {
    label: '极简黑白',
    value: 'mono',
    theme: { primaryColor: '#111111', backgroundColor: '#ffffff', textColor: '#111111', radius: 12, spacing: 'normal' },
  },
  {
    label: '赛博朋克',
    value: 'cyber',
    theme: { primaryColor: '#00e5ff', backgroundColor: '#0b1020', textColor: '#e6f7ff', radius: 14, spacing: 'relaxed' },
  },
  {
    label: '少女粉',
    value: 'pink',
    theme: { primaryColor: '#ff4d9d', backgroundColor: '#fff0f6', textColor: '#2b2b2b', radius: 16, spacing: 'normal' },
  },
]

const themePresetKey = ref<string | null>(null)
const themePresetOptions = computed(() => themePresets.map(p => ({ label: p.label, value: p.value })))

function applyThemePreset(key: string | null) {
  if (!key) return
  const preset = themePresets.find(p => p.value === key)
  if (!preset) return
  const theme = editor.currentTheme.value
  if (!theme) return
  Object.assign(theme, preset.theme)
}

const capacityStatus = computed(() => {
  if (editor.configBytes.value > editor.MAX_CONFIG_BYTES) return 'error'
  if (editor.configBytes.value > editor.MAX_CONFIG_BYTES * 0.9) return 'warning'
  return 'success'
})

const pageThemeMode = computed({
  get() {
    const theme = editor.currentTheme.value as any
    const v = theme?.pageThemeMode
    return (v === 'light' || v === 'dark') ? v : 'auto'
  },
  set(v: 'auto' | 'light' | 'dark') {
    const theme = editor.currentTheme.value as any
    if (!theme) return
    if (v === 'auto') delete theme.pageThemeMode
    else theme.pageThemeMode = v
  },
})

const pageMaxWidthSetting = computed({
  get() {
    const theme = editor.currentTheme.value as any
    const v = theme?.pageMaxWidth
    return typeof v === 'string' ? v : ''
  },
  set(v: string) {
    const theme = editor.currentTheme.value as any
    if (!theme) return
    const s = v.trim()
    if (!s) delete theme.pageMaxWidth
    else theme.pageMaxWidth = s
  },
})

const exportModal = ref(false)
const exportJson = ref('')
const importModal = ref(false)
const importJson = ref('')

function openExportModal() {
  try {
    exportJson.value = editor.exportCurrentBlockPageJson()
    exportModal.value = true
  } catch (e) {
    editor.message.error((e as Error).message || String(e))
  }
}

async function copyExportJson() {
  try {
    await navigator.clipboard.writeText(exportJson.value)
    editor.message.success('已复制到剪贴板')
  } catch (e) {
    editor.message.error((e as Error).message || String(e))
  }
}

function downloadExportJson() {
  try {
    const json = editor.exportCurrentBlockPageJson()
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vtsuru-block-page_${editor.currentKey.value}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    editor.message.success('已开始下载')
  } catch (e) {
    editor.message.error((e as Error).message || String(e))
  }
}

function confirmImportJson() {
  try {
    editor.importCurrentBlockPageJson(importJson.value)
    importModal.value = false
    importJson.value = ''
  } catch (e) {
    editor.message.error((e as Error).message || String(e))
  }
}

const pageOverrideBgTarget: BackgroundSettingsTarget = {
  get: () => (editor.currentPage.value as any).background,
  ensure: () => ((editor.currentPage.value as any).background ??= {}),
  uploadImage: editor.triggerUploadPageBackgroundOverride,
  clearImage: editor.clearPageBackgroundOverrideImageFile,
}

const blockThemeBgTarget: BackgroundSettingsTarget = {
  get: () => editor.currentTheme.value as any,
  ensure: () => {
    const theme = editor.currentTheme.value as any
    if (!theme) return null
    return theme
  },
  uploadImage: editor.triggerUploadPageBackground,
  clearImage: editor.clearPageBackgroundImageFile,
}

function ensurePageThemeOverride() {
  return ((editor.currentPage.value as any).theme ??= {})
}

function cleanupPageThemeOverrideIfEmpty() {
  const t: any = (editor.currentPage.value as any).theme
  if (!t || typeof t !== 'object') return
  const keys = Object.keys(t)
  if (keys.length === 0) delete (editor.currentPage.value as any).theme
}

const pageOverrideThemePrimaryColor = computed({
  get() {
    const v = (editor.currentPage.value as any).theme?.primaryColor
    return typeof v === 'string' ? v : undefined
  },
  set(v: string | null) {
    const next = typeof v === 'string' ? v : ''
    if (!next.trim().length) {
      const t: any = (editor.currentPage.value as any).theme
      if (t) delete t.primaryColor
      cleanupPageThemeOverrideIfEmpty()
      return
    }
    const t: any = ensurePageThemeOverride()
    t.primaryColor = next
  },
})

const pageOverrideThemeTextColor = computed({
  get() {
    const v = (editor.currentPage.value as any).theme?.textColor
    return typeof v === 'string' ? v : undefined
  },
  set(v: string | null) {
    const next = typeof v === 'string' ? v : ''
    if (!next.trim().length) {
      const t: any = (editor.currentPage.value as any).theme
      if (t) delete t.textColor
      cleanupPageThemeOverrideIfEmpty()
      return
    }
    const t: any = ensurePageThemeOverride()
    t.textColor = next
  },
})

const pageOverrideThemeBackgroundColor = computed({
  get() {
    const v = (editor.currentPage.value as any).theme?.backgroundColor
    return typeof v === 'string' ? v : undefined
  },
  set(v: string | null) {
    const next = typeof v === 'string' ? v : ''
    if (!next.trim().length) {
      const t: any = (editor.currentPage.value as any).theme
      if (t) delete t.backgroundColor
      cleanupPageThemeOverrideIfEmpty()
      return
    }
    const t: any = ensurePageThemeOverride()
    t.backgroundColor = next
  },
})

const pageOverrideThemeMode = computed({
  get() {
    const v = (editor.currentPage.value as any).theme?.pageThemeMode
    return (v === 'light' || v === 'dark') ? v : 'auto'
  },
  set(v: 'auto' | 'light' | 'dark') {
    const t: any = (editor.currentPage.value as any).theme
    if (v === 'auto') {
      if (t) delete t.pageThemeMode
      cleanupPageThemeOverrideIfEmpty()
      return
    }
    const ensured: any = ensurePageThemeOverride()
    ensured.pageThemeMode = v
  },
})
</script>

<template>
  <NCard
    title="编辑"
    style="width: 100%; height: 100%"
    content-style="padding: 12px"
  >
    <template #header-extra>
      <NFlex align="center" :wrap="false" style="gap: 10px; min-width: 0">
        <NText depth="3" style="font-size: 12px; white-space: nowrap">
          容量 {{ editor.configBytesPercent.value }}%
        </NText>
        <NProgress
          type="line"
          :percentage="editor.configBytesPercent.value"
          :status="capacityStatus as any"
          :show-indicator="false"
          :height="6"
          style="width: 140px"
        />
      </NFlex>
    </template>
    <NSpace vertical size="large">
      <NCollapse
        v-if="editor.currentKey.value !== 'home' || editor.currentPage.value.mode !== 'block'"
        :default-expanded-names="[]"
      >
        <NCollapseItem
          v-if="editor.currentKey.value !== 'home'"
          title="页面基本设置"
          name="page-info"
        >
          <NForm label-placement="top" size="small">
            <PropsGrid>
              <NFormItem label="页面名称">
                <NInput v-model:value="editor.currentPage.value.title" placeholder="可选，用于管理列表展示" />
              </NFormItem>
              <NFormItem label="在导航菜单中显示">
                <NFlex justify="end">
                  <NSwitch v-model:value="editor.currentPage.value.navVisible" size="small" />
                </NFlex>
              </NFormItem>
              <NFormItem class="span-full" label="页面描述">
                <NInput
                  v-model:value="editor.currentPage.value.description"
                  type="textarea"
                  placeholder="可选"
                  :autosize="{ minRows: 2, maxRows: 4 }"
                />
              </NFormItem>
              <NFormItem label="排序权重">
                <NInputNumber v-model:value="editor.currentPage.value.navOrder" style="width: 100%" placeholder="数字越小越靠前" />
              </NFormItem>
              <NFormItem label="路径 (Slug)">
                <NInput :value="editor.currentKey.value" :disabled="true" />
              </NFormItem>
            </PropsGrid>
          </NForm>
        </NCollapseItem>

        <NCollapseItem v-if="editor.currentPage.value.mode !== 'block'" title="页面背景" name="page-bg">
          <NSpace justify="space-between" align="center" style="margin-bottom: 10px">
            <NText depth="3">
              不设置时将使用全局背景或默认背景。
            </NText>
            <NButton
              size="small"
              secondary
              :disabled="!(editor.currentPage.value as any).background"
              @click="(editor.currentPage.value as any).background = undefined"
            >
              使用全局背景
            </NButton>
          </NSpace>
          <BackgroundSettingsEditor
            :target="pageOverrideBgTarget"
          />
        </NCollapseItem>

        <NCollapseItem v-if="editor.currentPage.value.mode !== 'block'" title="页面主题" name="page-theme">
          <NSpace justify="space-between" align="center" style="margin-bottom: 10px">
            <NText depth="3">
              不设置时将使用全局主题或站点主题。
            </NText>
            <NButton
              size="small"
              secondary
              :disabled="!(editor.currentPage.value as any).theme"
              @click="(editor.currentPage.value as any).theme = undefined"
            >
              清除页面主题
            </NButton>
          </NSpace>
          <NForm label-placement="top" size="small">
            <PropsGrid>
              <NFormItem label="主题色 primary">
                <NFlex align="center" :wrap="false" style="gap: 10px">
                  <div style="flex: 1; min-width: 0">
                    <NColorPicker v-model:value="pageOverrideThemePrimaryColor" />
                  </div>
                  <NButton
                    size="tiny"
                    secondary
                    :disabled="pageOverrideThemePrimaryColor == null"
                    @click="pageOverrideThemePrimaryColor = null"
                  >
                    清除
                  </NButton>
                </NFlex>
              </NFormItem>
              <NFormItem label="字体颜色 text">
                <NFlex align="center" :wrap="false" style="gap: 10px">
                  <div style="flex: 1; min-width: 0">
                    <NColorPicker v-model:value="pageOverrideThemeTextColor" />
                  </div>
                  <NButton
                    size="tiny"
                    secondary
                    :disabled="pageOverrideThemeTextColor == null"
                    @click="pageOverrideThemeTextColor = null"
                  >
                    清除
                  </NButton>
                </NFlex>
              </NFormItem>
              <NFormItem label="内容区域底色">
                <NFlex align="center" :wrap="false" style="gap: 10px">
                  <div style="flex: 1; min-width: 0">
                    <NColorPicker v-model:value="pageOverrideThemeBackgroundColor" />
                  </div>
                  <NButton
                    size="tiny"
                    secondary
                    :disabled="pageOverrideThemeBackgroundColor == null"
                    @click="pageOverrideThemeBackgroundColor = null"
                  >
                    清除
                  </NButton>
                </NFlex>
              </NFormItem>
              <NFormItem label="页面主题模式">
                <NSelect
                  v-model:value="pageOverrideThemeMode"
                  :options="[
                    { label: '跟随站点', value: 'auto' },
                    { label: '强制亮色', value: 'light' },
                    { label: '强制暗色', value: 'dark' },
                  ]"
                />
              </NFormItem>
            </PropsGrid>
          </NForm>
        </NCollapseItem>
      </NCollapse>

      <div style="background: var(--n-color-embedded); padding: 12px; border-radius: 8px">
        <NText depth="3" style="font-size: 12px; margin-bottom: 8px; display: block">
          页面渲染模式
        </NText>
        <NRadioGroup v-model:value="editor.currentPage.value.mode" size="small" style="width: 100%">
          <NRadioButton value="legacy" style="width: 33.3%; text-align: center">
            传统
          </NRadioButton>
          <NRadioButton value="block" style="width: 33.3%; text-align: center">
            区块
          </NRadioButton>
          <NRadioButton value="contrib" style="width: 33.4%; text-align: center">
            自定义
          </NRadioButton>
        </NRadioGroup>
      </div>

      <Transition name="fade-slide" mode="out-in">
        <div :key="`${editor.currentPage.value.mode}:${!!editor.currentProject.value}`">
          <template v-if="editor.currentPage.value.mode === 'legacy'">
            <NDivider style="margin: 0" title-placement="left">
              主页设置
            </NDivider>
            <LegacyIndexSettings />
          </template>

          <template v-else-if="editor.currentPage.value.mode === 'contrib'">
            <NForm label-placement="top" size="small">
              <PropsGrid>
                <NFormItem label="作用域">
                  <NSelect
                    v-model:value="editor.currentContrib.value!.scope"
                    :options="[{ label: '全局', value: 'global' }, { label: '主播专属', value: 'streamer' }]"
                  />
                </NFormItem>
                <NFormItem label="页面 ID">
                  <NAutoComplete
                    v-model:value="editor.currentContrib.value!.pageId"
                    :options="editor.contribPageIdOptions.value"
                    placeholder="选择或输入 pageId"
                    clearable
                  />
                </NFormItem>
                <NFormItem
                  v-if="editor.currentContrib.value!.scope === 'streamer'"
                  label="关联主播"
                >
                  <NInputNumber :value="editor.account.value.id" :disabled="true" style="width: 100%" />
                </NFormItem>
              </PropsGrid>
            </NForm>

            <NAlert v-if="editor.contribConfigError.value" type="error" :show-icon="true" style="margin-top: 12px">
              {{ editor.contribConfigError.value }}
            </NAlert>
            <NAlert v-else-if="editor.contribConfigLoading.value" type="info" :show-icon="true" style="margin-top: 12px">
              投稿页配置加载中...
            </NAlert>
            <template v-else-if="editor.contribConfigItems.value">
              <NSpace justify="space-between" align="center" style="margin-top: 12px">
                <NText strong>
                  页面配置
                </NText>
                <NButton size="small" secondary @click="editor.resetContribConfigToDefault">
                  重置为默认
                </NButton>
              </NSpace>
              <ErrorBoundary title="配置面板渲染失败">
                <ContribConfigEditor
                  :config="editor.contribConfigItems.value"
                  :config-data="(editor.currentContrib.value!.config as any)"
                />
              </ErrorBoundary>
            </template>
            <NAlert v-else type="warning" :show-icon="true" style="margin-top: 12px">
              该投稿页未导出 Config/DefaultConfig，可直接提交 PR 按约定补齐。
            </NAlert>
          </template>

          <template v-else-if="editor.currentPage.value.mode === 'block' && editor.currentProject.value">
            <NCollapse :default-expanded-names="[]">
              <NCollapseItem title="区块页主题" name="theme">
                <NForm label-placement="top" size="small">
                  <NFormItem label="主题预设">
                    <NSelect
                      v-model:value="themePresetKey"
                      :options="themePresetOptions"
                      clearable
                      placeholder="选择后会覆盖主题颜色/圆角/密度"
                      @update:value="applyThemePreset"
                    />
                  </NFormItem>
                  <NDivider style="margin: 10px 0">
                    主题颜色
                  </NDivider>
                  <NAlert type="info" :show-icon="true" style="margin-bottom: 12px">
                    主题主色会影响按钮等组件的主色；文字颜色会影响页面内组件的文字与边框，部分组件。区块渲染会按此主题覆盖 NaiveUI 主题色。
                  </NAlert>
                  <PropsGrid :min-item-width="240">
                    <NFormItem label="主题主色">
                      <NColorPicker v-model:value="editor.currentTheme.value!.primaryColor" />
                    </NFormItem>
                    <NFormItem label="页面主题模式">
                      <NSelect
                        v-model:value="pageThemeMode"
                        :options="[
                          { label: '跟随站点', value: 'auto' },
                          { label: '强制亮色', value: 'light' },
                          { label: '强制暗色', value: 'dark' },
                        ]"
                      />
                    </NFormItem>
                    <NFormItem label="文字颜色">
                      <NColorPicker v-model:value="editor.currentTheme.value!.textColor" />
                    </NFormItem>
                    <NFormItem label="内容区域底色">
                      <NColorPicker v-model:value="editor.currentTheme.value!.backgroundColor" />
                    </NFormItem>
                    <NFormItem label="圆角大小">
                      <NInputNumber v-model:value="editor.currentTheme.value!.radius" :min="0" :max="32" style="width: 100%" />
                    </NFormItem>
                    <NFormItem label="内容最大宽度">
                      <NInput v-model:value="pageMaxWidthSetting" placeholder="默认 820px；例如 100% / 1200px / none" />
                    </NFormItem>
                    <NFormItem class="span-full" label="布局密度">
                      <NSelect
                        v-model:value="editor.currentTheme.value!.spacing"
                        :options="[
                          { label: '紧凑', value: 'compact' },
                          { label: '标准', value: 'normal' },
                          { label: '宽松', value: 'relaxed' },
                        ]"
                      />
                    </NFormItem>
                  </PropsGrid>

                  <NDivider style="margin: 10px 0">
                    导入 / 导出
                  </NDivider>
                  <NSpace>
                    <NButton size="small" secondary @click="openExportModal">
                      导出 JSON
                    </NButton>
                    <NButton size="small" secondary @click="importModal = true">
                      导入 JSON
                    </NButton>
                  </NSpace>

                  <NDivider style="margin: 10px 0">
                    区块页背景
                  </NDivider>
                  <NAlert type="info" :show-icon="true" style="margin-bottom: 12px">
                    仅对“区块模式”页面生效；当页面/全局背景已设置时，会优先使用页面/全局背景。
                  </NAlert>
                  <BackgroundSettingsEditor
                    :target="blockThemeBgTarget"
                    none-hint="未设置区块页背景时，将优先使用页面或全局背景，否则使用默认背景。"
                  />
                </NForm>
              </NCollapseItem>
            </NCollapse>

            <Transition name="fade-slide" mode="out-in">
              <div v-if="editor.selectedBlock.value" :key="`selected:${editor.selectedBlock.value.id}`" style="margin-top: 12px">
                <NText strong style="display:block; margin-bottom: 8px">
                  属性编辑 - {{ editor.selectedBlock.value.type }}
                </NText>
                <ErrorBoundary title="区块属性面板渲染失败">
                  <BlockTypeEditor :block="editor.selectedBlock.value" />
                </ErrorBoundary>
              </div>
            </Transition>
          </template>

          <template v-else>
            <NAlert type="warning" :show-icon="true">
              当前页模式：{{ editor.getPageModeLabel(editor.currentPage.value.mode) }}，此处无可编辑项
            </NAlert>
          </template>
        </div>
      </Transition>

      <NButton block secondary @click="editor.openPreview">
        打开对外预览页
      </NButton>
    </NSpace>

    <input
      ref="uploadInput"
      type="file"
      accept="image/*"
      multiple
      style="display: none"
      @change="editor.onUploadChange"
    >
  </NCard>

  <NModal v-model:show="exportModal" preset="card" title="导出区块页 JSON" style="width: min(720px, 92vw)">
    <NSpace vertical>
      <NAlert type="info" :show-icon="true">
        这是当前页面的区块配置 JSON，仅包含当前页。导入到其他账号/页面时，图片等资源引用可能需要重新上传替换。
      </NAlert>
      <NInput v-model:value="exportJson" type="textarea" :autosize="{ minRows: 10, maxRows: 18 }" readonly />
      <NSpace justify="end">
        <NButton size="small" secondary @click="copyExportJson">
          复制
        </NButton>
        <NButton size="small" secondary @click="downloadExportJson">
          下载
        </NButton>
      </NSpace>
    </NSpace>
  </NModal>

  <NModal v-model:show="importModal" preset="card" title="导入区块页 JSON" style="width: min(720px, 92vw)">
    <NSpace vertical>
      <NAlert type="warning" :show-icon="true">
        导入会覆盖当前页面的区块配置，不可自动回退，建议先导出备份。
      </NAlert>
      <NInput v-model:value="importJson" type="textarea" :autosize="{ minRows: 10, maxRows: 18 }" placeholder="粘贴导出的 JSON，支持 vtsuru-block-page 包装或直接 BlockPageProject" />
      <NSpace justify="end">
        <NButton secondary @click="importModal = false">
          取消
        </NButton>
        <NButton type="primary" :disabled="!importJson.trim().length" @click="confirmImportJson">
          导入并覆盖
        </NButton>
      </NSpace>
    </NSpace>
  </NModal>
</template>

<style scoped src="./ui-transitions.css"></style>
