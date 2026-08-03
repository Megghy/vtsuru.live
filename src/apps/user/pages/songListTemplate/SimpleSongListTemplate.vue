<script setup lang="ts">
import { CloudAdd20Filled, Play24Filled } from '@vicons/fluent'
import { useWindowSize } from '@vueuse/core'
import { throttle } from 'lodash'
import { computed, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { SongsInfo } from '@/api/api-models'
import { FunctionTypes } from '@/api/api-models'
import LiveRequestOBS from '@/apps/obs/pages/request/LiveRequestOBS.vue'
import SongPlayer from '@/components/SongPlayer.vue'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { GetGuardColor } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

import { filterSongs, getSongFieldValues } from './utils/songListData'
import { getSongRequestButtonType, getSongRequestTooltip } from './utils/songRequestUtils'
import { useLiveRequestStatus } from './utils/useLiveRequestStatus'

const props = defineProps<SongListConfigType>()
const emits = defineEmits(['requestSong'])
const windowSize = useWindowSize()
const container = ref()
const index = ref(20)

const accountInfo = useAccount()
const biliAuth = useBiliAuth()
const requestAuthState = computed(() => ({
  isLoggedIn: !!accountInfo.value.id,
  isBiliAuthed: biliAuth.isAuthed,
}))

const selectedTag = ref('')
const selectedSong = ref<SongsInfo>()
const searchKeyword = ref('')
const selectedAuthor = ref<string>()

const isLrcLoading = ref('')
const isLoading = ref('')

const { singing: singingSongKeySet, queued: queuedSongKeySet } = useLiveRequestStatus(() => props.liveRequestActive)

const tags = computed(() => {
  return getSongFieldValues(props.data, 'tags')
})
const authors = computed(() => {
  return getSongFieldValues(props.data, 'author')
})
const songs = computed(() => {
  return filterSongs(props.data, {
    keyword: searchKeyword.value,
    tag: selectedTag.value,
    author: selectedAuthor.value,
  }).slice(0, index.value)
})
const onScroll = throttle((e: Event) => {
  const scrollEl = e.target as HTMLDivElement
  if (scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 20) {
    loadMore()
  }
}, 100)
function loadMore() {
  if (props.data) {
    index.value += props.data.length > 20 + index.value ? 20 : props.data.length - index.value
  }
}
function handleRequestSong(song: SongsInfo) {
  isLoading.value = song.key
  emits('requestSong', song)
  window.setTimeout(() => {
    isLoading.value = ''
  }, 2000)
}
</script>

<template>
  <div
    :style="{
      display: 'flex',
      justifyContent: 'center',
      flexDirection: windowSize.width.value > 900 ? 'row' : 'column',
      gap: '10px',
      width: '100%',
    }"
  >
    <UCard
      class="user-page-card"
      size="small"
      :style="{ width: windowSize.width.value > 900 ? '400px' : '100%' }"
    >
      <Transition>
        <SongPlayer
          v-if="selectedSong"
          v-model:is-lrc-loading="isLrcLoading"
          :song="selectedSong"
        />
      </Transition>
      <USeparator> 标签 </USeparator>
      <div>
        <UButton
          v-for="tag in tags"
          :key="tag"
          size="sm"
          variant="soft"
          :color="selectedTag === tag ? 'primary' : 'neutral'"
          @click="selectedTag === tag ? (selectedTag = '') : (selectedTag = tag)"
        >
          {{ tag }}
        </UButton>
      </div>
      <USeparator> 搜索歌曲 </USeparator>
      <div vertical>
        <UInput
          v-model="searchKeyword"
          placeholder="歌名"
          clearable
        />
        <USelect
          v-model="selectedAuthor"
          :items="
            authors.map((a) => {
              return { label: a, value: a }
            })
          "
          placeholder="选择歌手"
          clearable
        />
        <USeparator />
        <LiveRequestOBS v-if="userInfo?.extra?.enableFunctions.includes(FunctionTypes.LiveRequest)" />
      </div>
    </UCard>
    <UEmpty
      v-if="!data || songs?.length === 0"
      description="暂无曲目"
      style="max-width: 0 auto"
      class="public-empty"
    />
    <div
      v-else
      ref="container"
      :style="{
        flexGrow: 1,
        height: windowSize.width.value > 900 ? '90vh' : '800px',
        overflowY: 'auto',
        overflowX: 'hidden',
      }"
      @scroll="onScroll"
    >
      <div
        cols="1 600:2 900:3 1200:4"
        x-gap="10"
        y-gap="10"
        responsive="self"
      >
        <div
          v-for="item in songs"
          :key="item.key"
        >
          <UCard
            class="user-page-card"
            size="small"
            style="height: 200px; min-width: 300px"
          >
            <template #header>
              <div
                :wrap="false"
                align="center"
              >
                <div
                  :style="`border-radius: 4px; background-color: ${singingSongKeySet.has(item.key) ? '#f0a040' : item.options ? '#bd5757' : '#577fb8'}; width: 7px; height: 20px`"
                />
                <span>
                  {{ item.name }}
                </span>
                <span
                  v-if="singingSongKeySet.has(item.key)"
                  style="flex-shrink: 0; font-size: 11px; color: #f0a040; font-weight: 600"
                >
                  正在演唱
                </span>
                <span
                  v-else-if="queuedSongKeySet.has(item.key)"
                  style="flex-shrink: 0; font-size: 11px; color: #52c41a; font-weight: 600"
                >
                  排队中
                </span>
              </div>
            </template>
            <div vertical>
              <span
                v-if="item.translateName"
                depth="3"
                style="font-size: 13px; margin-bottom: 2px"
              >
                <span>
                  {{ item.translateName }}
                </span>
              </span>
              <div
                v-if="(item.author?.length ?? 0) > 0"
                :size="0"
              >
                <div
                  v-for="(author, authorIndex) in item.author"
                  :key="author"
                >
                  <UButton
                    size="sm"
                    variant="link"
                    @click="selectedAuthor === author ? (selectedAuthor = undefined) : (selectedAuthor = author)"
                  >
                    <span
                      depth="3"
                      :style="{ color: selectedAuthor === author ? '#82bcd3' : '' }"
                    >
                      {{ author }}
                    </span>
                    <USeparator
                      v-if="authorIndex < (item.author?.length ?? 0) - 1"
                      vertical
                    />
                  </UButton>
                </div>
              </div>
            </div>
            <div class="song-card-meta">
              <div vertical>
                <span>
                  {{ item.description }}
                </span>
                <template v-if="item.options">
                  <div>
                    <UBadge
                      v-if="item.options?.scMinPrice"
                      size="sm"
                      color="error"
                      :bordered="false"
                    >
                      SC | {{ item.options?.scMinPrice }}
                    </UBadge>
                    <UBadge
                      v-if="item.options?.fanMedalMinLevel"
                      size="sm"
                      color="info"
                      :bordered="false"
                    >
                      粉丝牌 | {{ item.options?.fanMedalMinLevel }}
                    </UBadge>
                    <UBadge
                      v-if="item.options?.needZongdu"
                      size="sm"
                      :style="{ backgroundColor: GetGuardColor(1), color: '#fff' }"
                    >
                      总督
                    </UBadge>
                    <UBadge
                      v-if="item.options?.needTidu"
                      size="sm"
                      :style="{ backgroundColor: GetGuardColor(2), color: '#fff' }"
                    >
                      提督
                    </UBadge>
                    <UBadge
                      v-if="item.options?.needJianzhang"
                      size="sm"
                      :style="{ backgroundColor: GetGuardColor(3), color: '#fff' }"
                    >
                      舰长
                    </UBadge>
                  </div>
                </template>
              </div>
            </div>
            <template #footer>
              <div
                align="center"
                :wrap="false"
              >
                <UTooltip v-if="item.url">
                  <UButton
                    size="sm"
                    color="success"
                    :loading="isLrcLoading === item.key"
                    @click="selectedSong = item"
                  >
                    <template #leading>
                      <component :is="Play24Filled" />
                    </template>
                  </UButton>
                  <template #content> 试听 </template></UTooltip
                >
                <UTooltip>
                  <UButton
                    size="sm"
                    :color="getSongRequestButtonType(item, liveRequestSettings, requestAuthState)"
                    :loading="isLoading === item.key"
                    @click="() => handleRequestSong(item)"
                  >
                    <template #leading>
                      <component :is="CloudAdd20Filled" />
                    </template>
                  </UButton>

                  <template #content>{{ getSongRequestTooltip(item, liveRequestSettings, requestAuthState) }}</template>
                </UTooltip>

                <UPopover
                  v-if="(item.tags?.length ?? 0) > 3"
                  trigger="hover"
                >
                  <UButton
                    size="sm"
                    variant="soft"
                    :color="item.tags?.includes(selectedTag) ? 'primary' : 'neutral'"
                  >
                    标签
                  </UButton>
                  <template #content>
                    <div :wrap="false">
                      <UButton
                        v-for="tag in item.tags"
                        :key="tag"
                        size="xs"
                        :color="selectedTag === tag ? 'primary' : 'neutral'"
                        @click="() => (selectedTag === tag ? (selectedTag = '') : (selectedTag = tag))"
                      >
                        <span style="max-width: 50px">
                          {{ tag }}
                        </span>
                      </UButton>
                    </div>
                  </template>
                </UPopover>
                <div
                  v-else
                  :wrap="false"
                >
                  <UButton
                    v-for="tag in item.tags"
                    :key="tag"
                    size="xs"
                    :color="selectedTag === tag ? 'primary' : 'neutral'"
                    @click="() => (selectedTag === tag ? (selectedTag = '') : (selectedTag = tag))"
                  >
                    <span style="max-width: 50px">
                      {{ tag }}
                    </span>
                  </UButton>
                </div>
              </div>
            </template>
          </UCard>
        </div>
      </div>
      <USeparator />
      <div justify="center">
        <UButton
          v-if="data.length > index"
          @click="loadMore"
        >
          加载更多
        </UButton>
      </div>
    </div>
  </div>
</template>
