<script setup lang="ts">
import { ExternalLink, Eye, EyeOff, Layers, RefreshCw, Send } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { useOBSStore } from '@/apps/client/store/useOBSStore'
import { useObsSceneControl } from '@/apps/client/store/useObsSceneControl'
import ObsSceneRenderer from '@/apps/obs-scene/components/ObsSceneRenderer.vue'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

const props = withDefaults(
  defineProps<{
    /** 是否默认展开内置场景渲染预览 */
    defaultPreview?: boolean
    /** 紧凑模式（用于工具总览） */
    compact?: boolean
  }>(),
  {
    defaultPreview: false,
    compact: false,
  },
)

const router = useRouter()
const obs = useOBSStore()
const sceneCtrl = useObsSceneControl()

const showPreview = ref(props.defaultPreview)
const previewWrapRef = ref<HTMLDivElement | null>(null)
const containerSize = ref({ width: 480, height: 270 })
let resizeObserver: ResizeObserver | null = null

const canvasSize = computed(() => ({
  width: sceneCtrl.selectedDoc?.canvas.width || 1920,
  height: sceneCtrl.selectedDoc?.canvas.height || 1080,
}))

const previewScale = computed(() => {
  const { width: cw, height: ch } = containerSize.value
  const { width: sw, height: sh } = canvasSize.value
  if (!cw || !ch || !sw || !sh) return 0.25
  return Math.min(cw / sw, ch / sh)
})

const scaledStageStyle = computed(() => ({
  width: `${Math.round(canvasSize.value.width * previewScale.value)}px`,
  height: `${Math.round(canvasSize.value.height * previewScale.value)}px`,
}))

watch(previewWrapRef, (el) => {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (!el) return
  const update = () => {
    const rect = el.getBoundingClientRect()
    if (rect.width > 0 && rect.height > 0) {
      containerSize.value = { width: rect.width, height: rect.height }
    }
  }
  update()
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect && rect.width > 0 && rect.height > 0) {
        containerSize.value = { width: rect.width, height: rect.height }
      }
    })
    resizeObserver.observe(el)
  }
})

onMounted(() => {
  void sceneCtrl.refreshProjects()
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})

