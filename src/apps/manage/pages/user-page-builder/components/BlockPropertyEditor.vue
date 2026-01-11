<script setup lang="ts">
import { NAlert, NAutoComplete, NButton, NCard, NCollapse, NCollapseItem, NColorPicker, NDivider, NFlex, NForm, NFormItem, NInput, NInputNumber, NProgress, NRadioButton, NRadioGroup, NSelect, NSpace, NSwitch, NText } from 'naive-ui'
import { computed, inject, ref } from 'vue'
import ContribConfigEditor from '@/apps/manage/components/ContribConfigEditor.vue'
import { UserPageEditorKey } from '../context'
import BlockManager from './BlockManager.vue'
import BlockTypeEditor from './BlockTypeEditor.vue'
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

const pageBackgroundType = computed({
  get() {
    const theme = editor.currentTheme.value as any
    const v = theme?.pageBackgroundType
    return (v === 'color' || v === 'image') ? v : 'none'
  },
  set(v: 'none' | 'color' | 'image') {
    const theme = editor.currentTheme.value as any
    if (!theme) return
    theme.pageBackgroundType = v
    if (v === 'color' && typeof theme.pageBackgroundColor !== 'string') theme.pageBackgroundColor = 'rgba(255, 255, 255, 1)'
    if (v !== 'image') delete theme.pageBackgroundImageFile
  },
})

const pageBackgroundColor = computed({
  get() {
    const theme = editor.currentTheme.value as any
    return typeof theme?.pageBackgroundColor === 'string' ? theme.pageBackgroundColor : 'rgba(255, 255, 255, 1)'
  },
  set(v: string) {
    const theme = editor.currentTheme.value as any
    if (!theme) return
    theme.pageBackgroundColor = v
  },
})

const pageBackgroundCoverSidebar = computed({
  get() {
    const theme = editor.currentTheme.value as any
    return theme?.pageBackgroundCoverSidebar !== false
  },
  set(v: boolean) {
    const theme = editor.currentTheme.value as any
    if (!theme) return
    theme.pageBackgroundCoverSidebar = v
  },
})

const pageBackgroundImageFit = computed({
  get() {
    const theme = editor.currentTheme.value as any
    const v = theme?.pageBackgroundImageFit
    return (v === 'contain' || v === 'fill' || v === 'none') ? v : 'cover'
  },
  set(v: 'cover' | 'contain' | 'fill' | 'none') {
    const theme = editor.currentTheme.value as any
    if (!theme) return
    theme.pageBackgroundImageFit = v
  },
})

const pageBackgroundBlurMode = computed({
  get() {
    const theme = editor.currentTheme.value as any
    const v = theme?.pageBackgroundBlurMode
    return (v === 'background' || v === 'glass') ? v : 'none'
  },
  set(v: 'none' | 'background' | 'glass') {
    const theme = editor.currentTheme.value as any
    if (!theme) return
    theme.pageBackgroundBlurMode = v
    if (v !== 'none' && (typeof theme.pageBackgroundBlur !== 'number' || !Number.isFinite(theme.pageBackgroundBlur))) theme.pageBackgroundBlur = 14
  },
})

