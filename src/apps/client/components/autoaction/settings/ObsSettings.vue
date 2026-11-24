<script setup lang="ts">
import { RefreshCw } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'

import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { ActionType } from '@/apps/client/store/useAutoAction'
import { useOBSStore } from '@/apps/client/store/useOBSStore'
import { useObsSceneControl } from '@/apps/client/store/useObsSceneControl'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'

const props = defineProps<{ action: AutoActionItem }>()
const obs = useOBSStore()
const sceneCtrl = useObsSceneControl()

const CURRENT_SCENE_SENTINEL = '__current__'

onMounted(async () => {
  if (props.action.actionType === ActionType.OBS_SCENE_SWITCH) {
    await sceneCtrl.refreshProjects()
    if (props.action.actionConfig.obsSceneProjectId) {
      await sceneCtrl.loadProject(props.action.actionConfig.obsSceneProjectId)
    }
  }
})

watch(
  () => props.action.actionType,
  async (type) => {
    if (type === ActionType.OBS_SCENE_SWITCH) {
      await sceneCtrl.refreshProjects()
      if (props.action.actionConfig.obsSceneProjectId) {
        await sceneCtrl.loadProject(props.action.actionConfig.obsSceneProjectId)
      }
    }
  },
)

const selectedProjectSubScenes = computed(() =>
  props.action.actionConfig.obsSceneProjectId
    ? sceneCtrl.getSubScenesFor(props.action.actionConfig.obsSceneProjectId)
    : [],
)

const sceneOptions = computed(() => obs.obsScenes)
const sourceOptions = ref<string[]>([])
const filterOptions = ref<string[]>([])
const loadingSources = ref(false)
const loadingFilters = ref(false)

const effectiveSceneForLookup = computed(() => {
  const configured = props.action.actionConfig.obsSceneName?.trim()
  return configured || obs.currentObsScene || obs.obsScenes[0] || ''
})

async function loadSourcesForScene() {
  if (!obs.obsConnected || !effectiveSceneForLookup.value) {
    sourceOptions.value = []
    return
  }
  loadingSources.value = true
  try {
    const res = await obs.getSceneItems(effectiveSceneForLookup.value)
    const names = Array.from(new Set(res.items.map((item) => item.sourceName).filter(Boolean)))
    sourceOptions.value = names
  } catch {
    sourceOptions.value = []
  } finally {
    loadingSources.value = false
  }
}

async function loadFiltersForSource() {
  const sourceName = props.action.actionConfig.obsSourceName?.trim()
  if (!obs.obsConnected || !sourceName) {
    filterOptions.value = []
    return
  }
  loadingFilters.value = true
  try {
    const list = await obs.getSourceFilters(sourceName)
    filterOptions.value = list.map((f) => f.filterName).filter(Boolean)
  } catch {
    filterOptions.value = []
  } finally {
    loadingFilters.value = false
  }
}

watch(
  [() => obs.obsConnected, effectiveSceneForLookup, () => props.action.actionType],
  ([connected, _scene, type]) => {
    if (connected && (type === ActionType.OBS_SOURCE_VISIBLE || type === ActionType.OBS_FILTER_ENABLED)) {
      void loadSourcesForScene()
    }
  },
  { immediate: true },
)

watch(
  [() => obs.obsConnected, () => props.action.actionConfig.obsSourceName, () => props.action.actionType],
  ([connected, _source, type]) => {
    if (connected && type === ActionType.OBS_FILTER_ENABLED) {
      void loadFiltersForSource()
    }
  },
  { immediate: true },
)