async function handleSwitchSubScene(sceneId: string) {
  if (!sceneCtrl.selectedProjectId) return
  try {
    await sceneCtrl.switchSubScene(sceneCtrl.selectedProjectId, sceneId)
  } catch (err) {
    toast.error(`切换子场景失败: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function handleSyncLayout() {
  if (!sceneCtrl.selectedProjectId) return
  try {
    await sceneCtrl.syncCurrentLayoutToObs(sceneCtrl.selectedProjectId, sceneCtrl.activeSceneId)
  } catch (err) {
    toast.error(`同步布局失败: ${err instanceof Error ? err.message : String(err)}`)
  }
}

function openSceneEditor() {
  void router.push({
    path: '/manage/obs-scene-editor',
    query: sceneCtrl.selectedProjectId ? { id: String(sceneCtrl.selectedProjectId) } : undefined,
  })
}
</script>

<template>
  <div class="rounded-lg border border-border bg-card overflow-hidden">
    <div class="px-3 py-2 border-b border-border flex-between gap-2 flex-wrap bg-muted/20">
      <div class="flex items-center gap-2 min-w-0">
        <Layers class="size-3.5 text-primary shrink-0" />
        <span class="text-xs font-semibold text-foreground truncate">VTsuru 场景编辑器联动 (obs-scene)</span>
        <Badge
          v-if="sceneCtrl.selectedProject"
          :variant="sceneCtrl.selectedProject.hasPublished ? 'success' : 'secondary'"
          size="xs"
        >
          {{ sceneCtrl.selectedProject.hasPublished ? `v${sceneCtrl.selectedProject.publishedVersion}` : '未发布' }}
        </Badge>
      </div>

      <div class="flex items-center gap-1.5 flex-wrap">
        <Button
          v-if="sceneCtrl.selectedDoc"
          type="button"
          size="xs"
          :variant="showPreview ? 'secondary' : 'outline'"
          class="gap-1"
          @click="showPreview = !showPreview"
        >
          <EyeOff
            v-if="showPreview"
            class="size-3"
          />
          <Eye
            v-else
            class="size-3"
          />
          {{ showPreview ? '收起预览' : '画面预览' }}
        </Button>

        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          :disabled="sceneCtrl.loadingProjects || sceneCtrl.loadingDetail"
          title="刷新云端场景项目"
          @click="sceneCtrl.refreshProjects(true)"
        >
          <RefreshCw
            class="size-3.5"
            :class="{ 'animate-spin': sceneCtrl.loadingProjects || sceneCtrl.loadingDetail }"
          />
        </Button>

        <Button
          type="button"
          size="xs"
          variant="ghost"
          class="gap-1 text-primary"
          @click="openSceneEditor"
        >
          编辑器
          <ExternalLink class="size-3" />
        </Button>
      </div>
    </div>

    <div class="p-3 space-y-2.5">
      <div
        v-if="sceneCtrl.projects.length === 0"
        class="py-3 text-center text-xs text-muted-foreground space-y-1.5"
      >
        <p>{{ sceneCtrl.loadingProjects ? '正在加载 VTsuru 场景项目...' : '暂无 VTsuru 场景项目，可前往场景编辑器创建' }}</p>
      </div>

      <template v-else>
        <!-- 项目选择与推送布局 -->
        <div class="flex items-center gap-2 flex-wrap">
          <div class="flex-1 min-w-[180px]">
            <Select
              :model-value="sceneCtrl.selectedProjectId ? String(sceneCtrl.selectedProjectId) : ''"
              @update:model-value="(v) => v && sceneCtrl.selectProject(Number(v))"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择 VTsuru 场景项目" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="p in sceneCtrl.projects"
                  :key="p.id"
                  :value="String(p.id)"
                >
                  {{ p.name }}{{ p.hasPublished ? '' : ' (草稿)' }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            size="xs"
            variant="outline"
            class="gap-1 shrink-0"
            :disabled="!obs.obsConnected || !sceneCtrl.selectedDoc || sceneCtrl.syncingLayout"
            title="将当前子场景的浏览器源槽位与本地 OBS 源 Z 序对齐到 OBS"
            @click="handleSyncLayout"
          >
            <Send class="size-3" />
            {{ sceneCtrl.syncingLayout ? '推送中...' : '对齐布局到 OBS' }}
          </Button>
        </div>

        <!-- 子场景快捷切换胶囊 -->
        <div
          v-if="sceneCtrl.subScenes.length > 0"
          class="flex items-center gap-1.5 flex-wrap"
        >
          <Button
            v-for="sub in sceneCtrl.subScenes"
            :key="sub.id"
            type="button"
            size="xs"
            :variant="sub.id === sceneCtrl.activeSceneId ? 'default' : 'outline'"
            :disabled="sceneCtrl.switchingScene"
            class="gap-1.5"
            @click="handleSwitchSubScene(sub.id)"
          >
            <span>{{ sub.name }}</span>
            <span
              v-if="sub.obsSceneBinding"
              class="text-[10px] opacity-75 font-mono"
            >
              → {{ sub.obsSceneBinding }}
            </span>
          </Button>
        </div>

        <!-- 内置无副作用场景渲染预览 (ObsSceneRenderer mode="preview") -->
        <div
          v-if="showPreview && sceneCtrl.selectedDoc"
          ref="previewWrapRef"
          class="relative w-full aspect-video rounded-md border border-border bg-neutral-950 overflow-hidden flex-center"
          :class="compact ? 'max-h-[220px]' : 'max-h-[300px]'"
        >
          <div
            class="relative overflow-hidden shrink-0 pointer-events-none"
            :style="scaledStageStyle"
          >
            <div
              class="origin-top-left"
              :style="{
                width: `${canvasSize.width}px`,
                height: `${canvasSize.height}px`,
                transform: `scale(${previewScale})`,
              }"
            >
              <ObsSceneRenderer
                :doc="sceneCtrl.selectedDoc"
                :owner-user-id="sceneCtrl.selectedDetail?.ownerUserId"
                mode="preview"
                :active-scene-override="sceneCtrl.activeSceneId"
              />
            </div>
          </div>
          <div class="absolute bottom-1.5 right-2 px-1.5 py-0.5 rounded bg-black/65 text-[10px] text-white/80">
            只读预览（不触发 VTS/OBS 副作用）
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
