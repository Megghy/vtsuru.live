<script setup lang="ts">
import { onMounted } from 'vue'

import { useOrgContext } from '../../composables/useOrgContext'
import { useOrgInvites } from '../../composables/useOrgInvites'
import { injectOrgStreamers, useStreamerDetail } from '../../composables/useOrgStreamers'
import type { OrgInviteStreamerListItem } from '../../types'
import { streamerStatusLabel, streamerStatusTagType } from '../../utils'
import OrgInviteManager from '../OrgInviteManager.vue'
import OrgStreamerDetailDrawer from '../OrgStreamerDetailDrawer.vue'
import OrgUserAvatar from '../OrgUserAvatar.vue'

const ctx = useOrgContext()
const { isOrgAdmin } = ctx
const { loading, includeAll, search, filtered, load, remove } = injectOrgStreamers()
const invites = useOrgInvites<OrgInviteStreamerListItem>(ctx, 'streamer')
const detail = useStreamerDetail(ctx)

function formatDate(timestamp: number) {
  const date = new Date(timestamp > 1e10 ? timestamp : timestamp * 1000)
  return date.toLocaleDateString('zh-CN')
}

function statusColor(status: number) {
  const color = streamerStatusTagType(status)
  return color === 'default' ? 'neutral' : color
}

onMounted(() => {
  if (isOrgAdmin.value) invites.load()
})

async function onSaved() {
  await load()
}
</script>

<template>
  <div
    v-if="loading"
    class="org-streamer-skeletons"
  >
    <USkeleton
      v-for="index in 6"
      :key="index"
      class="org-streamer-skeleton"
    />
  </div>
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

    <UCard
      class="org-streamer-filter"
      :ui="{ body: 'p-3' }"
    >
      <div class="org-streamer-filter__content">
        <UInput
          v-model="search"
          placeholder="搜索主播名称或 ID"
          icon="i-lucide-search"
          size="sm"
          class="org-streamer-search"
        />
        <UCheckbox
          v-if="isOrgAdmin"
          v-model="includeAll"
          label="包含非 Active 状态"
        />
      </div>
    </UCard>

    <UEmpty
      v-if="filtered.length === 0"
      icon="i-lucide-mic-vocal"
      title="暂无主播"
    />
    <div
      v-else
      class="org-streamer-list"
    >
      <UCard
        v-for="streamer in filtered"
        :key="streamer.streamer.id"
        :ui="{ body: 'p-3' }"
        class="org-streamer-card"
        @click="detail.open(streamer.streamer.id)"
      >
        <div class="org-streamer-row">
          <div class="org-streamer-identity">
            <OrgUserAvatar
              :face-url="streamer.streamer.faceUrl"
              :size="48"
            />
            <div>
              <div class="org-streamer-name">{{ streamer.streamer.name }}</div>
              <div class="org-streamer-id">ID: {{ streamer.streamer.id }}</div>
            </div>
            <UBadge
              :color="statusColor(streamer.status)"
              variant="soft"
              size="sm"
            >
              {{ streamerStatusLabel(streamer.status) }}
            </UBadge>
            <UBadge
              :color="streamer.streamer.isBiliAuthed ? 'success' : 'neutral'"
              variant="soft"
              size="sm"
            >
              {{ streamer.streamer.isBiliAuthed ? '已绑定 B 站' : '未绑定' }}
            </UBadge>
          </div>

          <div class="org-streamer-actions">
            <div class="org-streamer-date">
              <div>加入: {{ formatDate(streamer.addedAt) }}</div>
              <div v-if="streamer.respondedAt">响应: {{ formatDate(streamer.respondedAt) }}</div>
            </div>
            <UPopover v-if="isOrgAdmin">
              <UButton
                color="error"
                variant="ghost"
                size="xs"
                icon="i-lucide-trash-2"
                aria-label="移除主播"
                @click.stop
              />
              <template #content="{ close }">
                <div class="org-streamer-confirm">
                  <span>确定要移除该主播吗？</span>
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
                      @click="(close(), remove(streamer.streamer.id))"
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

  <OrgStreamerDetailDrawer
    :detail="detail"
    @saved="onSaved"
  />
</template>

<style scoped>
.org-streamer-skeletons,
.org-streamer-list {
  display: grid;
  gap: 8px;
}

.org-streamer-skeleton {
  height: 76px;
}

.org-streamer-filter {
  margin-bottom: 12px;
}

.org-streamer-filter__content,
.org-streamer-row,
.org-streamer-identity,
.org-streamer-actions,
.org-streamer-confirm > div {
  display: flex;
  align-items: center;
  gap: 10px;
}

.org-streamer-filter__content,
.org-streamer-actions {
  justify-content: space-between;
}

.org-streamer-search {
  max-width: 240px;
}

.org-streamer-card {
  cursor: pointer;
}

.org-streamer-card:hover {
  border-color: var(--vtsuru-brand);
}

.org-streamer-row {
  justify-content: space-between;
}

.org-streamer-identity,
.org-streamer-actions {
  min-width: 0;
}

.org-streamer-name {
  font-size: 15px;
  font-weight: 600;
}

.org-streamer-id,
.org-streamer-date {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.org-streamer-date {
  text-align: right;
}

.org-streamer-confirm {
  display: grid;
  min-width: 210px;
  gap: 12px;
  padding: 12px;
}

.org-streamer-confirm > div {
  justify-content: flex-end;
}

@media (max-width: 680px) {
  .org-streamer-filter__content,
  .org-streamer-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .org-streamer-actions {
    justify-content: flex-start;
    width: 100%;
  }

  .org-streamer-date {
    text-align: left;
  }
}
</style>
