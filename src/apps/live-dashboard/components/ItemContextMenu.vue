<script setup lang="ts">
import {
  AtSign,
  Ban,
  BookmarkPlus,
  Check,
  Copy,
  Filter,
  Image as ImageIcon,
  Languages,
  Quote,
  User,
  Volume2,
} from 'lucide-vue-next'
import type { Component } from 'vue'
import { computed, onMounted, onUnmounted } from 'vue'

import { EventDataTypes } from '@/api/generated/model'
import { isTauri } from '@/shared/config'
import { Button } from '@/shared/ui/button'
import { copyToClipboard } from '@/shared/utils'

import { useEventActions } from '../store/eventActions'
import { useDashboardUi } from '../store/ui'
import { useLiveDashboard } from '../store/useLiveDashboard'

const dashboard = useLiveDashboard()
const ui = useDashboardUi()
const actions = useEventActions()
const inTauri = isTauri()

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
      icon: Check,
      run: () => dashboard.toggleRead(event),
    },
    {
      key: 'reply',
      label: '@TA 回复',
      icon: AtSign,
      run: () => ui.insertReplyTarget(event.uname),
      show: inTauri && !!event.uname,
    },
    { key: 'user', label: '粉丝档案', icon: User, run: () => (ui.userMenu = { event, x, y }) },
    {
      key: 'remember',
      label: '记住这一条',
      icon: BookmarkPlus,
      run: () => dashboard.fans.rememberEvent(event),
      show: !!(event.ouid || event.uid > 0),
    },
    { key: 'filter', label: '筛选该用户', icon: Filter, run: () => dashboard.filterByUser(event, event.key) },
    {
      key: 'translate',
      label: '翻译为中文',
      icon: Languages,
      run: async () => actions.translate(event),
      show: hasText && !event.emoji,
    },
    { key: 'speak', label: '朗读', icon: Volume2, run: async () => actions.speak(event) },
    { key: 'copy', label: '复制内容', icon: Quote, run: () => copyToClipboard(event.msg), show: hasText },
    { key: 'copy-name', label: '复制用户名', icon: Copy, run: () => copyToClipboard(event.uname) },
    { key: 'image', label: '保存为图片', icon: ImageIcon, run: () => (ui.imageTarget = event) },
    {
      key: 'block',
      label: actions.isBlocked(event) ? '移出黑名单' : '拉黑',
      icon: Ban,
      run: () => actions.toggleBlock(event),
      show: !!event.ouid,
    },
  ].filter((item) => item.show !== false)
})

const menuStyle = computed(() => {
  if (!menu.value) return {}
  const estHeight = items.value.length * 32 + 16
  const maxX = typeof window !== 'undefined' ? Math.max(8, window.innerWidth - 176) : menu.value.x
  const maxY = typeof window !== 'undefined' ? Math.max(8, window.innerHeight - estHeight) : menu.value.y
  return {
    left: `${Math.max(8, Math.min(menu.value.x, maxX))}px`,
    top: `${Math.max(8, Math.min(menu.value.y, maxY))}px`,
  }
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
    :style="menuStyle"
  >
    <Button
      v-for="item in items"
      :key="item.key"
      variant="ghost"
      size="xs"
      class="w-full justify-start gap-2 h-auto py-1.5 px-2 font-normal"
      :class="item.key === 'block' && !actions.isBlocked(menu.event) ? 'text-destructive hover:text-destructive' : ''"
      @click="onSelect(item)"
    >
      <component
        :is="item.icon"
        class="size-3.5 shrink-0"
      />
      <span>{{ item.label }}</span>
    </Button>
  </div>
</template>
