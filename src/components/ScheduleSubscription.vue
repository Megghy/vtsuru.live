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
import { Input } from '@/shared/ui/input'
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
    class="flex flex-wrap items-center gap-4 w-full p-3.5 border border-border/80 rounded-lg text-card-foreground bg-card transition-all"
    :class="[
      docked
        ? 'sticky bottom-5 z-25 max-w-[740px] mx-auto p-2 px-3.5 rounded-full bg-card/85 backdrop-blur-xl saturate-180 border-border shadow-lg flex-nowrap gap-3'
        : 'shadow-sm',
    ]"
    aria-label="订阅直播日程"
  >
    <div
      class="flex items-center gap-2.5 min-w-0"
      :class="docked ? 'flex-1' : 'flex-1 basis-60'"
    >
      <span
        class="size-9 rounded-md bg-primary/10 text-primary flex-center shrink-0"
        :class="{ 'size-8': docked }"
        aria-hidden="true"
      >
        <component
          :is="CalendarNumberOutline"
          class="size-5"
        />
      </span>
      <span
        class="min-w-0"
        :class="docked ? 'flex items-center gap-2' : 'flex flex-col gap-0.5'"
      >
        <strong class="text-xs font-semibold leading-tight whitespace-nowrap">订阅直播日程</strong>
        <span class="text-xs text-muted-foreground leading-snug truncate">添加到日历后，日程更新自动同步</span>
      </span>
    </div>

    <div
      class="flex items-center gap-2 shrink-0"
      :class="docked ? 'flex-nowrap' : 'flex-wrap justify-end flex-1 basis-[400px]'"
    >
      <Input
        v-if="!docked"
        :value="url"
        readonly
        aria-label="日历订阅链接"
        class="font-mono flex-1 min-w-[200px]"
        @focus="selectUrl"
        @click="selectUrl"
      />
      <Button
        as-child
        variant="outline"
        class="flex items-center gap-1.5"
      >
        <a :href="webcalUrl">
          <component
            :is="OpenOutline"
            class="size-3.5"
          />
          <span class="max-sm:hidden">打开日历</span>
          <span class="hidden max-sm:inline">日历</span>
        </a>
      </Button>
      <Button
        variant="outline"
        class="flex items-center gap-1.5"
        :disabled="copyState === 'success'"
        @click="copyUrl"
      >
        <component
          :is="copyState === 'success' ? CheckmarkOutline : CopyOutline"
          class="size-3.5"
        />
        <span class="max-sm:hidden">{{
          copyState === 'success' ? '已复制' : copyState === 'error' ? '复制失败' : '复制链接'
        }}</span>
        <span class="hidden max-sm:inline">{{
          copyState === 'success' ? '已复制' : copyState === 'error' ? '失败' : '复制'
        }}</span>
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
            <component
              :is="SettingsOutline"
              class="size-4"
            />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          class="w-72 p-3 text-xs space-y-3"
        >
          <div class="space-y-0.5 pb-1.5 border-b border-border">
            <strong class="text-xs font-semibold block text-foreground">订阅参数设置</strong>
            <span class="text-[11px] text-muted-foreground block truncate">{{ settingsSummary }}</span>
          </div>

          <div class="space-y-1">
            <span class="text-[11px] text-muted-foreground font-medium block">开播提醒</span>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="opt in reminderOptions"
                :key="`dock-r-${opt.value}`"
                type="button"
                class="px-2 py-0.5 rounded text-[11px] transition cursor-pointer"
                :class="
                  reminder === opt.value
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                "
                :aria-pressed="reminder === opt.value"
                @click="reminder = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <div class="space-y-1">
            <span class="text-[11px] text-muted-foreground font-medium block">标题标签</span>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="opt in tagOptions"
                :key="`dock-t-${opt.value}`"
                type="button"
                class="px-2 py-0.5 rounded text-[11px] transition cursor-pointer"
                :class="
                  withTag === opt.value
                    ? 'bg-primary text-primary-foreground font-medium'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                "
                :aria-pressed="withTag === opt.value"
                @click="withTag = opt.value"
              >
                {{ opt.label }}
              </button>
            </div>
          </div>

          <div class="pt-1">
            <input
              :value="url"
              readonly
              aria-label="日历订阅链接"
              class="w-full h-7 text-[11px] font-mono px-2 rounded border border-border bg-background outline-none focus-visible:ring-2 focus-visible:ring-primary"
              @focus="selectUrl"
              @click="selectUrl"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>

    <!-- 普通内联模式下的可折叠设置栏 -->
    <template v-if="!docked">
      <div class="flex items-center justify-between w-full text-xs pt-2.5 border-t border-border/60">
        <span class="text-[11px] text-muted-foreground truncate">{{ settingsSummary }}</span>
        <button
          type="button"
          class="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          :aria-expanded="settingsOpen"
          aria-controls="schedule-subscription-settings"
          @click="settingsOpen = !settingsOpen"
        >
          <component
            :is="SettingsOutline"
            class="size-3.5"
          />
          <span>订阅设置</span>
          <component
            :is="ChevronDownOutline"
            class="size-3 transition-transform duration-200"
            :class="{ 'rotate-180': settingsOpen }"
            aria-hidden="true"
          />
        </button>
      </div>

      <div
        v-show="settingsOpen"
        id="schedule-subscription-settings"
        class="w-full pt-1 space-y-2 text-xs"
      >
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-[11px] text-muted-foreground mr-1">开播提醒:</span>
          <button
            v-for="opt in reminderOptions"
            :key="`r-${opt.value}`"
            type="button"
            class="px-2 py-0.5 rounded text-[11px] transition cursor-pointer"
            :class="
              reminder === opt.value
                ? 'bg-primary text-primary-foreground font-medium'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            "
            :aria-pressed="reminder === opt.value"
            @click="reminder = opt.value"
          >
            {{ opt.label }}
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-[11px] text-muted-foreground mr-1">标题标签:</span>
          <button
            v-for="opt in tagOptions"
            :key="`t-${opt.value}`"
            type="button"
            class="px-2 py-0.5 rounded text-[11px] transition cursor-pointer"
            :class="
              withTag === opt.value
                ? 'bg-primary text-primary-foreground font-medium'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            "
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
