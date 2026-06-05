<script setup lang="ts">
import { NEmpty, NList, NListItem, NFlex, NTime } from 'naive-ui'

interface AuditLog {
  id: number
  action: string
  detail: string
  createdAt: number
  userId: number
  userName?: string
}

defineProps<{ logs: AuditLog[] }>()
</script>

<template>
  <NEmpty v-if="logs.length === 0" description="暂无操作记录" />
  <NList v-else>
    <NListItem v-for="log in logs" :key="log.id">
      <NFlex justify="space-between" :wrap="false" style="gap: 12px;">
        <div style="min-width: 0;">
          <div style="font-weight: 600;">
            {{ log.action }}
          </div>
          <div style="font-size: 12px; opacity: 0.7; word-break: break-all;">
            {{ log.detail }}
          </div>
        </div>
        <div style="font-size: 12px; opacity: 0.7; white-space: nowrap;">
          {{ log.userName || `用户${log.userId}` }}
          ·
          <NTime :time="log.createdAt" format="yyyy-MM-dd HH:mm" />
        </div>
      </NFlex>
    </NListItem>
  </NList>
</template>
