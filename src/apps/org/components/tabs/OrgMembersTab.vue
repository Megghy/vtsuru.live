<script setup lang="ts">
import { onMounted } from 'vue'

import { useOrgContext } from '../../composables/useOrgContext'
import { useOrgInvites } from '../../composables/useOrgInvites'
import { useOrgMembers } from '../../composables/useOrgMembers'
import type { OrgInviteMemberListItem } from '../../types'
import { roleLabel } from '../../utils'
import OrgInviteManager from '../OrgInviteManager.vue'
import OrgUserAvatar from '../OrgUserAvatar.vue'

const ctx = useOrgContext()
const { isOrgAdmin, myRole, orgInfo } = ctx
const { loading, search, filtered, load, remove, updateRole } = useOrgMembers(ctx)
const invites = useOrgInvites<OrgInviteMemberListItem>(ctx, 'member')

function formatJoinedAt(timestamp: number) {
  const date = new Date(timestamp > 1e10 ? timestamp : timestamp * 1000)
  return date.toLocaleDateString('zh-CN')
}

function roleColor(role: number) {
  if (role === 0) return 'success'
  if (role === 1) return 'info'
  return 'neutral'
}

onMounted(async () => {
  await load()
  if (isOrgAdmin.value) await invites.load()
})
</script>

<template>
  <div
    v-if="loading"
    class="org-member-skeletons"
  >
    <USkeleton
      v-for="index in 6"
      :key="index"
      class="org-member-skeleton"
    />
  </div>
  <template v-else>
    <OrgInviteManager
      v-if="isOrgAdmin"
      kind="member"
      with-role
      :invites="invites.invites.value"
      :loading="invites.loading.value"
      :creating="invites.creating.value"
      @create="invites.create"
      @refresh="invites.load"
    />

    <UCard
      class="org-member-filter"
      :ui="{ body: 'p-3' }"
    >
      <UInput
        v-model="search"
        placeholder="搜索成员名称或 ID"
        icon="i-lucide-search"
        size="sm"
        class="org-member-search"
      />
    </UCard>

    <UEmpty
      v-if="filtered.length === 0"
      icon="i-lucide-users-round"
      title="暂无成员"
    />
    <div
      v-else
      class="org-member-list"
    >
      <UCard
        v-for="member in filtered"
        :key="member.user.id"
        :ui="{ body: 'p-3' }"
      >
        <div class="org-member-row">
          <div class="org-member-identity">
            <OrgUserAvatar
              :face-url="member.user.faceUrl"
              :size="40"
            />
            <div>
              <div class="org-member-name">{{ member.user.name }}</div>
              <div class="org-member-id">ID: {{ member.user.id }}</div>
            </div>
            <UBadge
              :color="roleColor(member.role)"
              variant="soft"
              size="sm"
            >
              {{ roleLabel(member.role) }}
            </UBadge>
          </div>

          <div class="org-member-actions">
            <span class="org-member-date">加入于 {{ formatJoinedAt(member.joinedAt) }}</span>
            <template v-if="myRole === 0 && member.role !== 0 && member.user.id !== orgInfo?.ownerUserId">
              <UPopover>
                <UButton
                  color="info"
                  variant="soft"
                  size="xs"
                >
                  设为 Admin
                </UButton>
                <template #content="{ close }">
                  <div class="org-member-confirm">
                    <span>确定要将该成员设为 Admin 吗？</span>
                    <div>
                      <UButton
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        @click="close"
                      >
                        取消
                      </UButton>
                      <UButton
                        color="info"
                        size="xs"
                        @click="(close(), updateRole(member.user.id, 1))"
                      >
                        确认
                      </UButton>
                    </div>
                  </div>
                </template>
              </UPopover>
              <UPopover>
                <UButton
                  color="neutral"
                  variant="soft"
                  size="xs"
                >
                  设为 Member
                </UButton>
                <template #content="{ close }">
                  <div class="org-member-confirm">
                    <span>确定要将该成员设为 Member 吗？</span>
                    <div>
                      <UButton
                        color="neutral"
                        variant="ghost"
                        size="xs"
                        @click="close"
                      >
                        取消
                      </UButton>
                      <UButton
                        size="xs"
                        @click="(close(), updateRole(member.user.id, 2))"
                      >
                        确认
                      </UButton>
                    </div>
                  </div>
                </template>
              </UPopover>
            </template>

            <UPopover v-if="isOrgAdmin && myRole != null && member.role > myRole">
              <UButton
                color="error"
                variant="ghost"
                size="xs"
                icon="i-lucide-trash-2"
                aria-label="移除成员"
              />
              <template #content="{ close }">
                <div class="org-member-confirm">
                  <span>确定要移除该成员吗？</span>
                  <div>
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="xs"
                      @click="close"
                    >
                      取消
                    </UButton>
                    <UButton
                      color="error"
                      size="xs"
                      @click="(close(), remove(member.user.id))"
                    >
                      移除
                    </UButton>
                  </div>
                </div>
              </template>
            </UPopover>
          </div>
        </div>
      </UCard>
    </div>
  </template>
</template>

<style scoped>
.org-member-skeletons,
.org-member-list {
  display: grid;
  gap: 8px;
}

.org-member-skeleton {
  height: 68px;
}

.org-member-filter {
  margin-bottom: 12px;
}

.org-member-search {
  max-width: 240px;
}

.org-member-row,
.org-member-identity,
.org-member-actions,
.org-member-confirm > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.org-member-row {
  justify-content: space-between;
}

.org-member-identity,
.org-member-actions {
  min-width: 0;
}

.org-member-name {
  font-weight: 600;
}

.org-member-id,
.org-member-date {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.org-member-actions {
  flex-wrap: wrap;
  justify-content: flex-end;
}

.org-member-confirm {
  display: grid;
  min-width: 220px;
  gap: 12px;
  padding: 12px;
}

.org-member-confirm > div {
  justify-content: flex-end;
}

@media (max-width: 680px) {
  .org-member-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .org-member-actions {
    justify-content: flex-start;
  }
}
</style>
