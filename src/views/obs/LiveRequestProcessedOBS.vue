<script setup lang="ts">
import {
  QueueSortType,
  Setting_LiveRequest,
  SongRequestFrom,
  SongRequestInfo
} from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { SONG_REQUEST_API_URL } from '@/data/constants'
import { useElementSize } from '@vueuse/core'
import { List } from 'linqts'
import { NDivider, NEmpty, NMessageProvider, useMessage } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Vue3Marquee } from 'vue3-marquee'

const props = defineProps<{
  id?: number,
  active?: boolean,
  visible?: boolean,
}>()

const message = useMessage()
const route = useRoute()
const currentId = computed(() => {
  return props.id ?? route.query.id
})

const cardRef = ref()
const listContainerRef = ref()
const { height, width } = useElementSize(listContainerRef)
const itemHeight = 40

const key = ref(Date.now())

const originSongs = ref<SongRequestInfo[]>([])
const songs = computed(() => {
  let result = new List(originSongs.value)
  switch (settings.value.sortType) {
    case QueueSortType.TimeFirst: {
      result = result.ThenBy((q) => q.createAt)
      break
    }
    case QueueSortType.GuardFirst: {
      result = result
        .OrderBy((q) => (q.user?.guard_level == 0 || q.user?.guard_level == null ? 4 : q.user.guard_level))
        .ThenBy((q) => q.createAt)
      break
    }
    case QueueSortType.PaymentFist: {
      result = result.OrderByDescending((q) => q.price ?? 0).ThenBy((q) => q.createAt)
    }
    case QueueSortType.FansMedalFirst: {
      result = result.OrderByDescending((q) => q.user?.fans_medal_level ?? 0).ThenBy((q) => q.createAt)
    }
  }
  if (settings.value.isReverse) {
     
    return result.Reverse().ToArray()
  } else {
    return result.ToArray()
  }
})

const isMoreThanContainer = computed(() => {
  return songs.value.length * itemHeight > height.value
})

const settings = ref<Setting_LiveRequest>({} as Setting_LiveRequest)

async function get() {
  try {
    const data = await QueryGetAPI<{ songs: SongRequestInfo[]; setting: Setting_LiveRequest }>(
      SONG_REQUEST_API_URL + 'get-today',
      {
        id: currentId.value,
      },
    )
    if (data.code == 200) {
      return data.data
    }
  } catch (err) { }
  return {} as { songs: SongRequestInfo[]; setting: Setting_LiveRequest }
}
const allowGuardTypes = computed(() => {
  const types = []
  if (settings.value.needTidu) {
    types.push('提督')
  }
  if (settings.value.needZongdu) {
    types.push('总督')
  }
  if (settings.value.needJianzhang) {
    types.push('舰长')
  }
  return types
})
async function update() {
  const r = await get()
  if (r) {
    const isCountChange = originSongs.value.length != r.songs.length
    originSongs.value = r.songs.sort((a, b) => {
      return b.createAt - a.createAt
    })
    settings.value = r.setting
    if (isCountChange) {
      key.value = Date.now()
    }
  }
}

const direction = ref<'normal' | 'reverse'>('normal')

onMounted(() => {
  update()
  window.$mitt.on('onOBSComponentUpdate', () => {
    update()
  })
})
onUnmounted(() => {
  window.$mitt.off('onOBSComponentUpdate')
})
</script>

<template>
  <NMessageProvider :to="cardRef" />
  <div
    ref="cardRef"
    class="live-request-background"
    v-bind="$attrs"
  >
    <p class="live-request-header">
      {{ settings.obsTitleToday ?? '今日已唱' }}
    </p>
    <NDivider class="live-request-divider">
      <p class="live-request-header-count">
        {{ songs.length ?? 0 }} 条
      </p>
    </NDivider>
    <div
      ref="listContainerRef"
      class="live-request-content"
    >
      <template v-if="songs.length > 0">
        <Vue3Marquee
          :key="key"
          class="live-request-list"
          vertical
          :duration="20"
          :pause="!isMoreThanContainer"
          :style="`height: ${height}px;width: ${width}px;`"
        >
          <div
            v-for="(song, index) in songs"
            :key="song.id"
            class="live-request-list-item"
            :from="song.from as number"
            :status="song.status as number"
            :style="`height: ${itemHeight}px`"
          >
            <div
              class="live-request-list-item-index"
              :index="index + 1"
            >
              {{ index + 1 }}
            </div>
            <div class="live-request-list-item-song-name">
              {{ song.songName }}
            </div>
            <p
              v-if="settings.showUserName"
              class="live-request-list-item-name"
            >
              {{ song.from == SongRequestFrom.Manual ? '主播添加' : song.user?.name }}
            </p>
            <div
              v-if="settings.showFanMadelInfo"
              class="live-request-list-item-level"
              :has-level="(song.user?.fans_medal_level ?? 0) > 0"
            >
              {{ `${song.user?.fans_medal_name} ${song.user?.fans_medal_level}` }}
            </div>
          </div>
          <NDivider
            v-if="isMoreThanContainer"
            class="live-request-footer-divider"
            style="margin: 10px 0 10px 0"
          />
        </Vue3Marquee>
      </template>
      <div
        v-else
        style="position: relative; top: 20%"
      >
        <NEmpty
          class="live-request-empty"
          description="今日暂无"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.live-request-background {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  min-height: 100px;
  min-width: 100px;
  background-color: #0f0f0f48;
  border-radius: 10px;
  color: white;
}

