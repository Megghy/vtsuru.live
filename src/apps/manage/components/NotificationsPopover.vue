<script setup lang="ts">
import { NotificationsOutline } from '@vicons/ionicons5'
import { format } from 'date-fns'
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import {
  postApiOrgInviteMemberAccept,
  postApiOrgInviteMemberReject,
  postApiOrgInviteStreamerAccept,
  postApiOrgInviteStreamerReject,
} from '@/api/generated/org/org'
import { getOrgInviteToken, getOrgInviteType, isOrgInviteNotification } from '@/shared/services/notifications/orgInvite'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { useMessage } from '@/shared/utils'
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

function formatNotificationTime(time: unknown): string {
  if (!time) return ''
  const t = typeof time === 'number' && time < 1e11 ? time * 1000 : time
  try {
    return format(new Date(t as string | number | Date), 'yyyy-MM-dd HH:mm')
  } catch {
    return ''
  }
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
    const ids = notificationStore.unread.map((n) => n.id)
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
    const resp = (await (type === 'member'
      ? postApiOrgInviteMemberAccept({ token })
      : postApiOrgInviteStreamerAccept({ token }))) as unknown as {
      code: number
      message?: string
      data: { orgId: number; orgName: string }
    }
    if (resp.code !== 200) {
      message.error(resp.message)
      return
    }

    await notificationStore.markRead([item.id])
    popoverOpen.value = false
    message.success(`已处理邀请：${resp.data.orgName}`)
    if (type === 'member') router.push({ name: 'org-detail', params: { orgId: resp.data.orgId } })
  } catch (err) {
    message.error(err instanceof Error ? err.message : '操作失败')
  }
}

async function rejectOrgInvite(item: any) {
  try {
    const type = getOrgInviteType(item)
    const token = getOrgInviteToken(item)
    const resp = (await (type === 'member'
      ? postApiOrgInviteMemberReject({ token })
      : postApiOrgInviteStreamerReject({ token }))) as unknown as {
      code: number
      message?: string
      data: { orgId: number; orgName: string }
    }
    if (resp.code !== 200) {
      message.error(resp.message)
      return
    }

    await notificationStore.markRead([item.id])
    popoverOpen.value = false
    message.success(type === 'member' ? `已拒绝加入：${resp.data.orgName}` : `已拒绝授权：${resp.data.orgName}`)
    if (type === 'member') router.push({ name: 'org-detail', params: { orgId: resp.data.orgId } })
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

watch(
  () => accountInfo.value?.id,
  (id) => {
    if (!id) return
    void notificationStore.refreshUnread()
  },
  { immediate: true },
)
</script>

<template>
  <Popover
    :open="popoverOpen"
    @update:open="onPopoverUpdate"
  >
    <PopoverTrigger as-child>
      <button
        class="relative h-8 w-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        type="button"
        title="通知中心"
      >
        <component
          :is="NotificationsOutline"
          class="h-4 w-4"
        />
        <span
          v-if="notificationStore.unreadCount > 0"
          class="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-brand text-brand-foreground text-[10px] font-mono font-bold flex items-center justify-center leading-none"
        >
          {{ notificationStore.unreadCount > 99 ? '99+' : notificationStore.unreadCount }}
        </span>
      </button>
    </PopoverTrigger>

    <PopoverContent
      align="end"
      :side-offset="8"
      class="w-96 p-0 shadow-2xl border border-border bg-popover/95 backdrop-blur-md rounded-lg overflow-hidden"
    >
      <div class="flex items-center justify-between p-3 border-b border-border bg-muted/20">
        <div class="flex items-center gap-1.5 font-semibold text-xs text-foreground">
          <span>通知</span>
          <Badge
            v-if="notificationStore.unreadCount > 0"
            variant="secondary"
            class="text-[10px] px-1.5 py-0 h-4"
          >
            {{ notificationStore.unreadCount }} 未读
          </Badge>
        </div>
        <Button
          size="xs"
          variant="ghost"
          class="h-6 text-[11px] text-muted-foreground hover:text-foreground"
          :disabled="notificationStore.unreadCount === 0"
          @click.stop="markAllRead"
        >
          全部已读
        </Button>
      </div>

      <div
        v-if="loading"
        class="p-8 text-center text-xs text-muted-foreground"
      >
        加载中...
      </div>

      <div
        v-else-if="notificationStore.latest.length === 0"
        class="p-8 text-center text-xs text-muted-foreground"
      >
        暂无通知
      </div>

      <ScrollArea class="max-h-[380px]">
        <div class="divide-y divide-border">
          <div
            v-for="item in notificationStore.latest"
            :key="item.id"
            class="p-3 space-y-1.5 hover:bg-muted/40 transition-colors text-xs"
            :class="{ 'bg-brand/5': !item.isReaded }"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5 font-semibold text-foreground truncate min-w-0">
                <span
                  v-if="!item.isReaded"
                  class="w-1.5 h-1.5 rounded-full bg-brand shrink-0"
                />
                <span class="truncate">{{ item.title }}</span>
              </div>
              <span class="text-[10px] text-muted-foreground font-mono shrink-0">
                {{ formatNotificationTime(item.createTime) }}
              </span>
            </div>

            <div class="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {{ item.message }}
            </div>

            <div class="flex items-center gap-1.5 pt-1 justify-end flex-wrap">
              <template v-if="isOrgInviteNotification(item)">
                <Button
                  size="xs"
                  variant="brand"
                  class="h-6 px-2 text-[11px]"
                  @click.stop="acceptOrgInvite(item)"
                >
                  接受
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  class="h-6 px-2 text-[11px]"
                  @click.stop="rejectOrgInvite(item)"
                >
                  拒绝
                </Button>
              </template>
              <Button
                v-if="resolveOpenUrl(item)"
                size="xs"
                variant="brand"
                class="h-6 px-2 text-[11px]"
                @click.stop="openNotif(item)"
              >
                打开
              </Button>
              <Button
                v-if="!item.isReaded"
                size="xs"
                variant="ghost"
                class="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                @click.stop="markRead(item.id)"
              >
                标为已读
              </Button>
            </div>
          </div>
        </div>
      </ScrollArea>
    </PopoverContent>
  </Popover>
</template>
