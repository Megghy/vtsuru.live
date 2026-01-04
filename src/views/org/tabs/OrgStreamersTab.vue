<script setup lang="ts">
import {
  NAvatar,
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NEmpty,
  NIcon,
  NInput,
  NInputNumber,
  NList,
  NListItem,
  NPopconfirm,
  NSkeleton,
  NSpace,
  NSwitch,
  NTag,
  NTime,
} from 'naive-ui'
import { CopyOutline, SearchOutline, TrashOutline } from '@vicons/ionicons5'
import UserAutocompleteSelect from '@/components/common/UserAutocompleteSelect.vue'

const props = defineProps<{
  loading: boolean
  isOrgAdmin: boolean

  creatingStreamerInvite: boolean
  streamerInviteUrl: string
  loadingStreamerInvites: boolean
  streamerInvites: any[]

  filteredStreamers: any[]

  inviteStatusLabel: (status: number) => string
  inviteStatusTagType: (status: number) => 'success' | 'info' | 'warning' | 'error' | 'default'
  streamerStatusLabel: (status: number) => string
  streamerStatusTagType: (status: number) => 'default' | 'success' | 'warning' | 'error' | 'info'

  createStreamerInvite: () => Promise<void> | void
  loadStreamerInvites: () => Promise<void> | void
  openStreamerDetailDrawer: (streamerId: number) => Promise<void> | void
  removeStreamer: (streamerId: number) => Promise<void> | void
  copyToClipboard: (text: string) => Promise<void> | void
  onUserSearchError: (message: string) => void
}>()

const streamerInviteTargetUserId = defineModel<number | null>('streamerInviteTargetUserId')
const streamerInviteExpireDays = defineModel<number | null>('streamerInviteExpireDays')
const streamerSearch = defineModel<string>('streamerSearch', { required: true })
const includeAllStreamers = defineModel<boolean>('includeAllStreamers', { required: true })
</script>

