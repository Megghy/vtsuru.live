<script setup lang="ts">
import { ArrowLeft24Regular, Bot24Regular } from '@vicons/fluent'
import { ChevronBackOutline, ChevronForwardOutline, Moon, Sunny } from '@vicons/ionicons5'
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ThemeType } from '@/api/client-types'
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
  <header
    class="h-[var(--vtsuru-header-height)] px-3 max-[600px]:px-2 flex items-center justify-between gap-3 max-[600px]:gap-2 bg-card border-b border-border box-border"
  >
    <div class="min-w-0 flex items-center gap-2.5 max-[600px]:gap-1.5">
      <button
        class="size-7 p-0 rounded-lg border border-[rgba(127,127,127,0.18)] bg-[rgba(127,127,127,0.06)] text-foreground inline-flex-center cursor-pointer transition-colors hover:bg-[rgba(127,127,127,0.08)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(127,127,127,0.28)] focus-visible:outline-offset-2"
        type="button"
        :title="siderCollapsed ? '展开侧栏' : '收起侧栏'"
        @click="siderCollapsed = !siderCollapsed"
      >
        <component
          :is="siderCollapsed ? ChevronForwardOutline : ChevronBackOutline"
          class="size-[18px] block"
        />
      </button>
      <img
        class="size-[22px] rounded-md shrink-0"
        :src="logoUrl"
        alt="VTSURU"
        decoding="async"
      />
      <div class="text-[15px] font-bold tracking-tight text-foreground whitespace-nowrap max-[600px]:hidden">
        VTSURU CENTER
      </div>
      <div
        class="py-0.5 px-1.5 rounded-md bg-[var(--brand-soft)] text-[var(--brand)] text-[11px] font-bold whitespace-nowrap"
      >
        {{ WORKSPACE_LABELS[workspace] }}
      </div>
      <div
        v-if="accountName"
        class="text-xs leading-tight text-muted-foreground whitespace-nowrap truncate max-[600px]:hidden"
      >
        / {{ accountName }}
      </div>
      <div
        v-if="pageTitle"
        class="min-w-0 text-xs leading-tight font-semibold text-foreground whitespace-nowrap truncate max-[600px]:hidden"
      >
        <span class="mr-1.5 text-muted-foreground font-normal">·</span>
        {{ pageTitle }}
      </div>
    </div>

    <div class="flex items-center gap-2.5 max-[600px]:gap-1.5 shrink-0">
      <button
        class="h-[26px] px-2.5 rounded-lg border border-[var(--brand)] bg-[var(--brand)] text-[var(--brand-foreground)] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-[filter,transform] duration-150 hover:brightness-110 active:translate-y-px"
        type="button"
        title="VTsuru 助手"
        @click="openAssistant"
      >
        <component
          :is="Bot24Regular"
          class="size-[15px]"
        />
        <span class="max-[600px]:hidden">助手</span>
      </button>

      <NotificationsPopover v-if="workspace === 'streamer'" />

      <button
        class="size-7 p-0 rounded-lg border border-border bg-transparent text-foreground inline-flex-center cursor-pointer transition-colors hover:bg-[rgba(127,127,127,0.08)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(127,127,127,0.28)] focus-visible:outline-offset-2"
        type="button"
        :title="themeToggleTitle"
        @click="toggleTheme"
      >
        <component
          :is="themeToggleIcon"
          class="size-[18px] block"
        />
      </button>

      <button
        v-if="workspace === 'streamer' && accountName"
        class="h-7 px-2.5 max-[600px]:p-0 max-[600px]:size-7 rounded-lg border border-input bg-muted text-foreground text-xs font-semibold cursor-pointer transition-colors hover:bg-[rgba(127,127,127,0.08)] active:scale-[0.98] inline-flex-center"
        type="button"
        title="回到展示页"
        @click="goToUserPage(accountName)"
      >
        <ArrowLeft24Regular class="size-4 hidden max-[600px]:block" />
        <span class="max-[600px]:hidden">回到展示页</span>
      </button>
    </div>
  </header>
</template>
