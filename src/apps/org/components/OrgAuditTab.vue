<script setup lang="ts">
import { NButton, NCard, NInput, NList, NListItem, NSpin, NTime, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { QueryGetAPI } from '@/api/query'
import { ORG_API_URL } from '@/shared/config'

const props = defineProps<{
  orgId: number
}>()

const message = useMessage()
interface OrgAuditItem {
  id: number
  action: string
  detail: string
  createdAt: number
  userId: number
  userName?: string
}

const logs = ref<OrgAuditItem[]>([])
const take = ref(50)
const actionPrefix = ref('')
const isLoading = ref(false)

const filterSummary = computed(() => {
  if (!actionPrefix.value) return '最近操作'
  return `过滤 action 以 "${actionPrefix.value}" 开头`
})

async function loadLogs() {
  if (!props.orgId) return
  isLoading.value = true
  try {
    const resp = await QueryGetAPI<OrgAuditItem[]>(
      `${ORG_API_URL}${props.orgId}/points/audit`,
      {
        take: take.value,
        actionPrefix: actionPrefix.value || undefined,
      },
    )
    logs.value = resp.code === 200 ? resp.data : []
    if (resp.code !== 200) {
      message.error(resp.message || '获取审计日志失败')
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '获取审计日志失败')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadLogs()
})
</script>

<template>
  <NCard title="操作审计" size="small">
    <div style="margin-bottom: 16px; display: flex; flex-wrap: wrap; gap: 8px;">
      <NInput
        v-model:value="actionPrefix"
        placeholder="按 action 前缀过滤（可选）"
        style="min-width: 220px; flex: 1;"
      />
      <NButton type="primary" :loading="isLoading" @click="loadLogs">
        查询
      </NButton>
      <span style="align-self: center; color: var(--n-text-color-3);">
        {{ filterSummary }}
      </span>
    </div>

    <NSpin :show="isLoading">
      <template v-if="logs.length === 0">
        <div style="padding: 32px 0; text-align: center; color: var(--n-text-color-3);">
          暂无操作记录
        </div>
      </template>
      <template v-else>
        <NList>
          <NListItem v-for="log in logs" :key="log.id">
            <div style="display: flex; justify-content: space-between; gap: 12px;">
              <div>
                <div style="font-weight: 600;">
                  {{ log.action }}
                </div>
                <div style="font-size: 12px; opacity: 0.7;">
                  {{ log.detail }}
                </div>
              </div>
              <div style="font-size: 12px; opacity: 0.7;">
                {{ log.userName || (`用户${ log.userId}`) }}
                ·
                <NTime :time="log.createdAt" format="yyyy-MM-dd HH:mm" />
              </div>
            </div>
          </NListItem>
        </NList>
      </template>
    </NSpin>
  </NCard>
</template>
