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
import type { DropdownOption } from 'naive-ui'
import { NDropdown, NIcon } from 'naive-ui'
import type { Component } from 'vue'
import { computed, h } from 'vue'

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
    { key: 'read', label: dashboard.isRead(event) ? '标为未读' : '标为已读', icon: Checkmark16Regular, run: () => dashboard.toggleRead(event) },
    { key: 'user', label: '用户信息', icon: Person16Regular, run: () => (ui.userMenu = { event, x, y }) },
    { key: 'filter', label: '筛选该用户', icon: Filter16Regular, run: () => dashboard.filterByUser(event, event.key) },
    { key: 'translate', label: '翻译为中文', icon: Translate16Regular, run: async () => actions.translate(event), show: hasText && !event.emoji },
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

const options = computed<DropdownOption[]>(() =>
  items.value.map((item) => ({
    key: item.key,
    label: item.label,
    icon: () => h(NIcon, { component: item.icon }),
    props: item.key === 'block' && !actions.isBlocked(menu.value!.event) ? { style: 'color: var(--vtsuru-error)' } : undefined,
  })),
)

function close() {
  ui.contextMenu = null
}

function onSelect(key: string) {
  const item = items.value.find((i) => i.key === key)!
  close()
  void item.run()
}
</script>

<template>
  <NDropdown
    :show="!!menu"
    :x="menu?.x"
    :y="menu?.y"
    trigger="manual"
    placement="bottom-start"
    size="small"
    :options="options"
    @select="onSelect"
    @clickoutside="close"
  >
    <span class="ctx-anchor" />
  </NDropdown>
</template>

<style scoped>
.ctx-anchor {
  display: none;
}
</style>
