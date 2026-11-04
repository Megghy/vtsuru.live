<script setup lang="ts">
import { ChevronRight, Compass, Menu, Moon, Pencil, Sun } from 'lucide-vue-next'
import { ref } from 'vue'
import type { Component } from 'vue'
import { useRouter } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'

import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'

interface NavItem {
  key: string
  label: string
  icon: Component
  to?: RouteLocationRaw
  disabled?: boolean
}

interface NavGroup {
  key: string
  label: string
  items: NavItem[]
}

const props = defineProps<{
  navGroups: NavGroup[]
  isOwner: boolean
  pageSlug?: string
  isDark: boolean
  themeLocked: boolean
  themeSwitchTitle: string
}>()

defineEmits<{ toggleTheme: [] }>()

const router = useRouter()
const collapsed = ref(false)

function openEditor() {
  void router.push({ name: 'manage-userPageBuilder', query: { page: props.pageSlug ?? 'home' } })
}
</script>

<template>
  <div
    class="immersive-dock"
    aria-label="页面工具栏"
  >
    <Button
      v-if="collapsed"
      variant="ghost"
      class="dock-button"
      aria-label="展开页面工具栏"
      @click="collapsed = false"
    >
      <Compass class="size-4" />
    </Button>
    <template v-else>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            class="dock-button"
            aria-label="页面导航"
          >
            <Menu class="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          side="top"
          class="max-h-[min(70dvh,420px)] min-w-44 overflow-y-auto"
        >
          <template
            v-for="group in navGroups"
            :key="group.key"
          >
            <DropdownMenuLabel>{{ group.label }}</DropdownMenuLabel>
            <DropdownMenuItem
              v-for="item in group.items"
              :key="item.key"
              :disabled="item.disabled || !item.to"
              @select="item.to && router.push(item.to)"
            >
              <component :is="item.icon" />
              {{ item.label }}
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="ghost"
        class="dock-button"
        :disabled="themeLocked"
        :aria-label="themeSwitchTitle"
        @click="$emit('toggleTheme')"
      >
        <Sun
          v-if="isDark"
          class="size-4"
        />
        <Moon
          v-else
          class="size-4"
        />
      </Button>
      <Button
        v-if="isOwner"
        variant="ghost"
        class="dock-button"
        aria-label="编辑当前页面"
        @click="openEditor"
      >
        <Pencil class="size-4" />
      </Button>
      <span
        class="dock-divider"
        aria-hidden="true"
      />
      <Button
        variant="ghost"
        class="dock-button"
        aria-label="折叠页面工具栏"
        @click="collapsed = true"
      >
        <ChevronRight class="size-4" />
      </Button>
    </template>
  </div>
</template>

<style scoped>
.immersive-dock {
  position: fixed;
  right: max(12px, env(safe-area-inset-right));
  bottom: max(12px, env(safe-area-inset-bottom));
  z-index: 110;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: color-mix(in srgb, var(--popover) 78%, transparent);
  color: var(--popover-foreground);
  box-shadow: var(--vtsuru-page-shadow, 0 4px 16px rgb(0 0 0 / 12%));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.dock-button {
  width: var(--control-h-sm, 32px);
  padding: 0;
  border-radius: 999px;
}

.dock-divider {
  width: 1px;
  height: 16px;
  margin: 0 2px;
  background: var(--border);
}
</style>
