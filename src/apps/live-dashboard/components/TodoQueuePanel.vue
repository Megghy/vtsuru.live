<script setup lang="ts">
import { Check, CheckCheck, Crown, HelpCircle, ListTodo, Settings2, Sparkles } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { EventDataTypes } from '@/api/generated/model'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { SimpleTooltip } from '@/shared/ui/tooltip'

import { avatarUrl, formatClock, formatPrice, formatRelative } from '../core/format'
import type { DashboardEvent } from '../core/types'
import { GUARD_NAMES } from '../core/types'
import { useDashboardUi } from '../store/ui'
import { useLiveDashboard } from '../store/useLiveDashboard'
import IconAction from './IconAction.vue'
import PanelShell from './PanelShell.vue'

defineProps<{ blurred?: boolean }>()

const dashboard = useLiveDashboard()
const ui = useDashboardUi()

const QUESTION_RE = /[?？@＠]|^(?:请问|怎么|为什么|啥|什么|谁|哪里|哪个|多少|能不能|可以|是不是)/

const config = usePersistedStorage('vtsuru:settings:live-dashboard:todo-queue', {
  includeGuards: true,
  includeSc: true,
  scMinPrice: 30,
  includeQuestions: true,
  customKeywords: '',
})

const tab = ref<'all' | 'thanks' | 'question'>('all')

interface TodoItem {
  event: DashboardEvent
  kind: 'guard' | 'sc' | 'question'
  tag: string
}

