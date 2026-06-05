<script setup lang="ts">
import { NButton, NCard, NCollapse, NCollapseItem, NEmpty, NIcon, NInput, NInputNumber, NList, NListItem, NPopconfirm, NSelect, NSkeleton, NFlex, NTag, NTime } from 'naive-ui'
import { CopyOutline } from '@vicons/ionicons5'
import { ref } from 'vue'
import UserAutocompleteSelect from '@/components/common/UserAutocompleteSelect.vue'
import { useClipboard } from '../composables/useClipboard'
import { inviteStatusLabel, inviteStatusTagType, roleLabel } from '../utils'
import type { OrgInviteMemberListItem, OrgInviteStreamerListItem } from '../types'

type InviteItem = OrgInviteMemberListItem | OrgInviteStreamerListItem

const props = defineProps<{
  kind: 'member' | 'streamer'
  invites: InviteItem[]
  loading: boolean
  creating: boolean
  /** 是否展示角色选择（仅成员邀请） */
  withRole?: boolean
}>()

const emit = defineEmits<{
  (e: 'create', payload: { role?: number, targetUserId?: number | null, targetStreamerUserId?: number | null, expireDays?: number | null }): void
  (e: 'refresh'): void
}>()

const { copy } = useClipboard()

const role = ref(2)
const targetUserId = ref<number | null>(null)
const expireDays = ref<number | null>(7)

function targetName(inv: InviteItem): string {
  if ('targetUserName' in inv) return inv.targetUserName || (inv.targetUserId ? `ID: ${inv.targetUserId}` : '公开链接')
  return inv.targetStreamerUserName || (inv.targetStreamerUserId ? `ID: ${inv.targetStreamerUserId}` : '公开链接')
}

function submit() {
  emit('create', {
    role: props.withRole ? role.value : undefined,
    targetUserId: props.kind === 'member' ? (targetUserId.value || undefined) : undefined,
    targetStreamerUserId: props.kind === 'streamer' ? (targetUserId.value || undefined) : undefined,
    expireDays: expireDays.value || undefined,
  })
}
</script>

<template>
  <NCollapse style="margin-bottom: 16px;">
    <NCollapseItem :title="kind === 'member' ? '邀请成员' : '邀请主播'" name="1">
      <NCard size="small" embedded :bordered="false">
        <NFlex vertical>
          <NFlex align="center" wrap>
            <NSelect
              v-if="withRole"
              v-model:value="role"
              style="width: 120px;"
              size="small"
              :options="[
                { label: 'Owner', value: 0 },
                { label: 'Admin', value: 1 },
                { label: 'Member', value: 2 },
              ]"
            />
            <UserAutocompleteSelect
              v-model:value="targetUserId"
              style="min-width: 240px; flex: 1;"
              :placeholder="`输入B站UID/用户名搜索${kind === 'member' ? '成员' : '主播'}(可选)`"
            />
          </NFlex>
          <NFlex align="center">
            <NInputNumber v-model:value="expireDays" placeholder="有效期(天)" :min="1" size="small" />
            <NPopconfirm @positive-click="submit">
              <template #trigger>
                <NButton type="primary" size="small" :loading="creating">
                  生成链接
                </NButton>
              </template>
              确定要发送邀请吗？
            </NPopconfirm>
          </NFlex>
        </NFlex>
      </NCard>
    </NCollapseItem>
  </NCollapse>

  <NCard size="small" style="margin-bottom: 12px;" :bordered="false" :segmented="{ content: true }">
    <template #header>
      已发出邀请
    </template>
    <template #header-extra>
      <NButton size="small" :loading="loading" @click="emit('refresh')">
        刷新邀请
      </NButton>
    </template>

    <NSkeleton v-if="loading" text :repeat="4" />
    <NEmpty v-else-if="invites.length === 0" description="暂无邀请" />
    <NList v-else>
      <NListItem v-for="inv in invites" :key="inv.token">
        <NFlex vertical :size="6" style="width: 100%;">
          <NFlex justify="space-between" align="center">
            <NFlex align="center" :size="6">
              <NTag size="small" :bordered="false" :type="inviteStatusTagType(inv.status)">
                {{ inviteStatusLabel(inv.status) }}
              </NTag>
              <span style="font-weight: 600;">{{ targetName(inv) }}</span>
              <NTag v-if="withRole && 'role' in inv" size="small" :bordered="false" type="info">
                {{ roleLabel(inv.role) }}
              </NTag>
            </NFlex>
            <NTime :time="inv.expiresAt" format="yyyy-MM-dd HH:mm" />
          </NFlex>
          <NFlex justify="space-between" wrap style="font-size: 12px; opacity: .75;">
            <span>创建者: {{ inv.createdByUserName || inv.createdByUserId }}</span>
            <span>
              使用次数: {{ inv.usedCount }}
              <template v-if="inv.lastUsedAt">, 最近: <NTime :time="inv.lastUsedAt" format="MM-dd HH:mm" /></template>
            </span>
          </NFlex>
          <NFlex>
            <NInput :value="inv.joinUrl" readonly size="small" placeholder="邀请链接" />
            <NButton size="small" secondary type="success" @click="copy(inv.joinUrl)">
              <template #icon>
                <NIcon :component="CopyOutline" />
              </template>
              复制
            </NButton>
          </NFlex>
        </NFlex>
      </NListItem>
    </NList>
  </NCard>
</template>
