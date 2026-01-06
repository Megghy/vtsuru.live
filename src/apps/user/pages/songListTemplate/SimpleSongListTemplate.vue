<script setup lang="ts">
import type { SongsInfo } from '@/api/api-models'
import type { SongListConfigType } from '@/shared/types/TemplateTypes'
import { CloudAdd20Filled, Play24Filled } from '@vicons/fluent'
import { useWindowSize } from '@vueuse/core'
import { throttle } from 'lodash'
import {
  NButton,
  NCard,
  NCollapseTransition,
  NDivider,
  NEllipsis,
  NEmpty,
  NGrid,
  NGridItem,
  NIcon,
  NInput,
  NPopover,
  NScrollbar,
  NSelect,
  NSpace,
  NTag,
  NText,
  NTooltip,
} from 'naive-ui'
import { computed, ref } from 'vue'
import { useAccount } from '@/api/account'
import { FunctionTypes } from '@/api/api-models'
import SongPlayer from '@/components/SongPlayer.vue'
import { useBiliAuth } from '@/store/useBiliAuth'
import { GetGuardColor } from '@/shared/utils'
import LiveRequestOBS from '@/apps/obs/pages/request/LiveRequestOBS.vue'
import { getSongRequestButtonType, getSongRequestTooltip } from './utils/songRequestUtils'

const props = defineProps<SongListConfigType>()
const emits = defineEmits(['requestSong'])
const windowSize = useWindowSize()
const container = ref()
const index = ref(20)

const accountInfo = useAccount()
const biliAuth = useBiliAuth()

const selectedTag = ref('')
const selectedSong = ref<SongsInfo>()
const searchKeyword = ref('')
const selectedAuthor = ref<string>()

const isLrcLoading = ref('')
const isLoading = ref('')

