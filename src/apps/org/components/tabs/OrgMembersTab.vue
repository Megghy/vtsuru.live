<script setup lang="ts">
import { NAvatar, NButton, NCard, NCollapse, NCollapseItem, NEmpty, NIcon, NInput, NInputNumber, NList, NListItem, NPopconfirm, NSelect, NSkeleton, NFlex, NTag, NTime } from 'naive-ui';
import { CopyOutline, SearchOutline, TrashOutline } from '@vicons/ionicons5'
import UserAutocompleteSelect from '@/components/common/UserAutocompleteSelect.vue'

const props = defineProps<{
  loading: boolean
  isOrgAdmin: boolean
  myRole: number | null
  ownerUserId: number | null

  creatingMemberInvite: boolean
  memberInviteUrl: string
  loadingMemberInvites: boolean
  memberInvites: any[]

  filteredMembers: any[]

  inviteStatusLabel: (status: number) => string
  inviteStatusTagType: (status: number) => 'success' | 'info' | 'warning' | 'error' | 'default'
  roleLabel: (role: number) => string

  createMemberInvite: () => Promise<void> | void
  loadMemberInvites: () => Promise<void> | void
  updateMemberRole: (userId: number, role: number) => Promise<void> | void
  removeMember: (userId: number) => Promise<void> | void
  copyToClipboard: (text: string) => Promise<void> | void
  onUserSearchError: (message: string) => void
}>()

const memberInviteRole = defineModel<number>('memberInviteRole', { required: true })
const memberInviteTargetUserId = defineModel<number | null>('memberInviteTargetUserId')
const memberInviteExpireDays = defineModel<number | null>('memberInviteExpireDays')
const memberSearch = defineModel<string>('memberSearch', { required: true })
</script>

