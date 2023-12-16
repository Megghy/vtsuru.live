<script setup lang="ts">
import { Setting_SongRequest, SongRequestFrom, SongRequestInfo, SongRequestStatus } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { AVATAR_URL, SONG_REQUEST_API_URL } from '@/data/constants'
import { useElementSize } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Vue3Marquee } from 'vue3-marquee'
import { NCard, NDivider, NEmpty, NSpace, NText, useMessage } from 'naive-ui'

const props = defineProps<{
  id?: number
}>()

const message = useMessage()
const route = useRoute()
const currentId = computed(() => {
  return props.id ?? route.query.id
})

const listContainerRef = ref()
const footerRef = ref()
const footerListRef = ref()
const { height, width } = useElementSize(listContainerRef)
const footerSize = useElementSize(footerRef)
const footerListSize = useElementSize(footerListRef)
const itemHeight = 40

const key = ref(Date.now())

const originSongs = ref<SongRequestInfo[]>([])
const songs = computed(() => {
  if (settings.value.isReverse) {
    return originSongs.value.reverse()
  } else {
    return originSongs.value
  }
})
const settings = ref<Setting_SongRequest>({} as Setting_SongRequest)
const singing = computed(() => {
  return originSongs.value.find((s) => s.status == SongRequestStatus.Singing)
})
const activeSongs = computed(() => {
  return originSongs.value.filter((s) => s.status == SongRequestStatus.Waiting)
})

async function get() {
  try {
    const data = await QueryGetAPI<{ songs: SongRequestInfo[]; setting: Setting_SongRequest }>(SONG_REQUEST_API_URL + 'get-active-and-settings', {
      id: currentId.value,
    })
    if (data.code == 200) {
      return data.data
    }
  } catch (err) {}
  return {} as { songs: SongRequestInfo[]; setting: Setting_SongRequest }
}
const isMoreThanContainer = computed(() => {
  return originSongs.value.length * itemHeight > height.value
})
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
    originSongs.value = r.songs.sort((a, b) => {
      return b.createAt - a.createAt
    })
    settings.value = r.setting
  }
}

let timer: any
onMounted(() => {
  update()
  timer = setInterval(update, 2000)
})
onUnmounted(() => {
  clearInterval(timer)
})
</script>

<template>
  <div class="song-request-background" v-bind="$attrs">
    <p class="song-request-header">点歌</p>
    <NDivider class="song-request-divider">
      <p class="song-request-header-count">已有 {{ activeSongs.length ?? 0 }} 首</p>
    </NDivider>
    <div
      class="song-request-singing-container"
      :singing="songs.findIndex((s) => s.status == SongRequestStatus.Singing) > -1"
      :from="(singing?.from as number)"
      :status="(singing?.status as number)"
    >
      <div class="song-request-singing-prefix"></div>
      <template v-if="singing">
        <img class="song-request-singing-avatar" :src="AVATAR_URL + singing?.user?.uid" referrerpolicy="no-referrer" />
        <p class="song-request-singing-song-name">{{ singing?.songName }}</p>
        <p class="song-request-singing-name">{{ singing?.user?.name }}</p>
      </template>
      <div v-else class="song-request-singing-empty">暂未演唱</div>
      <div class="song-request-singing-suffix"></div>
    </div>
    <div class="song-request-content" ref="listContainerRef">
      <template v-if="activeSongs.length > 0">
        <Vue3Marquee class="song-request-list" :key="key" vertical :pause="!isMoreThanContainer" :duration="20" :style="`height: ${height}px;width: ${width}px;`">
          <span class="song-request-list-item" :from="(song.from as number)" :status="(song.status as number)" v-for="(song, index) in activeSongs" :key="song.id" :style="`height: ${itemHeight}px`">
            <div class="song-request-list-item-index" :index="index + 1">
              {{ index + 1 }}
            </div>
            <div class="song-request-list-item-song-name">
              {{ song.songName }}
            </div>
            <p class="song-request-list-item-name">{{ song.from == SongRequestFrom.Manual ? '主播添加' : song.user?.name }}</p>
            <div class="song-request-list-item-level" :has-level="(song.user?.fans_medal_level ?? 0) > 0">
              {{ `${song.user?.fans_medal_name} ${song.user?.fans_medal_level}` }}
            </div>
          </span>
        </Vue3Marquee>
      </template>
      <div v-else style="position: relative; top: 20%">
        <NEmpty class="song-request-empty" description="暂无人点歌" />
      </div>
    </div>
    <div class="song-request-footer" v-if="settings.showRequireInfo" ref="footerRef">
      <Vue3Marquee :key="key" ref="footerListRef" class="song-request-footer-marquee" :pause="footerSize.width < footerListSize.width" :duration="20">
        <span class="song-request-tag" type="prefix">
          <div class="song-request-tag-key">前缀</div>
          <div class="song-request-tag-value">
            {{ settings.orderPrefix }}
          </div>
        </span>
        <span class="song-request-tag" type="prefix">
          <div class="song-request-tag-key">允许</div>
          <div class="song-request-tag-value">
            {{ settings.allowAllDanmaku ? '所有弹幕' : allowGuardTypes.length > 0 ? allowGuardTypes.join(',') : '无' }}
          </div>
        </span>
        <span class="song-request-tag" type="sc">
          <div class="song-request-tag-key">SC点歌</div>
          <div class="song-request-tag-value">
            {{ settings.allowSC ? '> ¥' + settings.scMinPrice : '不允许' }}
          </div>
        </span>
        <span class="song-request-tag" type="fan-madel">
          <div class="song-request-tag-key">粉丝牌</div>
          <div class="song-request-tag-value">
            {{ settings.needWearFanMedal ? (settings.fanMedalMinLevel > 0 ? '> ' + settings.fanMedalMinLevel : '佩戴') : '无需' }}
          </div>
        </span></Vue3Marquee
      >
    </div>
  </div>
