<script setup lang="ts">
import { ExternalLink, LayoutGrid } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

import type { PanelId } from '@/apps/live-dashboard/core/types'
import LiveSideCard from '@/apps/open-live/components/shared/LiveSideCard.vue'
import { isTauri } from '@/shared/config'
import { Button } from '@/shared/ui/button'

const props = defineProps<{
  panelId: PanelId
  panelName: string
  shortcut: string
  description: string
}>()

const router = useRouter()

function openLiveDashboard() {
  if (isTauri()) {
    void router.push({
      name: 'client-live-dashboard',
      query: { panel: props.panelId },
    })
    return
  }
  const target = router.resolve({
    name: 'live-dashboard',
    query: { panel: props.panelId },
  })
  window.open(target.href, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <LiveSideCard
    title="直播中控台"
    :icon="LayoutGrid"
    icon-class="text-primary"
  >
    <div class="space-y-2.5 text-xs">
      <p class="text-muted-foreground leading-relaxed">
        {{ description }}
      </p>

      <div class="rounded-md border border-border/70 bg-muted/25 p-2.5 space-y-1.5 text-muted-foreground">
        <div class="font-medium text-foreground">如何开启「{{ panelName }}」面板</div>
        <div class="flex items-center justify-between gap-2">
          <span>快捷键切换</span>
          <kbd class="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[11px] text-foreground">
            {{ shortcut }}
          </kbd>
        </div>
        <div class="leading-relaxed">
          或在中控台右上角点击「面板布局」图标，开启「{{ panelName }}」开关并可拖动排序。
        </div>
      </div>

      <Button
        variant="outline"
        class="w-full justify-center gap-1.5"
        @click="openLiveDashboard"
      >
        <ExternalLink class="size-3.5" />
        前往中控台并展开{{ panelName }}
      </Button>
    </div>
  </LiveSideCard>
</template>
