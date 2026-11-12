<script setup lang="ts">
import ArrowLeft24Regular from '@vicons/fluent/es/ArrowLeft24Regular'
import Bot24Regular from '@vicons/fluent/es/Bot24Regular'
import ChevronBackOutline from '@vicons/ionicons5/es/ChevronBackOutline'
import ChevronForwardOutline from '@vicons/ionicons5/es/ChevronForwardOutline'
import Moon from '@vicons/ionicons5/es/Moon'
import Sunny from '@vicons/ionicons5/es/Sunny'
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ThemeType } from '@/api/client-types'
import { useAssistantStore } from '@/apps/assistant/store/useAssistantStore'
import NotificationsPopover from '@/apps/manage/components/NotificationsPopover.vue'
import { WORKSPACE_LABELS, useManageWorkspace } from '@/apps/manage/composables/useManageWorkspace'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
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
    class="h-[var(--vtsuru-header-height)] px-3 max-[600px]:px-2 flex-between gap-3 max-[600px]:gap-2 bg-card border-b border-border box-border"
  >
    <div class="min-w-0 flex items-center gap-2.5 max-[600px]:gap-1.5">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="icon-xs"
              aria-label="展开或收起侧栏"
              @click="siderCollapsed = !siderCollapsed"
            >
              <component
                :is="siderCollapsed ? ChevronForwardOutline : ChevronBackOutline"
                class="size-4 block"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ siderCollapsed ? '展开侧栏' : '收起侧栏' }}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
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
      <Button
        variant="brand"
        size="xs"
        class="gap-1.5"
        @click="openAssistant"
      >
        <component
          :is="Bot24Regular"
          class="size-3.5"
        />
        <span class="max-[600px]:hidden">助手</span>
      </Button>

      <NotificationsPopover v-if="workspace === 'streamer'" />

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="icon-xs"
              :aria-label="themeToggleTitle"
              @click="toggleTheme"
            >
              <component
                :is="themeToggleIcon"
                class="size-4 block"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ themeToggleTitle }}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Button
        v-if="workspace === 'streamer' && accountName"
        variant="outline"
        size="xs"
        @click="goToUserPage(accountName)"
      >
        <ArrowLeft24Regular class="size-3.5 hidden max-[600px]:block" />
        <span class="max-[600px]:hidden">回到展示页</span>
      </Button>
    </div>
  </header>
</template>
