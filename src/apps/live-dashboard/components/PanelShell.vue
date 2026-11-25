<script setup lang="ts">
import { X } from 'lucide-vue-next'
import { computed } from 'vue'

import { SimpleTooltip } from '@/shared/ui/tooltip'

import type { PanelId } from '../core/types'
import { useLiveDashboard } from '../store/useLiveDashboard'
import IconAction from './IconAction.vue'

const props = defineProps<{
  title: string
  panelId?: PanelId
  count?: number
  unread?: number
  blurred?: boolean
}>()
defineSlots<{ actions?: () => unknown; default: () => unknown }>()

const dashboard = useLiveDashboard()

const canHide = computed(() => {
  if (!props.panelId) return false
  const layout = dashboard.settings.layout
  const visibleCount = layout.order.filter((id) => !layout.hidden.includes(id)).length
  return visibleCount > 1 && !layout.hidden.includes(props.panelId)
})

function hideSelf() {
  if (!props.panelId || !canHide.value) return
  dashboard.settings.layout.hidden = [...dashboard.settings.layout.hidden, props.panelId]
}
</script>

<template>
  <section
    class="group/panel flex flex-col h-full min-w-0 min-h-0 bg-card"
    :class="{ 'blur-[6px] grayscale-[0.6] opacity-50 pointer-events-none': blurred }"
  >
    <header
      class="flex items-center gap-1.5 h-[30px] px-2 shrink-0 text-xs text-muted-foreground border-b border-border"
    >
      <span class="font-semibold text-foreground truncate">{{ title }}</span>
      <span
        v-if="count !== undefined"
        class="tabular-nums shrink-0"
        >{{ count }}</span
      >
      <SimpleTooltip
        v-if="unread"
        content="未读"
      >
        <span class="px-1.5 rounded-full bg-[var(--brand-soft)] text-[var(--brand)] tabular-nums shrink-0">{{
          unread
        }}</span>
      </SimpleTooltip>
      <div class="ml-auto flex items-center gap-0.5 shrink-0">
        <slot name="actions" />
        <span
          v-if="canHide"
          class="inline-flex opacity-0 group-hover/panel:opacity-100 focus-within:opacity-100 transition-opacity"
        >
          <IconAction
            :icon="X"
            tip="隐藏此栏位"
            @click="hideSelf"
          />
        </span>
      </div>
    </header>
    <div class="flex-1 min-h-0">
      <slot />
    </div>
  </section>
</template>
