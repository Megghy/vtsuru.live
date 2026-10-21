<script setup lang="ts">
import { format } from 'date-fns'

import { Empty } from '@/shared/ui/empty'

interface AuditLog {
  id: number
  action: string
  detail: string
  createdAt: number
  userId: number
  userName?: string
}

const ACTION_LABELS: Record<string, string> = {
  'org.rename': '重命名组织',
  'org.dissolve': '解散组织',
  'org.transfer-owner': '移交所有权',
  'org.member-leave': '成员退出',
  'org.member-remove': '移除成员',
  'org.member-role-update': '调整成员角色',
  'org.member-invite': '成员邀请',
  'org.member-joined': '成员加入',
  'org.member-rejected': '成员拒绝邀请',
  'org.streamer-invite': '主播邀请',
  'org.streamer-joined': '主播授权',
  'org.streamer-rejected': '主播拒绝',
  'org.streamer-remove': '移除主播',
  'org.streamer-update': '更新主播',
  'org.invite-revoke': '撤销邀请',
  'points.orders.update-status': '更新订单状态',
  'points.orders.update-express': '更新快递信息',
  'points.settings.update': '更新积分规则',
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

defineProps<{ logs: AuditLog[] }>()
</script>

<template>
  <div v-if="logs.length === 0" class="py-8">
    <Empty description="暂无操作记录" />
  </div>
  <div
    v-else
    class="divide-y divide-border/60 border border-border/80 rounded-lg bg-card text-xs"
  >
    <div
      v-for="log in logs"
      :key="log.id"
      class="p-3 flex items-start justify-between gap-3 hover:bg-muted/30 transition-colors"
    >
      <div class="min-w-0 flex-1 space-y-0.5">
        <strong class="font-medium text-foreground text-xs block">
          {{ actionLabel(log.action) }}
        </strong>
        <p class="text-[11px] text-muted-foreground break-all m-0">
          {{ log.detail }}
          <span v-if="log.action !== actionLabel(log.action)" class="opacity-60"> · {{ log.action }}</span>
        </p>
      </div>

      <div class="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
        {{ log.userName || `用户${log.userId}` }} · {{ format(log.createdAt, 'yyyy-MM-dd HH:mm') }}
      </div>
    </div>
  </div>
</template>
