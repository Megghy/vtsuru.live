<script setup lang="ts">
import { ChevronDown20Regular, PanelLeftContract20Filled, PanelLeftExpand20Filled } from '@vicons/fluent'
import { useElementBounding, useWindowSize } from '@vueuse/core'
import type { SelectGroupOption, SelectOption } from 'naive-ui'
import {
  darkTheme,
  NAlert,
  NButton,
  NCollapseTransition,
  NConfigProvider,
  NDivider,
  NFlex,
  NIcon,
  NSelect,
  NSpin,
  NTag,
  NText,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, h, onMounted, ref, shallowRef, watch } from 'vue'

import { downloadConfigDirect, SaveAccountSettings, useAccount } from '@/api/account'
import DynamicForm from '@/apps/manage/components/DynamicForm.vue'
import { fetchUserPagesSettingsByUserId } from '@/apps/user-page/api'
import { getUserPageNaiveThemeOverrides, getUserPageThemeCssVars } from '@/apps/user-page/background'
import { resolvePageThemeIsDark } from '@/apps/user-page/theme'
import { getUserPageAppearanceOverrides } from '@/apps/user-page/themeConfig'
import type { UserPagesSettings } from '@/apps/user-page/types'
import nana7miPlaceholder from '@/assets/images/schedule/nana7mi-placeholder.webp'
import { useRouteQueryParam } from '@/composables/useRouteQueryParam'
import { FETCH_API } from '@/shared/config'
import type { TemplateCapability } from '@/shared/config/templateCapabilities'
import { CapabilityCategories, getCategoryTagColor, groupCapabilities } from '@/shared/config/templateCapabilities'
import type { TemplateMapType } from '@/shared/config/templates'
import { ScheduleTemplateMap, SongListTemplateMap } from '@/shared/config/templates'
import type { ConfigItemDefinition } from '@/shared/types/VTsuruConfigTypes'

import '@/apps/user/pages/songListTemplate/songListTheme.css'

import { isDarkMode } from '@/shared/utils'

import { schedulePreviewData, songListPreviewData } from './templatePreviewData'

interface TemplateOption extends SelectOption {
  label: string
  value: string
  capabilities: readonly TemplateCapability[]
}

interface TemplateGroup {
  TemplateMap: TemplateMapType
  Options: TemplateOption[]
  Data: unknown
}

const accountInfo = useAccount()
const message = useMessage()
const userPageSettings = ref<UserPagesSettings | null>(null)

const isSaving = ref(false)
const isFormSaving = ref(false)

// 左侧配置栏折叠状态
const configCollapsed = ref(false)

// 工作区固定占满视口剩余高度, 左右栏各自内部滚动 (页面整体不滚动)
const workspaceRef = ref<HTMLElement>()
// windowScroll: false 关键: 避免滚动改变 top 导致高度反馈循环
const { top: workspaceTop } = useElementBounding(workspaceRef, { windowScroll: false })
const { height: windowHeight } = useWindowSize()
// 底部留白: 覆盖 manage-page 的 padding-bottom(48px) + 余量, 避免页面级残余滚动
const BOTTOM_GAP = 56
const workspaceHeight = computed(() => {
  const height = windowHeight.value - workspaceTop.value - BOTTOM_GAP
  return height > 320 ? `${height}px` : '320px'
})

// 预览头部展示用的 B 站用户信息
const biliUserInfo = ref()
onMounted(async () => {
  if (!accountInfo.value?.biliId) return
  try {
    const response = await fetch(
      `${FETCH_API}https://workers.vrp.moe/api/bilibili/user-info/${accountInfo.value.biliId}`,
    )
    const data = await response.json()
    if (data.code === 0) biliUserInfo.value = data.card
  } catch (err) {
    console.error('获取B站用户数据失败:', err)
  }
})

onMounted(async () => {
  if (!accountInfo.value?.id) return
  try {
    userPageSettings.value = await fetchUserPagesSettingsByUserId(accountInfo.value.id)
  } catch (err) {
    console.error('加载展示页主题失败:', err)
    message.warning('展示页主题加载失败，当前预览使用默认主题')
  }
})

const previewTheme = computed(() => {
  const settings = userPageSettings.value
  const homeAppearance =
    settings?.home?.mode === 'block' ? getUserPageAppearanceOverrides(settings.home.block?.theme) : {}
  return { ...settings?.theme, ...homeAppearance }
})

