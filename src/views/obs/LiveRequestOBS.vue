<script setup lang="ts">
import {
  QueueSortType,
  Setting_LiveRequest,
  SongRequestFrom,
  SongRequestInfo,
  SongRequestStatus,
} from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { AVATAR_URL, SONG_REQUEST_API_URL } from '@/data/constants'
import { useElementSize } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Vue3Marquee } from 'vue3-marquee'
import { NCard, NDivider, NEmpty, NSpace, NText, useMessage } from 'naive-ui'
import { List } from 'linqts'

const props = defineProps<{
  id?: number
}>()

const message = useMessage()
const route = useRoute()
const currentId = computed(() => {
  return props.id ?? route.query.id
})

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
    // eslint-disable-next-line vue/no-side-effects-in-computed-properties
    return result.Reverse().ToArray()
  } else {
    return result.ToArray()
  }
})

const isMoreThanContainer = computed(() => {
  return songs.value.length * itemHeight > height.value
})

const settings = ref<Setting_LiveRequest>({} as Setting_LiveRequest)
const singing = computed(() => {
  return songs.value.find((s) => s.status == SongRequestStatus.Singing)
})
const activeSongs = computed(() => {
  return songs.value.filter((s) => s.status == SongRequestStatus.Waiting)
})

async function get() {
  try {
    const data = await QueryGetAPI<{ songs: SongRequestInfo[]; setting: Setting_LiveRequest }>(
      SONG_REQUEST_API_URL + 'get-active-and-settings',
      {
        id: currentId.value,
      },
    )
    if (data.code == 200) {
      return data.data
    }
  } catch (err) {}
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
  if (!visiable.value || !active.value) return
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

const visiable = ref(true)
const active = ref(true)
let timer: any
onMounted(() => {
  update()
  timer = setInterval(update, 2000)
  //@ts-expect-error 这里获取不了
  if (window.obsstudio) {
    //@ts-expect-error 这里获取不了
    window.obsstudio.onVisibilityChange = function (visibility: boolean) {
      visiable.value = visibility
    }
    //@ts-expect-error 这里获取不了
    window.obsstudio.onActiveChange = function (a: boolean) {
      active.value = a
    }
  }
})
onUnmounted(() => {
  clearInterval(timer)
})
</script>

<template>
  <div class="live-request-background" v-bind="$attrs">
    <p class="live-request-header">{{ settings.obsTitle ?? '点播' }}</p>
    <NDivider class="live-request-divider">
      <p class="live-request-header-count">已有 {{ activeSongs.length ?? 0 }} 条</p>
    </NDivider>
    <div
      class="live-request-processing-container"
      :singing="songs.findIndex((s) => s.status == SongRequestStatus.Singing) > -1"
      :from="singing?.from as number"
      :status="singing?.status as number"
    >
      <div class="live-request-processing-prefix"></div>
      <template v-if="singing">
        <img
          class="live-request-processing-avatar"
          :src="singing?.user?.face"
          referrerpolicy="no-referrer"
        />
        <p class="live-request-processing-song-name">{{ singing?.songName }}</p>
        <p class="live-request-processing-name">{{ singing?.user?.name }}</p>
      </template>
      <div v-else class="live-request-processing-empty">暂无</div>
      <div class="live-request-processing-suffix"></div>
    </div>
    <div class="live-request-content" ref="listContainerRef">
      <template v-if="activeSongs.length > 0">
        <Vue3Marquee
          class="live-request-list"
          :key="key"
          vertical
          :duration="20"
          :pause="!isMoreThanContainer"
          :style="`height: ${height}px;width: ${width}px;`"
        >
          <div
            class="live-request-list-item"
            :from="song.from as number"
            :status="song.status as number"
            v-for="(song, index) in activeSongs"
            :key="song.id"
            :style="`height: ${itemHeight}px`"
          >
            <div class="live-request-list-item-index" :index="index + 1">
              {{ index + 1 }}
            </div>
            <div class="live-request-list-item-song-name">
              {{ song.songName }}
            </div>
            <p v-if="settings.showUserName" class="live-request-list-item-name">
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
          <NDivider v-if="isMoreThanContainer" class="live-request-footer-divider" style="margin: 10px 0 10px 0" />
        </Vue3Marquee>
      </template>
      <div v-else style="position: relative; top: 20%">
        <NEmpty class="live-request-empty" description="暂无人点播" />
      </div>
    </div>
    <div class="live-request-footer" v-if="settings.showRequireInfo" ref="footerRef">
      <Vue3Marquee
        :key="key"
        ref="footerListRef"
        class="live-request-footer-marquee"
        :duration="10"
        animate-on-overflow-only
      >
        <span class="live-request-tag" type="prefix">
          <div class="live-request-tag-key">前缀</div>
          <div class="live-request-tag-value">
            {{ settings.orderPrefix }}
          </div>
        </span>
        <span class="live-request-tag" type="prefix">
          <div class="live-request-tag-key">允许</div>
          <div class="live-request-tag-value">
            {{ settings.allowAllDanmaku ? '所有弹幕' : allowGuardTypes.length > 0 ? allowGuardTypes.join(',') : '无' }}
          </div>
        </span>
        <span class="live-request-tag" type="sc">
          <div class="live-request-tag-key">SC点歌</div>
          <div class="live-request-tag-value">
            {{ settings.allowSC ? '> ¥' + settings.scMinPrice : '不允许' }}
          </div>
        </span>
        <span class="live-request-tag" type="fan-madel">
          <div class="live-request-tag-key">粉丝牌</div>
          <div class="live-request-tag-value">
            {{
              settings.needWearFanMedal
                ? settings.fanMedalMinLevel > 0
                  ? '> ' + settings.fanMedalMinLevel
                  : '佩戴'
                : '无需'
            }}
          </div>
        </span>
      </Vue3Marquee>
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
.live-request-processing-container {
  height: 35px;
  margin: 0 10px 0 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.live-request-processing-empty {
  font-weight: bold;
  font-style: italic;
  color: #ffffffbe;
}
.live-request-processing-prefix {
  border: 2px solid rgb(231, 231, 231);
  height: 30px;
  width: 10px;
  border-radius: 10px;
}
.live-request-processing-container[singing='true'] .live-request-processing-prefix {
  background-color: #75c37f;
  animation: animated-border 3s linear infinite;
}
.live-request-processing-container[singing='false'] .live-request-processing-prefix {
  background-color: #c37575;
}
.live-request-processing-avatar {
  height: 30px;
  border-radius: 50%;
  /* 添加无限旋转动画 */
  animation: rotate 20s linear infinite;
}
/* 网页点歌 */
.live-request-processing-container[from='3'] .live-request-processing-avatar {
  display: none;
}
.live-request-processing-song-name {
  font-size: large;
  font-weight: bold;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 80%;
}
.live-request-processing-name {
  font-size: 12px;
  font-style: italic;
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
.live-request-list-item[from='1'] {
}

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