<template>
  <template v-if="props.loading">
    <NSkeleton text :repeat="6" />
  </template>

  <template v-else>
    <template v-if="props.isOrgAdmin">
      <NCollapse style="margin-bottom: 16px;">
        <NCollapseItem title="邀请成员" name="1">
          <NCard size="small" embedded :bordered="false">
            <NFlex vertical>
              <NFlex align="center">
                <NSelect
                  v-model:value="memberInviteRole"
                  style="width: 120px;"
                  size="small"
                  :options="[
                    { label: 'Owner', value: 0 },
                    { label: 'Admin', value: 1 },
                    { label: 'Member', value: 2 },
                  ]"
                />
                <UserAutocompleteSelect
                  v-model:value="memberInviteTargetUserId"
                  style="min-width: 240px;"
                  placeholder="输入B站UID/用户名搜索成员(可选)"
                  @error="(m) => props.onUserSearchError(m)"
                />
              </NFlex>
              <NFlex align="center">
                <NInputNumber v-model:value="memberInviteExpireDays" placeholder="有效期(天)" :min="1" size="small" />
                <NPopconfirm @positive-click="props.createMemberInvite">
                  <template #trigger>
                    <NButton type="primary" size="small" :loading="props.creatingMemberInvite">
                      生成链接
                    </NButton>
                  </template>
                  确定要发送成员邀请吗？
                </NPopconfirm>
              </NFlex>
              <div v-if="props.memberInviteUrl">
                <NFlex>
                  <NInput :value="props.memberInviteUrl" readonly size="small" placeholder="邀请链接" />
                  <NButton size="small" secondary type="success" @click="props.copyToClipboard(props.memberInviteUrl)">
                    <template #icon>
                      <NIcon :component="CopyOutline" />
                    </template>
                    复制
                  </NButton>
                </NFlex>
              </div>
            </NFlex>
          </NCard>
        </NCollapseItem>
      </NCollapse>

      <NCard size="small" style="margin-bottom: 12px;" :bordered="false" :segmented="{ content: true }">
        <template #header>
          已发出邀请
        </template>
        <template #header-extra>
          <NButton size="small" :loading="props.loadingMemberInvites" @click="props.loadMemberInvites">
            刷新邀请
          </NButton>
        </template>

        <template v-if="props.loadingMemberInvites">
          <NSkeleton text :repeat="4" />
        </template>
        <template v-else-if="props.memberInvites.length === 0">
          <NEmpty description="暂无邀请" />
        </template>
        <NList v-else>
          <NListItem v-for="inv in props.memberInvites" :key="inv.token">
            <div style="display:flex; flex-direction: column; gap: 6px; width: 100%;">
              <div style="display:flex; justify-content: space-between; align-items: center; gap: 8px;">
                <div style="font-weight: 600;">
                  <NTag size="small" :bordered="false" :type="props.inviteStatusTagType(inv.status)">
                    {{ props.inviteStatusLabel(inv.status) }}
                  </NTag>
                  <span style="margin-left: 6px;">
                    {{ inv.targetUserName || (inv.targetUserId ? `ID: ${inv.targetUserId}` : '公开链接') }}
                  </span>
                  <NTag size="small" :bordered="false" type="info" style="margin-left: 6px;">
                    {{ props.roleLabel(inv.role) }}
                  </NTag>
                </div>
                <NTime :time="inv.expiresAt" format="yyyy-MM-dd HH:mm" />
              </div>

              <div style="font-size: 12px; opacity: .75; display:flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                <span>创建者: {{ inv.createdByUserName || inv.createdByUserId }}</span>
                <span>使用次数: {{ inv.usedCount }}<template v-if="inv.lastUsedAt">, 最近使用: <NTime :time="inv.lastUsedAt" format="yyyy-MM-dd HH:mm" /></template></span>
              </div>

              <NFlex>
                <NInput :value="inv.joinUrl" readonly size="small" placeholder="邀请链接" />
                <NButton size="small" secondary type="success" @click="props.copyToClipboard(inv.joinUrl)">
                  <template #icon>
                    <NIcon :component="CopyOutline" />
                  </template>
                  复制
                </NButton>
              </NFlex>
            </div>
          </NListItem>
        </NList>
      </NCard>
    </template>

    <NCard size="small" style="margin-bottom: 12px; background: transparent;" :bordered="false">
      <NFlex align="center" justify="start">
        <NInput v-model:value="memberSearch" placeholder="搜索成员名称或ID" size="small" style="width: 200px">
          <template #prefix>
            <NIcon :component="SearchOutline" />
          </template>
        </NInput>
      </NFlex>
    </NCard>

    <template v-if="props.filteredMembers.length === 0">
      <NEmpty description="暂无成员" />
    </template>

    <NList v-else hoverable>
      <NListItem v-for="m in props.filteredMembers" :key="m.user.id">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <NFlex align="center">
            <NAvatar
              round
              :size="40"
              :src="m.user.faceUrl ? (m.user.faceUrl.includes('@') ? m.user.faceUrl : `${m.user.faceUrl}@40w`) : ''"
              :img-props="{ referrerpolicy: 'no-referrer' }"
              fallback-src="https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png"
              style="border: 1px solid var(--n-divider-color);"
            />
            <NFlex vertical :size="2">
              <div style="font-weight: 600;">
                {{ m.user.name }}
              </div>
              <div style="font-size: 12px; opacity: 0.6;">
                ID: {{ m.user.id }}
              </div>
            </NFlex>
            <NTag :bordered="false" size="small" type="info">
              {{ props.roleLabel(m.role) }}
            </NTag>
          </NFlex>

          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 12px; opacity: 0.7;">
              加入于 <NTime :time="m.joinedAt" format="yyyy-MM-dd" />
            </span>

            <template v-if="props.myRole === 0 && m.role !== 0 && m.user.id !== props.ownerUserId">
              <NPopconfirm @positive-click="props.updateMemberRole(m.user.id, 1)">
                <template #trigger>
                  <NButton size="tiny" tertiary type="info">
                    设为 Admin
                  </NButton>
                </template>
                确定要将该成员设为 Admin 吗？
              </NPopconfirm>
              <NPopconfirm @positive-click="props.updateMemberRole(m.user.id, 2)">
                <template #trigger>
                  <NButton size="tiny" tertiary>
                    设为 Member
                  </NButton>
                </template>
                确定要将该成员设为 Member 吗？
              </NPopconfirm>
            </template>

            <NPopconfirm
              v-if="props.isOrgAdmin && props.myRole != null && m.role > props.myRole"
              @positive-click="props.removeMember(m.user.id)"
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
          </div>
        </div>
      </NListItem>
    </NList>
  </template>
</template>