const previewThemeMode = computed(() => {
  const mode = userPageSettings.value?.theme?.pageThemeMode
  return mode === 'light' || mode === 'dark' ? mode : 'auto'
})

const previewIsDark = computed(() => resolvePageThemeIsDark(previewThemeMode.value, isDarkMode.value))
const previewThemeVars = computed(() => getUserPageThemeCssVars(previewTheme.value, previewIsDark.value))
const previewNaiveTheme = computed(() => (previewIsDark.value ? darkTheme : null))
const previewNaiveThemeOverrides = computed(() =>
  getUserPageNaiveThemeOverrides(previewTheme.value, previewThemeVars.value, previewIsDark.value),
)

function toOptions(map: TemplateMapType): TemplateOption[] {
  return Object.entries(map).map(([value, v]) => ({
    label: v.name,
    value,
    capabilities: v.capabilities ?? [],
  }))
}

const groups: Record<'schedule' | 'songlist', TemplateGroup> = {
  schedule: {
    TemplateMap: ScheduleTemplateMap,
    Options: toOptions(ScheduleTemplateMap),
    Data: schedulePreviewData,
  },
  songlist: {
    TemplateMap: SongListTemplateMap,
    Options: toOptions(SongListTemplateMap),
    Data: songListPreviewData,
  },
}

// 各分组当前选中的模板 key (响应式)
const selectedTemplateKey = ref<Record<'schedule' | 'songlist', string>>({
  schedule: accountInfo.value?.settings.scheduleTemplate ?? '',
  songlist: accountInfo.value?.settings.songListTemplate ?? 'traditional',
})

const pageOptions: SelectOption[] = [
  { label: '日程表', value: 'schedule' },
  { label: '歌单', value: 'songlist' },
]

const selectedPage = useRouteQueryParam('template', 'songlist', { transform: String })

// 归一化非法页面值
watch(
  selectedPage,
  (v) => {
    if (v !== 'schedule' && v !== 'songlist') selectedPage.value = 'songlist'
  },
  { immediate: true },
)

const pageKey = computed<'schedule' | 'songlist'>(() => (selectedPage.value === 'schedule' ? 'schedule' : 'songlist'))
const group = computed(() => groups[pageKey.value])
// 当前分组选中的模板 key (可读写, 供下拉 v-model)
const selectedKey = computed({
  get: () => selectedTemplateKey.value[pageKey.value],
  set: (v) => (selectedTemplateKey.value[pageKey.value] = v),
})
const currentTemplate = computed(() => group.value.TemplateMap[selectedKey.value])
const previewComponent = computed(() => currentTemplate.value?.component)
const settingName = computed(() => currentTemplate.value?.settingName)
// 当前模板能力, 按分类分组展示
const capabilityGroups = computed(() => groupCapabilities(currentTemplate.value?.capabilities))
// 能力栏默认收起 (省空间), 点击标题展开
const capabilityExpanded = ref(false)
const capabilityCount = computed(() => currentTemplate.value?.capabilities?.length ?? 0)

// —— 按能力筛选模板 ——
// 选中的能力 (与关系: 模板需同时具备全部所选能力才显示)
const capabilityFilter = ref<TemplateCapability[]>([])
// 切换页面时重置筛选, 避免歌单的能力残留到日程表
watch(pageKey, () => {
  capabilityFilter.value = []
})

// 能力多选下拉: 按分类分组
const capabilityFilterOptions = computed<SelectGroupOption[]>(() => {
  const available = [...new Set(group.value.Options.flatMap((option) => option.capabilities))] as TemplateCapability[]
  const byCategory = groupCapabilities(available)
  return byCategory.map((g) => ({
    type: 'group',
    label: CapabilityCategories[g.category].name,
    key: g.category,
    children: g.items.map((it) => ({ label: it.name, value: it.id })),
  }))
})

// 经能力筛选后的模板下拉选项
const filteredTemplateOptions = computed<TemplateOption[]>(() => {
  const need = capabilityFilter.value
  if (!need.length) return group.value.Options
  return group.value.Options.filter((opt) => need.every((cap) => opt.capabilities.includes(cap)))
})

