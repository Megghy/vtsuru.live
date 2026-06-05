<script setup lang="ts">
import { NButton, NCard, NInput, NSpin } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { QueryGetAPI, unwrapOk } from '@/api/query'
import { ORG_API_URL } from '@/shared/config'
import { useOrgContext } from '../composables/useOrgContext'
import OrgAuditList from './OrgAuditList.vue'

interface OrgAuditItem {
  id: number
  action: string
  detail: string
  createdAt: number
  userId: number
  userName?: string
}

const { orgId } = useOrgContext()

const logs = ref<OrgAuditItem[]>([])
const actionPrefix = ref('')
const isLoading = ref(false)

async function loadLogs() {
  if (!orgId.value) return
  isLoading.value = true
  try {
    logs.value = unwrapOk(
      await QueryGetAPI<OrgAuditItem[]>(`${ORG_API_URL}${orgId.value}/points/audit`, {
        take: 50,
        actionPrefix: actionPrefix.value || undefined,
      }),
      '获取审计日志失败',
    )
  } finally {
    isLoading.value = false
  }
}

onMounted(loadLogs)
</script>

<template>
  <NCard title="操作审计" size="small">
    <div style="margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 8px;">
      <NInput
        v-model:value="actionPrefix"
        placeholder="按 action 前缀过滤（可选）"
        style="min-width: 220px; flex: 1;"
        @keydown.enter="loadLogs"
      />
      <NButton type="primary" :loading="isLoading" @click="loadLogs">
        查询
      </NButton>
    </div>
    <NSpin :show="isLoading">
      <OrgAuditList :logs="logs" />
    </NSpin>
  </NCard>
</template>
