<script setup lang="ts">
import type { SelectOption } from 'naive-ui'
import type { ConfigItemDefinition } from '@/shared/types/VTsuruConfigTypes'
import type { TemplateMapType } from '@/shared/config/templates'
import { PanelLeftContract20Filled, PanelLeftExpand20Filled } from '@vicons/fluent'
import { useElementBounding, useWindowSize } from '@vueuse/core'
import { NAlert, NButton, NDivider, NFlex, NIcon, NSelect, NSpin, NText, NTooltip, useMessage } from 'naive-ui'
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import { downloadConfigDirect, SaveAccountSettings, useAccount } from '@/api/account'
import DynamicForm from '@/apps/manage/components/DynamicForm.vue'
import { FETCH_API } from '@/shared/config'
import { ScheduleTemplateMap, SongListTemplateMap } from '@/shared/config/templates'
import { useRouteQueryParam } from '@/composables/useRouteQueryParam'
import { schedulePreviewData, songListPreviewData } from './templatePreviewData'

interface TemplateGroup {
  TemplateMap: TemplateMapType
  Options: SelectOption[]
  Data: unknown
}

const accountInfo = useAccount()
const message = useMessage()

const isSaving = ref(false)

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
  const h = windowHeight.value - workspaceTop.value - BOTTOM_GAP
  return h > 320 ? `${h}px` : '320px'
})

// 预览头部展示用的 B 站用户信息
const biliUserInfo = ref()
onMounted(async () => {
  if (!accountInfo.value?.biliId) return
  try {
    const response = await fetch(`${FETCH_API}https://workers.vrp.moe/api/bilibili/user-info/${accountInfo.value.biliId}`)
    const data = await response.json()
    if (data.code === 0) biliUserInfo.value = data.card
  } catch (err) {
    console.error('获取B站用户数据失败:', err)
  }
})

function toOptions(map: TemplateMapType): SelectOption[] {
  return Object.entries(map).map(([value, v]) => ({ label: v.name, value }))
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

const pageKey = computed<'schedule' | 'songlist'>(() =>
  selectedPage.value === 'schedule' ? 'schedule' : 'songlist')
const group = computed(() => groups[pageKey.value])
// 当前分组选中的模板 key (可读写, 供下拉 v-model)
const selectedKey = computed({
  get: () => selectedTemplateKey.value[pageKey.value],
  set: v => selectedTemplateKey.value[pageKey.value] = v,
})
const currentTemplate = computed(() => group.value.TemplateMap[selectedKey.value])
const previewComponent = computed(() => currentTemplate.value?.component)
const settingName = computed(() => currentTemplate.value?.settingName)

// 预览组件实例: 通过 defineExpose 暴露 Config(schema 定义) 和 DefaultConfig
const previewRef = shallowRef<{ Config?: ConfigItemDefinition[], DefaultConfig?: unknown }>()
const configSchema = computed<ConfigItemDefinition[] | undefined>(() => previewRef.value?.Config)

// 用户已保存的配置数据, 按 settingName 缓存 (修复同一页面下多个可配置模板串味的 bug)
const configDataCache = ref<Record<string, unknown>>({})
const loadingConfig = ref(false)
const currentConfigData = computed(() => settingName.value ? configDataCache.value[settingName.value] : undefined)

// 加载当前模板配置 (按 settingName 缓存, 命中则跳过)
async function loadConfig() {
  const name = settingName.value
  if (!name || name in configDataCache.value) return

  loadingConfig.value = true
  try {
    const response = await downloadConfigDirect(name)
    if (response.code === 200) {
      configDataCache.value[name] = JSON.parse(response.data)
    } else if (response.code === 404) {
      // 无远端配置, 用组件默认配置兜底
      configDataCache.value[name] = previewRef.value?.DefaultConfig ?? {}
    } else {
      message.error(`获取模板配置失败: ${response.message}`)
    }
  } catch (err) {
    message.error(`获取模板配置失败: ${err}`)
  } finally {
    loadingConfig.value = false
  }
}

// 预览组件挂载完成 -> 拿到 schema -> 加载对应配置
function onPreviewMounted() {
  void loadConfig()
}

// 切换模板时, schema 与配置都需重新解析
watch(settingName, () => {
  nextTick(() => void loadConfig())
})

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
    <NFlex vertical :size="12">
      <NAlert type="success" size="small" :bordered="false">
        如果有合适的设计稿或者想法可以给我说然后做成模板捏
      </NAlert>

      <NFlex align="center" :wrap="true" :size="12">
        <NText depth="2">
          页面
        </NText>
        <NSelect
          v-model:value="selectedPage"
          size="small"
          :options="pageOptions"
          style="width: 140px"
        />
        <NText depth="2">
          模板
        </NText>
        <NSelect
          v-model:value="selectedKey"
          size="small"
          style="width: 180px"
          :options="group.Options"
        />
        <NButton type="primary" size="small" @click="setAsDisplayTemplate">
          设为展示模板
        </NButton>
        <NTooltip v-if="settingName">
          <template #trigger>
            <NButton size="small" tertiary @click="configCollapsed = !configCollapsed">
              <template #icon>
                <NIcon :component="configCollapsed ? PanelLeftExpand20Filled : PanelLeftContract20Filled" />
              </template>
              {{ configCollapsed ? '展开配置' : '折叠配置' }}
            </NButton>
          </template>
          {{ configCollapsed ? '展开左侧配置面板' : '折叠左侧配置面板, 让预览占满' }}
        </NTooltip>
      </NFlex>

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
            <NSpin v-if="loadingConfig || !configSchema" show style="min-height: 200px" />
            <DynamicForm
              v-else
              :key="settingName"
              :name="settingName"
              :config-data="currentConfigData"
              :config="configSchema"
              fill-height
            />
          </div>
        </Transition>

        <!-- 右: 实时预览 (容器固定高度, 模板自带滚动则内部滚, 否则由容器兜底) -->
        <div class="template-preview-pane">
          <Transition name="fade">
            <Suspense v-if="previewComponent" :key="selectedKey">
              <component
                :is="previewComponent"
                ref="previewRef"
                :user-info="accountInfo"
                :bili-info="biliUserInfo"
                :data="group.Data"
                :config="currentConfigData"
                @vue:mounted="onPreviewMounted"
              />
            </Suspense>
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
  transition: flex-basis 0.25s ease, max-width 0.25s ease, opacity 0.25s ease, margin 0.25s ease;
}

.config-slide-enter-from,
.config-slide-leave-to {
  flex-basis: 0;
  max-width: 0;
  opacity: 0;
  margin-right: -16px;
}

/* 右栏: 作为唯一滚动容器. 通过缩放变量/解除内部固定高度, 避免模板自带滚动形成双层 */
.template-preview-pane {
  flex: 1 1 0;
  min-width: 0;
  height: 100%;
  overflow: auto;
  position: relative;
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
