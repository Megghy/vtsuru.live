<script setup lang="ts">
import { GetGuardColor } from '@/Utils'
import { useAccount } from '@/api/account'
import { FunctionTypes, Setting_SongRequest, SongRequestInfo, SongsInfo, UserInfo } from '@/api/api-models'
import SongPlayer from '@/components/SongPlayer.vue'
import SongRequestOBS from '@/views/obs/SongRequestOBS.vue'
import { CloudAdd20Filled, Play24Filled } from '@vicons/fluent'
import { useDebounceFn, useElementSize, useInfiniteScroll, useWindowSize } from '@vueuse/core'
import { debounce, throttle } from 'lodash'
import { NGridItem, NGrid, NCard, NSpace, NDivider, NButton, NCollapseTransition, NInput, NText, NEllipsis, NSelect, NEmpty, NIcon, NTag, NScrollbar, NTooltip } from 'naive-ui'
import { computed, ref } from 'vue'

const props = defineProps<{
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
  songRequestSettings: Setting_SongRequest
  songRequestActive: SongRequestInfo[]
  currentData: SongsInfo[] | undefined
}>()
const emits = defineEmits(['requestSong'])
const windowSize = useWindowSize()
const container = ref()
const index = ref(20)

const accountInfo = useAccount()

const selectedTag = ref('')
const selectedSong = ref<SongsInfo>()
const searchKeyword = ref('')
const selectedAuthor = ref<string>()

const isLrcLoading = ref('')
const isLoading = ref('')