const customKeywordList = computed(() =>
  config.value.customKeywords
    .split(/[,，\n]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
)

const allTodos = computed<TodoItem[]>(() => {
  const result: TodoItem[] = []
  const unreadPaid = [...dashboard.scList, ...dashboard.giftList]
  const seen = new Set<string>()

  for (const ev of unreadPaid) {
    if (dashboard.isRead(ev) || seen.has(ev.key)) continue
    if (ev.type === EventDataTypes.Guard && config.value.includeGuards) {
      seen.add(ev.key)
      result.push({
        event: ev,
        kind: 'guard',
        tag: GUARD_NAMES[ev.guardLevel] || '大航海',
      })
    } else if (ev.type === EventDataTypes.SC && config.value.includeSc && ev.price >= config.value.scMinPrice) {
      seen.add(ev.key)
      result.push({
        event: ev,
        kind: 'sc',
        tag: `SC ${formatPrice(ev.price)}`,
      })
    }
  }

  if (config.value.includeQuestions || customKeywordList.value.length > 0) {
    const kws = customKeywordList.value
    for (const ev of dashboard.danmakuList) {
      if (dashboard.isRead(ev) || ev.emoji || seen.has(ev.key)) continue
      const msg = ev.msg.trim()
      if (!msg) continue
      const lower = msg.toLowerCase()
      const hitKw = kws.find((k) => lower.includes(k))
      const hitQuestion = config.value.includeQuestions && QUESTION_RE.test(msg)
      if (hitKw || hitQuestion) {
        seen.add(ev.key)
        result.push({
          event: ev,
          kind: 'question',
          tag: hitKw ? `关键词: ${hitKw}` : '提问',
        })
      }
    }
  }

  return result.sort((a, b) => {
    const rank = (k: TodoItem['kind']) => (k === 'guard' ? 0 : k === 'sc' ? 1 : 2)
    return rank(a.kind) - rank(b.kind) || b.event.time - a.event.time
  })
})

const filteredTodos = computed(() => {
  if (tab.value === 'thanks') return allTodos.value.filter((i) => i.kind === 'guard' || i.kind === 'sc')
  if (tab.value === 'question') return allTodos.value.filter((i) => i.kind === 'question')
  return allTodos.value
})

const thanksCount = computed(() => allTodos.value.filter((i) => i.kind !== 'question').length)
const questionCount = computed(() => allTodos.value.filter((i) => i.kind === 'question').length)

function markDone(event: DashboardEvent) {
  dashboard.setRead([event], true)
}

function markAllDone() {
  dashboard.setRead(
    filteredTodos.value.map((i) => i.event),
    true,
  )
}
</script>

<template>
  <PanelShell
    title="待处理"
    panel-id="todo"
    :unread="allTodos.length"
    :blurred="blurred"
  >
    <template #actions>
      <Popover>
        <PopoverTrigger as-child>
          <span class="inline-flex">
            <SimpleTooltip content="待处理聚合规则">
              <Button
                variant="ghost"
                size="icon-xs"
                class="text-muted-foreground hover:text-foreground"
                aria-label="待处理聚合规则"
              >
                <Settings2 class="size-3.5" />
              </Button>
            </SimpleTooltip>
          </span>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          class="w-64 p-3 space-y-2.5 text-xs"
        >
          <div class="font-semibold text-foreground">待处理队列筛选规则</div>
          <SettingRow
            variant="none"
            title="收录未读大航海"
          >
            <Switch v-model="config.includeGuards" />
          </SettingRow>
          <SettingRow
            variant="none"
            title="收录未读醒目留言 (SC)"
          >
            <Switch v-model="config.includeSc" />
          </SettingRow>
          <FormField
            v-if="config.includeSc"
            label="SC 最低金额（元）"
          >
            <NumberField
              v-model="config.scMinPrice"
              :min="0"
              :step="10"
            />
          </FormField>
          <SettingRow
            variant="none"
            title="自动提取提问 / @弹幕"
          >
            <Switch v-model="config.includeQuestions" />
          </SettingRow>
          <FormField label="额外关键词（逗号分隔）">
            <Input
              v-model="config.customKeywords"
              size="xs"
              placeholder="例如：主播,点歌,报错"
            />
          </FormField>
        </PopoverContent>
      </Popover>
      <IconAction
        :icon="CheckCheck"
        tip="当前列表全部标为已处理"
        @click="markAllDone"
      />
    </template>

    <div class="flex flex-col h-full min-h-0 p-2 gap-2 text-xs">
      <ToggleGroup
        v-model="tab"
        type="single"
        size="xs"
        class="w-full grid grid-cols-3 shrink-0"
      >
        <ToggleGroupItem value="all">全部 ({{ allTodos.length }})</ToggleGroupItem>
        <ToggleGroupItem value="thanks">待感谢 ({{ thanksCount }})</ToggleGroupItem>
        <ToggleGroupItem value="question">提问 ({{ questionCount }})</ToggleGroupItem>
      </ToggleGroup>

      <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-1.5">
        <div
          v-for="item in filteredTodos"
          :key="item.event.key"
          class="rounded-md border p-2 space-y-1 transition-colors"
          :class="
            item.kind === 'guard'
              ? 'border-amber-500/40 bg-amber-500/5'
              : item.kind === 'sc'
                ? 'border-primary/40 bg-primary/5'
                : 'border-border bg-card/70'
          "
        >
          <div class="flex items-center gap-1.5">
            <img
              v-if="dashboard.settings.showAvatar && item.event.uface"
              :src="avatarUrl(item.event.uface, 40)"
              referrerpolicy="no-referrer"
              class="size-4 rounded-full shrink-0"
            />
            <button
              type="button"
              class="font-medium text-foreground truncate hover:underline border-0 bg-transparent p-0 cursor-pointer text-left"
              @click="ui.openUserMenu(item.event, $event)"
            >
              {{ item.event.uname }}
            </button>
            <Badge
              :variant="item.kind === 'guard' ? 'warning' : item.kind === 'sc' ? 'default' : 'secondary'"
              size="xs"
              class="gap-0.5 text-[10px] shrink-0"
            >
              <Crown
                v-if="item.kind === 'guard'"
                class="size-2.5"
              />
              <Sparkles
                v-else-if="item.kind === 'sc'"
                class="size-2.5"
              />
              <HelpCircle
                v-else
                class="size-2.5"
              />
              {{ item.tag }}
            </Badge>
            <span class="ml-auto text-[10px] text-muted-foreground tabular-nums shrink-0">
              {{
                dashboard.settings.absoluteTime
                  ? formatClock(item.event.time)
                  : (void dashboard.minuteNow, formatRelative(item.event.time))
              }}
            </span>
          </div>

          <div class="flex items-start gap-1.5">
            <div class="flex-1 text-foreground/95 leading-snug break-words">
              {{ item.event.msg || (item.kind === 'guard' ? `开通了 ${item.tag} ×${item.event.num}` : '') }}
            </div>
            <SimpleTooltip content="念完 / 标为已处理">
              <Button
                size="icon-xs"
                variant="ghost"
                class="text-muted-foreground hover:text-emerald-500 shrink-0"
                aria-label="念完 / 标为已处理"
                @click="markDone(item.event)"
              >
                <Check class="size-3.5" />
              </Button>
            </SimpleTooltip>
          </div>
        </div>

        <div
          v-if="!filteredTodos.length"
          class="flex-col-center py-8 text-muted-foreground gap-1.5"
        >
          <ListTodo class="size-5 opacity-40" />
          <span>当前没有待感谢或待回复条目</span>
        </div>
      </div>
    </div>
  </PanelShell>
</template>
