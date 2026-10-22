<script setup lang="ts">
import { ChevronDown20Regular, PanelLeftContract20Filled, PanelLeftExpand20Filled } from '@vicons/fluent'
import { useElementBounding, useWindowSize } from '@vueuse/core'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'

import { downloadConfigDirect, SaveAccountSettings, useAccount } from '@/api/account'
import DynamicForm from '@/apps/manage/components/DynamicForm.vue'
import { fetchUserPagesSettingsByUserId } from '@/apps/user-page/api'
import { getUserPageThemeCssVars } from '@/apps/user-page/background'
import { resolvePageThemeIsDark } from '@/apps/user-page/theme'
import { getUserPageAppearanceOverrides } from '@/apps/user-page/themeConfig'
import type { UserPagesSettings } from '@/apps/user-page/types'
import nana7miPlaceholder from '@/assets/images/schedule/nana7mi-placeholder.webp'
import { useRouteQueryParam } from '@/composables/useRouteQueryParam'
import { FETCH_API } from '@/shared/config'
import type { TemplateCapability } from '@/shared/config/templateCapabilities'
import { CapabilityCategories, groupCapabilities } from '@/shared/config/templateCapabilities'
import type { TemplateMapType } from '@/shared/config/templates'
import { ScheduleTemplateMap, SongListTemplateMap } from '@/shared/config/templates'
import type { ConfigItemDefinition } from '@/shared/types/VTsuruConfigTypes'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { Tag } from '@/shared/ui/tag'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { isDarkMode, useMessage } from '@/shared/utils'

import '@/apps/user/pages/songListTemplate/songListTheme.css'
import { schedulePreviewData, songListPreviewData } from './templatePreviewData'

