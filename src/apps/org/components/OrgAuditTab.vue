<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'

import { unwrapOk } from '@/api/query'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { toast } from '@/shared/utils'

import { getOrgAuditsPaged } from '../api'
import { useOrgContext } from '../composables/useOrgContext'
import type { OrgAuditItem } from '../types'
import OrgAuditList from './OrgAuditList.vue'

const PAGE_SIZE = 50
const ACTION_PRESETS = [
  { label: '全部操作', value: 'all' },
  { label: '组织管理 (org.)', value: 'org.' },
  { label: '成员与邀请 (org.member)', value: 'org.member' },
  { label: '主播授权 (org.streamer)', value: 'org.streamer' },
  { label: '积分与订单 (points.)', value: 'points.' },
]

const ctx = useOrgContext()
const { orgId } = ctx

const logs = ref<OrgAuditItem[]>([])
const total = ref<number | null>(null)
const preset = ref('all')
const customPrefix = ref('')
const isLoading = ref(false)
const loadError = ref<string | null>(null)
const lastPageCount = ref(0)

const effectivePrefix = computed(() => {
  const custom = customPrefix.value.trim()
  if (custom) return custom
  return preset.value === 'all' ? undefined : preset.value
})

const hasMore = computed(() => {
  if (total.value !== null) return logs.value.length < total.value
  return lastPageCount.value >= PAGE_SIZE
})

async function loadLogs(reset = true) {
  if (!orgId.value) return
  if (reset) {
    logs.value = []
    total.value = null
    lastPageCount.value = 0
  }
  isLoading.value = true
  loadError.value = null
  try {
    const raw = unwrapOk(
      await getOrgAuditsPaged(orgId.value, {
        take: PAGE_SIZE,
        skip: reset ? 0 : logs.value.length,
        actionPrefix: effectivePrefix.value,
      }),
      '获取审计日志失败',
    )
    if (Array.isArray(raw)) {
      logs.value = reset ? raw : [...logs.value, ...raw]
      lastPageCount.value = raw.length
    } else {
      const items = raw.items || []
      logs.value = reset ? items : [...logs.value, ...items]
      total.value = raw.total
      lastPageCount.value = items.length
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '获取审计日志失败'
    loadError.value = msg
    toast.error(msg)
  } finally {
    isLoading.value = false
  }
}

watch(preset, () => {
  customPrefix.value = ''
  void loadLogs(true)
})

watch(
  () => ctx.refreshTick.value,
  () => {
    void loadLogs(true)
  },
)

onMounted(() => loadLogs(true))
</script>

<template>
  <Card>
    <CardHeader class="p-3.5 border-b border-border/60 flex flex-row items-center justify-between gap-2">
      <CardTitle class="text-xs font-semibold">操作审计</CardTitle>
      <span
        v-if="total !== null"
        class="text-[11px] text-muted-foreground font-mono tabular-nums"
      >
        已加载 {{ logs.length }} / {{ total }} 条
      </span>
    </CardHeader>

    <CardContent class="p-3.5 space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <Select
          :model-value="preset"
          @update:model-value="preset = String($event)"
        >
          <SelectTrigger class="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="item in ACTION_PRESETS"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </SelectItem>
          </SelectContent>
        </Select>

        <div class="relative min-w-[200px] flex-1">
          <Input
            v-model="customPrefix"
            placeholder="或输入自定义 action 前缀（如 points.orders.）"
            class="pl-8"
            @keydown.enter="loadLogs(true)"
          />
          <Search class="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        <Button
          :disabled="isLoading"
          @click="loadLogs(true)"
        >
          查询
        </Button>
      </div>

      <Alert
        v-if="loadError"
        variant="destructive"
      >
        <AlertDescription class="flex-between gap-2">
          <span>{{ loadError }}</span>
          <Button
            variant="outline"
            size="xs"
            @click="loadLogs(true)"
          >
            重试
          </Button>
        </AlertDescription>
      </Alert>

      <div
        v-else-if="isLoading && logs.length === 0"
        class="py-8 flex-center"
      >
        <Spin />
      </div>

      <template v-else>
        <OrgAuditList :logs="logs" />

        <div
          v-if="hasMore"
          class="pt-2 flex-center"
        >
          <Button
            variant="outline"
            :disabled="isLoading"
            @click="loadLogs(false)"
          >
            {{ isLoading ? '加载中...' : '加载更多' }}
          </Button>
        </div>
      </template>
    </CardContent>
  </Card>
</template>
