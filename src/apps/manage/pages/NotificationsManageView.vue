<script setup lang="ts">
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NEmpty,
  NFlex,
  NList,
  NListItem,
  NPagination,
  NSpace,
  NSpin,
  NTag,
  NTime,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { QueryPostAPIWithParams } from '@/api/query'
import { ORG_API_URL } from '@/shared/config'
import { getOrgInviteToken, getOrgInviteType, isOrgInviteNotification } from '@/shared/services/notifications/orgInvite'
import { useNotificationStore } from '@/store/useNotificationStore'

const router = useRouter()
const message = useMessage()
const notificationStore = useNotificationStore()

const loading = ref(false)

const onlyUnread = ref(false)
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)

const list = computed(() => notificationStore.latest)

function resolveOpenUrl(item: any): string | undefined {
  const url = item?.extra?.openUrl
  if (typeof url !== 'string') return undefined
  return url
}

async function acceptOrgInvite(item: any) {
  try {
    const type = getOrgInviteType(item)
    const token = getOrgInviteToken(item)
    const url = type === 'member'
      ? `${ORG_API_URL}invite/member/accept`
      : `${ORG_API_URL}invite/streamer/accept`

    const resp = await QueryPostAPIWithParams<{ orgId: number, orgName: string }>(
      url,
      { token },
      undefined,
    )

    if (resp.code !== 200) {
      message.error(resp.message)
      return
    }

    await notificationStore.markRead([item.id])
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

    if (type === 'member') {
      const resp = await QueryPostAPIWithParams<{ orgId: number, orgName: string }>(
        `${ORG_API_URL}invite/member/reject`,
        { token },
        undefined,
      )
      if (resp.code !== 200) {
        message.error(resp.message)
        return
      }
      await notificationStore.markRead([item.id])
      message.success(`已拒绝加入：${resp.data.orgName}`)
      router.push({ name: 'org-detail', params: { orgId: resp.data.orgId } })
      return
    }

    const resp = await QueryPostAPIWithParams<{ orgId: number, orgName: string }>(
      `${ORG_API_URL}invite/streamer/reject`,
      { token },
      undefined,
    )
    if (resp.code !== 200) {
      message.error(resp.message)
      return
    }

    await notificationStore.markRead([item.id])
    message.success(`已拒绝授权：${resp.data.orgName}`)
    router.push({ name: 'org-detail', params: { orgId: resp.data.orgId } })
  } catch (err) {
    message.error(err instanceof Error ? err.message : '操作失败')
  }
}

async function markNotifRead(id: string) {
  try {
    await notificationStore.markRead([id])
  } catch (err) {
    message.error(err instanceof Error ? err.message : '操作失败')
  }
}

async function markAllNotifsRead() {
  try {
    const ids = notificationStore.unread.map(n => n.id)
    if (!ids.length) return
    await notificationStore.markRead(ids)
  } catch (err) {
    message.error(err instanceof Error ? err.message : '操作失败')
  }
}

async function openNotif(item: any) {
  try {
    const url = resolveOpenUrl(item)
    if (!url) return

    if (!item.isReaded) {
      await notificationStore.markRead([item.id])
    }

    await router.push(url)
  } catch (err) {
    message.error(err instanceof Error ? err.message : '打开失败')
  }
}

async function refresh() {
  loading.value = true
  try {
    await notificationStore.refreshUnread()
    const resp = await notificationStore.refreshLatest(page.value - 1, pageSize.value, onlyUnread.value)
    total.value = resp.total
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载通知失败')
  } finally {
    loading.value = false
  }
}

watch([onlyUnread, pageSize], async () => {
  page.value = 1
  await refresh()
})

watch(page, async () => {
  await refresh()
})

onMounted(async () => {
  await refresh()
})
</script>

<template>
  <ManagePageHeader title="通知中心">
    <template #action>
      <NSpace>
        <NCheckbox v-model:checked="onlyUnread">
          仅未读
        </NCheckbox>
        <NButton secondary :disabled="notificationStore.unreadCount === 0" @click="markAllNotifsRead">
          全部已读
        </NButton>
        <NButton :loading="loading" @click="refresh">
          刷新
        </NButton>
      </NSpace>
    </template>
  </ManagePageHeader>

  <NSpin :show="loading">
    <template v-if="list.length === 0">
      <NEmpty description="暂无通知" />
    </template>

    <template v-else>
      <NList>
        <NListItem v-for="item in list" :key="item.id">
          <NCard size="small" :bordered="false" style="width: 100%;">
            <NFlex vertical :size="8">
              <NFlex justify="space-between" align="center" :gap="12">
                <div style="font-weight: 600;">
                  <NTag v-if="!item.isReaded" size="small" type="info" :bordered="false">
                    未读
                  </NTag>
                  {{ item.title }}
                </div>
                <NTime :time="item.createTime" format="yyyy-MM-dd HH:mm" />
              </NFlex>

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

                <NButton v-if="!item.isReaded" size="small" tertiary @click.stop="markNotifRead(item.id)">
                  标记已读
                </NButton>
              </NSpace>
            </NFlex>
          </NCard>
        </NListItem>
      </NList>

      <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
        <NPagination
          v-model:page="page"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :item-count="total"
          show-size-picker
        />
      </div>

      <NAlert type="info" :bordered="false" style="margin-top: 12px;">
        当前未读：{{ notificationStore.unreadCount }}
      </NAlert>
    </template>
  </NSpin>
</template>
