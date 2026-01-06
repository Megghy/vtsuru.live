<script setup lang="ts">
import { Moon, Sunny } from '@vicons/ionicons5'
import { NButton, NIcon, NLayoutHeader, NPageHeader, NSpace, NSwitch, NText } from 'naive-ui'
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
  <NLayoutHeader bordered style="height: var(--vtsuru-header-height); padding: 10px 15px 5px 15px">
    <NPageHeader>
      <template #title>
        <NText strong style="font-size: 1.4rem; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1)">
          VTSURU CENTER
        </NText>
      </template>
      <template #extra>
        <NSpace align="center" justify="center">
          <NotificationsPopover />
          <NSwitch :value="!isDarkMode" @update:value="onToggleTheme">
            <template #checked>
              <NIcon :component="Sunny" />
            </template>
            <template #unchecked>
              <NIcon :component="Moon" />
            </template>
          </NSwitch>
          <NButton
            size="small" type="primary"
            @click="$router.push({ name: 'user-index', params: { id: accountName } })"
          >
            回到展示页
          </NButton>
        </NSpace>
      </template>
    </NPageHeader>
  </NLayoutHeader>
</template>

