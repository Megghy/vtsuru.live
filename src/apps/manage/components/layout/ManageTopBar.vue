<script setup lang="ts">
import ArrowLeft24Regular from '@vicons/fluent/es/ArrowLeft24Regular'
import Bot24Regular from '@vicons/fluent/es/Bot24Regular'
import ChevronBackOutline from '@vicons/ionicons5/es/ChevronBackOutline'
import ChevronForwardOutline from '@vicons/ionicons5/es/ChevronForwardOutline'
import MenuOutline from '@vicons/ionicons5/es/MenuOutline'
import { BookOpen, Search } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAssistantStore } from '@/apps/assistant/store/useAssistantStore'
import NotificationsPopover from '@/apps/manage/components/NotificationsPopover.vue'
import { useManageShell } from '@/apps/manage/composables/useManageShell'
import { WORKSPACE_LABELS, useManageWorkspace } from '@/apps/manage/composables/useManageWorkspace'
import ThemeToggleButton from '@/shared/components/ThemeToggleButton.vue'
import { useCommandPalette } from '@/shared/composables/useCommandPalette'
import { Button } from '@/shared/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import logoUrl from '@/svgs/ic_vtuber.svg?url'

defineProps<{
  accountName?: string
}>()

const router = useRouter()
const route = useRoute()
const assistant = useAssistantStore()
const { isMobileSider, siderCollapsed, mobileSiderOpen, toggleSider } = useManageShell()
const { openPalette } = useCommandPalette()
const { workspace } = useManageWorkspace()

const toggleButtonIcon = computed(() => {
  if (isMobileSider.value) return MenuOutline
  return siderCollapsed.value ? ChevronForwardOutline : ChevronBackOutline
})

const toggleButtonLabel = computed(() => {
  if (isMobileSider.value) return mobileSiderOpen.value ? '关闭导航菜单' : '打开导航菜单'
  return siderCollapsed.value ? '展开侧栏' : '收起侧栏'
})

const pageTitle = computed(() => {
  const title = route.meta?.title
  return typeof title === 'string' && title.trim() ? title : ''
})

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
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="outline"
            size="icon-xs"
            :aria-label="toggleButtonLabel"
            @click="toggleSider"
          >
            <component
              :is="toggleButtonIcon"
              class="size-4 block"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{{ toggleButtonLabel }}</TooltipContent>
      </Tooltip>
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
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="outline"
            size="xs"
            class="gap-1.5 text-muted-foreground"
            aria-label="打开命令面板 (Ctrl+K)"
            @click="openPalette"
          >
            <Search class="size-3.5" />
            <span class="max-[750px]:hidden">搜索</span>
            <kbd
              class="max-[750px]:hidden pointer-events-none inline-flex h-4 select-none items-center rounded border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground"
            >
              Ctrl+K
            </kbd>
          </Button>
        </TooltipTrigger>
        <TooltipContent>快捷跳转与命令面板 (Ctrl+K)</TooltipContent>
      </Tooltip>

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

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label="使用文档"
            @click="router.push({ name: 'docs-index' })"
          >
            <BookOpen class="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>使用文档</TooltipContent>
      </Tooltip>

      <ThemeToggleButton />

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
