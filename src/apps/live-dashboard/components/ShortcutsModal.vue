<script setup lang="ts">
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'

import { PANEL_IDS, PANEL_TITLES } from '../core/types'
import { useDashboardUi } from '../store/ui'

const ui = useDashboardUi()
const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

const GROUPS = [
  {
    title: '面板',
    items: PANEL_IDS.slice(0, 9).map((id, idx) => [`Alt + ${idx + 1}`, `显示 / 隐藏${PANEL_TITLES[id]}面板`]),
  },
  {
    title: '视图',
    items: [
      ['Alt + C', '切换卡片模式'],
      ['Alt + R', '隐藏 / 显示已读项'],
      ['Alt + D', '切换深色 / 浅色'],
      ['Alt + M', '记录直播高光打点'],
    ],
  },
  {
    title: '通用',
    items: [
      [`${mod} + F`, '聚焦搜索框'],
      ['?', '显示 / 关闭快捷键列表'],
      ['双击事件', '标记已读 / 未读'],
      ['点击用户名', '用户菜单：历史、备注、筛选'],
      ['右键事件', '快捷操作：已读、翻译、朗读、拉黑'],
    ],
  },
]
</script>

<template>
  <Dialog v-model:open="ui.shortcutsOpen">
    <DialogContent class="sm:max-w-[420px]">
      <DialogHeader>
        <DialogTitle>快捷键</DialogTitle>
      </DialogHeader>
      <div class="grid gap-1.5 text-[13px]">
        <template
          v-for="group in GROUPS"
          :key="group.title"
        >
          <div class="mt-1.5 font-semibold">
            {{ group.title }}
          </div>
          <div
            v-for="[key, desc] in group.items"
            :key="key"
            class="flex-between"
          >
            <kbd class="px-1.5 border border-border rounded bg-muted font-inherit text-xs">{{ key }}</kbd>
            <span>{{ desc }}</span>
          </div>
        </template>
        <div class="mt-1.5 text-xs text-muted-foreground">输入框聚焦时快捷键不生效</div>
      </div>
    </DialogContent>
  </Dialog>
</template>
