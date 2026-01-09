<script setup lang="ts">
import { Moon, Sunny } from '@vicons/ionicons5'
import { NButton, NFlex, NIcon, NLayoutHeader, NSwitch, NText } from 'naive-ui'
import { useStorage } from '@vueuse/core'
import NotificationsPopover from '@/apps/manage/components/NotificationsPopover.vue'
import { ThemeType } from '@/api/api-models'
import { isDarkMode } from '@/shared/utils'

defineProps<{
  accountName?: string
}>()

const themeType = useStorage('Settings.Theme', ThemeType.Auto)

function onToggleTheme(isLight: boolean) {
  themeType.value = isLight ? ThemeType.Light : ThemeType.Dark
}
</script>

<template>
  <NLayoutHeader bordered class="manage-topbar">
    <div class="manage-topbar__inner">
      <NFlex
        align="center"
        justify="space-between"
        :wrap="true"
        :size="12"
      >
        <NFlex align="baseline" :wrap="false" :size="10">
          <NText strong class="manage-topbar__brand">
            VTSURU CENTER
          </NText>
          <NText v-if="accountName" depth="3" class="manage-topbar__account">
            / {{ accountName }}
          </NText>
        </NFlex>

        <NFlex align="center" justify="end" :wrap="false" :size="10">
          <NotificationsPopover />
          <NSwitch
            size="small"
            :value="!isDarkMode"
            @update:value="onToggleTheme"
          >
            <template #checked>
              <NIcon :component="Sunny" />
            </template>
            <template #unchecked>
              <NIcon :component="Moon" />
            </template>
          </NSwitch>
          <NButton
            size="small"
            secondary
            @click="$router.push({ name: 'user-index', params: { id: accountName } })"
          >
            回到展示页
          </NButton>
        </NFlex>
      </NFlex>
    </div>
  </NLayoutHeader>
</template>

<style scoped>
.manage-topbar {
  height: var(--vtsuru-header-height);
  padding: 0 16px;
  display: flex;
  align-items: center;
}

.manage-topbar__inner {
  width: 100%;
}

.manage-topbar__brand {
  font-size: 16px;
  letter-spacing: -0.02em;
}

.manage-topbar__account {
  font-size: 12px;
  line-height: 1.2;
}
</style>
