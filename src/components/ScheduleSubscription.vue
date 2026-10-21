<script setup lang="ts">
import {
  CalendarNumberOutline,
  CheckmarkOutline,
  ChevronDownOutline,
  CopyOutline,
  OpenOutline,
  SettingsOutline,
} from '@vicons/ionicons5'
import { computed, onBeforeUnmount, ref } from 'vue'

import { Button } from '@/shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

const props = withDefaults(
  defineProps<{
    url: string
    docked?: boolean
  }>(),
  {
    docked: false,
  },
)

const reminderOptions: { value: number | null; label: string }[] = [
  { value: null, label: '不提醒' },
  { value: 5, label: '提前5分钟' },
  { value: 10, label: '提前10分钟' },
  { value: 30, label: '提前30分钟' },
  { value: 60, label: '提前1小时' },
  { value: 180, label: '提前3小时' },
  { value: 1440, label: '提前1天' },
  { value: 2880, label: '提前2天' },
]
const tagOptions: { value: boolean; label: string }[] = [
  { value: false, label: '不带标签' },
  { value: true, label: '附带标签' },
]

const reminder = ref<number | null>(5)
const withTag = ref(false)
const settingsOpen = ref(false)
const popoverOpen = ref(false)
const url = computed(() => {
  const target = new URL(props.url)
  if (reminder.value === null) target.searchParams.delete('remind')
  else target.searchParams.set('remind', String(reminder.value))
  if (withTag.value) target.searchParams.set('tag', '1')
  else target.searchParams.delete('tag')
  return target.toString()
})
const webcalUrl = computed(() => url.value.replace(/^https?:\/\//, 'webcal://'))
const reminderLabel = computed(() => reminderOptions.find((option) => option.value === reminder.value)?.label ?? '')
const settingsSummary = computed(() => {
  const values = [reminderLabel.value]
  if (withTag.value) values.push('附带标题标签')
  return values.join(' · ')
})

const copyState = ref<'idle' | 'success' | 'error'>('idle')
let resetTimer: number | undefined

async function copyUrl() {
  if (copyState.value === 'success') return

  if (resetTimer !== undefined) window.clearTimeout(resetTimer)
  try {
    await navigator.clipboard.writeText(url.value)
    copyState.value = 'success'
  } catch {
    copyState.value = 'error'
  }
  resetTimer = window.setTimeout(() => {
    copyState.value = 'idle'
  }, 3000)
}

function selectUrl(event: FocusEvent | MouseEvent) {
  ;(event.currentTarget as HTMLInputElement).select()
}

onBeforeUnmount(() => {
  if (resetTimer !== undefined) window.clearTimeout(resetTimer)
})
</script>

<template>
  <aside
    class="schedule-subscription"
    :class="{ 'is-docked': docked }"
    aria-label="订阅直播日程"
  >
    <div class="subscription-copy">
      <span
        class="subscription-icon"
        aria-hidden="true"
      >
        <component :is="CalendarNumberOutline" class="size-5" />
      </span>
      <span class="subscription-text">
        <strong>订阅直播日程</strong>
        <span class="subscription-hint">添加到日历后，日程更新自动同步</span>
      </span>
    </div>

    <div class="subscription-action flex items-center gap-1.5">
      <input
        v-if="!docked"
        :value="url"
        readonly
        aria-label="日历订阅链接"
        class="h-8 text-xs font-mono px-2 rounded border border-border bg-background flex-1"
        @focus="selectUrl"
        @click="selectUrl"
      />
      <Button
        as-child
        variant="outline"
        size="sm"
        class="h-8 text-xs flex items-center gap-1"
      >
        <a :href="webcalUrl">
          <component :is="OpenOutline" class="size-3.5" />
          <span class="btn-text-full">打开日历</span>
          <span class="btn-text-short">日历</span>
        </a>
      </Button>
      <Button
        variant="outline"
        size="sm"
        class="h-8 text-xs flex items-center gap-1"
        :disabled="copyState === 'success'"
        @click="copyUrl"
      >
        <component :is="copyState === 'success' ? CheckmarkOutline : CopyOutline" class="size-3.5" />
        <span class="btn-text-full">{{ copyState === 'success' ? '已复制' : copyState === 'error' ? '复制失败' : '复制链接' }}</span>
        <span class="btn-text-short">{{ copyState === 'success' ? '已复制' : copyState === 'error' ? '失败' : '复制' }}</span>
      </Button>

      <!-- 悬浮坞模式下的设置弹层 -->
      <Popover
        v-if="docked"
        v-model:open="popoverOpen"
      >
        <PopoverTrigger as-child>
          <Button
            variant="ghost"
            size="icon"
            class="size-8 rounded-full text-muted-foreground hover:text-foreground"
            :title="`订阅设置 (${settingsSummary})`"
            :aria-label="`订阅设置 (${settingsSummary})`"
          >
            <component :is="SettingsOutline" class="size-4" />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          class="dock-settings-popover w-72 p-3 text-xs space-y-3"
        >
          <div class="dock-settings-header space-y-0.5">
            <strong class="text-xs font-semibold block text-foreground">订阅参数设置</strong>
            <span class="dock-settings-sub text-[11px] text-muted-foreground block">{{ settingsSummary }}</span>
          </div>

          <div class="subscription-setting space-y-1">
            <span class="setting-label text-[11px] text-muted-foreground font-medium block">开播提醒</span>
            <div class="setting-options-wrap flex flex-wrap gap-1">
              <button
                v-for="opt in reminderOptions"
                :key="`dock-r-${opt.value}`"
                type="button"
                class="setting-option px-2 py-0.5 rounded text-[11px] transition cursor-pointer"
                :class="reminder === opt.value ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80'"
                :aria-pressed="reminder === opt.value"
                @click="reminder = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <div class="subscription-setting space-y-1">
            <span class="setting-label text-[11px] text-muted-foreground font-medium block">标题标签</span>
            <div class="setting-options-wrap flex flex-wrap gap-1">
              <button
                v-for="opt in tagOptions"
                :key="`dock-t-${opt.value}`"
                type="button"
                class="setting-option px-2 py-0.5 rounded text-[11px] transition cursor-pointer"
                :class="withTag === opt.value ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80'"
                :aria-pressed="withTag === opt.value"
                @click="withTag = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <div class="dock-url-preview pt-1">
            <input
              :value="url"
              readonly
              aria-label="日历订阅链接"
              class="w-full h-7 text-[11px] font-mono px-1.5 rounded border border-border bg-background"
              @focus="selectUrl"
              @click="selectUrl"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>

    <!-- 普通内联模式下的可折叠设置栏 -->
    <template v-if="!docked">
      <div class="subscription-settings-bar flex items-center justify-between text-xs pt-2 border-t border-border/50">
        <span class="settings-summary text-[11px] text-muted-foreground">{{ settingsSummary }}</span>
        <button
          type="button"
          class="settings-toggle inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
          :aria-expanded="settingsOpen"
          aria-controls="schedule-subscription-settings"
          @click="settingsOpen = !settingsOpen"
        >
          <component :is="SettingsOutline" class="size-3.5" />
          <span>订阅设置</span>
          <component
            :is="ChevronDownOutline"
            class="settings-toggle-arrow size-3 transition-transform duration-200"
            :class="{ 'rotate-180': settingsOpen }"
            aria-hidden="true"
          />
        </button>
      </div>

      <div
        v-show="settingsOpen"
        id="schedule-subscription-settings"
        class="subscription-settings pt-2 space-y-2 text-xs"
      >
        <div class="subscription-setting flex flex-wrap items-center gap-1.5">
          <span class="setting-label text-[11px] text-muted-foreground mr-1">开播提醒:</span>
          <button
            v-for="opt in reminderOptions"
            :key="`r-${opt.value}`"
            type="button"
            class="setting-option px-2 py-0.5 rounded text-[11px] transition cursor-pointer"
            :class="reminder === opt.value ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80'"
            :aria-pressed="reminder === opt.value"
            @click="reminder = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>

        <div class="subscription-setting flex flex-wrap items-center gap-1.5">
          <span class="setting-label text-[11px] text-muted-foreground mr-1">标题标签:</span>
          <button
            v-for="opt in tagOptions"
            :key="`t-${opt.value}`"
            type="button"
            class="setting-option px-2 py-0.5 rounded text-[11px] transition cursor-pointer"
            :class="withTag === opt.value ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:bg-muted/80'"
            :aria-pressed="withTag === opt.value"
            @click="withTag = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </template>
  </aside>
</template>

<style scoped>
@import './scheduleSubscription.css';
</style>
