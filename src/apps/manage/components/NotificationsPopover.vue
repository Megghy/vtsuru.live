<script setup lang="ts">
import { NotificationsOutline } from '@vicons/ionicons5'
import {
  NBadge,
  NButton,
  NCard,
  NEmpty,
  NIcon,
  NList,
  NListItem,
  NPopover,
  NScrollbar,
  NSpace,
  NSpin,
  NTag,
  NTime,
  NTooltip,
  useMessage,
} from 'naive-ui'
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
const message = useMessage()
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
    message.error(err instanceof Error ? err.message : '加载通知失败')
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
    const ids = notificationStore.unread.map(n => n.id)
    if (!ids.length) return
    await notificationStore.markRead(ids)
  } catch (err) {
    message.error(err instanceof Error ? err.message : '操作失败')
  }
}

async function markRead(id: string) {
  try {
    await notificationStore.markRead([id])
  } catch (err) {
    message.error(err instanceof Error ? err.message : '操作失败')
  }
}

async function acceptOrgInvite(item: any) {
  try {
    const type = getOrgInviteType(item)
    const token = getOrgInviteToken(item)
    const url = type === 'member'
      ? `${ORG_API_URL}invite/member/accept`
      : `${ORG_API_URL}invite/streamer/accept`

    const resp = await QueryPostAPIWithParams<{ orgId: number, orgName: string }>(url, { token }, undefined)
    if (resp.code !== 200) {
      message.error(resp.message)
      return
    }

    await notificationStore.markRead([item.id])
    popoverOpen.value = false
    message.success(`已处理邀请：${resp.data.orgName}`)
    router.push({ name: 'org-detail', params: { orgId: resp.data.orgId } })
  } catch (err) {
    message.error(err instanceof Error ? err.message : '操作失败')
  }
}

async function rejectOrgInvite(item: any) {
  try {
    const type = getOrgInviteType(item)
    const token = getOrgInviteToken(item)
    const url = type === 'member'
      ? `${ORG_API_URL}invite/member/reject`
      : `${ORG_API_URL}invite/streamer/reject`

    const resp = await QueryPostAPIWithParams<{ orgId: number, orgName: string }>(url, { token }, undefined)
    if (resp.code !== 200) {
      message.error(resp.message)
      return
    }

    await notificationStore.markRead([item.id])
    popoverOpen.value = false
    message.success(type === 'member' ? `已拒绝加入：${resp.data.orgName}` : `已拒绝授权：${resp.data.orgName}`)
    router.push({ name: 'org-detail', params: { orgId: resp.data.orgId } })
  } catch (err) {
    message.error(err instanceof Error ? err.message : '操作失败')
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
    message.error(err instanceof Error ? err.message : '打开失败')
  }
}

onMounted(() => {
  if (accountInfo.value?.id) {
    void notificationStore.refreshUnread().catch(err => console.warn('[notification] refreshUnread failed', err))
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
</script>

<template>
  <NTooltip>
    <template #trigger>
      <NPopover
        v-model:show="popoverOpen"
        trigger="click"
        placement="bottom-end"
        @update:show="onPopoverUpdate"
      >
        <template #trigger>
          <NBadge :value="notificationStore.unreadCount" :max="99" :show="notificationStore.unreadCount > 0">
            <NButton circle tertiary>
              <template #icon>
                <NIcon :component="NotificationsOutline" />
              </template>
            </NButton>
          </NBadge>
        </template>

        <NCard size="small" style="width: 420px" :bordered="false" :segmented="{ content: true }">
          <template #header>
            通知
          </template>
          <template #header-extra>
            <NButton size="small" secondary :disabled="notificationStore.unreadCount === 0" @click.stop="markAllRead">
              全部已读
            </NButton>
          </template>

          <NSpin :show="loading">
            <template v-if="notificationStore.latest.length === 0">
              <NEmpty description="暂无通知" />
            </template>

            <NScrollbar v-else style="max-height: 420px">
              <NList>
                <NListItem v-for="item in notificationStore.latest" :key="item.id">
                  <div style="display:flex; flex-direction: column; gap: 6px; width: 100%;">
                    <div style="display:flex; justify-content: space-between; align-items: center; gap: 8px;">
                      <div style="font-weight: 600;">
                        <NTag v-if="!item.isReaded" size="small" type="info" :bordered="false">
                          未读
                        </NTag>
                        {{ item.title }}
                      </div>
                      <NTime :time="item.createTime" format="yyyy-MM-dd HH:mm" />
                    </div>

                    <div style="white-space: pre-wrap; opacity: .85;">
                      {{ item.message }}
                    </div>

                    <NSpace>
                      <template v-if="isOrgInviteNotification(item)">
                        <NButton size="small" type="primary" @click.stop="acceptOrgInvite(item)">
                          接受
                        </NButton>
                        <NButton size="small" tertiary @click.stop="rejectOrgInvite(item)">
                          拒绝
                        </NButton>
                      </template>
                      <NButton v-if="resolveOpenUrl(item)" size="small" tertiary type="primary" @click.stop="openNotif(item)">
                        打开
                      </NButton>
                      <NButton v-if="!item.isReaded" size="small" tertiary @click.stop="markRead(item.id)">
                        标记已读
                      </NButton>
                    </NSpace>
                  </div>
                </NListItem>
              </NList>
            </NScrollbar>
          </NSpin>
        </NCard>
      </NPopover>
    </template>
    通知
  </NTooltip>
</template>
