<script setup lang="ts">
import { NModal } from 'naive-ui'

import { useDashboardUi } from '../store/ui'

const ui = useDashboardUi()
const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

const GROUPS = [
  { title: '面板', items: [['Alt + 1', '显示 / 隐藏弹幕面板'], ['Alt + 2', '显示 / 隐藏醒目留言面板'], ['Alt + 3', '显示 / 隐藏礼物面板'], ['Alt + 4', '显示 / 隐藏投票面板']] },
  { title: '视图', items: [['Alt + C', '切换卡片模式'], ['Alt + R', '隐藏 / 显示已读项'], ['Alt + D', '切换深色 / 浅色']] },
  { title: '通用', items: [[`${mod} + F`, '聚焦搜索框'], ['?', '显示 / 关闭快捷键列表'], ['双击事件', '标记已读 / 未读'], ['点击用户名', '用户菜单：历史、备注、筛选'], ['右键事件', '快捷操作：已读、翻译、朗读、拉黑']] },
]
</script>

<template>
  <NModal
    v-model:show="ui.shortcutsOpen"
    preset="card"
    title="快捷键"
    style="width: min(420px, 94vw)"
  >
    <div class="shortcuts">
      <template
        v-for="group in GROUPS"
        :key="group.title"
      >
        <div class="shortcuts__title">
          {{ group.title }}
        </div>
        <div
          v-for="[key, desc] in group.items"
          :key="key"
          class="shortcuts__row"
        >
          <kbd>{{ key }}</kbd>
          <span>{{ desc }}</span>
        </div>
      </template>
      <div class="shortcuts__hint">
        输入框聚焦时快捷键不生效
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.shortcuts {
  display: grid;
  gap: 6px;
  font-size: 13px;
}

.shortcuts__title {
  margin-top: 6px;
  font-weight: 600;
}

.shortcuts__row {
  display: flex;
  justify-content: space-between;
}

kbd {
  padding: 0 6px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 4px;
  background: var(--vtsuru-bg-muted);
  font-family: inherit;
  font-size: 12px;
}

.shortcuts__hint {
  margin-top: 6px;
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}
</style>
