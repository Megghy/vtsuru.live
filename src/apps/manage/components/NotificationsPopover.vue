<script setup lang="ts">
import { format } from 'date-fns'
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import { QueryPostAPIWithParams } from '@/api/query'
import { ORG_API_URL } from '@/shared/config'
import { getOrgInviteToken, getOrgInviteType, isOrgInviteNotification } from '@/shared/services/notifications/orgInvite'
import { NavigateToNewTab } from '@/shared/utils'
import { useNotificationStore } from '@/store/useNotificationStore'

const accountInfo = useAccount()
const router = useRouter()
const toast = useToast()
const notificationStore = useNotificationStore()

const popoverOpen = ref(false)
const loading = ref(false)

function resolveOpenUrl(item: any): string | undefined {
  const openUrl = item?.extra?.openUrl
  if (typeof openUrl !== 'string' || !openUrl.trim()) return undefined
  return openUrl
}

async function refreshLatest() {
  loading.value = true
  try {
    await notificationStore.refreshUnread()
    await notificationStore.refreshLatest(0, 20, false)
  } catch (err) {
    toast.add({ title: err instanceof Error ? err.message : '加载通知失败', color: 'error' })
  } finally {
    loading.value = false
  }
}

async function onPopoverUpdate(show: boolean) {
  popoverOpen.value = show
  if (!show) return
  await refreshLatest()
}

async function markAllRead() {
  try {
    const ids = notificationStore.unread.map((n) => n.id)
    if (!ids.length) return
    await notificationStore.markRead(ids)
  } catch (err) {
    toast.add({ title: err instanceof Error ? err.message : '操作失败', color: 'error' })
  }
}

async function markRead(id: string) {
  try {
    await notificationStore.markRead([id])
  } catch (err) {
    toast.add({ title: err instanceof Error ? err.message : '操作失败', color: 'error' })
  }
}

async function acceptOrgInvite(item: any) {
  try {
    const type = getOrgInviteType(item)
    const token = getOrgInviteToken(item)
    const url = type === 'member' ? `${ORG_API_URL}invite/member/accept` : `${ORG_API_URL}invite/streamer/accept`

    const resp = await QueryPostAPIWithParams<{ orgId: number; orgName: string }>(url, { token }, undefined)
    if (resp.code !== 200) {
      toast.add({ title: resp.message, color: 'error' })
      return
    }

    await notificationStore.markRead([item.id])
    popoverOpen.value = false
    toast.add({ title: `已处理邀请：${resp.data.orgName}`, color: 'success' })
    router.push({ name: 'org-detail', params: { orgId: resp.data.orgId } })
  } catch (err) {
    toast.add({ title: err instanceof Error ? err.message : '操作失败', color: 'error' })
  }
}

async function rejectOrgInvite(item: any) {
  try {
    const type = getOrgInviteType(item)
    const token = getOrgInviteToken(item)
    const url = type === 'member' ? `${ORG_API_URL}invite/member/reject` : `${ORG_API_URL}invite/streamer/reject`

    const resp = await QueryPostAPIWithParams<{ orgId: number; orgName: string }>(url, { token }, undefined)
    if (resp.code !== 200) {
      toast.add({ title: resp.message, color: 'error' })
      return
    }

    await notificationStore.markRead([item.id])
    popoverOpen.value = false
    toast.add({
      title: type === 'member' ? `已拒绝加入：${resp.data.orgName}` : `已拒绝授权：${resp.data.orgName}`,
      color: 'success',
    })
    router.push({ name: 'org-detail', params: { orgId: resp.data.orgId } })
  } catch (err) {
    toast.add({ title: err instanceof Error ? err.message : '操作失败', color: 'error' })
  }
}

async function openNotif(item: any) {
  try {
    const openUrl = resolveOpenUrl(item)
    if (!openUrl) return

    if (!item.isReaded) {
      await notificationStore.markRead([item.id])
    }

    if (openUrl.startsWith('http://') || openUrl.startsWith('https://')) {
      NavigateToNewTab(openUrl)
      popoverOpen.value = false
      return
    }

    popoverOpen.value = false
    await router.push(openUrl)
  } catch (err) {
    toast.add({ title: err instanceof Error ? err.message : '打开失败', color: 'error' })
  }
}

