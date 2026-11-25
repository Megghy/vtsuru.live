<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { CornerDownLeft, Plus, Send, Sparkles, X } from 'lucide-vue-next'
import { computed, nextTick, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { roomInfo } from '@/apps/client/data/info'
import { useBiliFunction } from '@/apps/client/store/useBiliFunction'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { SimpleTooltip } from '@/shared/ui/tooltip'

import { useDashboardUi } from '../store/ui'

const MAX_DANMAKU_LEN = 40

const ui = useDashboardUi()
const account = useAccount()
const biliFunc = useBiliFunction()

const composerRef = ref<HTMLElement | null>(null)
const { width: composerWidth } = useElementSize(composerRef)
const isCompact = computed(() => composerWidth.value > 0 && composerWidth.value < 300)

const inputRef = ref<{ focus: () => void } | null>(null)
const sending = ref(false)
const newPreset = ref('')

const quickReplies = usePersistedStorage<string[]>('vtsuru:settings:live-dashboard:quick-replies', [
  '欢迎来到直播间~',
  '感谢投喂，老板大气！',
  '感谢上舰，比心！',
  '稍等一下马上就好~',
  '点歌/歌单请看主页或简介~',
])
const showQuickBar = usePersistedStorage<boolean>('vtsuru:settings:live-dashboard:quick-replies-bar', false)
const instantSendPhrase = usePersistedStorage<boolean>('vtsuru:settings:live-dashboard:quick-replies-instant', false)

function onQuickBarWheel(e: WheelEvent) {
  const el = e.currentTarget as HTMLElement | null
  if (!el || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
  el.scrollLeft += e.deltaY
}

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

function fillDraft(text: string) {
  ui.replyDraft = text.slice(0, MAX_DANMAKU_LEN)
  ui.composerFocusTick++
}

function handlePhraseClick(text: string) {
  if (instantSendPhrase.value) {
    void send(text)
  } else {
    fillDraft(text)
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
  <div
    ref="composerRef"
    class="border-t border-border bg-card shrink-0"
  >
    <!-- 常用弹幕短语快捷条（默认收起，可在左侧短语弹窗开启） -->
    <div
      v-if="showQuickBar && quickReplies.length > 0"
      class="flex items-center gap-1 px-2 pt-1.5 overflow-x-auto no-scrollbar [mask-image:linear-gradient(to_right,black_calc(100%-16px),transparent)]"
      @wheel.prevent="onQuickBarWheel"
    >
      <SimpleTooltip
        v-for="item in quickReplies.slice(0, 6)"
        :key="item"
        :content="instantSendPhrase ? `点击直接发送：${item}` : `点击填入输入框：${item}`"
      >
        <button
          type="button"
          class="px-2 py-0.5 rounded-full border border-border/80 bg-muted/40 hover:bg-muted text-[11px] text-foreground/90 whitespace-nowrap max-w-32 truncate transition-colors cursor-pointer shrink-0"
          :disabled="sending"
          @click="handlePhraseClick(item)"
        >
          {{ item }}
        </button>
      </SimpleTooltip>
    </div>

    <div class="flex items-center gap-1.5 px-2 py-1.5">
      <Popover>
        <SimpleTooltip content="管理与发送快捷短语">
          <PopoverTrigger as-child>
            <Button
              variant="ghost"
              size="icon-xs"
              class="text-muted-foreground hover:text-foreground shrink-0"
              aria-label="管理与发送快捷短语"
            >
              <Sparkles class="size-3.5" />
            </Button>
          </PopoverTrigger>
        </SimpleTooltip>
        <PopoverContent
          align="start"
          class="w-76 p-2.5 space-y-2 text-xs"
        >
          <div class="flex-between">
            <span class="font-semibold text-foreground">快捷弹幕短语</span>
            <span class="text-[11px] text-muted-foreground">填入或一键发送</span>
          </div>

          <div class="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
            <div
              v-for="(item, index) in quickReplies"
              :key="item"
              class="flex items-center gap-1 group"
            >
              <SimpleTooltip :content="`点击填入：${item}`">
                <Button
                  variant="ghost"
                  size="xs"
                  class="flex-1 justify-start truncate font-normal px-2"
                  @click="fillDraft(item)"
                >
                  <span class="truncate">{{ item }}</span>
                </Button>
              </SimpleTooltip>
              <SimpleTooltip content="立即发送">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  class="text-muted-foreground hover:text-primary shrink-0"
                  aria-label="立即发送"
                  :disabled="sending"
                  @click="send(item)"
                >
                  <CornerDownLeft class="size-3" />
                </Button>
              </SimpleTooltip>
              <Button
                variant="ghost"
                size="icon-xs"
                class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                aria-label="删除快捷短语"
                @click="removePreset(index)"
              >
                <X class="size-3" />
              </Button>
            </div>
            <div
              v-if="!quickReplies.length"
              class="py-3 text-center text-muted-foreground"
            >
              暂无预设短语
            </div>
          </div>

          <div class="flex items-center gap-1 pt-1.5 border-t border-border">
            <Input
              v-model="newPreset"
              size="xs"
              placeholder="新增短语（规则/群号/歌单）..."
              :maxlength="MAX_DANMAKU_LEN"
              @keyup.enter="addPreset"
            />
            <Button
              size="icon-xs"
              variant="secondary"
              :disabled="!newPreset.trim()"
              aria-label="添加短语"
              @click="addPreset"
            >
              <Plus class="size-3.5" />
            </Button>
          </div>

          <div class="space-y-1 pt-1.5 border-t border-border">
            <SettingRow
              variant="none"
              title="输入框上方常驻短语条"
            >
              <Switch v-model="showQuickBar" />
            </SettingRow>
            <SettingRow
              variant="none"
              title="点击短语条直接发送"
            >
              <Switch v-model="instantSendPhrase" />
            </SettingRow>
          </div>
        </PopoverContent>
      </Popover>

      <div class="relative flex-1 min-w-0">
        <Input
          ref="inputRef"
          v-model="ui.replyDraft"
          size="xs"
          :class="ui.replyDraft.length > 0 ? 'pr-10' : 'pr-2'"
          placeholder="发弹幕（回车发送）"
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

      <SimpleTooltip content="发送弹幕 (Enter)">
        <Button
          :size="isCompact ? 'icon-xs' : 'xs'"
          class="shrink-0 gap-1"
          :disabled="!trimmed || sending"
          aria-label="发送弹幕"
          @click="send()"
        >
          <Send class="size-3" />
          <span v-if="!isCompact">发送</span>
        </Button>
      </SimpleTooltip>
    </div>
  </div>
</template>