</template>

<style scoped>
.song-request-background {
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
.song-request-header {
  margin: 0;
  color: #fff;
  text-align: center;
  font-size: 20px;
  font-weight: bold;
  text-shadow: 0 0 10px #ca7b7b6e, 0 0 20px #ffffff8e, 0 0 30px #61606086, 0 0 40px rgba(64, 156, 179, 0.555);
}
.song-request-header-count {
  color: #ffffffbd;
  text-align: center;
  font-size: 14px;
}
.song-request-divider {
  margin: 0 auto;
  margin-top: -15px;
  margin-bottom: -15px;
  width: 90%;
}
.song-request-singing-container {
  height: 35px;
  margin: 0 10px 0 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.song-request-singing-empty {
  font-weight: bold;
  font-style: italic;
  color: #ffffffbe;
}
.song-request-singing-prefix {
  border: 2px solid rgb(231, 231, 231);
  height: 30px;
  width: 10px;
  border-radius: 10px;
}
.song-request-singing-container[singing='true'] .song-request-singing-prefix {
  background-color: #75c37f;
  animation: animated-border 3s linear infinite;
}
.song-request-singing-container[singing='false'] .song-request-singing-prefix {
  background-color: #c37575;
}
.song-request-singing-avatar {
  height: 30px;
  border-radius: 50%;
  /* 添加无限旋转动画 */
  animation: rotate 20s linear infinite;
}
/* 网页点歌 */
.song-request-singing-container[from='3'] .song-request-singing-avatar {
  display: none;
}
.song-request-singing-song-name {
  font-size: large;
  font-weight: bold;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 80%;
}
.song-request-singing-name {
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
.song-request-content {
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
.song-request-list-item {
  display: flex;
  width: 100%;
  align-self: flex-start;
  position: relative;
  align-items: center;
  justify-content: left;
  gap: 10px;
}
.song-request-list-item-song-name {
  font-size: 18px;
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 80%;
}

/* 手动添加 */
.song-request-list-item[from='0'] .song-request-list-item-name {
  font-style: italic;
  font-weight: bold;
  color: #d2d8d6;
  font-size: 12px;
}
.song-request-list-item[from='0'] .song-request-list-item-avatar {
  display: none;
}

/* 弹幕点歌 */
.song-request-list-item[from='1'] {
}

.song-request-list-item-name {
  font-style: italic;
  font-size: 12px;
  color: rgba(204, 204, 204, 0.993);
  text-overflow: ellipsis;
  white-space: nowrap;

  margin-left: auto;
}
.song-request-list-item-index {
  text-align: center;
  height: 18px;
  padding: 2px;
  min-width: 15px;
  border-radius: 5px;
  background-color: #0f0f0f48;
  color: rgba(204, 204, 204, 0.993);
  font-size: 12px;
}
.song-request-list-item-level {
  text-align: center;
  height: 18px;
  padding: 2px;
  min-width: 15px;
  border-radius: 5px;
  background-color: #0f0f0f48;
  color: rgba(204, 204, 204, 0.993);
  font-size: 12px;
}
.song-request-list-item-level[has-level='false'] {
  display: none;
}
.song-request-footer {
  margin: 0 5px 5px 5px;
  height: 60px;
  border-radius: 5px;
  background-color: #0f0f0f4f;
  display: flex;
  align-items: center;
}
.song-request-tag {
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
.song-request-tag-key {
  font-style: italic;
  color: rgb(211, 211, 211);
  font-size: 12px;
}
.song-request-tag-value {
  font-size: 14px;
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
