<script setup lang="ts">
import {
  Check,
  ExternalLink,
  EyeOff,
  Image as ImageIcon,
  MessageSquareHeart,
  Monitor,
  MonitorOff,
  Pin,
  RefreshCw,
  Search,
  Star,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponseQAInfoToTarget } from '@/api/generated/model'
import { CURRENT_HOST, isTauri } from '@/shared/config'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { SimpleTooltip } from '@/shared/ui/tooltip'
import { useQuestionBox } from '@/store/useQuestionBox'

import IconAction from './IconAction.vue'
import PanelShell from './PanelShell.vue'

defineProps<{ blurred?: boolean }>()

const account = useAccount()
const qb = useQuestionBox()

const filterMode = ref<'unread' | 'all' | 'favorite'>('unread')
const keyword = ref('')

const normalQuestions = computed(() =>
  qb.recieveQuestions.filter((q) => !q.reviewResult || q.reviewResult.isApproved === true),
)

const displayQuestions = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return normalQuestions.value
    .filter((q) => {
      if (filterMode.value === 'unread' && q.isReaded) return false
      if (filterMode.value === 'favorite' && !q.isFavorite) return false
      if (kw) {
        const hay = `${q.question?.message ?? ''} ${q.sender?.name ?? ''} ${q.anonymousName ?? ''} ${q.tag ?? ''}`.toLowerCase()
        if (!hay.includes(kw)) return false
      }
      return true
    })
    .toSorted((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.sendAt - a.sendAt)
})

const currentDisplayId = computed(() => qb.displayQuestion?.id ?? account.value.currentQuestionId ?? 0)

function senderLabel(item: ResponseQAInfoToTarget) {
  if (item.isAnonymous) return item.anonymousName || '匿名提问'
  return item.sender?.name || item.senderBiliAuthInfo?.name || '注册用户'
}