const allCandidateSources = computed(() => {
  const set = new Set<string>([...sourceOptions.value, ...obs.obsScenes])
  return Array.from(set)
})
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b flex-row items-center justify-between space-y-0">
      <CardTitle class="text-xs font-semibold">OBS 联动动作配置</CardTitle>
      <Button
        v-if="obs.obsConnected && (props.action.actionType === ActionType.OBS_SOURCE_VISIBLE || props.action.actionType === ActionType.OBS_FILTER_ENABLED)"
        type="button"
        size="xs"
        variant="ghost"
        class="gap-1 text-muted-foreground"
        :disabled="loadingSources || loadingFilters"
        @click="
          () => {
            void loadSourcesForScene()
            void loadFiltersForSource()
          }
        "
      >
        <RefreshCw
          class="size-3"
          :class="{ 'animate-spin': loadingSources || loadingFilters }"
        />
        刷新源/滤镜
      </Button>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <Alert
        v-if="!obs.obsConnected && props.action.actionType !== ActionType.OBS_SCENE_SWITCH"
        size="sm"
        variant="warning"
      >
        <AlertDescription class="m-0">
          当前 OBS 未连接，你仍可先填写场景/源名称；连接 OBS 后将自动提供场景 → 源 → 滤镜级联下拉选择。
        </AlertDescription>
      </Alert>

      <template v-if="props.action.actionType === ActionType.OBS_SCENE_SWITCH">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label="VTsuru 场景项目"
            class="min-w-0"
          >
            <Select
              :model-value="props.action.actionConfig.obsSceneProjectId ? String(props.action.actionConfig.obsSceneProjectId) : ''"
              @update:model-value="
                (v) => {
                  const id = v ? Number(v) : undefined
                  props.action.actionConfig.obsSceneProjectId = id
                  props.action.actionConfig.obsSubSceneId = ''
                  if (id) void sceneCtrl.loadProject(id)
                }
              "
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择云端场景项目" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="proj in sceneCtrl.projects"
                  :key="proj.id"
                  :value="String(proj.id)"
                >
                  {{ proj.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="目标子场景"
            class="min-w-0"
          >
            <Select
              :model-value="props.action.actionConfig.obsSubSceneId ?? ''"
              :disabled="!props.action.actionConfig.obsSceneProjectId || selectedProjectSubScenes.length === 0"
              @update:model-value="(v) => (props.action.actionConfig.obsSubSceneId = String(v ?? ''))"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择要切换的子场景" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="sub in selectedProjectSubScenes"
                  :key="sub.id"
                  :value="sub.id"
                >
                  {{ sub.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </template>

      <template v-else-if="props.action.actionType === ActionType.OBS_SWITCH_SCENE">
        <FormField
          label="目标 OBS 场景"
          description="触发后将切换至该 OBS 场景"
        >
          <div class="space-y-2">
            <Select
              v-if="sceneOptions.length > 0"
              :model-value="props.action.actionConfig.obsSceneName ?? ''"
              @update:model-value="(v) => (props.action.actionConfig.obsSceneName = String(v ?? ''))"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择 OBS 场景" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="s in sceneOptions"
                  :key="s"
                  :value="s"
                >
                  {{ s }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Input
              v-model="props.action.actionConfig.obsSceneName"
              placeholder="或手动输入精确场景名"
            />
          </div>
        </FormField>
      </template>

      <template v-else-if="props.action.actionType === ActionType.OBS_SOURCE_VISIBLE">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label="所在场景（留空则操作当前场景）"
            class="min-w-0"
          >
            <div class="space-y-1.5">
              <Select
                v-if="sceneOptions.length > 0"
                :model-value="props.action.actionConfig.obsSceneName || CURRENT_SCENE_SENTINEL"
                @update:model-value="
                  (v) =>
                    (props.action.actionConfig.obsSceneName =
                      v === CURRENT_SCENE_SENTINEL ? '' : String(v ?? ''))
                "
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="选择所在场景" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem :value="CURRENT_SCENE_SENTINEL">当前场景（跟随切换）</SelectItem>
                  <SelectItem
                    v-for="s in sceneOptions"
                    :key="s"
                    :value="s"
                  >
                    {{ s }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Input
                v-else
                v-model="props.action.actionConfig.obsSceneName"
                placeholder="留空默认当前场景"
              />
            </div>
          </FormField>

          <FormField
            label="OBS 源名称"
            class="min-w-0"
          >
            <div class="space-y-1.5">
              <Select
                v-if="sourceOptions.length > 0"
                :model-value="props.action.actionConfig.obsSourceName ?? ''"
                @update:model-value="(v) => (props.action.actionConfig.obsSourceName = String(v ?? ''))"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="选择该场景下的 OBS 源" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="src in sourceOptions"
                    :key="src"
                    :value="src"
                  >
                    {{ src }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Input
                v-model="props.action.actionConfig.obsSourceName"
                placeholder="或手动输入精确源名"
              />
            </div>
          </FormField>
        </div>
        <SettingRow
          type="switch"
          variant="compact"
          title="显示源"
          description="开启表示显示该源，关闭表示隐藏该源"
          :model-value="props.action.actionConfig.obsSourceVisible ?? true"
          @update:model-value="(v: boolean) => (props.action.actionConfig.obsSourceVisible = v)"
        />
      </template>

      <template v-else-if="props.action.actionType === ActionType.OBS_FILTER_ENABLED">
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <FormField
            label="筛选场景（可选）"
            class="min-w-0"
          >
            <Select
              v-if="sceneOptions.length > 0"
              :model-value="props.action.actionConfig.obsSceneName || CURRENT_SCENE_SENTINEL"
              @update:model-value="
                (v) =>
                  (props.action.actionConfig.obsSceneName =
                    v === CURRENT_SCENE_SENTINEL ? '' : String(v ?? ''))
              "
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="按场景筛选源" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="CURRENT_SCENE_SENTINEL">当前场景</SelectItem>
                <SelectItem
                  v-for="s in sceneOptions"
                  :key="s"
                  :value="s"
                >
                  {{ s }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Input
              v-else
              v-model="props.action.actionConfig.obsSceneName"
              placeholder="可选场景"
            />
          </FormField>

          <FormField
            label="OBS 源/场景名称"
            class="min-w-0"
          >
            <div class="space-y-1.5">
              <Select
                v-if="allCandidateSources.length > 0"
                :model-value="props.action.actionConfig.obsSourceName ?? ''"
                @update:model-value="
                  (v) => {
                    props.action.actionConfig.obsSourceName = String(v ?? '')
                    props.action.actionConfig.obsFilterName = ''
                  }
                "
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="选择挂载滤镜的源" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="src in allCandidateSources"
                    :key="src"
                    :value="src"
                  >
                    {{ src }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Input
                v-model="props.action.actionConfig.obsSourceName"
                placeholder="或输入源/场景名称"
              />
            </div>
          </FormField>

          <FormField
            label="滤镜名称"
            class="min-w-0"
          >
            <div class="space-y-1.5">
              <Select
                v-if="filterOptions.length > 0"
                :model-value="props.action.actionConfig.obsFilterName ?? ''"
                @update:model-value="(v) => (props.action.actionConfig.obsFilterName = String(v ?? ''))"
              >
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="选择滤镜" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="f in filterOptions"
                    :key="f"
                    :value="f"
                  >
                    {{ f }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <Input
                v-model="props.action.actionConfig.obsFilterName"
                placeholder="例如：模糊 / 色彩校正"
              />
            </div>
          </FormField>
        </div>
        <SettingRow
          type="switch"
          variant="compact"
          title="启用滤镜"
          description="触发后启用或关闭指定滤镜"
          :model-value="props.action.actionConfig.obsFilterEnabled ?? true"
          @update:model-value="(v: boolean) => (props.action.actionConfig.obsFilterEnabled = v)"
        />
      </template>

      <template v-else-if="props.action.actionType === ActionType.OBS_SAVE_REPLAY">
        <Alert
          size="sm"
          variant="info"
        >
          <AlertDescription class="m-0">
            触发后立即保存当前 OBS 回放缓存（高光切片）。请确保 OBS 中已开启「回放缓存」。
          </AlertDescription>
        </Alert>
      </template>
    </CardContent>
  </Card>
</template>
