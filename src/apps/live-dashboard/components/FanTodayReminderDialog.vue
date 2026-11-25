<script setup lang="ts">
import { Cake, Crown, ExternalLink, Eye, EyeOff, Lock, Sparkles } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { FanReminderItem } from '@/api/fanProfile'
import { useFanPrivacy } from '@/shared/composables/useFanPrivacy'
import { isTauri } from '@/shared/config'
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
import { Separator } from '@/shared/ui/separator'

import { avatarUrl } from '../core/format'
import { GUARD_NAMES } from '../core/types'
import { useLiveDashboard } from '../store/useLiveDashboard'

interface ExpiringGuardSummary {
  uid: number
  uname: string
  face: string
  guardLevel: number
  daysLeft: number
  expireText: string
}

const dashboard = useLiveDashboard()
const account = useAccount()
const { privacyMode, togglePrivacyMode, formatBirthday } = useFanPrivacy()
const inTauri = isTauri()

const dismissedDate = usePersistedStorage<string>('vtsuru:fan:today-reminder-dismissed', '')
const autoChecked = ref(false)
const expiringGuards = ref<ExpiringGuardSummary[]>([])

const todayReminders = computed(() => dashboard.fans.todayReminders)
const totalReminderCount = computed(() => todayReminders.value.length + expiringGuards.value.length)

function getTodayKey() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

async function loadExpiringGuards() {
  if (!inTauri) return
  try {
    const [{ fetchAnchorGuardExpireList }, { roomInfo }] = await Promise.all([
      import('@/apps/client/api/bili-guard-fans'),
      import('@/apps/client/data/info'),
    ])
    const roomId = roomInfo.value?.room_id || account.value.biliRoomId || 0
    if (!roomId) return
    const res = await fetchAnchorGuardExpireList(roomId, 1, 30)
    expiringGuards.value = res.items
      .filter((item) => item.daysLeft >= 0 && item.daysLeft <= 3)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .map((item) => ({
        uid: item.uid,
        uname: item.uname,
        face: item.face,
        guardLevel: item.guardLevel,
        daysLeft: item.daysLeft,
        expireText: item.expireText,
      }))
  } catch {
    // 未登录 Cookie 或拉取失败时静默忽略，不影响常规粉丝特别日提醒
  }
}

watch(
  [() => dashboard.fans.loaded, totalReminderCount],
  ([loaded, count]) => {
    if (!loaded || autoChecked.value) return
    if (count > 0 && dismissedDate.value !== getTodayKey()) {
      autoChecked.value = true
      dashboard.fans.todayReminderDialogOpen = true
    }
  },
  { immediate: true },
)

onMounted(() => {
  void loadExpiringGuards()
})

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
    <DialogContent class="sm:max-w-[480px]">
      <DialogHeader>
        <div class="flex items-center justify-between gap-2 pr-6">
          <DialogTitle class="text-sm flex items-center gap-1.5">
            <Cake class="size-4 text-amber-500" />
            今日粉丝关怀提醒
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
          仅主播中控台可见，绝不透出到 OBS 或公开页面。今日有 {{ todayReminders.length }} 条特别日<template v-if="expiringGuards.length > 0">、{{ expiringGuards.length }} 位近 3 天到期大航海</template>。
        </DialogDescription>
      </DialogHeader>

      <ScrollArea
        v-if="totalReminderCount > 0"
        class="max-h-[340px] [&_[data-reka-scroll-area-viewport]>div]:!block"
      >
        <div class="space-y-3 pr-2">
          <!-- 生日 / 纪念日 -->
          <div
            v-if="todayReminders.length > 0"
            class="space-y-2"
          >
            <div
              v-for="item in todayReminders"
              :key="`${item.profileId}-${item.kind}-${item.title}`"
              class="flex items-center gap-2.5 rounded-md border border-border bg-card p-2.5"
            >
              <div
                class="size-8 rounded-full flex-center shrink-0"
                :class="
                  item.kind === 'birthday'
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'bg-primary/10 text-primary'
                "
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

          <Separator v-if="todayReminders.length > 0 && expiringGuards.length > 0" />

          <!-- 近 3 天到期大航海（仅客户端） -->
          <div
            v-if="expiringGuards.length > 0"
            class="space-y-2"
          >
            <div class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Crown class="size-3.5 text-amber-500" />
              <span>近 3 天即将到期大航海（{{ expiringGuards.length }}）</span>
            </div>

            <div
              v-for="guard in expiringGuards"
              :key="guard.uid"
              class="flex items-center gap-2.5 rounded-md border border-amber-500/35 bg-amber-500/5 p-2"
            >
              <img
                v-if="guard.face"
                :src="avatarUrl(guard.face, 48)"
                referrerpolicy="no-referrer"
                class="size-7 rounded-full shrink-0"
              />
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs font-semibold text-foreground truncate">{{ guard.uname }}</span>
                  <Badge
                    variant="warning"
                    size="xs"
                    class="text-[10px]"
                  >
                    {{ GUARD_NAMES[guard.guardLevel] || '大航海' }}
                  </Badge>
                  <span class="text-[11px] font-medium text-amber-600 dark:text-amber-400 tabular-nums">
                    {{ guard.daysLeft === 0 ? '今日到期' : `剩余 ${guard.daysLeft} 天` }}
                  </span>
                </div>
                <div class="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                  到期：{{ privacyMode ? '••••-••-••' : guard.expireText }}
                </div>
              </div>

              <Button
                variant="ghost"
                size="xs"
                as="a"
                :href="`/manage/fans?uid=${guard.uid}`"
                target="_blank"
              >
                <ExternalLink class="size-3 mr-1" />
                档案
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>

      <div
        v-else
        class="py-6 text-center text-xs text-muted-foreground"
      >
        今天暂无粉丝生日、纪念日或即将到期的大航海。
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