function formatTime(ts: number) {
  const d = new Date(ts < 1e12 ? ts * 1000 : ts)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

async function toggleObsDisplay(item: ResponseQAInfoToTarget) {
  if (currentDisplayId.value === item.id) {
    await qb.clearCurrentQuestion()
  } else {
    await qb.setCurrentQuestion(item)
    if (!item.isReaded) {
      await qb.read(item, true)
    }
  }
}

async function openManage() {
  const url = `${CURRENT_HOST}manage/question-box`
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else {
    window.open(url, '_blank')
  }
}

onMounted(() => {
  if (!qb.recieveQuestions.length) {
    void qb.GetRecieveQAInfo()
  }
})
</script>

<template>
  <PanelShell
    title="提问箱"
    panel-id="question_box"
    :count="displayQuestions.length"
    :unread="qb.stats.unread"
    :blurred="blurred"
  >
    <template #actions>
      <IconAction
        :icon="RefreshCw"
        tip="刷新棉花糖列表"
        :class="qb.isLoading ? 'animate-spin' : ''"
        @click="qb.GetRecieveQAInfo()"
      />
      <IconAction
        :icon="ExternalLink"
        tip="打开提问箱管理页"
        @click="openManage"
      />
    </template>

    <div class="flex flex-col h-full min-h-0 p-2 gap-2 text-xs">
      <!-- 当前 OBS 投屏状态条 -->
      <div
        v-if="currentDisplayId"
        class="flex-between gap-2 rounded-md border border-primary/30 bg-primary/8 px-2 py-1.5 shrink-0"
      >
        <div class="flex items-center gap-1.5 min-w-0">
          <Monitor class="size-3.5 text-primary shrink-0" />
          <span class="truncate text-foreground font-medium">
            OBS 展示中：{{ qb.displayQuestion?.question?.message || `#${currentDisplayId}` }}
          </span>
        </div>
        <Button
          size="xs"
          variant="outline"
          class="shrink-0 gap-1"
          @click="qb.clearCurrentQuestion()"
        >
          <MonitorOff class="size-3" />
          关闭投屏
        </Button>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <div class="relative flex-1 min-w-0">
          <Search class="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
          <Input
            v-model="keyword"
            size="xs"
            placeholder="筛选提问内容或标签..."
            class="pl-7"
          />
        </div>
      </div>

      <ToggleGroup
        v-model="filterMode"
        type="single"
        size="xs"
        class="w-full grid grid-cols-3 shrink-0"
      >
        <ToggleGroupItem value="unread">未读 ({{ qb.stats.unread }})</ToggleGroupItem>
        <ToggleGroupItem value="favorite">收藏 ({{ qb.stats.favoriteCount }})</ToggleGroupItem>
        <ToggleGroupItem value="all">全部 ({{ qb.stats.total }})</ToggleGroupItem>
      </ToggleGroup>

      <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-1.5">
        <div
          v-for="item in displayQuestions"
          :key="item.id"
          class="rounded-md border p-2 space-y-1.5 transition-colors"
          :class="
            currentDisplayId === item.id
              ? 'border-primary/60 bg-primary/5'
              : item.isReaded
                ? 'border-border/70 bg-card/50 opacity-80'
                : 'border-border bg-card'
          "
        >
          <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Pin
              v-if="item.isPinned"
              class="size-3 text-primary shrink-0"
            />
            <span class="font-medium text-foreground/90 truncate">{{ senderLabel(item) }}</span>
            <Badge
              v-if="item.tag"
              variant="secondary"
              size="xs"
              class="text-[10px]"
            >
              {{ item.tag }}
            </Badge>
            <span
              v-if="item.questionImages?.length"
              class="inline-flex items-center gap-0.5 text-[10px]"
            >
              <ImageIcon class="size-3" />
              {{ item.questionImages.length }}
            </span>
            <span class="ml-auto tabular-nums shrink-0">{{ formatTime(item.sendAt) }}</span>
          </div>

          <div class="text-xs text-foreground leading-relaxed whitespace-pre-wrap break-words">
            {{ item.question?.message }}
          </div>

          <div class="flex items-center gap-1 pt-1 border-t border-border/60">
            <Button
              size="xs"
              :variant="currentDisplayId === item.id ? 'default' : 'outline'"
              class="gap-1"
              @click="toggleObsDisplay(item)"
            >
              <MonitorOff
                v-if="currentDisplayId === item.id"
                class="size-3"
              />
              <Monitor
                v-else
                class="size-3"
              />
              {{ currentDisplayId === item.id ? '取消投屏' : '投屏 OBS' }}
            </Button>

            <Button
              size="xs"
              :variant="item.isReaded ? 'ghost' : 'secondary'"
              class="gap-1"
              @click="qb.read(item, !item.isReaded)"
            >
              <Check class="size-3" />
              {{ item.isReaded ? '已读' : '标已读' }}
            </Button>

            <div class="ml-auto flex items-center gap-0.5">
              <SimpleTooltip :content="item.isPinned ? '取消置顶' : '置顶提问'">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  :class="item.isPinned ? 'text-primary' : 'text-muted-foreground'"
                  :aria-label="item.isPinned ? '取消置顶' : '置顶提问'"
                  @click="qb.pin(item, !item.isPinned)"
                >
                  <Pin class="size-3" />
                </Button>
              </SimpleTooltip>
              <SimpleTooltip :content="item.isFavorite ? '取消收藏' : '收藏'">
                <Button
                  size="icon-xs"
                  variant="ghost"
                  :class="item.isFavorite ? 'text-amber-500' : 'text-muted-foreground'"
                  :aria-label="item.isFavorite ? '取消收藏' : '收藏'"
                  @click="qb.favorite(item, !item.isFavorite)"
                >
                  <Star class="size-3" />
                </Button>
              </SimpleTooltip>
              <Popconfirm @positive-click="qb.approve(item, false)">
                <template #trigger>
                  <SimpleTooltip content="移入垃圾站隐藏">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      class="text-muted-foreground hover:text-destructive"
                      aria-label="移入垃圾站隐藏"
                    >
                      <EyeOff class="size-3" />
                    </Button>
                  </SimpleTooltip>
                </template>
                确定将此条提问移入垃圾站？
              </Popconfirm>
            </div>
          </div>
        </div>

        <div
          v-if="!displayQuestions.length && !qb.isLoading"
          class="flex-col-center py-8 text-muted-foreground gap-1.5"
        >
          <MessageSquareHeart class="size-5 opacity-40" />
          <span>{{ filterMode === 'unread' ? '当前没有未读棉花糖' : '暂无符合条件的提问' }}</span>
        </div>
      </div>
    </div>
  </PanelShell>
</template>
