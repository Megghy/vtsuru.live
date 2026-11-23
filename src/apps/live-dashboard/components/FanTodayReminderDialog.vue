<script setup lang="ts">
import { Cake, ExternalLink, Eye, EyeOff, Lock, Sparkles } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import type { FanReminderItem } from '@/api/fanProfile'
import { useFanPrivacy } from '@/shared/composables/useFanPrivacy'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { ScrollArea } from '@/shared/ui/scroll-area'

import { useLiveDashboard } from '../store/useLiveDashboard'

const dashboard = useLiveDashboard()
const { privacyMode, togglePrivacyMode, formatBirthday } = useFanPrivacy()

const dismissedDate = usePersistedStorage<string>('vtsuru:fan:today-reminder-dismissed', '')
const autoChecked = ref(false)

const todayReminders = computed(() => dashboard.fans.todayReminders)

function getTodayKey() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

watch(
  [() => dashboard.fans.loaded, () => todayReminders.value.length],
  ([loaded, count]) => {
    if (!loaded || autoChecked.value) return
    autoChecked.value = true
    if (count > 0 && dismissedDate.value !== getTodayKey()) {
      dashboard.fans.todayReminderDialogOpen = true
    }
  },
  { immediate: true },
)

function reminderHref(item: FanReminderItem) {
  if (item.canonicalOUId) return `/manage/fans?ouid=${encodeURIComponent(item.canonicalOUId)}`
  if (item.uId && item.uId > 0) return `/manage/fans?uid=${item.uId}`
  return '/manage/fans'
}

function dismissForToday() {
  dismissedDate.value = getTodayKey()
  dashboard.fans.todayReminderDialogOpen = false
}
</script>

<template>
  <Dialog v-model:open="dashboard.fans.todayReminderDialogOpen">
    <DialogContent class="sm:max-w-[460px]">
      <DialogHeader>
        <div class="flex items-center justify-between gap-2 pr-6">
          <DialogTitle class="text-sm flex items-center gap-1.5">
            <Cake class="size-4 text-amber-500" />
            今日粉丝特别日提醒
          </DialogTitle>
          <Button
            :variant="privacyMode ? 'default' : 'outline'"
            size="xs"
            @click="togglePrivacyMode"
          >
            <EyeOff
              v-if="privacyMode"
              class="size-3 mr-1"
            />
            <Eye
              v-else
              class="size-3 mr-1"
            />
            {{ privacyMode ? '防露屏开' : '防露屏关' }}
          </Button>
        </div>
        <DialogDescription class="text-xs flex items-center gap-1.5">
          <Lock class="size-3 shrink-0" />
          仅主播中控台可见，绝不透出到 OBS 或公开页面。今天共有 {{ todayReminders.length }} 条粉丝生日 / 纪念日。
        </DialogDescription>
      </DialogHeader>

      <ScrollArea
        v-if="todayReminders.length > 0"
        class="max-h-[300px] [&_[data-reka-scroll-area-viewport]>div]:!block"
      >
        <div class="space-y-2 pr-2">
          <div
            v-for="item in todayReminders"
            :key="`${item.profileId}-${item.kind}-${item.title}`"
            class="flex items-center gap-2.5 rounded-md border border-border bg-card p-2.5"
          >
            <div
              class="size-8 rounded-full flex-center shrink-0"
              :class="item.kind === 'birthday' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-primary/10 text-primary'"
            >
              <Cake
                v-if="item.kind === 'birthday'"
                class="size-4"
              />
              <Sparkles
                v-else
                class="size-4"
              />
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-xs font-semibold text-foreground truncate">{{ item.displayName }}</span>
                <Badge
                  variant="secondary"
                  class="text-[10px]"
                >
                  {{ item.kind === 'birthday' ? '今天生日' : item.title || '纪念日' }}
                </Badge>
                <span
                  v-if="item.years && item.years > 0"
                  class="text-[11px] text-muted-foreground tabular-nums"
                >
                  满 {{ item.years }} 年
                </span>
              </div>
              <div class="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                <template v-if="item.kind === 'birthday'">
                  日期：{{ formatBirthday(item.month, item.day, !privacyMode) }}
                </template>
                <template v-else>
                  日期：{{ privacyMode ? '••月••日' : item.dateLabel }}
                </template>
              </div>
            </div>

            <Button
              variant="ghost"
              size="xs"
              as="a"
              :href="reminderHref(item)"
              target="_blank"
            >
              <ExternalLink class="size-3 mr-1" />
              档案
            </Button>
          </div>
        </div>
      </ScrollArea>

      <div
        v-else
        class="py-6 text-center text-xs text-muted-foreground"
      >
        今天暂无粉丝生日或纪念日。
      </div>

      <DialogFooter class="gap-1.5">
        <Button
          variant="outline"
          @click="dismissForToday"
        >
          今天不再提醒
        </Button>
        <Button @click="dashboard.fans.todayReminderDialogOpen = false">
          开始直播
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
