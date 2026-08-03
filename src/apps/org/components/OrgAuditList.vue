<script setup lang="ts">
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
  <UEmpty
    v-if="logs.length === 0"
    icon="i-lucide-scroll-text"
    title="暂无操作记录"
  />
  <div
    v-else
    class="audit-list"
  >
    <article
      v-for="log in logs"
      :key="log.id"
    >
      <div class="audit-row">
        <div style="min-width: 0">
          <div style="font-weight: 600">
            {{ log.action }}
          </div>
          <div style="font-size: 12px; opacity: 0.7; word-break: break-all">
            {{ log.detail }}
          </div>
        </div>
        <div style="font-size: 12px; opacity: 0.7; white-space: nowrap">
          {{ log.userName || `用户${log.userId}` }}
          ·
          {{ new Date(log.createdAt).toLocaleString('zh-CN') }}
        </div>
      </div>
    </article>
  </div>
</template>

<style scoped>
.audit-list {
  display: grid;
}
.audit-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--vtsuru-border-muted);
}
</style>
