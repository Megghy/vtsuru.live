<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { error as logError } from '@tauri-apps/plugin-log'
import { platform, type, version } from '@tauri-apps/plugin-os'
import { HardwareChipOutline } from '@vicons/ionicons5'
import { onMounted, ref } from 'vue'

const osInfo = ref<string>('未知')
const memoryInfo = ref<{ total?: number, free?: number, used?: number }>({})

async function fetchSystemInfo() {
  try {
    osInfo.value = `${type()} (${platform()} ${version()})`
  } catch (e) {
    logError(`Failed to get OS info: ${e}`)
    osInfo.value = navigator.userAgent
  }

  try {
    const mem: { total: number, free: number } = await invoke('get_memory_info')
    memoryInfo.value = { total: mem.total, free: mem.free, used: mem.total - mem.free }
  } catch (e) {
    logError(`Failed to get Memory info: ${e}`)
    if ('memory' in performance && (performance as any).memory.totalJSHeapSize) {
      memoryInfo.value = { total: (performance as any).memory.totalJSHeapSize }
    }
  }
}

onMounted(fetchSystemInfo)
</script>

<template>
  <NCard
    title="系统信息"
    size="small"
    bordered
    style="width: 100%;"
  >
    <template #header-extra>
      <NIcon :component="HardwareChipOutline" />
    </template>
    <NDescriptions
      label-placement="left"
      bordered
      size="small"
      :columns="1"
    >
      <NDescriptionsItem label="操作系统">
        {{ osInfo }}
      </NDescriptionsItem>
      <NDescriptionsItem label="内存 (近似)">
        <span v-if="memoryInfo?.total">
          已用: {{ ((memoryInfo.used ?? 0) / 1024 / 1024 / 1024).toFixed(2) }} GB /
          可用: {{ ((memoryInfo.free ?? 0) / 1024 / 1024 / 1024).toFixed(2) }} GB /
          总计: {{ (memoryInfo.total / 1024 / 1024 / 1024).toFixed(2) }} GB
        </span>
        <span v-else> N/A </span>
      </NDescriptionsItem>
    </NDescriptions>
  </NCard>
</template>
