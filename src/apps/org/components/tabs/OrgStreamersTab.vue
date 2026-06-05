<script setup lang="ts">
import { NButton, NCard, NEmpty, NIcon, NInput, NList, NListItem, NPopconfirm, NSkeleton, NFlex, NSwitch, NTag, NTime } from 'naive-ui'
import { SearchOutline, TrashOutline } from '@vicons/ionicons5'
import { onMounted } from 'vue'
import { useOrgContext } from '../../composables/useOrgContext'
import { injectOrgStreamers, useStreamerDetail } from '../../composables/useOrgStreamers'
import { useOrgInvites } from '../../composables/useOrgInvites'
import { streamerStatusLabel, streamerStatusTagType } from '../../utils'
import type { OrgInviteStreamerListItem } from '../../types'
import OrgUserAvatar from '../OrgUserAvatar.vue'
import OrgInviteManager from '../OrgInviteManager.vue'
import OrgStreamerDetailDrawer from '../OrgStreamerDetailDrawer.vue'

const ctx = useOrgContext()
const { isOrgAdmin } = ctx
const { loading, includeAll, search, filtered, load, remove } = injectOrgStreamers()
const invites = useOrgInvites<OrgInviteStreamerListItem>(ctx, 'streamer')
const detail = useStreamerDetail(ctx)

onMounted(() => {
  if (isOrgAdmin.value) invites.load()
})

async function onSaved() {
  await load()
}
</script>

<template>
  <NSkeleton v-if="loading" text :repeat="6" />
  <template v-else>
    <OrgInviteManager
      v-if="isOrgAdmin"
      kind="streamer"
      :invites="invites.invites.value"
      :loading="invites.loading.value"
      :creating="invites.creating.value"
      @create="invites.create"
      @refresh="invites.load"
    />

    <NCard size="small" style="margin-bottom: 12px; background: transparent;" :bordered="false">
      <NFlex align="center" justify="space-between" wrap>
        <NInput v-model:value="search" placeholder="搜索主播名称或ID" size="small" style="width: 200px">
          <template #prefix>
            <NIcon :component="SearchOutline" />
          </template>
        </NInput>
        <NFlex v-if="isOrgAdmin" align="center">
          <span style="opacity: .8; font-size: 12px;">包含非 Active 状态</span>
          <NSwitch v-model:value="includeAll" size="small" />
        </NFlex>
      </NFlex>
    </NCard>

    <NEmpty v-if="filtered.length === 0" description="暂无主播" />
    <NList v-else hoverable clickable>
      <NListItem v-for="s in filtered" :key="s.streamer.id" @click="detail.open(s.streamer.id)">
        <NFlex align="center" justify="space-between" :wrap="false">
          <NFlex align="center">
            <OrgUserAvatar :face-url="s.streamer.faceUrl" :size="48" />
            <NFlex vertical :size="2">
              <div style="font-weight: 600; font-size: 15px;">
                {{ s.streamer.name }}
              </div>
              <div style="font-size: 12px; opacity: 0.6;">
                ID: {{ s.streamer.id }}
              </div>
            </NFlex>
            <NTag :bordered="false" :type="streamerStatusTagType(s.status)" size="small">
              {{ streamerStatusLabel(s.status) }}
            </NTag>
            <NTag :bordered="false" :type="s.streamer.isBiliAuthed ? 'success' : 'default'" size="small">
              {{ s.streamer.isBiliAuthed ? '已绑定B站' : '未绑定' }}
            </NTag>
          </NFlex>

          <NFlex align="center">
            <div style="font-size: 12px; opacity: 0.7; text-align: right;">
              <div>加入: <NTime :time="s.addedAt" format="yyyy-MM-dd" /></div>
              <div v-if="s.respondedAt">
                响应: <NTime :time="s.respondedAt" format="yyyy-MM-dd" />
              </div>
            </div>
            <NPopconfirm v-if="isOrgAdmin" @positive-click="() => remove(s.streamer.id)">
              <template #trigger>
                <NButton size="tiny" type="error" ghost circle @click.stop>
                  <template #icon>
                    <NIcon :component="TrashOutline" />
                  </template>
                </NButton>
              </template>
              确定要移除该主播吗？
            </NPopconfirm>
          </NFlex>
        </NFlex>
      </NListItem>
    </NList>
  </template>

  <OrgStreamerDetailDrawer :detail="detail" @saved="onSaved" />
</template>