.live-request-header {
  margin: 0;
  color: #fff;
  text-align: center;
  font-size: 20px;
  font-weight: bold;
  text-shadow:
    0 0 10px #ca7b7b6e,
    0 0 20px #ffffff8e,
    0 0 30px #61606086,
    0 0 40px rgba(64, 156, 179, 0.555);
}

.live-request-header-count {
  color: #ffffffbd;
  text-align: center;
  font-size: 14px;
}

.live-request-divider {
  margin: 0 auto;
  margin-top: -15px;
  margin-bottom: -15px;
  width: 90%;
}

@keyframes rotate {
  0% {
    transform: rotate(0);
  }

  100% {
    transform: rotate(360deg);
  }
}

.n-divider__line {
  background-color: #ffffffd5;
}

.live-request-content {
  background-color: #0f0f0f4f;
  margin: 10px;
  padding: 10px;
  height: 100%;
  border-radius: 10px;
  overflow-x: hidden;
}

.marquee {
  justify-items: left;
}

.live-request-list-item {
  display: flex;
  width: 100%;
  align-self: flex-start;
  position: relative;
  align-items: center;
  justify-content: left;
  gap: 10px;
}

.live-request-list-item-song-name {
  font-size: 18px;
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 80%;
}

/* 手动添加 */
.live-request-list-item[from='0'] .live-request-list-item-name {
  font-style: italic;
  font-weight: bold;
  color: #d2d8d6;
  font-size: 12px;
}

.live-request-list-item[from='0'] .live-request-list-item-avatar {
  display: none;
}

/* 弹幕点歌 */
.live-request-list-item[from='1'] {}

.live-request-list-item-name {
  font-style: italic;
  font-size: 12px;
  color: rgba(204, 204, 204, 0.993);
  text-overflow: ellipsis;
  white-space: nowrap;

  margin-left: auto;
}

.live-request-list-item-index {
  text-align: center;
  height: 18px;
  padding: 2px;
  min-width: 15px;
  border-radius: 5px;
  background-color: #0f0f0f48;
  color: rgba(204, 204, 204, 0.993);
  font-size: 12px;
}

.live-request-list-item-level {
  text-align: center;
  height: 18px;
  padding: 2px;
  min-width: 15px;
  border-radius: 5px;
  background-color: #0f0f0f48;
  color: rgba(204, 204, 204, 0.993);
  font-size: 12px;
}

.live-request-list-item-level[has-level='false'] {
  display: none;
}

.live-request-footer {
  margin: 0 5px 5px 5px;
  height: 60px;
  border-radius: 5px;
  background-color: #0f0f0f4f;
  display: flex;
  align-items: center;
}

.live-request-tag {
  display: flex;
  margin: 5px 0 5px 5px;
  height: 40px;
  border-radius: 3px;
  background-color: #0f0f0f4f;
  padding: 4px;
  padding-right: 6px;
  display: flex;
  flex-direction: column;
  justify-content: left;
}

.live-request-tag-key {
  font-style: italic;
  color: rgb(211, 211, 211);
  font-size: 12px;
}

.live-request-tag-value {
  font-size: 14px;
}

.live-request-list-item-index[index='1'] {
  background-color: #ebc34c;
  color: white;
  font-weight: bold;
  text-shadow: 0 0 6px #ebc34c;
}

.live-request-list-item-index[index='2'] {
  background-color: #c0c0c0;
  color: white;
  font-weight: bold;
}

.live-request-list-item-index[index='3'] {
  background-color: #b87333;
  color: white;
  font-weight: bold;
}

@keyframes animated-border {
  0% {
    box-shadow: 0 0 0px #589580;
  }

  100% {
    box-shadow: 0 0 0 6px rgba(255, 255, 255, 0);
  }
}
</style>
