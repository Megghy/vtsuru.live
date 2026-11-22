<script setup lang="ts">
import {
  Box,
  Camera,
  Copy,
  Film,
  FolderPlus,
  GalleryHorizontalEnd,
  Gamepad2,
  Globe,
  Group,
  Image as ImageIcon,
  Images,
  Layers,
  Link2,
  MessageSquareText,
  MoveHorizontal,
  Plus,
  Puzzle,
  Sparkles,
  Trash2,
  Type,
  Ungroup,
  UserRound,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { obsComponentList } from '@/apps/obs-store/registry'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Separator } from '@/shared/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'

import { useObsSceneEditorStore } from '../store/useObsSceneEditorStore'
import type { ObsModuleId, ObsSourceRole } from '../types'
import {
  createIframeLayer,
  createImageLayer,
  createMarqueeLayer,
  createObsModuleLayer,
  createObsSourceLayer,
  createShapeLayer,
  createSlideshowLayer,
  createTextLayer,
  createVideoLayer,
  createWidgetLayer,
  formatCleanWidgetName,
  OBS_MODULE_LIST,
} from '../types'
import SceneHelpTip from './SceneHelpTip.vue'
import SceneLayerTreeList from './SceneLayerTreeList.vue'

const props = defineProps<{
  obsConnected: boolean
}>()

const emit = defineEmits<{
  switchObsScene: [obsSceneName: string]
}>()

const store = useObsSceneEditorStore()

const editingSceneId = ref<string | null>(null)
const sceneNameDraft = ref('')

const availableWidgets = computed(() => obsComponentList.filter((c) => c.status === 'ready'))

const currentRootLayerIds = computed<string[]>(() => {
  return store.editingScope === 'global' ? store.doc.globalLayerIds : (store.activeScene?.layerIds ?? [])
})

function startRenameScene(sceneId: string, name: string) {
  editingSceneId.value = sceneId
  sceneNameDraft.value = name
}

function commitRenameScene(sceneId: string) {
  if (editingSceneId.value !== sceneId) return
  const next = sceneNameDraft.value.trim()
  if (next) store.updateSceneMeta(sceneId, { name: next })
  editingSceneId.value = null
}

function addWidget(componentId: string) {
  store.addLayer(createWidgetLayer(componentId, store.doc.canvas))
}

function addObsModule(moduleId: ObsModuleId) {
  store.addLayer(createObsModuleLayer(moduleId, store.doc.canvas))
}

function addObsSource(role: ObsSourceRole) {
  store.addLayer(createObsSourceLayer(role, store.doc.canvas), 'scene')
}

function addBasicLayer(kind: 'text' | 'marquee-text' | 'marquee-image' | 'slideshow' | 'shape' | 'image' | 'video' | 'iframe') {
  const c = store.doc.canvas
  if (kind === 'text') store.addLayer(createTextLayer(c))
  else if (kind === 'marquee-text') store.addLayer(createMarqueeLayer(c, 'text'))
  else if (kind === 'marquee-image') store.addLayer(createMarqueeLayer(c, 'image'))
  else if (kind === 'slideshow') store.addLayer(createSlideshowLayer(c))
  else if (kind === 'shape') store.addLayer(createShapeLayer(c))
  else if (kind === 'image') store.addLayer(createImageLayer(c))
  else if (kind === 'video') store.addLayer(createVideoLayer(c))
  else store.addLayer(createIframeLayer(c))
}
</script>