const tags = computed(() => {
  if (props.currentData) {
    return [
      ...new Set(
        props.currentData
          .map((item) => {
            return item.tags ?? []
          })
          .reduce((prev, curr) => [...prev, ...curr], [])
      ),
    ]
  }
  return []
})
const authors = computed(() => {
  if (props.currentData) {
    return [
      ...new Set(
        props.currentData
          .map((item) => {
            return item.author ?? []
          })
          .reduce((prev, curr) => [...prev, ...curr], [])
      ),
    ]
  }
  return []
})
const songs = computed(() => {
  if (props.currentData) {
    return props.currentData
      .filter((item) => {
        return (
          (!selectedTag.value || item.tags?.includes(selectedTag.value)) &&
          (!searchKeyword.value || item.name.toLowerCase().includes(searchKeyword.value.toLowerCase())) &&
          (!selectedAuthor.value || item.author?.includes(selectedAuthor.value) == true)
        )
      })
      .slice(0, index.value)
  }
})
const onScroll = throttle((e: Event) => {
  const container = e.target as HTMLDivElement
  if (container.scrollTop + container.clientHeight >= container.scrollHeight - 20) {
    loadMore()
  }
}, 100)
function loadMore() {
  if (props.currentData) {
    index.value += props.currentData.length > 20 + index.value ? 20 : props.currentData.length - index.value
  }
}
</script>
<template>
  <div :style="{ display: 'flex', justifyContent: 'center', flexDirection: windowSize.width.value > 900 ? 'row' : 'column', gap: '10px', width: '100%' }">
    <NCard size="small" :style="{ width: windowSize.width.value > 900 ? '400px' : '100%' }">
      <NCollapseTransition>
        <SongPlayer v-if="selectedSong" :song="selectedSong" v-model:is-lrc-loading="isLrcLoading" />
      </NCollapseTransition>
      <NDivider> 标签 </NDivider>
      <NSpace>
        <NButton v-for="tag in tags" size="small" secondary :type="selectedTag == tag ? 'primary' : 'default'" @click="selectedTag == tag ? (selectedTag = '') : (selectedTag = tag)">
          {{ tag }}
        </NButton>
      </NSpace>
      <NDivider> 搜索歌曲 </NDivider>
      <NSpace vertical>
        <NInput v-model:value="searchKeyword" placeholder="歌名" clearable />
        <NSelect
          v-model:value="selectedAuthor"
          :options="
            authors.map((a) => {
              return { label: a, value: a }
            })
          "
          placeholder="选择歌手"
          clearable
        />
        <NDivider />
        <SongRequestOBS v-if="userInfo?.extra?.enableFunctions.includes(FunctionTypes.SongRequest)" :id="userInfo?.id" />
      </NSpace>
    </NCard>
    <NEmpty v-if="!currentData || songs?.length == 0" description="暂无曲目" style="max-width: 0 auto" />
    <NScrollbar v-else ref="container" :style="{ flexGrow: 1, height: windowSize.width.value > 900 ? '90vh' : '800px', overflowY: 'auto', overflowX: 'hidden' }" @scroll="onScroll">
      <NGrid cols="1 600:2 900:3 1200:4" x-gap="10" y-gap="10" responsive="self">
        <NGridItem v-for="item in songs" :key="item.key">
          <NCard size="small" style="height: 200px; min-width: 300px">
            <template #header>
              <NSpace :wrap="false" align="center">
                <div :style="`border-radius: 4px; background-color: ${item.options ? '#bd5757' : '#577fb8'}; width: 7px; height: 20px`"></div>
                <NEllipsis>
                  {{ item.name }}
                </NEllipsis>
              </NSpace>
            </template>
            <NText depth="3">
              <NSpace v-if="(item.author?.length ?? 0) > 0" :size="0">
                <div v-for="(author, index) in item.author" v-bind:key="author">
                  <NButton size="small" text @click="selectedAuthor == author ? (selectedAuthor = undefined) : (selectedAuthor = author)">
                    <NText depth="3" :style="{ color: selectedAuthor == author ? '#82bcd3' : '' }">
                      {{ author }}
                    </NText>
                    <NDivider v-if="index < (item.author?.length ?? 0) - 1" vertical />
                  </NButton>
                </div>
              </NSpace>
            </NText>
            <template #footer>
              <NEllipsis>
                {{ item.description }}
              </NEllipsis>
              <template v-if="item.options">
                <NSpace>
                  <NTag v-if="item.options?.scMinPrice" size="small" type="error" :bordered="false"> SC | {{ item.options?.scMinPrice }}</NTag>
                  <NTag v-if="item.options?.fanMedalMinLevel" size="small" type="info" :bordered="false"> 粉丝牌 | {{ item.options?.fanMedalMinLevel }}</NTag>
                  <NTag v-if="item.options?.needZongdu" size="small" :color="{ color: GetGuardColor(1) }"> 总督 </NTag>
                  <NTag v-if="item.options?.needTidu" size="small" :color="{ color: GetGuardColor(2) }"> 提督 </NTag>
                  <NTag v-if="item.options?.needJianzhang" size="small" :color="{ color: GetGuardColor(3) }"> 舰长 </NTag>
                </NSpace>
              </template>
            </template>
            <template #action>
              <NSpace>
                <NTooltip v-if="item.url">
                  <template #trigger>
                    <NButton size="small" @click="selectedSong = item" type="success" :loading="isLrcLoading == item.key">
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
                      @click="
                        () => {
                          isLoading = item.key
                          emits('requestSong', item)
                          isLoading = ''
                        }
                      "
                      :type="!songRequestSettings.allowFromWeb || item.options ? 'warning' : 'info'"
                      :loading="isLoading == item.key"
                    >
                      <template #icon>
                        <NIcon :component="CloudAdd20Filled" />
                      </template>
                    </NButton>
                  </template>
                  {{ !songRequestSettings.allowFromWeb || item.options ? '点歌 | 用户或此歌曲不允许从网页点歌, 点击后将复制点歌内容到剪切板' : !accountInfo ? '点歌 | 你需要登录后才能点歌' : '点歌' }}
                </NTooltip>
              </NSpace>
            </template>
          </NCard>
        </NGridItem>
      </NGrid>
      <NDivider />
      <NSpace justify="center">
        <NButton v-if="currentData.length > index" @click="loadMore"> 加载更多 </NButton>
      </NSpace>
    </NScrollbar>
  </div>
</template>