const tags = computed(() => {
  if (props.data) {
    return [
      ...new Set(
        props.data
          .map((item) => {
            return item.tags ?? []
          })
          .reduce((prev, curr) => [...prev, ...curr], []),
      ),
    ]
  }
  return []
})
const authors = computed(() => {
  if (props.data) {
    return [
      ...new Set(
        props.data
          .map((item) => {
            return item.author ?? []
          })
          .reduce((prev, curr) => [...prev, ...curr], []),
      ),
    ]
  }
  return []
})
const songs = computed(() => {
  if (props.data) {
    return props.data
      .filter((item) => {
        return (
          (!selectedTag.value || item.tags?.includes(selectedTag.value))
          && (!searchKeyword.value || item.name.toLowerCase().includes(searchKeyword.value.toLowerCase()))
          && (!selectedAuthor.value || item.author?.includes(selectedAuthor.value) == true)
        )
      })
      .slice(0, index.value)
  }
  return []
})
const onScroll = throttle((e: Event) => {
  const container = e.target as HTMLDivElement
  if (container.scrollTop + container.clientHeight >= container.scrollHeight - 20) {
    loadMore()
  }
}, 100)
function loadMore() {
  if (props.data) {
    index.value += props.data.length > 20 + index.value ? 20 : props.data.length - index.value
  }
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
    <NCard
      size="small"
      :style="{ width: windowSize.width.value > 900 ? '400px' : '100%' }"
    >
      <NCollapseTransition>
        <SongPlayer
          v-if="selectedSong"
          v-model:is-lrc-loading="isLrcLoading"
          :song="selectedSong"
        />
      </NCollapseTransition>
      <NDivider> 标签 </NDivider>
      <NSpace>
        <NButton
          v-for="tag in tags"
          :key="tag"
          size="small"
          secondary
          :type="selectedTag === tag ? 'primary' : 'default'"
          @click="selectedTag === tag ? (selectedTag = '') : (selectedTag = tag)"
        >
          {{ tag }}
        </NButton>
      </NSpace>
      <NDivider> 搜索歌曲 </NDivider>
      <NSpace vertical>
        <NInput
          v-model:value="searchKeyword"
          placeholder="歌名"
          clearable
        />
        <NSelect
          v-model:value="selectedAuthor"
          :options="authors.map((a) => {
            return { label: a, value: a }
          })
          "
          placeholder="选择歌手"
          clearable
        />
        <NDivider />
        <LiveRequestOBS v-if="userInfo?.extra?.enableFunctions.includes(FunctionTypes.LiveRequest)" />
      </NSpace>
    </NCard>
    <NEmpty
      v-if="!data || songs?.length === 0"
      description="暂无曲目"
      style="max-width: 0 auto"
    />
    <NScrollbar
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
      <NGrid
        cols="1 600:2 900:3 1200:4"
        x-gap="10"
        y-gap="10"
        responsive="self"
      >
        <NGridItem
          v-for="item in songs"
          :key="item.key"
        >
          <NCard
            size="small"
            style="height: 200px; min-width: 300px"
          >
            <template #header>
              <NSpace
                :wrap="false"
                align="center"
              >
                <div
                  :style="`border-radius: 4px; background-color: ${item.options ? '#bd5757' : '#577fb8'}; width: 7px; height: 20px`"
                />
                <NEllipsis>
                  {{ item.name }}
                </NEllipsis>
              </NSpace>
            </template>
            <NSpace vertical>
              <NSpace
                v-if="(item.author?.length ?? 0) > 0"
                :size="0"
              >
                <div
                  v-for="(author, authorIndex) in item.author"
                  :key="author"
                >
                  <NButton
                    size="small"
                    text
                    @click="selectedAuthor === author ? (selectedAuthor = undefined) : (selectedAuthor = author)"
                  >
                    <NText
                      depth="3"
                      :style="{ color: selectedAuthor === author ? '#82bcd3' : '' }"
                    >
                      {{ author }}
                    </NText>
                    <NDivider
                      v-if="authorIndex < (item.author?.length ?? 0) - 1"
                      vertical
                    />
                  </NButton>
                </div>
              </NSpace>
            </NSpace>
            <template #footer>
              <NSpace vertical>
                <NEllipsis>
                  {{ item.description }}
                </NEllipsis>
                <template v-if="item.options">
                  <NSpace>
                    <NTag
                      v-if="item.options?.scMinPrice"
                      size="small"
                      type="error"
                      :bordered="false"
                    >
                      SC | {{ item.options?.scMinPrice }}
                    </NTag>
                    <NTag
                      v-if="item.options?.fanMedalMinLevel"
                      size="small"
                      type="info"
                      :bordered="false"
                    >
                      粉丝牌 | {{ item.options?.fanMedalMinLevel }}
                    </NTag>
                    <NTag
                      v-if="item.options?.needZongdu"
                      size="small"
                      :color="{ color: GetGuardColor(1) }"
                    >
                      总督
                    </NTag>
                    <NTag
                      v-if="item.options?.needTidu"
                      size="small"
                      :color="{ color: GetGuardColor(2) }"
                    >
                      提督
                    </NTag>
                    <NTag
                      v-if="item.options?.needJianzhang"
                      size="small"
                      :color="{ color: GetGuardColor(3) }"
                    >
                      舰长
                    </NTag>
                  </NSpace>
                </template>
              </NSpace>
            </template>
            <template #action>
              <NSpace
                align="center"
                :wrap="false"
              >
                <NTooltip v-if="item.url">
                  <template #trigger>
                    <NButton
                      size="small"
                      type="success"
                      :loading="isLrcLoading === item.key"
                      @click="selectedSong = item"
                    >
                      <template #icon>
                        <NIcon :component="Play24Filled" />
                      </template>
                    </NButton>
                  </template>
                  试听
                </NTooltip>
                <NTooltip>
                  <template #trigger>
                    <NButton
                      size="small"
                      :type="getSongRequestButtonType(item, liveRequestSettings, !!accountInfo, biliAuth.isAuthed)"
                      :loading="isLoading === item.key"
                      @click="() => {
                        isLoading = item.key
                        emits('requestSong', item)
                        isLoading = ''
                      }
                      "
                    >
                      <template #icon>
                        <NIcon :component="CloudAdd20Filled" />
                      </template>
                    </NButton>
                  </template>
                  {{ getSongRequestTooltip(item, liveRequestSettings) }}
                </NTooltip>

                <NPopover
                  v-if="(item.tags?.length ?? 0) > 3"
                  trigger="hover"
                >
                  <template #trigger>
                    <NButton
                      size="small"
                      secondary
                      :type="item.tags?.includes(selectedTag) ? 'primary' : 'default'"
                    >
                      标签
                    </NButton>
                  </template>
                  <NSpace :wrap="false">
                    <NButton
                      v-for="tag in item.tags"
                      :key="tag"
                      size="tiny"
                      :type="selectedTag === tag ? 'primary' : 'default'"
                      @click="() => (selectedTag === tag ? (selectedTag = '') : (selectedTag = tag))"
                    >
                      <NEllipsis style="max-width: 50px">
                        {{ tag }}
                      </NEllipsis>
                    </NButton>
                  </NSpace>
                </NPopover>
                <NSpace
                  v-else
                  :wrap="false"
                >
                  <NButton
                    v-for="tag in item.tags"
                    :key="tag"
                    size="tiny"
                    :type="selectedTag === tag ? 'primary' : 'default'"
                    @click="() => (selectedTag === tag ? (selectedTag = '') : (selectedTag = tag))"
                  >
                    <NEllipsis style="max-width: 50px">
                      {{ tag }}
                    </NEllipsis>
                  </NButton>
                </NSpace>
              </NSpace>
            </template>
          </NCard>
        </NGridItem>
      </NGrid>
      <NDivider />
      <NSpace justify="center">
        <NButton
          v-if="data.length > index"
          @click="loadMore"
        >
          加载更多
        </NButton>
      </NSpace>
    </NScrollbar>
  </div>
</template>
