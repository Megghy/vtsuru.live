<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useStorage } from '@vueuse/core'
import { ChevronBackOutline, ChevronForwardOutline, Moon, Sunny } from '@vicons/ionicons5'
import { ThemeType } from '@/api/api-models'
import NotificationsPopover from '@/apps/manage/components/NotificationsPopover.vue'
import { isDarkMode } from '@/shared/utils'
import logoUrl from '@/svgs/ic_vtuber.svg?url'

defineProps<{
  accountName?: string
}>()

const router = useRouter()
const themeType = useStorage('Settings.Theme', ThemeType.Auto)
const defaultCollapsed = window.innerWidth < 750
const siderCollapsed = useStorage<boolean>('Settings.ManageSiderCollapsed', defaultCollapsed)

const themeToggleIcon = computed(() => (isDarkMode.value ? Sunny : Moon))
const themeToggleTitle = computed(() => (isDarkMode.value ? '切换到亮色主题' : '切换到暗色主题'))

function toggleTheme() {
  themeType.value = isDarkMode.value ? ThemeType.Light : ThemeType.Dark
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
        <component :is="siderCollapsed ? ChevronForwardOutline : ChevronBackOutline" class="manage-header__icon" />
      </button>
      <img class="manage-header__logo" :src="logoUrl" alt="VTSURU" decoding="async">
      <div class="manage-header__brand">
        VTSURU CENTER
      </div>
      <div v-if="accountName" class="manage-header__account">
        / {{ accountName }}
      </div>
    </div>

    <div class="manage-header__right">
      <NotificationsPopover />

      <button
        class="manage-header__icon-button"
        type="button"
        :title="themeToggleTitle"
        @click="toggleTheme"
      >
        <component :is="themeToggleIcon" class="manage-header__icon" />
      </button>

      <button
        class="manage-header__button"
        type="button"
        :disabled="!accountName"
        @click="goToUserPage(accountName)"
      >
        回到展示页
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
  background-color: var(--n-body-color);
  border-bottom: 1px solid var(--n-border-color);
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
  color: var(--n-text-color);
  white-space: nowrap;
}

.manage-header__account {
  font-size: 12px;
  line-height: 1.2;
  color: var(--n-text-color-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.manage-header__right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}

.manage-header__icon-button {
  height: 32px;
  width: 32px;
  padding: 0;
  border-radius: 10px;
  border: 1px solid var(--n-border-color);
  background: transparent;
  color: var(--n-text-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease, transform 120ms ease;
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
}

.manage-header__button {
  height: 32px;
  padding: 0 10px;
  border-radius: 10px;
  border: 1px solid var(--n-border-color);
  background: transparent;
  color: var(--n-text-color);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease, transform 120ms ease;
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
</style>
