<script setup lang="ts">
import { Copy } from 'lucide-vue-next'
import { computed } from 'vue'

import type { ResponseSongModel, SettingSongRequest } from '@/api/generated/model'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { copyToClipboard } from '@/shared/utils'

const props = defineProps<{
  song: ResponseSongModel | null
  settings?: SettingSongRequest
  basePointCost: number
  priorityPointCost: number
  totalPointCost: number
  userPoints: number | null
  isBiliAuthed: boolean
  isSubmitting: boolean
}>()

const usePriority = defineModel<boolean>('usePriority', { default: false })

const emit = defineEmits<{
  close: []
  confirm: [song: ResponseSongModel, usePriority: boolean]
}>()

const danmakuCommand = computed(() => {
  if (!props.song) return ''
  return `${props.settings?.orderPrefix || ''} ${props.song.name}`.trim()
})

async function handleCopyCommand() {
  if (!danmakuCommand.value) return
  await copyToClipboard(danmakuCommand.value, `已复制点歌指令：${danmakuCommand.value}`)
}
</script>

<template>
  <Dialog
    :open="Boolean(song)"
    @update:open="(v) => !v && emit('close')"
  >
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>确认在线点歌</DialogTitle>
        <DialogDescription>
          即将点播歌曲《{{ song?.name }}》
          <template v-if="song?.author?.length"> · {{ song.author.join(' / ') }} </template>
        </DialogDescription>
      </DialogHeader>

      <div
        v-if="basePointCost > 0 || settings?.allowPointPriority"
        class="space-y-3 text-xs"
      >
        <div class="flex-between rounded-md border bg-muted/40 px-3 py-2">
          <span class="text-muted-foreground">基础点歌消耗</span>
          <span class="font-medium font-mono tabular-nums">
            {{ basePointCost > 0 ? `${basePointCost} 积分` : '免费' }}
          </span>
        </div>

        <label
          v-if="settings?.allowPointPriority"
          class="flex-between rounded-md border px-3 py-2 cursor-pointer"
        >
          <span class="flex items-center gap-2">
            <Checkbox v-model:checked="usePriority" />
            <span>同时使用积分插队（置顶排在普通队伍前）</span>
          </span>
          <span class="font-medium font-mono tabular-nums">+{{ priorityPointCost }} 积分</span>
        </label>

        <div class="flex-between px-1 pt-1 border-t">
          <span class="text-muted-foreground">
            合计消耗：<strong class="text-foreground font-mono tabular-nums">{{ totalPointCost }} 积分</strong>
          </span>
          <span
            v-if="isBiliAuthed"
            class="text-muted-foreground"
          >
            当前余额：<strong class="text-foreground font-mono tabular-nums">{{ userPoints ?? '...' }}</strong>
          </span>
          <span
            v-else-if="totalPointCost > 0"
            class="text-destructive"
          >
            需先绑定 B 站账号
          </span>
        </div>
      </div>

      <DialogFooter class="flex-wrap gap-2">
        <Button
          v-if="danmakuCommand"
          type="button"
          variant="ghost"
          class="gap-1.5 mr-auto text-muted-foreground"
          @click="handleCopyCommand"
        >
          <Copy class="size-3.5" />
          复制弹幕
        </Button>
        <Button
          type="button"
          variant="outline"
          :disabled="isSubmitting"
          @click="emit('close')"
        >
          取消
        </Button>
        <Button
          type="button"
          :loading="isSubmitting"
          :disabled="totalPointCost > 0 && !isBiliAuthed"
          @click="song && emit('confirm', song, usePriority)"
        >
          {{ totalPointCost > 0 ? `确认消耗 ${totalPointCost} 积分点歌` : '确认点歌' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
