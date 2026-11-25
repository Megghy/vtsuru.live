<script setup lang="ts">
import { Bot, Clock, ExternalLink, Pause, Play, Trash2 } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { TriggerType } from '@/apps/client/store/autoAction/types'
import { useAutoAction } from '@/apps/client/store/useAutoAction'
import { useBiliFunction } from '@/apps/client/store/useBiliFunction'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { SimpleTooltip } from '@/shared/ui/tooltip'

const router = useRouter()
const autoAction = useAutoAction()
const biliFunc = useBiliFunction()

const open = ref(false)
const pausedSnapshot = ref<TriggerType[] | null>(null)

const allTriggerTypes = Object.values(TriggerType)

const enabledCount = computed(
  () => allTriggerTypes.filter((t) => autoAction.enabledTriggerTypes[t]).length,
)

const isAllPaused = computed(() => enabledCount.value === 0)

const scheduledEnabled = computed({
  get: () => !!autoAction.enabledTriggerTypes[TriggerType.SCHEDULED],
  set: (v: boolean) => {
    void autoAction.setTriggerTypeEnabled(TriggerType.SCHEDULED, v)
  },
})

const totalQueued = computed(
  () => biliFunc.danmakuQueuePreview.length + biliFunc.pmQueuePreview.length,
)

async function toggleEmergencyPause() {
  if (!isAllPaused.value) {
    pausedSnapshot.value = allTriggerTypes.filter((t) => autoAction.enabledTriggerTypes[t])
    for (const t of pausedSnapshot.value) {
      await autoAction.setTriggerTypeEnabled(t, false)
    }
    toast.warning('已紧急暂停全部自动操作')
  } else {
    const toRestore = pausedSnapshot.value?.length ? pausedSnapshot.value : allTriggerTypes
    for (const t of toRestore) {
      await autoAction.setTriggerTypeEnabled(t, true)
    }
    pausedSnapshot.value = null
    toast.success('已恢复自动操作')
  }
}

function clearDanmaku() {
  const count = biliFunc.clearDanmakuQueue()
  toast.success(count > 0 ? `已清空 ${count} 条待发弹幕` : '待发弹幕队列已为空')
}

function clearPm() {
  const count = biliFunc.clearPmQueue()
  toast.success(count > 0 ? `已清空 ${count} 条待发私信` : '待发私信队列已为空')
}

function goAutoAction() {
  open.value = false
  void router.push({ name: 'client-auto-action-manage' })
}
</script>

<template>
  <Popover v-model:open="open">
    <SimpleTooltip content="自动操作总闸与发送队列监控">
      <PopoverTrigger as-child>
        <Button
          variant="ghost"
          :size="isAllPaused || totalQueued > 0 ? 'xs' : 'icon-xs'"
          class="gap-1 shrink-0"
          :class="
            isAllPaused
              ? 'px-1.5 text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/15'
              : totalQueued > 0
                ? 'px-1.5 text-primary'
                : 'text-muted-foreground hover:text-foreground'
          "
          aria-label="自动操作总闸与发送队列监控"
        >
          <Bot class="size-3.5" />
          <span
            v-if="isAllPaused"
            class="hidden xl:inline"
          >
            已暂停
          </span>
          <Badge
            v-if="totalQueued > 0"
            size="xs"
            variant="secondary"
            class="px-1 tabular-nums"
          >
            {{ totalQueued }}
          </Badge>
        </Button>
      </PopoverTrigger>
    </SimpleTooltip>

    <PopoverContent
      align="end"
      class="w-80 p-3 space-y-3 text-xs"
    >
      <div class="flex-between">
        <div class="flex items-center gap-1.5 font-semibold text-foreground">
          <Bot class="size-3.5 text-primary" />
          <span>自动操作总闸与队列</span>
        </div>
        <Button
          variant="ghost"
          size="xs"
          class="gap-1 text-muted-foreground"
          @click="goAutoAction"
        >
          <span>管理规则</span>
          <ExternalLink class="size-3" />
        </Button>
      </div>

      <!-- 紧急总闸 -->
      <div class="rounded-md border border-border bg-muted/40 p-2.5 space-y-2">
        <div class="flex-between gap-2">
          <div>
            <div class="font-medium text-foreground">
              {{ isAllPaused ? '自动操作已全部暂停' : `自动操作运行中（${enabledCount}/${allTriggerTypes.length} 类启用）` }}
            </div>
            <div class="text-[11px] text-muted-foreground">
              遇歌回、煽情或刷屏节奏时可一键急停
            </div>
          </div>
          <Button
            size="xs"
            :variant="isAllPaused ? 'default' : 'destructive'"
            class="gap-1 shrink-0"
            @click="toggleEmergencyPause"
          >
            <Play
              v-if="isAllPaused"
              class="size-3"
            />
            <Pause
              v-else
              class="size-3"
            />
            {{ isAllPaused ? '恢复' : '急停' }}
          </Button>
        </div>

        <SettingRow
          variant="none"
          title="定时发送消息"
          :description="autoAction.nextScheduledAction ? `下一条：${autoAction.nextScheduledAction.name}` : undefined"
        >
          <Switch v-model="scheduledEnabled" />
        </SettingRow>
      </div>

      <Separator />

      <!-- 发弹幕队列监控 -->
      <div class="space-y-1.5">
        <div class="flex-between">
          <span class="font-medium text-foreground inline-flex items-center gap-1">
            <Clock class="size-3 text-muted-foreground" />
            待发弹幕队列（{{ biliFunc.danmakuQueuePreview.length }}）
          </span>
          <Button
            v-if="biliFunc.danmakuQueuePreview.length > 0"
            size="xs"
            variant="ghost"
            class="text-destructive hover:text-destructive gap-1 h-6 px-1.5"
            @click="clearDanmaku"
          >
            <Trash2 class="size-3" />
            清空
          </Button>
        </div>
        <div
          v-if="biliFunc.danmakuQueuePreview.length > 0"
          class="max-h-24 overflow-y-auto scrollbar-thin space-y-1 rounded bg-muted/40 p-1.5"
        >
          <div
            v-for="(item, idx) in biliFunc.danmakuQueuePreview.slice(0, 8)"
            :key="`${idx}-${item.message}`"
            class="truncate text-[11px] text-foreground/90"
          >
            {{ idx + 1 }}. {{ item.message }}
          </div>
        </div>
        <div
          v-else
          class="text-[11px] text-muted-foreground"
        >
          当前无待发送弹幕
        </div>
      </div>

      <!-- 私信队列监控 -->
      <div class="space-y-1.5">
        <div class="flex-between">
          <span class="font-medium text-foreground">
            待发私信队列（{{ biliFunc.pmQueuePreview.length }}）
          </span>
          <Button
            v-if="biliFunc.pmQueuePreview.length > 0"
            size="xs"
            variant="ghost"
            class="text-destructive hover:text-destructive gap-1 h-6 px-1.5"
            @click="clearPm"
          >
            <Trash2 class="size-3" />
            清空
          </Button>
        </div>
        <div
          v-if="biliFunc.pmQueuePreview.length > 0"
          class="max-h-20 overflow-y-auto scrollbar-thin space-y-1 rounded bg-muted/40 p-1.5"
        >
          <div
            v-for="(item, idx) in biliFunc.pmQueuePreview.slice(0, 6)"
            :key="`${idx}-${item.receiverId}`"
            class="truncate text-[11px] text-foreground/90"
          >
            UID {{ item.receiverId }}：{{ item.message }}
          </div>
        </div>
        <div
          v-else
          class="text-[11px] text-muted-foreground"
        >
          当前无待发送私信
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
