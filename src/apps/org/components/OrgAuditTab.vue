<script setup lang="ts">
import { onMounted, ref } from 'vue'

import { getApiOrgOrgIdAudit } from '@/api/generated/org/org'
import { unwrapOk } from '@/api/query'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Spin } from '@/shared/ui/spin'

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
      (await getApiOrgOrgIdAudit(orgId.value, {
        take: 50,
        actionPrefix: actionPrefix.value || undefined,
      })) as any,
      '获取审计日志失败',
    )
  } finally {
    isLoading.value = false
  }
}

onMounted(loadLogs)
</script>

<template>
  <Card class="border border-border/80">
    <CardHeader class="pb-3 border-b border-border/60">
      <CardTitle class="text-sm font-semibold">操作审计</CardTitle>
    </CardHeader>

    <CardContent class="pt-4 space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <Input
          v-model="actionPrefix"
          placeholder="按 action 前缀过滤（可选）"
          class="min-w-[220px] flex-1"
          @keydown.enter="loadLogs"
        />
        <Button
          :disabled="isLoading"
          @click="loadLogs"
        >
          查询
        </Button>
      </div>

      <div
        v-if="isLoading"
        class="py-8 flex justify-center"
      >
        <Spin />
      </div>
      <OrgAuditList
        v-else
        :logs="logs"
      />
    </CardContent>
  </Card>
</template>