// 模板下拉自定义渲染: 名称 + 能力数量徽标
function renderTemplateLabel(option: SelectOption) {
  const caps = (option as TemplateOption).capabilities ?? []
  return h('div', { style: 'display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%' }, [
    h('span', option.label as string),
    caps.length
      ? h(
          'span',
          {
            style: 'font-size:11px;color:var(--vtsuru-fg-muted);flex-shrink:0',
          },
          `${caps.length} 项能力`,
        )
      : null,
  ])
}

// 能力表 tooltip 内容: 按分类分组的彩色标签 (供下拉项 hover 弹出)
function renderCapabilityPanel(caps: readonly TemplateCapability[]) {
  const grouped = groupCapabilities(caps)
  if (!grouped.length) return h('span', { style: 'font-size:12px' }, '该模板暂无能力标记')
  return h(
    'div',
    { style: 'display:flex;flex-direction:column;gap:6px;max-width:320px' },
    grouped.map((g) =>
      h('div', { key: g.category, style: 'display:flex;align-items:center;gap:6px;flex-wrap:wrap' }, [
        h(
          'span',
          {
            style: `display:inline-flex;align-items:center;gap:3px;font-size:12px;font-weight:600;color:${CapabilityCategories[g.category].color}`,
          },
          [
            h(NIcon, { component: CapabilityCategories[g.category].icon, size: 14 }),
            CapabilityCategories[g.category].name,
          ],
        ),
        ...g.items.map((it) =>
          h(
            NTag,
            {
              key: it.id,
              size: 'small',
              bordered: true,
              color: getCategoryTagColor(g.category),
            },
            { default: () => it.name },
          ),
        ),
      ]),
    ),
  )
}

// 下拉项整体: 用 tooltip 包裹, hover 弹出该模板能力表
function renderTemplateOption({ node, option }: { node: any; option: SelectOption }) {
  const caps = (option as TemplateOption).capabilities ?? []
  return h(
    NTooltip,
    { placement: 'right', delay: 200 },
    {
      trigger: () => node,
      default: () => renderCapabilityPanel(caps),
    },
  )
}

interface PreviewTemplateInstance {
  Config?: ConfigItemDefinition[]
  DefaultConfig?: Record<string, unknown>
}

interface FormContext {
  name: string
  schema: ConfigItemDefinition[]
}

// schema 必须和 settingName 来自同一个预览实例，避免切换期间旧 schema 读取新模板数据。
const previewRef = shallowRef<PreviewTemplateInstance>()
const formContext = shallowRef<FormContext>()
const configDataCache = ref<Record<string, Record<string, unknown>>>({})
const configSchema = computed(() =>
  formContext.value?.name === settingName.value ? formContext.value.schema : undefined,
)
const currentConfigData = computed(() => (settingName.value ? configDataCache.value[settingName.value] : undefined))

function parseConfigData(data: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(data)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('模板配置格式无效')
  return parsed as Record<string, unknown>
}

async function loadConfig(name: string, defaults: Record<string, unknown>) {
  if (name in configDataCache.value) return

  try {
    const response = await downloadConfigDirect(name)
    if (response.code === 200) {
      configDataCache.value[name] = { ...defaults, ...parseConfigData(response.data) }
    } else if (response.code === 404) {
      configDataCache.value[name] = { ...defaults }
    } else {
      message.error(`获取模板配置失败: ${response.message}`)
    }
  } catch (err) {
    message.error(`获取模板配置失败: ${err}`)
  }
}

function onPreviewMounted() {
  const name = settingName.value
  const instance = previewRef.value
  if (!name || !instance?.Config) return

  formContext.value = { name, schema: instance.Config }
  void loadConfig(name, instance.DefaultConfig ?? {})
}

watch(
  settingName,
  () => {
    previewRef.value = undefined
    formContext.value = undefined
  },
  { flush: 'sync' },
)

