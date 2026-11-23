<script setup lang="ts">
import { AlertTriangle, Check, ExternalLink, Radio, SlidersHorizontal, Video } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { updateRoom } from '@/apps/client/api/live-manage'
import { roomInfo, streamingInfo } from '@/apps/client/data/info'
import { useOBSStore } from '@/apps/client/store/useOBSStore'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Separator } from '@/shared/ui/separator'

const router = useRouter()
const account = useAccount()
const obs = useOBSStore()

const open = ref(false)
const titleDraft = ref('')
const savingTitle = ref(false)

onMounted(() => {
  void obs.init()
})

const isLiving = computed(() => roomInfo.value?.live_status === 1 || streamingInfo.value?.status === 'streaming')
const roomId = computed(() => roomInfo.value?.room_id || account.value.biliRoomId || 0)

const dropRatio = computed(() => {
  const total = obs.obsStats.outputTotalFrames || 0
  if (total <= 0) return 0
  return Math.round(((obs.obsStats.outputSkippedFrames || 0) / total) * 1000) / 10
})

watch(open, (v) => {
  if (v) {
    titleDraft.value = roomInfo.value?.title ?? ''
    if (obs.obsConnected) {
      void obs.fetchObsScenes()
      void obs.updateCurrentScene()
    }
  }
})

async function saveTitle() {
  const title = titleDraft.value.trim()
  if (!title || !roomId.value || savingTitle.value) return
  savingTitle.value = true
  try {
    const res = await updateRoom({ roomId: roomId.value, title })
    if (res.code === 0) {
      if (roomInfo.value) roomInfo.value.title = title
      toast.success('直播标题已更新')
    } else {
      toast.error(res.message || '修改标题失败')
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '修改标题失败')
  } finally {
    savingTitle.value = false
  }
}

function goLiveManage() {
  open.value = false
  void router.push({ name: 'client-live-manage' })
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="outline"
        size="xs"
        class="gap-1.5 px-2 shrink-0"
        title="直播与 OBS 快速控制"
      >
        <span
          class="size-2 rounded-full shrink-0"
          :class="isLiving ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/40'"
        />
        <span class="hidden md:inline">{{ isLiving ? '直播中' : '未开播' }}</span>
        <template v-if="obs.obsConnected">
          <span class="text-muted-foreground/50">|</span>
          <Video
            class="size-3.5 shrink-0"
            :class="obs.obsStreamActive ? 'text-emerald-500' : 'text-muted-foreground'"
          />
          <span
            v-if="obs.obsStreamActive"
            class="hidden lg:inline text-[11px] tabular-nums text-muted-foreground"
          >
            {{ Math.round(obs.obsStats.fps) }}fps · {{ obs.obsStats.bitrateKbps }}k
          </span>
          <AlertTriangle
            v-if="obs.obsStreamActive && dropRatio >= 1"
            class="size-3.5 text-destructive shrink-0"
            :title="`丢帧率 ${dropRatio}%`"
          />
        </template>
        <SlidersHorizontal class="size-3 text-muted-foreground hidden sm:inline" />
      </Button>
    </PopoverTrigger>

    <PopoverContent
      align="end"
      class="w-80 p-3 space-y-3 text-xs"
    >
      <div class="flex-between">
        <div class="flex items-center gap-1.5 font-semibold text-foreground">
          <Radio
            class="size-3.5"
            :class="isLiving ? 'text-emerald-500' : 'text-muted-foreground'"
          />
          <span>{{ isLiving ? '直播进行中' : '当前未开播' }}</span>
        </div>
        <Button
          variant="ghost"
          size="xs"
          class="gap-1 text-muted-foreground h-6 px-1.5"
          @click="goLiveManage"
        >
          <span>完整播控</span>
          <ExternalLink class="size-3" />
        </Button>
      </div>

      <div class="space-y-1.5">
        <div class="text-[11px] text-muted-foreground">直播间标题</div>
        <div class="flex items-center gap-1.5">
          <Input
            v-model="titleDraft"
            size="xs"
            placeholder="输入新的直播标题"
            :disabled="!roomId || savingTitle"
            @keyup.enter="saveTitle"
          />
          <Button
            size="icon-xs"
            variant="secondary"
            :disabled="!titleDraft.trim() || savingTitle || titleDraft.trim() === roomInfo?.title"
            aria-label="保存标题"
            @click="saveTitle"
          >
            <Check class="size-3.5" />
          </Button>
        </div>
      </div>

      <Separator />

      <div class="space-y-2">
        <div class="flex-between">
          <div class="flex items-center gap-1.5 font-semibold text-foreground">
            <Video class="size-3.5" />
            <span>OBS 联动</span>
          </div>
          <span
            class="text-[11px]"
            :class="obs.obsConnected ? 'text-emerald-500' : 'text-muted-foreground'"
          >
            {{ obs.obsConnected ? (obs.obsStreamActive ? '推流中' : '已连接 · 待机') : '未连接' }}
          </span>
        </div>

        <template v-if="obs.obsConnected">
          <div class="grid grid-cols-3 gap-1.5 rounded-md bg-muted/60 px-2 py-1.5 text-[11px] tabular-nums">
            <div>
              <div class="text-muted-foreground">帧率</div>
              <div class="font-semibold">{{ Math.round(obs.obsStats.fps) }} FPS</div>
            </div>
            <div>
              <div class="text-muted-foreground">码率</div>
              <div class="font-semibold">{{ obs.obsStats.bitrateKbps }} kbps</div>
            </div>
            <div>
              <div class="text-muted-foreground">丢帧率</div>
              <div
                class="font-semibold"
                :class="dropRatio >= 1 ? 'text-destructive' : ''"
              >
                {{ dropRatio }}%
              </div>
            </div>
          </div>

          <div
            v-if="obs.obsScenes.length"
            class="space-y-1"
          >
            <div class="text-[11px] text-muted-foreground">快速切换场景</div>
            <div class="flex flex-wrap gap-1 max-h-28 overflow-y-auto scrollbar-thin">
              <Button
                v-for="scene in obs.obsScenes"
                :key="scene"
                size="xs"
                :variant="scene === obs.currentObsScene ? 'default' : 'outline'"
                class="max-w-full truncate"
                :disabled="obs.isSwitchingScene"
                @click="obs.switchToScene(scene)"
              >
                <span class="truncate">{{ scene }}</span>
              </Button>
            </div>
          </div>

          <div class="flex justify-end pt-0.5">
            <Popconfirm @positive-click="obs.handleObsToggleStream()">
              <template #trigger>
                <Button
                  size="xs"
                  :variant="obs.obsStreamActive ? 'destructive' : 'secondary'"
                  :disabled="obs.isTogglingObsStream"
                >
                  {{ obs.obsStreamActive ? '停止 OBS 推流' : '开始 OBS 推流' }}
                </Button>
              </template>
              确定{{ obs.obsStreamActive ? '停止' : '开始' }} OBS 推流？
            </Popconfirm>
          </div>
        </template>

        <div
          v-else
          class="flex-between gap-2 rounded-md bg-muted/50 px-2.5 py-2 text-muted-foreground"
        >
          <span>尚未连接 OBS WebSocket</span>
          <Button
            size="xs"
            variant="outline"
            :disabled="obs.obsConnecting"
            @click="obs.handleObsConnect()"
          >
            {{ obs.obsConnecting ? '连接中...' : '连接 OBS' }}
          </Button>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
