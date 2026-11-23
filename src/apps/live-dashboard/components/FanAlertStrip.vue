<script setup lang="ts">
import { Cake, CloudUpload, History, Sparkles, Tag, X } from 'lucide-vue-next'
import { computed } from 'vue'

import { Button } from '@/shared/ui/button'
import { useFanPrivacy } from '@/shared/composables/useFanPrivacy'

import type { FanLiveAlert } from '../store/fanProfiles'
import { useDashboardUi } from '../store/ui'
import { useLiveDashboard } from '../store/useLiveDashboard'

const dashboard = useLiveDashboard()
const ui = useDashboardUi()
const { privacyMode } = useFanPrivacy()

const alerts = computed(() => dashboard.fans.alerts)
const unsyncedCount = computed(() => dashboard.fans.unsyncedLocalNoteCount)

function openFromAlert(alert: FanLiveAlert, e: MouseEvent) {
  ui.openUserMenu(alert.event, e)
}

function iconOf(kind: FanLiveAlert['kind']) {
  if (kind === 'birthday') return Cake
  if (kind === 'anniversary') return Sparkles
  if (kind === 'dormant') return History
  return Tag
}
</script>

<template>
  <div
    v-if="alerts.length > 0 || unsyncedCount > 0"
    class="flex flex-wrap items-center gap-1.5 px-2.5 py-1 border-b border-border bg-muted/40 text-xs shrink-0"
  >
    <div
      v-if="unsyncedCount > 0"
      class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1"
    >
      <CloudUpload class="size-3.5 text-brand shrink-0" />
      <span class="text-muted-foreground">发现 {{ unsyncedCount }} 条本机旧备注尚未同步云端</span>
      <Button
        variant="secondary"
        size="xs"
        :disabled="dashboard.fans.syncingNotes"
        @click="dashboard.fans.syncLocalNotesToCloud()"
      >
        {{ dashboard.fans.syncingNotes ? '同步中...' : '一键同步' }}
      </Button>
    </div>

    <div
      v-for="alert in alerts"
      :key="alert.id"
      class="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 max-w-[340px]"
    >
      <component
        :is="iconOf(alert.kind)"
        class="size-3.5 shrink-0"
        :class="alert.kind === 'birthday' ? 'text-amber-500' : 'text-brand'"
      />
      <Button
        variant="link"
        size="xs"
        class="h-auto p-0 font-medium text-foreground truncate"
        data-user-trigger
        @click.stop="openFromAlert(alert, $event)"
      >
        {{ alert.title }}
      </Button>
      <span class="text-[11px] text-muted-foreground truncate">
        {{ privacyMode ? '已开启防露屏遮罩' : alert.detail }}
      </span>
      <Button
        variant="ghost"
        size="none"
        class="size-4 p-0 text-muted-foreground hover:text-foreground shrink-0"
        aria-label="关闭提醒"
        @click="dashboard.fans.dismissAlert(alert.id)"
      >
        <X class="size-3" />
      </Button>
    </div>
  </div>
</template>
