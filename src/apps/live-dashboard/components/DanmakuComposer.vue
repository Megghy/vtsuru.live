<script setup lang="ts">
import { Plus, Send, Sparkles, X } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { roomInfo } from '@/apps/client/data/info'
import { useBiliFunction } from '@/apps/client/store/useBiliFunction'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

import { useDashboardUi } from '../store/ui'

const MAX_DANMAKU_LEN = 40

const ui = useDashboardUi()
const account = useAccount()
const biliFunc = useBiliFunction()

const inputRef = ref<{ focus: () => void } | null>(null)
const sending = ref(false)
const newPreset = ref('')
const quickReplies = usePersistedStorage<string[]>('vtsuru:settings:live-dashboard:quick-replies', [
  '欢迎来到直播间~',
  '感谢投喂，老板大气！',
  '感谢上舰，比心！',
  '稍等一下马上就好~',
])

const targetRoomId = computed(() => roomInfo.value?.room_id || account.value.biliRoomId || 0)
const trimmed = computed(() => ui.replyDraft.trim())

watch(
  () => ui.composerFocusTick,
  async () => {
    await nextTick()
    inputRef.value?.focus()
  },
)

async function send(text?: string) {
  const msg = (text ?? trimmed.value).slice(0, MAX_DANMAKU_LEN)
  if (!msg || sending.value) return
  if (!targetRoomId.value) {
    toast.error('未获取到当前直播间房间号')
    return
  }
  sending.value = true
  try {
    const ok = await biliFunc.sendLiveDanmaku(targetRoomId.value, msg)
    if (ok && text === undefined) {
      ui.replyDraft = ''
    }
  } finally {
    sending.value = false
  }
}

function addPreset() {
  const val = newPreset.value.trim().slice(0, MAX_DANMAKU_LEN)
  if (!val) return
  if (!quickReplies.value.includes(val)) {
    quickReplies.value = [...quickReplies.value, val]
  }
  newPreset.value = ''
}

function removePreset(index: number) {
  quickReplies.value = quickReplies.value.filter((_, idx) => idx !== index)
}
</script>

<template>
  <div class="flex items-center gap-1.5 px-2 py-1.5 border-t border-border bg-card shrink-0">
    <Popover>
      <PopoverTrigger as-child>
        <Button
          variant="ghost"
          size="icon-xs"
          class="text-muted-foreground hover:text-foreground shrink-0"
          title="快捷话术"
        >
          <Sparkles class="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        class="w-72 p-2.5 space-y-2 text-xs"
      >
        <div class="flex-between">
          <span class="font-semibold text-foreground">快捷话术</span>
          <span class="text-[11px] text-muted-foreground">点击直接发送</span>
        </div>
        <div class="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
          <div
            v-for="(item, index) in quickReplies"
            :key="item"
            class="flex items-center gap-1 group"
          >
            <Button
              variant="ghost"
              size="xs"
              class="flex-1 justify-start truncate font-normal h-7 px-2"
              :disabled="sending"
              @click="send(item)"
            >
              <span class="truncate">{{ item }}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
              aria-label="删除快捷话术"
              @click="removePreset(index)"
            >
              <X class="size-3" />
            </Button>
          </div>
          <div
            v-if="!quickReplies.length"
            class="py-3 text-center text-muted-foreground"
          >
            暂无预设话术
          </div>
        </div>
        <div class="flex items-center gap-1 pt-1.5 border-t border-border">
          <Input
            v-model="newPreset"
            size="xs"
            placeholder="新增话术..."
            :maxlength="MAX_DANMAKU_LEN"
            @keyup.enter="addPreset"
          />
          <Button
            size="icon-xs"
            variant="secondary"
            :disabled="!newPreset.trim()"
            aria-label="添加话术"
            @click="addPreset"
          >
            <Plus class="size-3.5" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>

    <div class="relative flex-1 min-w-0">
      <Input
        ref="inputRef"
        v-model="ui.replyDraft"
        size="xs"
        class="pr-10"
        placeholder="发送弹幕到直播间（回车发送，仅客户端）"
        :maxlength="MAX_DANMAKU_LEN"
        :disabled="sending"
        @keyup.enter="send()"
        @keydown.esc="ui.replyDraft = ''"
      />
      <span
        v-if="ui.replyDraft.length > 0"
        class="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums pointer-events-none"
      >
        {{ ui.replyDraft.length }}/{{ MAX_DANMAKU_LEN }}
      </span>
    </div>

    <Button
      size="xs"
      class="shrink-0 gap-1"
      :disabled="!trimmed || sending"
      @click="send()"
    >
      <Send class="size-3" />
      <span>发送</span>
    </Button>
  </div>
</template>