<template>
  <template v-if="props.loading">
    <NSkeleton text :repeat="6" />
  </template>

  <template v-else>
    <template v-if="props.isOrgAdmin">
      <NCollapse style="margin-bottom: 16px;">
        <NCollapseItem title="邀请主播" name="1">
          <NCard size="small" embedded :bordered="false">
            <NSpace vertical>
              <UserAutocompleteSelect
                v-model:value="streamerInviteTargetUserId"
                style="width: 100%;"
                placeholder="输入B站UID/用户名搜索主播(可选)"
                @error="(m) => props.onUserSearchError(m)"
              />
              <NSpace align="center">
                <NInputNumber v-model:value="streamerInviteExpireDays" placeholder="有效期(天)" :min="1" size="small" />
                <NPopconfirm @positive-click="props.createStreamerInvite">
                  <template #trigger>
                    <NButton type="primary" size="small" :loading="props.creatingStreamerInvite">
                      生成链接
                    </NButton>
                  </template>
                  确定要发送主播邀请吗？
                </NPopconfirm>
              </NSpace>
              <div v-if="props.streamerInviteUrl">
                <NSpace>
                  <NInput :value="props.streamerInviteUrl" readonly size="small" placeholder="邀请链接" />
                  <NButton size="small" secondary type="success" @click="props.copyToClipboard(props.streamerInviteUrl)">
                    <template #icon>
                      <NIcon :component="CopyOutline" />
                    </template>
                    复制
                  </NButton>
                </NSpace>
              </div>
            </NSpace>
          </NCard>
        </NCollapseItem>
      </NCollapse>

      <NCard size="small" style="margin-bottom: 12px;" :bordered="false" :segmented="{ content: true }">
        <template #header>
          已发出邀请
        </template>
        <template #header-extra>
          <NButton size="small" :loading="props.loadingStreamerInvites" @click="props.loadStreamerInvites">
            刷新邀请
          </NButton>
        </template>

        <template v-if="props.loadingStreamerInvites">
          <NSkeleton text :repeat="4" />
        </template>
        <template v-else-if="props.streamerInvites.length === 0">
          <NEmpty description="暂无邀请" />
        </template>
        <NList v-else>
          <NListItem v-for="inv in props.streamerInvites" :key="inv.token">
            <div style="display:flex; flex-direction: column; gap: 6px; width: 100%;">
              <div style="display:flex; justify-content: space-between; align-items: center; gap: 8px;">
                <div style="font-weight: 600;">
                  <NTag size="small" :bordered="false" :type="props.inviteStatusTagType(inv.status)">
                    {{ props.inviteStatusLabel(inv.status) }}
                  </NTag>
                  <span style="margin-left: 6px;">
                    {{ inv.targetStreamerUserName || (inv.targetStreamerUserId ? `ID: ${inv.targetStreamerUserId}` : '公开链接') }}
                  </span>
                </div>
                <NTime :time="inv.expiresAt" format="yyyy-MM-dd HH:mm" />
              </div>

              <div style="font-size: 12px; opacity: .75; display:flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                <span>创建者: {{ inv.createdByUserName || inv.createdByUserId }}</span>
                <span>使用次数: {{ inv.usedCount }}<template v-if="inv.lastUsedAt">, 最近使用: <NTime :time="inv.lastUsedAt" format="yyyy-MM-dd HH:mm" /></template></span>
              </div>

              <NSpace>
                <NInput :value="inv.joinUrl" readonly size="small" placeholder="邀请链接" />
                <NButton size="small" secondary type="success" @click="props.copyToClipboard(inv.joinUrl)">
                  <template #icon>
                    <NIcon :component="CopyOutline" />
                  </template>
                  复制
                </NButton>
              </NSpace>
            </div>
          </NListItem>
        </NList>
      </NCard>

      <NCard size="small" style="margin-bottom: 12px; background: transparent;" :bordered="false">
        <NSpace align="center" justify="space-between">
          <NInput v-model:value="streamerSearch" placeholder="搜索主播名称或ID" size="small" style="width: 200px">
            <template #prefix>
              <NIcon :component="SearchOutline" />
            </template>
          </NInput>
          <NSpace align="center">
            <span style="opacity: .8; font-size: 12px;">包含非 Active 状态</span>
            <NSwitch v-model:value="includeAllStreamers" size="small" />
          </NSpace>
        </NSpace>
      </NCard>
    </template>
    <template v-else>
      <NCard size="small" style="margin-bottom: 12px; background: transparent;" :bordered="false">
        <NSpace align="center" justify="start">
          <NInput v-model:value="streamerSearch" placeholder="搜索主播名称或ID" size="small" style="width: 200px">
            <template #prefix>
              <NIcon :component="SearchOutline" />
            </template>
          </NInput>
        </NSpace>
      </NCard>
    </template>

    <template v-if="props.filteredStreamers.length === 0">
      <NEmpty description="暂无主播" />
    </template>

    <NList v-else hoverable clickable>
      <NListItem v-for="s in props.filteredStreamers" :key="s.streamer.id" @click="props.openStreamerDetailDrawer(s.streamer.id)">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <NSpace align="center">
            <NAvatar
              round
              :size="48"
              :src="s.streamer.faceUrl ? (s.streamer.faceUrl.includes('@') ? s.streamer.faceUrl : `${s.streamer.faceUrl}@48w`) : ''"
              :img-props="{ referrerpolicy: 'no-referrer' }"
              :fallback-src="'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'"
              style="border: 1px solid var(--n-divider-color);"
            />
            <NSpace vertical :size="2">
              <div style="font-weight: 600; font-size: 15px;">
                {{ s.streamer.name }}
              </div>
              <div style="font-size: 12px; opacity: 0.6;">
                ID: {{ s.streamer.id }}
              </div>
            </NSpace>
            <NTag :bordered="false" :type="props.streamerStatusTagType(s.status)" size="small">
              {{ props.streamerStatusLabel(s.status) }}
            </NTag>
            <NTag v-if="s.streamer.isBiliAuthed" :bordered="false" type="success" size="small">
              已绑定B站
            </NTag>
            <NTag v-else :bordered="false" size="small">
              未绑定
            </NTag>
          </NSpace>

          <div style="text-align: right; display: flex; align-items: center; gap: 12px;">
            <div style="font-size: 12px; opacity: 0.7;">
              <div>加入时间: <NTime :time="s.addedAt" format="yyyy-MM-dd" /></div>
              <div v-if="s.respondedAt">响应时间: <NTime :time="s.respondedAt" format="yyyy-MM-dd" /></div>
            </div>
            <NPopconfirm
              v-if="props.isOrgAdmin"
              @positive-click="props.removeStreamer(s.streamer.id)"
            >
              <template #trigger>
                <NButton size="tiny" type="error" ghost circle @click.stop>
                  <template #icon>
                    <NIcon :component="TrashOutline" />
                  </template>
                </NButton>
              </template>
              确定要移除该主播吗？
            </NPopconfirm>
          </div>
        </div>
      </NListItem>
    </NList>
  </template>
</template>
