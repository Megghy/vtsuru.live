<script setup lang="ts">
import { ref } from 'vue'

import UserAutocompleteSelect from '@/components/common/UserAutocompleteSelect.vue'

import { useClipboard } from '../composables/useClipboard'
import type { OrgInviteMemberListItem, OrgInviteStreamerListItem } from '../types'
import { inviteStatusLabel, inviteStatusTagType, roleLabel } from '../utils'

type InviteItem = OrgInviteMemberListItem | OrgInviteStreamerListItem

const props = defineProps<{
  kind: 'member' | 'streamer'
  invites: InviteItem[]
  loading: boolean
  creating: boolean
  withRole?: boolean
}>()
const emit = defineEmits<{
  create: [
    payload: {
      role?: number
      targetUserId?: number | null
      targetStreamerUserId?: number | null
      expireDays?: number | null
    },
  ]
  refresh: []
}>()

const { copy } = useClipboard()
const role = ref(2)
const targetUserId = ref<number | null>(null)
const expireDays = ref<number | null>(7)
const showCreate = ref(false)
const showConfirm = ref(false)
const roleOptions = [
  { label: 'Owner', value: 0 },
  { label: 'Admin', value: 1 },
  { label: 'Member', value: 2 },
]

function targetName(invite: InviteItem) {
  if ('targetUserName' in invite)
    return invite.targetUserName || (invite.targetUserId ? `ID: ${invite.targetUserId}` : '公开链接')
  return (
    invite.targetStreamerUserName || (invite.targetStreamerUserId ? `ID: ${invite.targetStreamerUserId}` : '公开链接')
  )
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
}

function submit() {
  emit('create', {
    role: props.withRole ? role.value : undefined,
    targetUserId: props.kind === 'member' ? targetUserId.value : undefined,
    targetStreamerUserId: props.kind === 'streamer' ? targetUserId.value : undefined,
    expireDays: expireDays.value,
  })
  showConfirm.value = false
}
</script>

<template>
  <div class="invite-manager">
    <UCard>
      <template #header
        ><div class="card-header">
          <div>
            <h2>邀请{{ kind === 'member' ? '成员' : '主播' }}</h2>
            <p>生成指定用户或公开可用的邀请链接。</p>
          </div>
          <UButton
            size="sm"
            icon="i-lucide-user-plus"
            @click="showCreate = !showCreate"
            >{{ showCreate ? '收起' : '新建邀请' }}</UButton
          >
        </div></template
      >
      <div
        v-if="showCreate"
        class="create-form"
      >
        <USelectMenu
          v-if="withRole"
          v-model="role"
          :items="roleOptions"
          value-key="value"
          class="role-select"
        />
        <UserAutocompleteSelect
          v-model:value="targetUserId"
          class="target-select"
          :placeholder="`输入B站UID/用户名搜索${kind === 'member' ? '成员' : '主播'}（可选）`"
        />
        <UFieldGroup class="expiry-field"
          ><UInputNumber
            v-model="expireDays"
            :min="1"
            :step="1"
          /><span>天有效期</span></UFieldGroup
        >
        <UButton
          :loading="creating"
          @click="showConfirm = true"
          >生成链接</UButton
        >
      </div>
    </UCard>

    <UCard>
      <template #header
        ><div class="card-header">
          <div>
            <h2>已发出邀请</h2>
            <p>{{ invites.length }} 条记录</p>
          </div>
          <UButton
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-lucide-refresh-cw"
            :loading="loading"
            @click="emit('refresh')"
            >刷新邀请</UButton
          >
        </div></template
      >
      <div
        v-if="loading"
        class="loading-state"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-5 animate-spin"
        />
      </div>
      <UEmpty
        v-else-if="!invites.length"
        icon="i-lucide-mail-plus"
        description="暂无邀请"
      />
      <div
        v-else
        class="invite-list"
      >
        <article
          v-for="invite in invites"
          :key="invite.token"
          class="invite-item"
        >
          <div class="invite-item__header">
            <div class="flex min-w-0 flex-wrap items-center gap-2">
              <UBadge
                :color="
                  inviteStatusTagType(invite.status) === 'default' ? 'neutral' : inviteStatusTagType(invite.status)
                "
                variant="soft"
                size="xs"
                >{{ inviteStatusLabel(invite.status) }}</UBadge
              ><strong>{{ targetName(invite) }}</strong
              ><UBadge
                v-if="withRole && 'role' in invite"
                color="info"
                variant="soft"
                size="xs"
                >{{ roleLabel(invite.role) }}</UBadge
              >
            </div>
            <time>{{ formatTime(invite.expiresAt) }}</time>
          </div>
          <div class="invite-item__meta">
            <span>创建者：{{ invite.createdByUserName || invite.createdByUserId }}</span
            ><span
              >使用次数：{{ invite.usedCount
              }}<template v-if="invite.lastUsedAt">，最近 {{ formatTime(invite.lastUsedAt) }}</template></span
            >
          </div>
          <UFieldGroup
            ><UInput
              :model-value="invite.joinUrl"
              readonly
            /><UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-copy"
              @click="copy(invite.joinUrl)"
              >复制</UButton
            ></UFieldGroup
          >
        </article>
      </div>
    </UCard>

    <UModal
      v-model:open="showConfirm"
      title="生成邀请链接"
      :ui="{ content: 'sm:max-w-md' }"
      ><template #body><p>确定要生成邀请链接吗？</p></template
      ><template #footer
        ><div class="ml-auto flex gap-2">
          <UButton
            color="neutral"
            variant="soft"
            @click="showConfirm = false"
            >取消</UButton
          ><UButton
            :loading="creating"
            @click="submit"
            >生成</UButton
          >
        </div></template
      ></UModal
    >
  </div>
</template>

<style scoped>
.invite-manager,
.create-form,
.invite-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card-header,
.invite-item__header,
.invite-item__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.card-header h2,
.card-header p {
  margin: 0;
}
.card-header h2 {
  font-size: 1rem;
}
.card-header p,
.invite-item__meta,
time {
  color: var(--vtsuru-fg-muted);
  font-size: 0.75rem;
}
.create-form {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
}
.target-select {
  min-width: 240px;
  flex: 1;
}
.role-select {
  width: 120px;
}
.expiry-field {
  width: 180px;
}
.loading-state {
  display: flex;
  min-height: 180px;
  align-items: center;
  justify-content: center;
}
.invite-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
  border-bottom: 1px solid var(--vtsuru-border);
}
.invite-item:last-child {
  border-bottom: 0;
}
@media (max-width: 600px) {
  .card-header,
  .invite-item__header,
  .invite-item__meta {
    align-items: flex-start;
    flex-direction: column;
  }
  .target-select,
  .expiry-field {
    width: 100%;
  }
}
</style>
