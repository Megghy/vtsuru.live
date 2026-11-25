<script setup lang="ts">
import { CalendarPlus, CheckSquare, Plus, Square, Trash2, X } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { getApiScheduleGet } from '@/api/generated/schedule/schedule'
import { buildScheduleDays, getCurrentWeekOrder } from '@/apps/user/pages/scheduleTemplate/scheduleTemplateUtils'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { SimpleTooltip } from '@/shared/ui/tooltip'

import IconAction from './IconAction.vue'
import PanelShell from './PanelShell.vue'

defineProps<{ blurred?: boolean }>()

interface ChecklistItem {
  id: string
  text: string
  done: boolean
  tag?: string
}

const account = useAccount()
const items = usePersistedStorage<ChecklistItem[]>('vtsuru:settings:live-dashboard:checklist', [
  { id: 'init-1', text: '开播检查麦克风、桌面音频与推流画面', done: false, tag: '准备' },
  { id: 'init-2', text: '提醒观众点赞/粉丝团与本场活动内容', done: false, tag: '口播' },
])

const draftText = ref('')
const importing = ref(false)

const doneCount = computed(() => items.value.filter((i) => i.done).length)

function addItem() {
  const text = draftText.value.trim()
  if (!text) return
  items.value = [...items.value, { id: `ck-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text, done: false }]
  draftText.value = ''
}

function toggleItem(id: string) {
  items.value = items.value.map((i) => (i.id === id ? { ...i, done: !i.done } : i))
}

function removeItem(id: string) {
  items.value = items.value.filter((i) => i.id !== id)
}

function clearDone() {
  items.value = items.value.filter((i) => !i.done)
}

async function importTodaySchedule() {
  const uid = account.value?.id
  if (!uid || importing.value) return
  importing.value = true
  try {
    const res = await getApiScheduleGet({ id: String(uid) })
    const weeks = res.data ?? []
    const now = new Date()
    const targetOrder = getCurrentWeekOrder(now)
    const week = weeks.find((w) => w.year * 100 + w.week === targetOrder) ?? weeks[0]
    if (!week) {
      toast.info('本周暂无日程表内容')
      return
    }
    const days = buildScheduleDays(week, now)
    const today = days.find((d) => d.isToday)
    const todayItems = today?.items ?? []
    if (!todayItems.length) {
      toast.info('今日日程表暂无安排条目')
      return
    }
    const existingTexts = new Set(items.value.map((i) => i.text))
    const appended: ChecklistItem[] = []
    for (const entry of todayItems) {
      const label = [entry.time, entry.title].filter(Boolean).join(' ')
      if (!label || existingTexts.has(label)) continue
      appended.push({
        id: `sched-${Date.now()}-${appended.length}`,
        text: label,
        done: false,
        tag: entry.tag || '日程',
      })
    }
    if (!appended.length) {
      toast.info('今日日程条目已在提纲中')
      return
    }
    items.value = [...items.value, ...appended]
    toast.success(`已导入 ${appended.length} 条今日日程`)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '导入日程失败')
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <PanelShell
    title="直播提纲"
    panel-id="checklist"
    :count="items.length"
    :blurred="blurred"
  >
    <template #actions>
      <Badge
        v-if="items.length > 0"
        variant="secondary"
        size="xs"
        class="tabular-nums"
      >
        {{ doneCount }}/{{ items.length }}
      </Badge>
      <IconAction
        :icon="CalendarPlus"
        tip="导入今日日程表条目"
        @click="importTodaySchedule"
      />
      <Popconfirm
        v-if="doneCount > 0"
        @positive-click="clearDone"
      >
        <template #trigger>
          <SimpleTooltip content="清除已完成条目">
            <Button
              variant="ghost"
              size="icon-xs"
              class="text-muted-foreground hover:text-destructive"
              aria-label="清除已完成条目"
            >
              <Trash2 class="size-3.5" />
            </Button>
          </SimpleTooltip>
        </template>
        确定清除已勾选的 {{ doneCount }} 条提纲？
      </Popconfirm>
    </template>

    <div class="flex flex-col h-full min-h-0 p-2 gap-2 text-xs">
      <div class="flex items-center gap-1.5 shrink-0">
        <Input
          v-model="draftText"
          size="xs"
          placeholder="添加本场话题、口播或备忘..."
          @keyup.enter="addItem"
        />
        <Button
          size="icon-xs"
          variant="secondary"
          :disabled="!draftText.trim()"
          aria-label="添加提纲条目"
          @click="addItem"
        >
          <Plus class="size-3.5" />
        </Button>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-1">
        <div
          v-for="item in items"
          :key="item.id"
          class="group flex items-start gap-1.5 rounded-md border border-border/80 bg-card/70 px-2 py-1.5 transition-opacity"
          :class="{ 'opacity-55': item.done }"
        >
          <button
            type="button"
            class="mt-0.5 text-muted-foreground hover:text-primary shrink-0 border-0 bg-transparent p-0 cursor-pointer"
            @click="toggleItem(item.id)"
          >
            <CheckSquare
              v-if="item.done"
              class="size-3.5 text-emerald-500"
            />
            <Square
              v-else
              class="size-3.5"
            />
          </button>

          <div
            class="flex-1 min-w-0 cursor-pointer leading-snug break-words"
            :class="{ 'line-through text-muted-foreground': item.done }"
            @click="toggleItem(item.id)"
          >
            <Badge
              v-if="item.tag"
              variant="secondary"
              size="xs"
              class="mr-1 text-[10px] align-baseline"
            >
              {{ item.tag }}
            </Badge>
            <span>{{ item.text }}</span>
          </div>

          <Button
            variant="ghost"
            size="none"
            class="size-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
            aria-label="删除条目"
            @click="removeItem(item.id)"
          >
            <X class="size-3" />
          </Button>
        </div>

        <div
          v-if="!items.length"
          class="py-8 text-center text-muted-foreground"
        >
          暂无提纲，可在上方新增或点右上角导入今日日程
        </div>
      </div>
    </div>
  </PanelShell>
</template>