async function setAsDisplayTemplate() {
  if (!accountInfo.value) return
  isSaving.value = true
  try {
    if (pageKey.value === 'songlist') {
      accountInfo.value.settings.songListTemplate = selectedKey.value
    } else {
      accountInfo.value.settings.scheduleTemplate = selectedKey.value
    }
    const response = await SaveAccountSettings()
    if (response.code === 200) message.success('已设为展示模板')
    else message.error('保存失败')
  } catch (err) {
    message.error(`保存失败: ${err}`)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <NSpin :show="isSaving">
    <NFlex
      vertical
      :size="12"
    >
      <NAlert
        type="success"
        size="small"
        :bordered="false"
      >
        如果有合适的设计稿或者想法可以给我说然后做成模板捏
      </NAlert>

      <NFlex
        align="center"
        :wrap="true"
        :size="12"
      >
        <NText depth="2"> 页面 </NText>
        <NSelect
          v-model:value="selectedPage"
          :disabled="isFormSaving"
          size="small"
          :options="pageOptions"
          style="width: 140px"
        />
        <NText depth="2"> 模板 </NText>
        <NTooltip>
          <template #trigger>
            <NSelect
              v-model:value="selectedKey"
              :disabled="isFormSaving"
              size="small"
              style="width: 220px"
              :options="filteredTemplateOptions"
              :render-label="renderTemplateLabel"
              :render-option="renderTemplateOption"
            />
          </template>
          悬浮模板项可查看其完整能力表
        </NTooltip>
        <NSelect
          v-model:value="capabilityFilter"
          :disabled="isFormSaving"
          multiple
          clearable
          size="small"
          style="min-width: 200px; max-width: 360px"
          placeholder="按能力筛选模板"
          :options="capabilityFilterOptions"
          :max-tag-count="2"
        />
        <NText
          v-if="capabilityFilter.length"
          depth="3"
          style="font-size: 12px"
        >
          匹配 {{ filteredTemplateOptions.length }} 个模板
        </NText>
        <NButton
          type="primary"
          size="small"
          @click="setAsDisplayTemplate"
        >
          设为展示模板
        </NButton>
        <NTooltip v-if="settingName">
          <template #trigger>
            <NButton
              size="small"
              tertiary
              @click="configCollapsed = !configCollapsed"
            >
              <template #icon>
                <NIcon :component="configCollapsed ? PanelLeftExpand20Filled : PanelLeftContract20Filled" />
              </template>
              {{ configCollapsed ? '展开配置' : '折叠配置' }}
            </NButton>
          </template>
          {{ configCollapsed ? '展开左侧配置面板' : '折叠左侧配置面板, 让预览占满' }}
        </NTooltip>
      </NFlex>

      <!-- 当前模板能力标签 (默认收起, 点击标题展开; 按分类分组, 每类带图标) -->
      <div
        v-if="capabilityGroups.length"
        class="capability-bar"
      >
        <div
          class="capability-bar__title"
          role="button"
          tabindex="0"
          @click="capabilityExpanded = !capabilityExpanded"
          @keydown.enter="capabilityExpanded = !capabilityExpanded"
        >
          <NIcon
            :component="ChevronDown20Regular"
            class="capability-bar__chevron"
            :class="{ 'is-expanded': capabilityExpanded }"
          />
          <NText
            depth="2"
            strong
            style="font-size: 13px"
          >
            模板能力
          </NText>
          <NText
            depth="3"
            style="font-size: 12px"
          >
            共 {{ capabilityCount }} 项{{ capabilityExpanded ? '' : ' · 点击展开' }}
          </NText>
        </div>
        <NCollapseTransition :show="capabilityExpanded">
          <NFlex
            align="flex-start"
            :wrap="true"
            :size="14"
            style="margin-top: 10px"
          >
            <div
              v-for="g in capabilityGroups"
              :key="g.category"
              class="capability-group"
            >
              <span
                class="capability-group__head"
                :style="{ color: CapabilityCategories[g.category].color }"
              >
                <NIcon
                  :component="CapabilityCategories[g.category].icon"
                  :size="15"
                />
                {{ CapabilityCategories[g.category].name }}
              </span>
              <NTooltip
                v-for="cap in g.items"
                :key="cap.id"
              >
                <template #trigger>
                  <NTag
                    size="small"
                    :bordered="true"
                    :color="getCategoryTagColor(g.category)"
                  >
                    <template #icon>
                      <NIcon :component="CapabilityCategories[g.category].icon" />
                    </template>
                    {{ cap.name }}
                  </NTag>
                </template>
                {{ cap.description }}
              </NTooltip>
            </div>
          </NFlex>
        </NCollapseTransition>
      </div>

      <NDivider style="margin: 0" />

      <div
        ref="workspaceRef"
        class="template-workspace"
        :style="{ height: workspaceHeight }"
      >
        <!-- 左: 配置表单 (仅当模板支持配置) -->
        <Transition name="config-slide">
          <div
            v-if="settingName && !configCollapsed"
            class="template-config-pane"
          >
            <NSpin
              v-if="!configSchema || !currentConfigData"
              show
              style="min-height: 200px"
            />
            <DynamicForm
              v-else
              :key="settingName"
              :name="settingName"
              :config-data="currentConfigData"
              :config="configSchema"
              fill-height
              @saving-change="isFormSaving = $event"
            />
          </div>
        </Transition>

        <!-- 右: 实时预览 (容器固定高度, 模板自带滚动则内部滚, 否则由容器兜底) -->
        <div class="template-preview-pane">
          <Transition name="fade">
            <div
              v-if="previewComponent"
              :key="selectedKey"
              class="template-preview-content"
              :class="{
                'song-list-surface': pageKey === 'songlist',
                'schedule-template-surface': pageKey === 'schedule',
              }"
              :style="previewThemeVars"
            >
              <Suspense>
                <NConfigProvider
                  :theme="previewNaiveTheme"
                  :theme-overrides="previewNaiveThemeOverrides"
                >
                  <component
                    :is="previewComponent"
                    ref="previewRef"
                    :user-info="accountInfo"
                    :bili-info="biliUserInfo"
                    :data="group.Data"
                    :config="currentConfigData"
                    :preview-portrait="
                      pageKey === 'schedule' && ['pinky', 'liveposter'].includes(selectedKey)
                        ? nana7miPlaceholder
                        : undefined
                    "
                    @vue:mounted="onPreviewMounted"
                  />
                </NConfigProvider>
              </Suspense>
            </div>
          </Transition>
        </div>
      </div>
    </NFlex>
  </NSpin>
</template>

<style scoped>
.template-workspace {
  display: flex;
  gap: 16px;
  align-items: stretch;
  overflow: hidden;
}

/* 能力标签栏: 整块带背景, 一眼可辨为"模板能力"区 */
.capability-bar {
  padding: 10px 14px;
  border-radius: 10px;
  background: var(--vtsuru-bg-muted, rgba(128, 128, 128, 0.06));
  border: 1px solid var(--vtsuru-border, rgba(128, 128, 128, 0.15));
}

.capability-bar__title {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.capability-bar__title:hover {
  opacity: 0.85;
}

.capability-bar__chevron {
  transition: transform 0.2s ease;
  color: var(--vtsuru-fg-muted);
}

.capability-bar__chevron.is-expanded {
  transform: rotate(180deg);
}

/* 每个分类: 图标标题 + 该类标签, 之间用浅竖线隔开 */
.capability-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding-right: 14px;
  border-right: 1px solid var(--vtsuru-border, rgba(128, 128, 128, 0.2));
}

.capability-group:last-child {
  border-right: none;
  padding-right: 0;
}

.capability-group__head {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  font-weight: 600;
}

.template-config-pane {
  flex: 0 0 340px;
  min-width: 0;
  max-width: 340px;
  height: 100%;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 让 DynamicForm 撑满配置栏高度 (内部表单区滚动, 提交按钮固定顶部) */
.template-config-pane > :deep(.dynamic-form--fill) {
  flex: 1 1 0;
  min-height: 0;
}

/* 折叠/展开过渡 */
.config-slide-enter-active,
.config-slide-leave-active {
  transition:
    flex-basis 0.25s ease,
    max-width 0.25s ease,
    opacity 0.25s ease,
    margin 0.25s ease;
}

.config-slide-enter-from,
.config-slide-leave-to {
  flex-basis: 0;
  max-width: 0;
  opacity: 0;
  margin-right: -16px;
}

.template-preview-pane {
  flex: 1 1 0;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.template-preview-content {
  height: 100% !important;
  overflow: auto;
}

.template-preview-content.song-list-surface {
  background: var(--vtsuru-bg);
}

.template-preview-content > :deep(:only-child) {
  height: 100% !important;
}

.template-preview-content.schedule-template-surface > :deep(:only-child) {
  height: auto !important;
}

/* 窄屏: 取消固定高度, 上下堆叠各自自然展开, 回退到页面整体滚动 */
@media (max-width: 900px) {
  .template-workspace {
    flex-direction: column;
    height: auto !important;
    overflow: visible;
  }

  .template-config-pane {
    flex: none;
    max-width: 100%;
    width: 100%;
    height: auto;
  }

  .template-preview-pane {
    height: auto;
  }

  .template-preview-content {
    height: auto !important;
    overflow: visible;
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
