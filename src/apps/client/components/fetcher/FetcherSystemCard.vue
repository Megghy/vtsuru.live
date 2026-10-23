<script setup lang="ts">
import { invoke } from '@tauri-apps/api/core'
import { error as logError } from '@tauri-apps/plugin-log'
import { platform, type, version } from '@tauri-apps/plugin-os'
import { Cpu, Server } from 'lucide-vue-next'
import { onMounted, ref } from 'vue'

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'

const osInfo = ref<string>('未知')
const memoryInfo = ref<{ total?: number; free?: number; used?: number }>({})

async function fetchSystemInfo() {
  try {
    osInfo.value = `${type()} (${platform()} ${version()})`
  } catch (e) {
    logError(`Failed to get OS info: ${e}`)
    osInfo.value = navigator.userAgent
  }

  try {
    const mem: { total: number; free: number } = await invoke('get_memory_info')
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
  <Card class="border bg-card">
    <CardHeader class="p-3 pb-2 border-b flex-row items-center justify-between space-y-0">
      <CardTitle class="text-sm font-semibold">系统与宿主信息</CardTitle>
      <Cpu class="size-4 text-muted-foreground" />
    </CardHeader>

    <CardContent class="p-3 space-y-2.5">
      <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-1">
        <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Server class="size-3.5" />
          <span>操作系统</span>
        </div>
        <span
          class="text-xs font-mono font-medium text-foreground block truncate"
          :title="osInfo"
        >
          {{ osInfo }}
        </span>
      </div>

      <div class="p-2.5 rounded-md border border-border bg-muted/20 space-y-1">
        <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Cpu class="size-3.5" />
          <span>内存使用（近似）</span>
        </div>
        <span
          v-if="memoryInfo?.total"
          class="text-xs font-mono font-medium text-foreground block"
        >
          已用: {{ ((memoryInfo.used ?? 0) / 1024 / 1024 / 1024).toFixed(2) }} GB / 可用:
          {{ ((memoryInfo.free ?? 0) / 1024 / 1024 / 1024).toFixed(2) }} GB / 总计:
          {{ (memoryInfo.total / 1024 / 1024 / 1024).toFixed(2) }} GB
        </span>
        <span
          v-else
          class="text-xs text-muted-foreground block"
        >
          暂未获取到内存遥测数据
        </span>
      </div>
    </CardContent>
  </Card>
</template>
