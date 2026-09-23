<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { NAlert, NAvatar, NButton, NEmpty, NInput, NSpin, NTabPane, NTabs, NTag, NTime } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { ACCOUNT, isLoggedIn } from '@/api/account'
import { getDirectory, type LiveDirectoryEntry } from '@/api/following'
import FollowButton from '@/components/common/FollowButton.vue'

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
    if (value === 'following' || value === 'following-live' || value === 'live') tab.value = value
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
</script>

<template>
  <main class="live-directory">
    <header class="directory-header">
      <div>
        <h1>正在直播</h1>
        <p>看看主播们在播什么，也可以在这里查看你的关注。</p>
      </div>
      <NButton
        :loading="loading"
        @click="revision++"
        >刷新</NButton
      >
    </header>
    <NTabs
      v-model:value="tab"
      type="line"
      animated
    >
      <NTabPane
        name="live"
        tab="全部直播"
      />
      <NTabPane
        v-if="isLoggedIn"
        name="following-live"
        tab="关注的直播"
      />
      <NTabPane
        v-if="isLoggedIn"
        name="following"
        tab="全部关注"
      />
    </NTabs>
    <NInput
      v-model:value="search"
      clearable
      placeholder="搜索主播、标题或分区"
      class="directory-search"
    />
    <NAlert
      v-if="error"
      type="error"
      style="margin: 16px 0"
      >{{ error }}</NAlert
    >
    <NSpin :show="loading">
      <NEmpty
        v-if="!visible.length && !loading"
        :description="tab === 'following' ? '还没有关注的主播，可从主播主页或公会页添加' : '暂无正在直播的主播'"
        style="padding: 64px 0"
      />
      <div class="directory-grid">
        <article
          v-for="entry in visible"
          :key="entry.id"
          class="streamer-card"
        >
          <a
            v-if="entry.roomId"
            :href="`https://live.bilibili.com/${entry.roomId}`"
            target="_blank"
            rel="noopener noreferrer"
            class="streamer-cover"
          >
            <img
              v-if="entry.cover"
              :src="entry.cover"
              alt=""
              loading="lazy"
              referrerpolicy="no-referrer"
            />
            <NTag
              class="streamer-status"
              size="small"
              :type="freshStatus(entry) === 'live' ? 'success' : 'default'"
            >
              {{
                freshStatus(entry) === 'live' ? '直播中' : freshStatus(entry) === 'offline' ? '未开播' : '状态待更新'
              }}
            </NTag>
          </a>
          <div class="streamer-body">
            <h2>{{ entry.title || entry.name }}</h2>
            <div class="streamer-person">
              <RouterLink :to="`/@${entry.id}`"
                ><NAvatar
                  round
                  :size="28"
                  :src="entry.avatar"
                />
                <span>{{ entry.name }}</span></RouterLink
              >
              <FollowButton
                :user-id="entry.id"
                :following="entry.isFollowing"
                @changed="changed(entry, $event)"
              />
            </div>
            <p class="streamer-meta">
              {{ entry.area
              }}<template v-if="entry.updatedAt">
                ·
                <NTime
                  :time="entry.updatedAt * 1000"
                  format="HH:mm:ss"
                />
                更新</template
              ><template v-else>状态待更新</template>
            </p>
          </div>
        </article>
      </div>
    </NSpin>
  </main>
</template>

<style scoped>
.live-directory {
  max-width: 1120px;
  margin: auto;
  padding: 32px 20px;
  color: var(--vtsuru-fg);
}
.directory-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
h1 {
  font-size: 26px;
  margin: 0 0 8px;
}
.directory-header p,
.streamer-meta {
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
}
.directory-search {
  max-width: 360px;
  margin: 8px 0 24px;
}
.directory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 290px), 1fr));
  gap: 18px;
}
.streamer-card {
  border: 1px solid var(--vtsuru-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--vtsuru-bg-elevated);
}
.streamer-cover {
  display: block;
  position: relative;
  aspect-ratio: 16 / 9;
  background: var(--vtsuru-bg-muted);
}
.streamer-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.streamer-status {
  position: absolute;
  bottom: 10px;
  left: 12px;
}
.streamer-body {
  padding: 16px;
}
h2 {
  margin: 0 0 14px;
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.streamer-person {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.streamer-person a {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}
.streamer-person span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.streamer-meta {
  margin: 12px 0 0;
}
</style>