const pageBackgroundBlur = computed({
  get() {
    const theme = editor.currentTheme.value as any
    const v = Number(theme?.pageBackgroundBlur)
    if (!Number.isFinite(v)) return 14
    return Math.min(40, Math.max(0, Math.round(v)))
  },
  set(v: number) {
    const theme = editor.currentTheme.value as any
    if (!theme) return
    theme.pageBackgroundBlur = v
  },
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

const pageBackgroundImagePath = computed(() => {
  const theme = editor.currentTheme.value as any
  const f = theme?.pageBackgroundImageFile
  if (!f || typeof f !== 'object' || Array.isArray(f)) return ''
  const path = (f as any).path
  return typeof path === 'string' ? path : ''
})
</script>

<template>
  <NCard
    title="编辑"
    style="width: 100%; height: 100%"
    content-style="padding: 12px"
  >
    <NSpace vertical size="large">
      <div style="background: var(--n-color-embedded); padding: 10px 12px; border-radius: 8px">
        <NFlex justify="space-between" align="center">
          <NText depth="3" style="font-size: 12px">
            使用容量：{{ editor.configBytesPercent.value}} %
          </NText>
          <NText depth="3" style="font-size: 12px">
            保存时会自动剔除“隐藏且空内容”的冗余区块
          </NText>
        </NFlex>
        <NProgress
          type="line"
          :percentage="editor.configBytesPercent.value"
          :status="capacityStatus as any"
          :show-indicator="false"
          :height="8"
          style="margin-top: 8px"
        />
      </div>

      <NCollapse v-if="editor.currentKey.value !== 'home'" :default-expanded-names="[]">
        <NCollapseItem title="页面基本设置" name="page-info">
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

      <template v-if="editor.currentPage.value.mode === 'legacy'">
        <NDivider style="margin: 0" title-placement="left">
          主页设置
        </NDivider>
        <LegacyIndexSettings />
      </template>

      <template v-if="editor.currentPage.value.mode === 'contrib'">
        <NForm label-placement="top" size="small">
          <PropsGrid>
            <NFormItem label="作用域">
              <NSelect
                v-model:value="editor.currentContrib.value!.scope"
                :options="[{ label: '全局 (Global)', value: 'global' }, { label: '主播专属 (Streamer)', value: 'streamer' }]"
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
          该投稿页未导出 Config/DefaultConfig（可直接提交 PR 按约定补齐）。
        </NAlert>
      </template>

      <template v-else-if="editor.currentPage.value.mode === 'block' && editor.currentProject.value">
        <NCollapse :default-expanded-names="[]">
          <NCollapseItem title="主题风格设置" name="theme">
            <NForm label-placement="top" size="small">
              <NFormItem label="主题预设（可选）">
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
                主题主色会影响按钮等组件的主色；文字颜色会影响页面内组件的文字与边框（部分组件）。区块渲染会按此主题覆盖 NaiveUI 主题色。
              </NAlert>
              <PropsGrid :min-item-width="240">
                <NFormItem label="主题主色（按钮等）">
                  <NColorPicker v-model:value="editor.currentTheme.value!.primaryColor" />
                </NFormItem>
                <NFormItem label="页面主题模式（可选）">
                  <NSelect
                    v-model:value="pageThemeMode"
                    :options="[
                      { label: '跟随站点（Auto）', value: 'auto' },
                      { label: '强制亮色（Light）', value: 'light' },
                      { label: '强制暗色（Dark）', value: 'dark' },
                    ]"
                  />
                </NFormItem>
                <NFormItem label="文字颜色">
                  <NColorPicker v-model:value="editor.currentTheme.value!.textColor" />
                </NFormItem>
                <NFormItem label="内容区域底色（可选）">
                  <NColorPicker v-model:value="editor.currentTheme.value!.backgroundColor" />
                </NFormItem>
                <NFormItem label="圆角大小">
                  <NInputNumber v-model:value="editor.currentTheme.value!.radius" :min="0" :max="32" style="width: 100%" />
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
                页面全局背景
              </NDivider>

              <NFormItem label="背景类型">
                <NRadioGroup v-model:value="pageBackgroundType" size="small" style="width: 100%">
                  <NRadioButton value="none" style="width: 33.3%; text-align: center">无</NRadioButton>
                  <NRadioButton value="color" style="width: 33.3%; text-align: center">纯色</NRadioButton>
                  <NRadioButton value="image" style="width: 33.4%; text-align: center">图片</NRadioButton>
                </NRadioGroup>
              </NFormItem>

              <NAlert v-if="pageBackgroundType === 'none'" type="info" :show-icon="true" style="margin-bottom: 12px">
                不设置全局背景时，页面会使用默认背景（或由站点主题决定）。
              </NAlert>

              <template v-else-if="pageBackgroundType === 'color'">
                <NFormItem label="背景颜色">
                  <NColorPicker v-model:value="pageBackgroundColor" :modes="['rgb', 'hex']" :show-alpha="true" />
                </NFormItem>
              </template>

              <template v-else-if="pageBackgroundType === 'image'">
                <NFormItem label="背景图片（上传）">
                  <NSpace align="center">
                    <NButton size="small" :loading="editor.isUploading.value" @click="editor.triggerUploadPageBackground">
                      上传背景图
                    </NButton>
                    <NButton size="small" secondary :disabled="!pageBackgroundImagePath" @click="editor.clearPageBackgroundImageFile">
                      清除
                    </NButton>
                    <img
                      v-if="pageBackgroundImagePath"
                      :src="pageBackgroundImagePath"
                      alt=""
                      referrerpolicy="no-referrer"
                      style="width: 36px; height: 36px; object-fit: cover; border-radius: 6px; border: 1px solid var(--n-border-color);"
                    >
                  </NSpace>
                </NFormItem>
                <NFormItem label="图片填充方式">
                  <NSelect
                    v-model:value="pageBackgroundImageFit"
                    :options="[
                      { label: '铺满（推荐）', value: 'cover' },
                      { label: '完整显示', value: 'contain' },
                      { label: '拉伸填满', value: 'fill' },
                      { label: '原始大小', value: 'none' },
                    ]"
                  />
                </NFormItem>
                <NAlert v-if="!pageBackgroundImagePath" type="warning" :show-icon="true" style="margin-bottom: 12px">
                  请选择并上传一张图片作为背景。
                </NAlert>
              </template>

              <template v-if="pageBackgroundType !== 'none'">
                <PropsGrid :min-item-width="220">
                  <NFormItem label="覆盖导航区域">
                    <NFlex justify="end">
                      <NSwitch v-model:value="pageBackgroundCoverSidebar" size="small" />
                    </NFlex>
                  </NFormItem>
                  <NFormItem label="强度（px）" :show-feedback="false">
                    <NInputNumber
                      v-model:value="pageBackgroundBlur"
                      :min="0"
                      :max="40"
                      style="width: 100%"
                      :disabled="pageBackgroundBlurMode === 'none'"
                    />
                  </NFormItem>
                  <NFormItem class="span-full" label="背景效果">
                    <NRadioGroup v-model:value="pageBackgroundBlurMode" size="small" style="width: 100%">
                      <NRadioButton value="none" style="width: 33.3%; text-align: center">无</NRadioButton>
                      <NRadioButton value="background" style="width: 33.3%; text-align: center">模糊背景</NRadioButton>
                      <NRadioButton value="glass" style="width: 33.4%; text-align: center">磨砂玻璃</NRadioButton>
                    </NRadioGroup>
                  </NFormItem>
                </PropsGrid>
              </template>
            </NForm>
          </NCollapseItem>
        </NCollapse>

        <BlockManager />

        <div v-if="editor.selectedBlock.value" style="margin-top: 12px">
          <NText strong style="display:block; margin-bottom: 8px">
            属性编辑 - {{ editor.selectedBlock.value.type }}
          </NText>
          <ErrorBoundary title="区块属性面板渲染失败">
            <BlockTypeEditor :block="editor.selectedBlock.value" />
          </ErrorBoundary>
        </div>

        <div v-else-if="editor.selectedBlockIds.value.length === 0" style="margin-top: 12px">
          <NAlert type="info" :show-icon="true">
            请选择一个区块进行编辑（支持 Ctrl/Shift 多选做批量操作）。
          </NAlert>
        </div>
        <div v-else style="margin-top: 12px">
          <NAlert type="info" :show-icon="true">
            已多选 {{ editor.selectedBlockIds.value.length }} 个区块：可在上方做批量隐藏/删除/复制/粘贴。
          </NAlert>
        </div>
      </template>

      <template v-else>
        <NAlert type="warning" :show-icon="true">
          当前页模式：{{ editor.getPageModeLabel(editor.currentPage.value.mode) }}（此处无可编辑项）
        </NAlert>
      </template>

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
</template>
