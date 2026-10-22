<script setup lang="ts">
import {
  Checkmark16Regular,
  Copy16Regular,
  Filter16Regular,
  Image16Regular,
  Person16Regular,
  PersonProhibited16Regular,
  Speaker216Regular,
  TextQuote16Regular,
  Translate16Regular,
} from '@vicons/fluent'
import type { Component } from 'vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { EventDataTypes } from '@/api/api-models'
import { copyToClipboard } from '@/shared/utils'

import { useEventActions } from '../store/eventActions'
import { useDashboardUi } from '../store/ui'
import { useLiveDashboard } from '../store/useLiveDashboard'

const dashboard = useLiveDashboard()
const ui = useDashboardUi()
const actions = useEventActions()

const menu = computed(() => ui.contextMenu)

interface MenuItem {
  key: string
  label: string
  icon: Component
  run: () => unknown
  show?: boolean
}

const items = computed<MenuItem[]>(() => {
  const target = menu.value
  if (!target) return []
  const { event, x, y } = target
  const hasText = !!event.msg && event.type !== EventDataTypes.Gift && event.type !== EventDataTypes.Guard
  return [
    {
      key: 'read',
      label: dashboard.isRead(event) ? '标为未读' : '标为已读',
      icon: Checkmark16Regular,
      run: () => dashboard.toggleRead(event),
    },
    { key: 'user', label: '用户信息', icon: Person16Regular, run: () => (ui.userMenu = { event, x, y }) },
    { key: 'filter', label: '筛选该用户', icon: Filter16Regular, run: () => dashboard.filterByUser(event, event.key) },
    {
      key: 'translate',
      label: '翻译为中文',
      icon: Translate16Regular,
      run: async () => actions.translate(event),
      show: hasText && !event.emoji,
    },
    { key: 'speak', label: '朗读', icon: Speaker216Regular, run: async () => actions.speak(event) },
    { key: 'copy', label: '复制内容', icon: TextQuote16Regular, run: () => copyToClipboard(event.msg), show: hasText },
    { key: 'copy-name', label: '复制用户名', icon: Copy16Regular, run: () => copyToClipboard(event.uname) },
    { key: 'image', label: '保存为图片', icon: Image16Regular, run: () => (ui.imageTarget = event) },
    {
      key: 'block',
      label: actions.isBlocked(event) ? '移出黑名单' : '拉黑',
      icon: PersonProhibited16Regular,
      run: () => actions.toggleBlock(event),
      show: !!event.ouid,
    },
  ].filter((item) => item.show !== false)
})

function close() {
  ui.contextMenu = null
}

function onSelect(item: MenuItem) {
  close()
  void item.run()
}

function onGlobalClick(e: MouseEvent) {
  if (menu.value && !(e.target as HTMLElement)?.closest('.item-context-menu')) {
    close()
  }
}

onMounted(() => {
  window.addEventListener('click', onGlobalClick)
  window.addEventListener('contextmenu', onGlobalClick)
})

onUnmounted(() => {
  window.removeEventListener('click', onGlobalClick)
  window.removeEventListener('contextmenu', onGlobalClick)
})
</script>

<template>
  <div
    v-if="menu"
    class="item-context-menu fixed z-50 min-w-[160px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
    :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
  >
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none hover:bg-accent hover:text-accent-foreground"
      :class="item.key === 'block' && !actions.isBlocked(menu.event) ? 'text-destructive hover:text-destructive' : ''"
      @click="onSelect(item)"
    >
      <component
        :is="item.icon"
        class="h-4 w-4 shrink-0"
      />
      <span>{{ item.label }}</span>
    </button>
  </div>
</template>
