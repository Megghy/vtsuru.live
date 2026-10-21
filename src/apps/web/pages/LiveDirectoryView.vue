<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { ACCOUNT, isLoggedIn } from '@/api/account'
import { getDirectory, type LiveDirectoryEntry } from '@/api/following'
import FollowButton from '@/components/common/FollowButton.vue'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Spin } from '@/shared/ui/spin'
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs'

const route = useRoute()
const tab = ref(route.query.tab === 'following' ? 'following' : 'live')
const search = ref('')
const entries = ref<LiveDirectoryEntry[]>([])
const loading = ref(false)
const error = ref('')
const revision = ref(0)
const now = ref(Date.now())
const freshStatus = (entry: LiveDirectoryEntry) => (now.value / 1000 - entry.updatedAt > 120 ? 'unknown' : entry.status)
const visible = computed(() =>
  entries.value.filter(
    (entry) =>
      (tab.value === 'following' || freshStatus(entry) === 'live') &&
      `${entry.name} ${entry.title} ${entry.area}`.toLowerCase().includes(search.value.toLowerCase()),
  ),
)
watch(
  [tab, () => ACCOUNT.value.id, revision],
  async (_, __, onCleanup) => {
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    loading.value = true
    error.value = ''
    try {
      entries.value = await getDirectory(tab.value !== 'live', tab.value !== 'following', controller.signal)
    } catch (cause) {
      if (controller.signal.aborted) return
      error.value = (cause as Error).message
      throw cause
    } finally {
      if (!controller.signal.aborted) loading.value = false
    }
  },
  { immediate: true },
)
watch(
  () => route.query.tab,
  (value) => {
    if (value === 'following' || value === 'following-live' || value === 'live') tab.value = String(value)
  },
)
watch(isLoggedIn, (loggedIn) => {
  if (!loggedIn) tab.value = 'live'
})
useIntervalFn(() => {
  now.value = Date.now()
}, 1000)
useIntervalFn(() => {
  if (!loading.value) revision.value++
}, 30_000)
function changed(entry: LiveDirectoryEntry, following: boolean) {
  entry.isFollowing = following
  if (!following && tab.value !== 'live') entries.value = entries.value.filter((item) => item.id !== entry.id)
}

function formatTime(sec: number) {
  try {
    const d = new Date(sec * 1000)
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ''
  }
}
</script>

<template>
  <main class="live-directory max-w-6xl mx-auto px-4 py-8 space-y-6">
    <header class="directory-header flex items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">正在直播</h1>
        <p class="text-sm text-muted-foreground mt-1">看看主播们在播什么，也可以在这里查看你的关注。</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        :disabled="loading"
        @click="revision++"
      >
        {{ loading ? '刷新中...' : '刷新' }}
      </Button>
    </header>

    <Tabs
      v-model="tab"
      class="w-full"
    >
      <TabsList class="grid w-full max-w-xs grid-cols-3">
        <TabsTrigger value="live">全部直播</TabsTrigger>
        <TabsTrigger v-if="isLoggedIn" value="following-live">关注的直播</TabsTrigger>
        <TabsTrigger v-if="isLoggedIn" value="following">全部关注</TabsTrigger>
      </TabsList>
    </Tabs>

    <div class="max-w-md">
      <Input
        v-model="search"
        placeholder="搜索主播、标题或分区..."
        class="h-9"
      />
    </div>

    <Alert
      v-if="error"
      variant="destructive"
    >
      <AlertDescription>{{ error }}</AlertDescription>
    </Alert>

    <div v-if="loading && !entries.length" class="py-20 flex justify-center">
      <Spin />
    </div>

    <template v-else>
      <Empty
        v-if="!visible.length"
        :description="tab === 'following' ? '还没有关注的主播，可从主播主页或公会页添加' : '暂无正在直播的主播'"
        class="py-16 text-xs"
      />

      <div class="directory-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <article
          v-for="entry in visible"
          :key="entry.id"
          class="streamer-card group flex flex-col rounded-xl border border-border/80 bg-card overflow-hidden shadow-xs hover:border-primary/40 hover:shadow-md transition"
        >
          <a
            v-if="entry.roomId"
            :href="`https://live.bilibili.com/${entry.roomId}`"
            target="_blank"
            rel="noopener noreferrer"
            class="streamer-cover relative aspect-video bg-muted/40 overflow-hidden block"
          >
            <img
              v-if="entry.cover"
              :src="entry.cover"
              alt=""
              loading="lazy"
              referrerpolicy="no-referrer"
              class="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
            <div class="absolute top-2 left-2">
              <Badge
                class="text-[10px] h-5 px-1.5 font-medium"
                :class="[
                  freshStatus(entry) === 'live'
                    ? 'bg-emerald-500 text-white hover:bg-emerald-500'
                    : 'bg-black/60 text-white/90 backdrop-blur-xs',
                ]"
              >
                {{
                  freshStatus(entry) === 'live' ? '直播中' : freshStatus(entry) === 'offline' ? '未开播' : '状态待更新'
                }}
              </Badge>
            </div>
          </a>
          <div class="streamer-body p-3.5 flex flex-col flex-1 gap-2">
            <h2 class="text-sm font-semibold line-clamp-1 group-hover:text-primary transition" :title="entry.title || entry.name">
              {{ entry.title || entry.name }}
            </h2>
            <div class="streamer-person flex items-center justify-between gap-2 mt-auto pt-1">
              <RouterLink
                :to="`/@${entry.id}`"
                class="flex items-center gap-2 min-w-0 hover:text-primary transition"
              >
                <Avatar class="size-7 shrink-0 border border-border/50">
                  <AvatarImage :src="entry.avatar" />
                  <AvatarFallback>{{ entry.name?.slice(0, 1) }}</AvatarFallback>
                </Avatar>
                <span class="text-xs font-medium truncate">{{ entry.name }}</span>
              </RouterLink>
              <FollowButton
                :user-id="entry.id"
                :following="entry.isFollowing"
                @changed="changed(entry, $event)"
              />
            </div>
            <p class="streamer-meta text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1 border-t border-border/50">
              <span class="truncate">{{ entry.area }}</span>
              <template v-if="entry.updatedAt">
                <span>·</span>
                <span class="font-mono">{{ formatTime(entry.updatedAt) }} 更新</span>
              </template>
              <template v-else>
                <span>·</span>
                <span>状态待更新</span>
              </template>
            </p>
          </div>
        </article>
      </div>
    </template>
  </main>
</template>
