<script setup lang="ts">
import { Bot24Regular } from '@vicons/fluent'
import { ChevronBackOutline, ChevronForwardOutline, Moon, Sunny } from '@vicons/ionicons5'
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ThemeType } from '@/api/api-models'
import { useAssistantStore } from '@/apps/assistant/store/useAssistantStore'
import NotificationsPopover from '@/apps/manage/components/NotificationsPopover.vue'
import { WORKSPACE_LABELS, useManageWorkspace } from '@/apps/manage/composables/useManageWorkspace'
import { usePersistedStorage } from '@/shared/storage/persist'
import { isDarkMode } from '@/shared/utils'
import logoUrl from '@/svgs/ic_vtuber.svg?url'

defineProps<{
  accountName?: string
}>()

const router = useRouter()
const route = useRoute()
const assistant = useAssistantStore()
const themeType = usePersistedStorage('Settings.Theme', ThemeType.Auto)
const defaultCollapsed = window.innerWidth < 750
const siderCollapsed = usePersistedStorage<boolean>('Settings.ManageSiderCollapsed', defaultCollapsed)
const { workspace } = useManageWorkspace()

onMounted(() => {
  if (window.innerWidth < 750) siderCollapsed.value = true
})

const themeToggleIcon = computed(() => (isDarkMode.value ? Sunny : Moon))
const themeToggleTitle = computed(() => (isDarkMode.value ? '切换到亮色主题' : '切换到暗色主题'))
const pageTitle = computed(() => {
  const title = route.meta?.title
  return typeof title === 'string' && title.trim() ? title : ''
})

function toggleTheme() {
  themeType.value = isDarkMode.value ? ThemeType.Light : ThemeType.Dark
}

function openAssistant() {
  assistant.open({
    routeName: route.name?.toString() ?? '',
    title: (route.meta?.title as string) ?? route.name?.toString() ?? '管理后台',
    path: route.path,
  })
}

async function goToUserPage(accountName?: string) {
  if (!accountName) return
  await router.push({ name: 'user-index', params: { id: accountName } })
}
</script>

<template>
  <header class="manage-header">
    <div class="manage-header__left">
      <button
        class="manage-header__icon-button manage-header__sider-toggle"
        type="button"
        :title="siderCollapsed ? '展开侧栏' : '收起侧栏'"
        @click="siderCollapsed = !siderCollapsed"
      >
        <component
          :is="siderCollapsed ? ChevronForwardOutline : ChevronBackOutline"
          class="manage-header__icon"
        />
      </button>
      <img
        class="manage-header__logo"
        :src="logoUrl"
        alt="VTSURU"
        decoding="async"
      />
      <div class="manage-header__brand">VTSURU CENTER</div>
      <div class="manage-header__workspace">{{ WORKSPACE_LABELS[workspace] }}</div>
      <div
        v-if="accountName"
        class="manage-header__account"
      >
        / {{ accountName }}
      </div>
      <div
        v-if="pageTitle"
        class="manage-header__page-title"
      >
        <span class="manage-header__page-sep">·</span>
        {{ pageTitle }}
      </div>
    </div>

    <div class="manage-header__right">
      <button
        class="manage-header__assistant"
        type="button"
        title="VTsuru 助手"
        @click="openAssistant"
      >
        <component
          :is="Bot24Regular"
          class="manage-header__icon"
        />
        <span class="manage-header__assistant-text">助手</span>
      </button>

      <NotificationsPopover v-if="workspace === 'streamer'" />

      <button
        class="manage-header__icon-button"
        type="button"
        :title="themeToggleTitle"
        @click="toggleTheme"
      >
        <component
          :is="themeToggleIcon"
          class="manage-header__icon"
        />
      </button>

      <button
        v-if="workspace === 'streamer' && accountName"
        class="manage-header__button manage-header__user-page-button"
        type="button"
        title="回到展示页"
        @click="goToUserPage(accountName)"
      >
        <span class="manage-header__button-text">回到展示页</span>
      </button>
    </div>
  </header>
</template>

<style scoped>
.manage-header {
  height: var(--vtsuru-header-height);
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background-color: var(--card);
  border-bottom: 1px solid var(--border);
  box-sizing: border-box;
}

.manage-header__left {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.manage-header__logo {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  flex: 0 0 auto;
}

.manage-header__brand {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--foreground);
  white-space: nowrap;
}

.manage-header__account {
  font-size: 12px;
  line-height: 1.2;
  color: var(--muted-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.manage-header__workspace {
  padding: 3px 7px;
  border-radius: 6px;
  background: var(--brand-soft);
  color: var(--brand);
  font-size: 11px;
  font-weight: 700;
  white-space: nowrap;
}

.manage-header__page-title {
  min-width: 0;
  font-size: 12px;
  line-height: 1.2;
  font-weight: 600;
  color: var(--foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.manage-header__page-sep {
  margin-right: 6px;
  color: var(--muted-foreground);
  font-weight: 400;
}

.manage-header__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}

.manage-header__assistant {
  height: 26px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--brand);
  background: var(--brand);
  color: var(--brand-foreground);
  font-size: 12px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  cursor: pointer;
  transition:
    filter 120ms ease,
    transform 120ms ease;
}

.manage-header__assistant:hover {
  filter: brightness(1.08);
}

.manage-header__assistant:active {
  transform: translateY(0.5px);
}

.manage-header__assistant .manage-header__icon {
  width: 15px;
  height: 15px;
}

.manage-header__icon-button {
  height: 28px;
  width: 28px;
  padding: 0;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--foreground);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    transform 120ms ease;
}

.manage-header__sider-toggle {
  background: rgba(127, 127, 127, 0.06);
  border-color: rgba(127, 127, 127, 0.18);
}

.manage-header__icon-button:hover {
  background: rgba(127, 127, 127, 0.08);
}

.manage-header__icon-button:active {
  transform: translateY(0.5px);
}

.manage-header__icon-button:focus-visible {
  outline: 2px solid rgba(127, 127, 127, 0.28);
  outline-offset: 2px;
}

.manage-header__icon {
  width: 18px;
  height: 18px;
  display: block;
}

.manage-header__button {
  height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  border: 1px solid var(--input);
  background: var(--muted);
  color: var(--foreground);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition:
    background-color 120ms ease,
    border-color 120ms ease,
    transform 120ms ease;
}

.manage-header__button:hover {
  background: rgba(127, 127, 127, 0.08);
}

.manage-header__button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.manage-header__button:active {
  transform: translateY(0.5px);
}

/* 移动端: 收紧间距, 隐藏次要文字, 给助手按钮留出空间 */
@media (max-width: 600px) {
  .manage-header {
    padding: 0 8px;
    gap: 8px;
  }

  .manage-header__left {
    gap: 6px;
  }

  .manage-header__right {
    gap: 6px;
  }

  .manage-header__brand {
    display: none;
  }

  .manage-header__account {
    display: none;
  }

  .manage-header__page-sep {
    display: none;
  }

  .manage-header__page-title,
  .manage-header__assistant-text {
    display: none;
  }

  .manage-header__button-text {
    display: none;
  }

  .manage-header__user-page-button {
    padding: 0;
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .manage-header__user-page-button::before {
    content: '↩';
    font-size: 16px;
  }
}
</style>