interface TemplateOption {
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

// 工作区固定占满视口剩余高度
const workspaceRef = ref<HTMLElement>()
const { top: workspaceTop } = useElementBounding(workspaceRef, { windowScroll: false })
const { height: windowHeight } = useWindowSize()
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

// 各分组当前选中的模板 key
const selectedTemplateKey = ref<Record<'schedule' | 'songlist', string>>({
  schedule: accountInfo.value?.settings.scheduleTemplate ?? '',
  songlist: accountInfo.value?.settings.songListTemplate || 'traditional',
})

watch(
  () => accountInfo.value?.settings,
  (settings) => {
    if (!settings) return
    selectedTemplateKey.value = {
      schedule: settings.scheduleTemplate ?? '',
      songlist: settings.songListTemplate || 'traditional',
    }
  },
  { immediate: true },
)

const pageOptions = [
  { label: '日程表', value: 'schedule' },
  { label: '歌单', value: 'songlist' },
]

const selectedPage = useRouteQueryParam('template', 'songlist', { transform: String })

watch(
  selectedPage,
  (v) => {
    if (v !== 'schedule' && v !== 'songlist') selectedPage.value = 'songlist'
  },
  { immediate: true },
)

const pageKey = computed<'schedule' | 'songlist'>(() => (selectedPage.value === 'schedule' ? 'schedule' : 'songlist'))
const group = computed(() => groups[pageKey.value])

const selectedKey = computed({
  get: () => selectedTemplateKey.value[pageKey.value],
  set: (v) => (selectedTemplateKey.value[pageKey.value] = v),
})
const currentTemplate = computed(() => group.value.TemplateMap[selectedKey.value])
const previewComponent = computed(() => currentTemplate.value?.component)
const settingName = computed(() => currentTemplate.value?.settingName)
const capabilityGroups = computed(() => groupCapabilities(currentTemplate.value?.capabilities))
const capabilityExpanded = ref(false)
const capabilityCount = computed(() => currentTemplate.value?.capabilities?.length ?? 0)

// 按能力筛选
const capabilityFilter = ref<TemplateCapability[]>([])
watch(pageKey, () => {
  capabilityFilter.value = []
})

const filteredTemplateOptions = computed<TemplateOption[]>(() => {
  const need = capabilityFilter.value
  if (!need.length) return group.value.Options
  return group.value.Options.filter((opt) => need.every((cap) => opt.capabilities.includes(cap)))
})

interface PreviewTemplateInstance {
  Config?: ConfigItemDefinition[]
  DefaultConfig?: Record<string, unknown>
}

interface FormContext {
  name: string
  schema: ConfigItemDefinition[]
}

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
    if (response.code === 200) {
      message.success('已设为展示模板')
    } else {
      message.error(response.message ? `保存失败: ${response.message}` : '保存失败')
    }
  } catch (err) {
    message.error(`保存失败: ${err}`)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <div class="relative flex flex-col gap-3">
    <div
      v-if="isSaving"
      class="absolute inset-0 bg-background/60 backdrop-blur-sm z-50 flex items-center justify-center"
    >
      <Spin />
    </div>

    <Alert class="bg-primary/5 border-primary/20 text-xs py-2 text-primary">
      <AlertDescription> 如果有合适的设计稿或者想法可以给我说然后做成模板捏 </AlertDescription>
    </Alert>

    <div class="flex flex-wrap items-center gap-3">
      <div class="flex items-center gap-2">
        <span class="text-xs text-muted-foreground">页面</span>
        <div class="w-28">
          <Select
            v-model="selectedPage"
            :disabled="isFormSaving"
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in pageOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <span class="text-xs text-muted-foreground">模板</span>
        <div class="min-w-[180px]">
          <Select
            v-model="selectedKey"
            :disabled="isFormSaving"
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in filteredTemplateOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }} {{ opt.capabilities?.length ? `(${opt.capabilities.length} 项能力)` : '' }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        :disabled="isSaving"
        @click="setAsDisplayTemplate"
      >
        设为展示模板
      </Button>

      <Button
        v-if="settingName"
        variant="outline"
        @click="configCollapsed = !configCollapsed"
      >
        <component
          :is="configCollapsed ? PanelLeftExpand20Filled : PanelLeftContract20Filled"
          class="size-3.5 mr-1"
        />
        {{ configCollapsed ? '展开配置' : '折叠配置' }}
      </Button>
    </div>

    <!-- 当前模板能力标签 -->
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
        <component
          :is="ChevronDown20Regular"
          class="capability-bar__chevron size-3.5"
          :class="{ 'is-expanded': capabilityExpanded }"
        />
        <span class="text-xs font-semibold text-foreground">模板能力</span>
        <span class="text-[11px] text-muted-foreground">
          共 {{ capabilityCount }} 项{{ capabilityExpanded ? '' : ' · 点击展开' }}
        </span>
      </div>
      <div
        v-show="capabilityExpanded"
        class="flex flex-wrap gap-3.5 mt-2.5"
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
            <component
              :is="CapabilityCategories[g.category].icon"
              class="size-3.5"
            />
            {{ CapabilityCategories[g.category].name }}
          </span>
          <TooltipProvider
            v-for="cap in g.items"
            :key="cap.id"
          >
            <Tooltip>
              <TooltipTrigger as-child>
                <Tag
                  variant="outline"
                  class="text-[11px] h-5 px-1.5 flex items-center gap-1"
                >
                  <component
                    :is="CapabilityCategories[g.category].icon"
                    class="size-3"
                  />
                  {{ cap.name }}
                </Tag>
              </TooltipTrigger>
              <TooltipContent>
                {{ cap.description }}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>

    <div class="h-px bg-border w-full" />

    <div
      ref="workspaceRef"
      class="template-workspace"
      :style="{ height: workspaceHeight }"
    >
      <!-- 左: 配置表单 -->
      <Transition name="config-slide">
        <div
          v-if="settingName && !configCollapsed"
          class="template-config-pane"
        >
          <div
            v-if="!configSchema || !currentConfigData"
            class="min-h-[200px] flex items-center justify-center"
          >
            <Spin />
          </div>
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

      <!-- 右: 实时预览 -->
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
            </Suspense>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.template-workspace {
  display: flex;
  gap: 16px;
  align-items: stretch;
  overflow: hidden;
}

.capability-bar {
  padding: 10px 14px;
  border-radius: 8px;
  background: var(--muted);
  border: 1px solid var(--border);
}

.capability-bar__title {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
}

.capability-bar__chevron {
  transition: transform 0.2s ease;
  color: var(--muted-foreground);
}

.capability-bar__chevron.is-expanded {
  transform: rotate(180deg);
}

.capability-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding-right: 14px;
  border-right: 1px solid var(--border);
}

.capability-group:last-child {
  border-right: none;
}

.capability-group__head {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 600;
}

.template-config-pane {
  width: 320px;
  flex-shrink: 0;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card);
  overflow: hidden;
}

.template-preview-pane {
  flex: 1;
  min-width: 0;
  border-radius: 8px;
  border: 1px solid var(--border);
  overflow: hidden;
  background: var(--card);
  display: flex;
  flex-direction: column;
}

.template-preview-content {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.config-slide-enter-active,
.config-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.config-slide-enter-from,
.config-slide-leave-to {
  width: 0;
  opacity: 0;
  margin-right: -16px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
