<script setup lang="ts">
import { ChevronDown, ChevronRight, Eye, EyeOff, Image as ImageIcon, Layers, RefreshCw, Sparkles } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useOBSStore } from '@/apps/client/store/useOBSStore'
import type { RpcObsSceneItemRef } from '@/shared/rpc/contract'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'

interface SourceFilterItem {
  filterName: string
  filterKind: string
  filterEnabled: boolean
  filterIndex: number
}

const obs = useOBSStore()

const selectedScene = ref('')
const items = ref<RpcObsSceneItemRef[]>([])
const loading = ref(false)
const expandedSources = ref<Record<string, boolean>>({})
const filtersBySource = ref<Record<string, SourceFilterItem[]>>({})
const loadingFilters = ref<Record<string, boolean>>({})
const previewBySource = ref<Record<string, string>>({})
const loadingPreview = ref<Record<string, boolean>>({})

const effectiveScene = computed(() => selectedScene.value || obs.currentObsScene || obs.obsScenes[0] || '')

/** OBS GetSceneItemList 返回底→顶顺序，图层列表按视觉顶→底展示 */
const orderedItems = computed(() => [...items.value].reverse())

async function refreshItems() {
  if (!obs.obsConnected || !effectiveScene.value) {
    items.value = []
    return
  }
  loading.value = true
  try {
    const res = await obs.getSceneItems(effectiveScene.value)
    items.value = res.items
  } catch (err) {
    toast.error(`读取 OBS 图层失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    loading.value = false
  }
}

async function toggleItemVisible(item: RpcObsSceneItemRef) {
  if (!effectiveScene.value) return
  const next = !item.enabled
  try {
    await obs.setSceneItemEnabled(effectiveScene.value, item.sceneItemId, next)
    item.enabled = next
  } catch (err) {
    toast.error(`切换源显隐失败: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function toggleExpandSource(sourceName: string) {
  const next = !expandedSources.value[sourceName]
  expandedSources.value = { ...expandedSources.value, [sourceName]: next }
  if (next && !filtersBySource.value[sourceName]) {
    await loadFilters(sourceName)
  }
}

async function loadFilters(sourceName: string) {
  loadingFilters.value = { ...loadingFilters.value, [sourceName]: true }
  try {
    const list = await obs.getSourceFilters(sourceName)
    filtersBySource.value = { ...filtersBySource.value, [sourceName]: list }
  } catch (err) {
    toast.error(`读取滤镜失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    loadingFilters.value = { ...loadingFilters.value, [sourceName]: false }
  }
}

async function toggleFilter(sourceName: string, filter: SourceFilterItem, enabled: boolean) {
  try {
    await obs.setSourceFilterEnabled(sourceName, filter.filterName, enabled)
    filter.filterEnabled = enabled
  } catch (err) {
    toast.error(`切换滤镜状态失败: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function snapSourcePreview(sourceName: string) {
  if (previewBySource.value[sourceName]) {
    const next = { ...previewBySource.value }
    delete next[sourceName]
    previewBySource.value = next
    return
  }
  loadingPreview.value = { ...loadingPreview.value, [sourceName]: true }
  try {
    const res = await obs.getSourceScreenshot({
      sourceName,
      width: 320,
      height: 180,
    })
    if (res.ok && res.imageData) {
      previewBySource.value = { ...previewBySource.value, [sourceName]: res.imageData }
    } else {
      toast.warning(res.message || '该源暂无可捕获画面')
    }
  } finally {
    loadingPreview.value = { ...loadingPreview.value, [sourceName]: false }
  }
}

watch(
  () => obs.currentObsScene,
  (scene) => {
    if (scene && (!selectedScene.value || !obs.obsScenes.includes(selectedScene.value))) {
      selectedScene.value = scene
    }
  },
  { immediate: true },
)

watch(
  [() => obs.obsConnected, effectiveScene],
  ([connected, scene]) => {
    if (connected && scene) {
      void refreshItems()
    } else {
      items.value = []
    }
  },
  { immediate: true },
)
</script>

<template>
  <div
    v-if="obs.obsConnected"
    class="space-y-2.5"
  >
    <div class="flex-between gap-2 flex-wrap">
      <div class="flex items-center gap-1.5">
        <Layers class="size-3.5 text-primary" />
        <span class="text-xs font-semibold text-foreground">源与滤镜可视化图层</span>
        <Badge
          variant="secondary"
          size="xs"
          class="tabular-nums"
        >
          {{ items.length }}
        </Badge>
      </div>

      <div class="flex items-center gap-1.5">
        <div class="w-44">
          <Select
            :model-value="effectiveScene"
            @update:model-value="(v) => (selectedScene = String(v ?? ''))"
          >
            <SelectTrigger class="w-full">
              <SelectValue placeholder="选择查看的场景" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="scene in obs.obsScenes"
                :key="scene"
                :value="scene"
              >
                {{ scene }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          size="icon-xs"
          variant="outline"
          :disabled="loading"
          title="刷新图层列表"
          @click="refreshItems"
        >
          <RefreshCw
            class="size-3.5"
            :class="{ 'animate-spin': loading }"
          />
        </Button>
      </div>
    </div>

    <div
      v-if="orderedItems.length === 0"
      class="py-4 text-center text-xs text-muted-foreground rounded-md border border-dashed border-border"
    >
      {{ loading ? '正在读取场景源列表...' : '该场景暂无源图层' }}
    </div>

    <div
      v-else
      class="space-y-1.5 max-h-[320px] overflow-y-auto scrollbar-thin pr-1"
    >
      <div
        v-for="item in orderedItems"
        :key="item.sceneItemId"
        class="rounded-md border border-border bg-card overflow-hidden"
      >
        <div class="px-2.5 py-1.5 flex items-center gap-2">
          <Button
            type="button"
            size="icon-xs"
            variant="ghost"
            class="shrink-0"
            :title="expandedSources[item.sourceName] ? '收起滤镜' : '展开滤镜'"
            @click="toggleExpandSource(item.sourceName)"
          >
            <ChevronDown
              v-if="expandedSources[item.sourceName]"
              class="size-3.5"
            />
            <ChevronRight
              v-else
              class="size-3.5"
            />
          </Button>

          <Button
            type="button"
            size="icon-xs"
            :variant="item.enabled ? 'ghost' : 'secondary'"
            class="shrink-0"
            :class="item.enabled ? 'text-foreground' : 'text-muted-foreground'"
            :title="item.enabled ? '点击隐藏源' : '点击显示源'"
            @click="toggleItemVisible(item)"
          >
            <Eye
              v-if="item.enabled"
              class="size-3.5"
            />
            <EyeOff
              v-else
              class="size-3.5"
            />
          </Button>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <span
                class="text-xs font-medium truncate"
                :class="item.enabled ? 'text-foreground' : 'text-muted-foreground line-through'"
                :title="item.sourceName"
              >
                {{ item.sourceName }}
              </span>
              <Badge
                variant="outline"
                size="xs"
                class="font-mono shrink-0"
              >
                {{ item.inputKind }}
              </Badge>
            </div>
            <div class="text-[10px] text-muted-foreground font-mono tabular-nums">
              {{ item.width }}×{{ item.height }} · ({{ item.x }}, {{ item.y }})
            </div>
          </div>

          <Button
            type="button"
            size="icon-xs"
            :variant="previewBySource[item.sourceName] ? 'default' : 'ghost'"
            class="shrink-0"
            :disabled="loadingPreview[item.sourceName]"
            title="预览该源单帧画面"
            @click="snapSourcePreview(item.sourceName)"
          >
            <ImageIcon class="size-3.5" />
          </Button>
        </div>

        <!-- 源缩略图预览 -->
        <div
          v-if="previewBySource[item.sourceName]"
          class="px-2.5 pb-2"
        >
          <div class="rounded overflow-hidden border border-border bg-black/80 max-w-[260px]">
            <img
              :src="previewBySource[item.sourceName]"
              :alt="item.sourceName"
              class="w-full h-auto block"
            />
          </div>
        </div>

        <!-- 展开的滤镜列表 -->
        <div
          v-if="expandedSources[item.sourceName]"
          class="px-3 py-2 border-t border-border bg-muted/20 space-y-1.5"
        >
          <div class="flex-between text-[11px] text-muted-foreground">
            <span class="flex items-center gap-1">
              <Sparkles class="size-3" />
              源滤镜列表
            </span>
            <button
              type="button"
              class="text-primary hover:underline"
              @click="loadFilters(item.sourceName)"
            >
              刷新
            </button>
          </div>

          <div
            v-if="loadingFilters[item.sourceName]"
            class="text-[11px] text-muted-foreground py-1"
          >
            正在读取滤镜...
          </div>
          <div
            v-else-if="!filtersBySource[item.sourceName] || filtersBySource[item.sourceName].length === 0"
            class="text-[11px] text-muted-foreground py-1"
          >
            该源未挂载 OBS 滤镜
          </div>
          <div
            v-else
            class="space-y-1"
          >
            <div
              v-for="filter in filtersBySource[item.sourceName]"
              :key="filter.filterName"
              class="flex-between gap-2 py-1 px-2 rounded bg-card border border-border/60"
            >
              <div class="min-w-0 flex items-center gap-1.5">
                <span class="text-xs truncate">{{ filter.filterName }}</span>
                <span class="text-[10px] font-mono text-muted-foreground shrink-0">{{ filter.filterKind }}</span>
              </div>
              <Switch
                :checked="filter.filterEnabled"
                @update:checked="(v) => toggleFilter(item.sourceName, filter, v)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
