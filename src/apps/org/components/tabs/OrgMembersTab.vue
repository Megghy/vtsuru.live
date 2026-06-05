<script setup lang="ts">
import { NButton, NCard, NEmpty, NIcon, NInput, NList, NListItem, NPopconfirm, NSkeleton, NFlex, NTag, NTime } from 'naive-ui'
import { SearchOutline, TrashOutline } from '@vicons/ionicons5'
import { onMounted } from 'vue'
import { useOrgContext } from '../../composables/useOrgContext'
import { useOrgMembers } from '../../composables/useOrgMembers'
import { useOrgInvites } from '../../composables/useOrgInvites'
import { roleLabel } from '../../utils'
import type { OrgInviteMemberListItem } from '../../types'
import OrgUserAvatar from '../OrgUserAvatar.vue'
import OrgInviteManager from '../OrgInviteManager.vue'

const ctx = useOrgContext()
const { isOrgAdmin, myRole, orgInfo } = ctx
const { loading, search, filtered, load, remove, updateRole } = useOrgMembers(ctx)
const invites = useOrgInvites<OrgInviteMemberListItem>(ctx, 'member')

onMounted(async () => {
  await load()
  if (isOrgAdmin.value) await invites.load()
})
</script>

<template>
  <NSkeleton v-if="loading" text :repeat="6" />
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

    <NCard size="small" style="margin-bottom: 12px; background: transparent;" :bordered="false">
      <NInput v-model:value="search" placeholder="搜索成员名称或ID" size="small" style="width: 200px">
        <template #prefix>
          <NIcon :component="SearchOutline" />
        </template>
      </NInput>
    </NCard>

    <NEmpty v-if="filtered.length === 0" description="暂无成员" />
    <NList v-else hoverable>
      <NListItem v-for="m in filtered" :key="m.user.id">
        <NFlex align="center" justify="space-between" :wrap="false">
          <NFlex align="center">
            <OrgUserAvatar :face-url="m.user.faceUrl" :size="40" />
            <NFlex vertical :size="2">
              <div style="font-weight: 600;">
                {{ m.user.name }}
              </div>
              <div style="font-size: 12px; opacity: 0.6;">
                ID: {{ m.user.id }}
              </div>
            </NFlex>
            <NTag :bordered="false" size="small" type="info">
              {{ roleLabel(m.role) }}
            </NTag>
          </NFlex>

          <NFlex align="center">
            <span style="font-size: 12px; opacity: 0.7;">
              加入于 <NTime :time="m.joinedAt" format="yyyy-MM-dd" />
            </span>

            <template v-if="myRole === 0 && m.role !== 0 && m.user.id !== orgInfo?.ownerUserId">
              <NPopconfirm @positive-click="() => updateRole(m.user.id, 1)">
                <template #trigger>
                  <NButton size="tiny" tertiary type="info">
                    设为 Admin
                  </NButton>
                </template>
                确定要将该成员设为 Admin 吗？
              </NPopconfirm>
              <NPopconfirm @positive-click="() => updateRole(m.user.id, 2)">
                <template #trigger>
                  <NButton size="tiny" tertiary>
                    设为 Member
                  </NButton>
                </template>
                确定要将该成员设为 Member 吗？
              </NPopconfirm>
            </template>

            <NPopconfirm
              v-if="isOrgAdmin && myRole != null && m.role > myRole"
              @positive-click="() => remove(m.user.id)"
            >
              <template #trigger>
                <NButton size="tiny" type="error" ghost circle>
                  <template #icon>
                    <NIcon :component="TrashOutline" />
                  </template>
                </NButton>
              </template>
              确定要移除该成员吗？
            </NPopconfirm>
          </NFlex>
        </NFlex>
      </NListItem>
    </NList>
  </template>
</template>