onMounted(() => {
  if (accountInfo.value?.id) {
    void notificationStore.refreshUnread().catch((err) => console.warn('[notification] refreshUnread failed', err))
  }
})

watch(
  () => accountInfo.value?.id,
  async (id) => {
    if (!id) return
    await notificationStore.refreshUnread()
  },
  { immediate: true },
)

function formatTime(timestamp: number) {
  return format(new Date(timestamp), 'yyyy-MM-dd HH:mm')
}
</script>

<template>
  <UPopover
    v-model:open="popoverOpen"
    :content="{ align: 'end', side: 'bottom' }"
    @update:open="onPopoverUpdate"
  >
    <UTooltip text="通知">
      <button
        type="button"
        class="notifications-popover__trigger"
        aria-label="通知"
      >
        <UIcon name="i-lucide-bell" />
        <span
          v-if="notificationStore.unreadCount"
          class="notifications-popover__count"
        >
          {{ Math.min(notificationStore.unreadCount, 99) }}
        </span>
      </button>
    </UTooltip>

    <template #content>
      <section class="notifications-popover__panel">
        <div class="notifications-popover__header">
          <strong>通知</strong>
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            label="全部已读"
            :disabled="notificationStore.unreadCount === 0"
            @click="markAllRead"
          />
        </div>

        <div
          v-if="loading"
          class="notifications-popover__loading"
        >
          <USkeleton
            v-for="index in 3"
            :key="index"
            class="h-16 w-full"
          />
        </div>
        <UEmpty
          v-else-if="notificationStore.latest.length === 0"
          title="暂无通知"
          size="sm"
        />
        <UScrollArea
          v-else
          class="notifications-popover__list"
        >
          <ul>
            <li
              v-for="item in notificationStore.latest"
              :key="item.id"
              class="notifications-popover__item"
            >
              <div class="notifications-popover__item-header">
                <strong>
                  <UBadge
                    v-if="!item.isReaded"
                    color="info"
                    variant="subtle"
                    size="xs"
                    label="未读"
                  />
                  {{ item.title }}
                </strong>
                <time>{{ formatTime(item.createTime) }}</time>
              </div>
              <p>{{ item.message }}</p>
              <div class="notifications-popover__actions">
                <template v-if="isOrgInviteNotification(item)">
                  <UButton
                    size="xs"
                    label="接受"
                    @click="acceptOrgInvite(item)"
                  />
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="soft"
                    label="拒绝"
                    @click="rejectOrgInvite(item)"
                  />
                </template>
                <UButton
                  v-if="resolveOpenUrl(item)"
                  size="xs"
                  color="primary"
                  variant="soft"
                  label="打开"
                  @click="openNotif(item)"
                />
                <UButton
                  v-if="!item.isReaded"
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  label="标记已读"
                  @click="markRead(item.id)"
                />
              </div>
            </li>
          </ul>
        </UScrollArea>
      </section>
    </template>
  </UPopover>
</template>

<style scoped>
.notifications-popover__trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  color: var(--vtsuru-fg);
  background: transparent;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius-control);
  cursor: pointer;
}

.notifications-popover__trigger > :first-child {
  width: 18px;
  height: 18px;
}

.notifications-popover__count {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 16px;
  padding: 0 4px;
  color: var(--vtsuru-fg-inverted);
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  background: var(--vtsuru-error);
  border-radius: 999px;
}

.notifications-popover__panel {
  width: min(420px, calc(100vw - 24px));
  padding: 12px;
  background: var(--vtsuru-bg-elevated);
}

.notifications-popover__header,
.notifications-popover__item-header,
.notifications-popover__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notifications-popover__header,
.notifications-popover__item-header {
  justify-content: space-between;
}

.notifications-popover__loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
}

.notifications-popover__list {
  max-height: 420px;
  margin-top: 8px;
}

.notifications-popover__list ul {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.notifications-popover__item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--vtsuru-border-muted);
  border-radius: var(--vtsuru-radius-control);
}

.notifications-popover__item strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notifications-popover__item time,
.notifications-popover__item p {
  margin: 0;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.notifications-popover__item time {
  flex: 0 0 auto;
}

.notifications-popover__item p {
  white-space: pre-wrap;
}
</style>
