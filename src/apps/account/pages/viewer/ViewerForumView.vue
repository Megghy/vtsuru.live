<script setup lang="ts">
import { format } from 'date-fns'
import { ExternalLink, FileText, Heart, Lock, MessageSquare, Pin, RefreshCw } from 'lucide-vue-next'
import { onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import { fetchMyForumActivity, type MyForumActivityItem } from '@/api/viewer-records'
import AccountPageHeader from '@/apps/account/components/AccountPageHeader.vue'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Pagination } from '@/shared/ui/pagination'
import { Skeleton } from '@/shared/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { toast } from '@/shared/utils'
import { buildBiliAuthRoute } from '@/shared/utils/authRedirect'

const route = useRoute()
const router = useRouter()
const account = useAccount()

const activeType = ref<'topics' | 'comments'>(route.query.type === 'comments' ? 'comments' : 'topics')
const isLoading = ref(false)
const items = ref<MyForumActivityItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20

function formatTime(ts: number) {
  const value = ts < 1e12 ? ts * 1000 : ts
  return format(value, 'yyyy-MM-dd HH:mm')
}

async function loadActivity() {
  if (!account.value.id) return
  isLoading.value = true
  try {
    const resp = await fetchMyForumActivity({
      type: activeType.value,
      pageNum: page.value - 1,
      pageSize,
    })
    if (resp.code !== 200) throw new Error(resp.message || '加载失败')
    items.value = resp.data ?? []
    total.value = resp.total ?? 0
  } catch (err) {
    toast.error(`获取讨论区记录失败：${err instanceof Error ? err.message : String(err)}`)
  } finally {
    isLoading.value = false
  }
}

watch(activeType, (next) => {
  page.value = 1
  void router.replace({ query: { ...route.query, type: next } })
  void loadActivity()
})

onMounted(() => {
  void loadActivity()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <AccountPageHeader
      title="我的讨论区"
      subtitle="查看你在各主播粉丝讨论区发布过的主题帖、评论与回复。"
    >
      <template #actions>
        <Button
          v-if="account.id"
          variant="outline"
          :disabled="isLoading"
          class="gap-1.5"
          @click="loadActivity"
        >
          <RefreshCw
            class="size-3.5"
            :class="{ 'animate-spin': isLoading }"
          />
          刷新
        </Button>
      </template>
    </AccountPageHeader>

    <Card
      v-if="!account.id"
      class="p-6 text-center space-y-3"
    >
      <div class="text-sm font-semibold text-foreground">需要站内账号查看讨论区记录</div>
      <p class="text-xs text-muted-foreground m-0">
        当前使用的是旧版快捷会话，发一条 B 站认证弹幕即可一键升级为站内账号。
      </p>
      <div>
        <Button @click="router.push(buildBiliAuthRoute(route.fullPath))">B 站弹幕一键升级</Button>
      </div>
    </Card>

    <template v-else>
      <Tabs v-model="activeType">
        <TabsList class="grid w-full sm:w-72 grid-cols-2">
          <TabsTrigger
            value="topics"
            class="gap-1.5"
          >
            <FileText class="size-3.5" />
            我的发帖
          </TabsTrigger>
          <TabsTrigger
            value="comments"
            class="gap-1.5"
          >
            <MessageSquare class="size-3.5" />
            评论与回复
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div
        v-if="isLoading && items.length === 0"
        class="space-y-2.5"
      >
        <Skeleton
          v-for="i in 4"
          :key="i"
          class="h-24 rounded-lg"
        />
      </div>

      <Empty
        v-else-if="items.length === 0"
        :description="activeType === 'topics' ? '还没有发布过主题帖' : '还没有发表过评论或回复'"
        class="py-12 rounded-lg border border-dashed border-border"
      />

      <div
        v-else
        class="space-y-2.5"
      >
        <Card
          v-for="item in items"
          :key="`${item.kind}-${item.id}`"
          class="p-3.5 space-y-2 hover:border-primary/30 transition-colors"
        >
          <div class="flex-between gap-2 flex-wrap">
            <div class="flex items-center gap-2 min-w-0">
              <Avatar class="size-5 shrink-0">
                <AvatarImage :src="item.forumOwner.faceUrl || ''" />
                <AvatarFallback class="text-[10px]">{{ item.forumOwner.name?.slice(0, 1) || '区' }}</AvatarFallback>
              </Avatar>
              <span class="text-xs text-muted-foreground truncate">{{ item.forumName }}</span>
              <Badge
                v-if="item.kind !== 'topic'"
                variant="outline"
                size="xs"
              >
                {{ item.kind === 'comment' ? '评论' : '回复' }}
              </Badge>
              <Badge
                v-if="item.isPinned"
                variant="secondary"
                size="xs"
                class="gap-0.5"
              >
                <Pin class="size-2.5" />
                置顶
              </Badge>
              <Badge
                v-if="item.isLocked"
                variant="outline"
                size="xs"
                class="gap-0.5"
              >
                <Lock class="size-2.5" />
                已锁定
              </Badge>
            </div>

            <span class="text-xs text-muted-foreground font-mono tabular-nums shrink-0">
              {{ formatTime(item.createAt) }}
            </span>
          </div>

          <div class="space-y-1">
            <h3 class="text-sm font-semibold text-foreground m-0 line-clamp-1">
              {{ item.topicTitle }}
            </h3>
            <p
              v-if="item.contentPreview"
              class="text-xs text-muted-foreground m-0 line-clamp-2 leading-relaxed"
            >
              {{ item.contentPreview }}
            </p>
          </div>

          <div class="flex-between gap-2 pt-1 border-t border-border/50 text-xs text-muted-foreground">
            <div class="flex items-center gap-3">
              <span class="flex items-center gap-1 font-mono tabular-nums">
                <Heart class="size-3" />
                {{ item.likeCount }}
              </span>
              <span
                v-if="item.kind === 'topic'"
                class="flex items-center gap-1 font-mono tabular-nums"
              >
                <MessageSquare class="size-3" />
                {{ item.commentCount }}
              </span>
            </div>

            <Button
              size="xs"
              variant="ghost"
              class="gap-1"
              @click="
                router.push({
                  name: 'user-forum-topic-detail',
                  params: { id: item.forumOwner.name || item.forumOwner.id, topicId: String(item.topicId) },
                })
              "
            >
              查看原帖
              <ExternalLink class="size-3" />
            </Button>
          </div>
        </Card>

        <div
          v-if="total > pageSize"
          class="flex justify-center pt-2"
        >
          <Pagination
            v-model:page="page"
            :total="total"
            :page-size="pageSize"
            @update:page="loadActivity"
          />
        </div>
      </div>
    </template>
  </div>
</template>
