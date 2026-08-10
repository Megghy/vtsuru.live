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
  <NEmpty
    v-if="logs.length === 0"
    description="暂无操作记录"
  />
  <NList v-else>
    <NListItem
      v-for="log in logs"
      :key="log.id"
    >
      <NFlex
        justify="space-between"
        :wrap="false"
        style="gap: 12px"
      >
        <div style="min-width: 0">
          <div style="font-weight: 600">
            {{ actionLabel(log.action) }}
          </div>
          <div style="font-size: 12px; opacity: 0.7; word-break: break-all">
            {{ log.detail }}
            <span v-if="log.action !== actionLabel(log.action)" style="opacity: 0.5"> · {{ log.action }}</span>
          </div>
        </div>
        <div style="font-size: 12px; opacity: 0.7; white-space: nowrap">
          {{ log.userName || `用户${log.userId}` }}
          ·
          <NTime
            :time="log.createdAt"
            format="yyyy-MM-dd HH:mm"
          />
        </div>
      </NFlex>
    </NListItem>
  </NList>
</template>