<template>
  <div class="h-full w-full min-w-0 flex flex-col bg-card border-r border-border overflow-hidden">
    <!-- 上半区：子场景列表 -->
    <div class="flex flex-col min-h-0 max-h-[36%] shrink-0">
      <div class="flex-between px-3 py-2 border-b border-border gap-2">
        <div class="flex items-center gap-1.5 text-xs font-semibold text-foreground whitespace-nowrap shrink-0">
          <Sparkles class="w-3.5 h-3.5 text-primary" />
          <span>子场景</span>
          <Badge variant="secondary">{{ store.doc.sceneOrder.length }}</Badge>
          <SceneHelpTip
            side="right"
            compact
            text="可在同一项目里建多个子场景（如杂谈、游戏、歌回），支持过渡动效切换，也可绑定本地 OBS 场景自动跟随切场。"
          />
        </div>
        <Button variant="ghost" size="xs" class="shrink-0 whitespace-nowrap" title="新建子场景" @click="store.addScene()">
          <Plus class="w-3.5 h-3.5" />
          <span>新建</span>
        </Button>
      </div>

      <ScrollArea class="flex-1">
        <div class="p-2 space-y-1">
          <div
            v-for="sceneId in store.doc.sceneOrder"
            :key="sceneId"
            class="group relative flex items-center gap-1.5 rounded-md px-2 py-1.5 cursor-pointer transition-colors"
            :class="
              store.doc.activeSceneId === sceneId
                ? 'bg-primary/12 text-foreground ring-1 ring-primary/30'
                : 'hover:bg-accent/60 text-muted-foreground hover:text-foreground'
            "
            @click="store.setActiveScene(sceneId, true)"
          >
            <div class="flex-1 min-w-0">
              <Input
                v-if="editingSceneId === sceneId"
                v-model="sceneNameDraft"
                autofocus
                @click.stop
                @blur="commitRenameScene(sceneId)"
                @keydown.enter="commitRenameScene(sceneId)"
                @keydown.esc="editingSceneId = null"
              />
              <div
                v-else
                class="truncate text-xs font-medium"
                @dblclick.stop="startRenameScene(sceneId, store.doc.scenes[sceneId]?.name ?? '')"
              >
                {{ store.doc.scenes[sceneId]?.name }}
              </div>
              <div
                v-if="store.doc.scenes[sceneId]?.obsSceneBinding"
                class="flex items-center gap-1 text-[10px] text-sky-500 truncate mt-0.5"
              >
                <Link2 class="w-2.5 h-2.5 shrink-0" />
                <span class="truncate">{{ store.doc.scenes[sceneId]?.obsSceneBinding }}</span>
              </div>
            </div>

            <!-- 悬停紧凑浮层操作条：平时完全不占用文字宽度 -->
            <div
              v-if="editingSceneId !== sceneId"
              class="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded bg-card/95 border border-border/70 px-0.5 py-0.5 shadow-xs opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150"
            >
              <Button
                v-if="props.obsConnected && store.doc.scenes[sceneId]?.obsSceneBinding"
                variant="ghost"
                size="none"
                class="w-5 h-5 rounded flex-center [&_svg]:size-3"
                title="同时切换本地 OBS 到绑定场景"
                @click.stop="emit('switchObsScene', store.doc.scenes[sceneId]!.obsSceneBinding!)"
              >
                <Link2 class="text-sky-500" />
              </Button>
              <Button
                variant="ghost"
                size="none"
                class="w-5 h-5 rounded flex-center [&_svg]:size-3"
                title="复制子场景"
                @click.stop="store.duplicateScene(sceneId)"
              >
                <Copy />
              </Button>
              <Button
                v-if="store.doc.sceneOrder.length > 1"
                variant="ghost"
                size="none"
                class="w-5 h-5 rounded flex-center [&_svg]:size-3"
                title="删除子场景"
                @click.stop="store.deleteScene(sceneId)"
              >
                <Trash2 class="text-destructive" />
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>

    <Separator />

    <!-- 下半区：图层列表（场景层 / 全局常驻层） -->
    <div class="flex-1 flex flex-col min-h-0">
      <div class="flex-between px-2.5 py-2 border-b border-border gap-1">
        <div class="flex items-center gap-1 text-xs font-semibold text-foreground whitespace-nowrap shrink-0">
          <Layers class="w-3.5 h-3.5 text-primary" />
          <span>图层</span>
          <SceneHelpTip
            side="right"
            compact
            text="列表越靠上显示在越前面（Z 轴越高）。可拖拽调序或拖入分组；本地模型/采集源放在顶层以自动切分前后景。"
          />
        </div>

        <div class="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="xs"
            class="shrink-0 whitespace-nowrap px-1.5"
            title="新建空分组（可将图层拖入或右键移入）"
            @click="store.addEmptyGroup()"
          >
            <FolderPlus class="w-3.5 h-3.5 text-amber-500" />
            <span>分组</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="default"
                size="xs"
                class="shrink-0 whitespace-nowrap px-2"
                title="添加图层、本地模型或直播组件"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>添加</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-60 max-h-[72vh] overflow-y-auto scrollbar-thin">
              <DropdownMenuLabel>本地源 / VTuber 模型 (OBS)</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem @select="addObsSource('vts')">
                  <Sparkles class="w-3.5 h-3.5 mr-2 text-violet-500" />
                  <span class="flex-1 truncate">VTube Studio 皮套</span>
                  <span class="text-[10px] text-muted-foreground">VTS 联动</span>
                </DropdownMenuItem>
                <DropdownMenuItem @select="addObsSource('avatar')">
                  <UserRound class="w-3.5 h-3.5 mr-2 text-violet-500" />
                  <span class="flex-1 truncate">其他 VTuber 模型</span>
                  <span class="text-[10px] text-muted-foreground">Spout2/透明</span>
                </DropdownMenuItem>
                <DropdownMenuItem @select="addObsSource('game')">
                  <Gamepad2 class="w-3.5 h-3.5 mr-2 text-violet-500" />
                  <span class="flex-1 truncate">游戏 / 窗口捕获</span>
                </DropdownMenuItem>
                <DropdownMenuItem @select="addObsSource('camera')">
                  <Camera class="w-3.5 h-3.5 mr-2 text-violet-500" />
                  <span class="flex-1 truncate">摄像头 / 采集卡</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />
              <DropdownMenuLabel>常用创意与媒体</DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem @select="store.addEmptyGroup()">
                  <FolderPlus class="w-3.5 h-3.5 mr-2 text-amber-500" />
                  <span>新建分组容器</span>
                </DropdownMenuItem>
                <DropdownMenuItem @select="addBasicLayer('marquee-text')">
                <MoveHorizontal class="w-3.5 h-3.5 mr-2 text-primary" />
                <span>文字走马灯</span>
              </DropdownMenuItem>
              <DropdownMenuItem @select="addBasicLayer('marquee-image')">
                <GalleryHorizontalEnd class="w-3.5 h-3.5 mr-2 text-primary" />
                <span>图片走马灯</span>
              </DropdownMenuItem>
              <DropdownMenuItem @select="addBasicLayer('slideshow')">
                <Images class="w-3.5 h-3.5 mr-2 text-primary" />
                <span>图片轮播 / 海报</span>
              </DropdownMenuItem>
              <DropdownMenuItem @select="addBasicLayer('text')">
                <Type class="w-3.5 h-3.5 mr-2" />
                <span>文本标题</span>
              </DropdownMenuItem>
              <DropdownMenuItem @select="addBasicLayer('image')">
                <ImageIcon class="w-3.5 h-3.5 mr-2" />
                <span>图片 / 动图贴纸</span>
              </DropdownMenuItem>
              <DropdownMenuItem @select="addBasicLayer('shape')">
                <Box class="w-3.5 h-3.5 mr-2" />
                <span>装饰框 / 毛玻璃底板</span>
              </DropdownMenuItem>
              <DropdownMenuItem @select="addBasicLayer('video')">
                <Film class="w-3.5 h-3.5 mr-2" />
                <span>背景视频</span>
              </DropdownMenuItem>
              <DropdownMenuItem @select="addBasicLayer('iframe')">
                <Globe class="w-3.5 h-3.5 mr-2" />
                <span>外部网页源 (iframe)</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>站内直播组件 (OBS)</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem
                v-for="mod in OBS_MODULE_LIST"
                :key="mod.id"
                @select="addObsModule(mod.id)"
              >
                <MessageSquareText class="w-3.5 h-3.5 mr-2 text-sky-500" />
                <span class="flex-1 truncate">{{ mod.name }}</span>
                <span class="text-[10px] text-muted-foreground">
                  {{ mod.defaultWidth }}×{{ mod.defaultHeight }}
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator />
            <DropdownMenuLabel>OBS 组件库</DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem
                v-for="comp in availableWidgets"
                :key="comp.id"
                @select="addWidget(comp.id)"
              >
                <Puzzle class="w-3.5 h-3.5 mr-2 text-primary" />
                <span class="flex-1 truncate">{{ formatCleanWidgetName(comp.name) }}</span>
                <span v-if="comp.defaultResolution" class="text-[10px] text-muted-foreground">
                  {{ comp.defaultResolution.width }}×{{ comp.defaultResolution.height }}
                </span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div class="px-2 pt-2 space-y-1.5">
        <div class="flex items-center gap-1.5">
          <Tabs v-model="store.editingScope" class="flex-1 min-w-0">
            <TabsList class="w-full grid grid-cols-2">
              <TabsTrigger value="scene" class="px-1.5">
                当前场景 ({{ store.activeScene?.layerIds.length ?? 0 }})
              </TabsTrigger>
              <TabsTrigger value="global" class="px-1.5">
                全局常驻 ({{ store.doc.globalLayerIds.length }})
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <SceneHelpTip
            side="right"
            text="当前场景：仅在对应子场景显示&#10;全局常驻：跨所有子场景始终置顶且切场不卸载，适合放弹幕机、台标或固定挂件"
          />
        </div>

        <!-- 分组快捷操作条：多选同级图层时一键编组，选中组时一键解组 -->
        <div
          v-if="store.canGroupSelected || store.selectedLayer?.type === 'group'"
          class="flex items-center gap-1"
        >
          <Button
            v-if="store.canGroupSelected"
            variant="secondary"
            size="xs"
            class="flex-1"
            @click="store.groupSelectedLayers()"
          >
            <Group class="w-3.5 h-3.5" />
            <span>编组 ({{ store.selectedLayerIds.length }})</span>
          </Button>
          <Button
            v-if="store.selectedLayer?.type === 'group'"
            variant="outline"
            size="xs"
            class="flex-1"
            @click="store.ungroupLayer(store.selectedLayer.id)"
          >
            <Ungroup class="w-3.5 h-3.5" />
            <span>解散分组</span>
          </Button>
        </div>
      </div>

      <ScrollArea class="flex-1">
        <div v-if="currentRootLayerIds.length === 0" class="px-4 py-8 text-center text-xs text-muted-foreground">
          {{ store.editingScope === 'global' ? '暂无全局常驻图层' : '当前场景暂无图层，点击右上角「添加」开始排版' }}
        </div>

        <SceneLayerTreeList
          v-else
          :layer-ids="currentRootLayerIds"
          :parent-group-id="null"
          :depth="0"
        />
      </ScrollArea>
    </div>
  </div>
</template>
