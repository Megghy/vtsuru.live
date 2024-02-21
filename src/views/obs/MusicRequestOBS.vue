<script setup lang="ts">
import { DanmakuUserInfo, SongsInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { AVATAR_URL, MUSIC_REQUEST_API_URL } from '@/data/constants'
import { useElementSize } from '@vueuse/core'
import { NDivider, NEmpty, useMessage } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Vue3Marquee } from 'vue3-marquee'

type WaitMusicInfo = {
  from: DanmakuUserInfo
  music: SongsInfo
}

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

const originSongs = ref<{ playing?: WaitMusicInfo; waiting: WaitMusicInfo[] }>({
  waiting: [],
})

async function get() {
  try {
    const data = await QueryGetAPI<{ playing: WaitMusicInfo; waiting: WaitMusicInfo[] }>(
      MUSIC_REQUEST_API_URL + 'get-waiting',
      {
        id: currentId.value,
      },
    )
    if (data.code == 200) {
      return data.data
    }
  } catch (err) {}
  return originSongs.value
}
const isMoreThanContainer = computed(() => {
  return originSongs.value.waiting.length * itemHeight > height.value
})
async function update() {
  if (!visiable.value || !active.value) return
  const r = await get()
  if (r) {
    originSongs.value = r
  }
}
const visiable = ref(true)
const active = ref(true)
let timer: any
onMounted(() => {
  update()
  timer = setInterval(update, 2000)

  //@ts-expect-error 这里获取不了
  window.obsstudio.onVisibilityChange = function (visibility: boolean) {
    visiable.value = visibility
  }
  //@ts-expect-error 这里获取不了
  window.obsstudio.onActiveChange = function (a: boolean) {
    active.value = a
  }
})
onUnmounted(() => {
  clearInterval(timer)
})
</script>

<template>
  <div class="music-request-background" v-bind="$attrs">
    <p class="music-request-header">点歌</p>
    <NDivider class="music-request-divider">
      <p class="music-request-header-count">已有 {{ originSongs.waiting.length ?? 0 }} 首</p>
    </NDivider>
    <div
      class="music-request-singing-container"
      :playing="originSongs.playing ? 'true' : 'false'"
      :from="originSongs.playing?.music.from ?? -1"
    >
      <div class="music-request-singing-prefix"></div>
      <template v-if="originSongs.playing">
        <img
          class="music-request-singing-avatar"
          :src="originSongs.playing.music.cover ?? AVATAR_URL + originSongs.playing.from?.uid"
          referrerpolicy="no-referrer"
        />
        <p class="music-request-singing-song-name">{{ originSongs.playing.music.name }}</p>
        <p class="music-request-singing-name">{{ originSongs.playing.from?.name }}</p>
      </template>
      <div v-else class="music-request-singing-empty">暂无点歌</div>
      <div class="music-request-singing-suffix"></div>
    </div>
    <div class="music-request-content" ref="listContainerRef">
      <template v-if="originSongs.waiting.length > 0">
        <Vue3Marquee
          class="music-request-list"
          :key="key"
          vertical
          :pause="!isMoreThanContainer"
          :duration="20"
          :style="`height: ${height}px;width: ${width}px;`"
        >
          <span
            class="music-request-list-item"
            :from="item.music.from as number"
            v-for="(item, index) in originSongs.waiting"
            :key="item.music.id"
            :style="`height: ${itemHeight}px`"
          >
            <div class="music-request-list-item-index" :index="index + 1">
              {{ index + 1 }}
            </div>
            <div class="music-request-list-item-song-name">
              {{ item.music.name }}
            </div>
            <p class="music-request-list-item-name">{{ item.from ? item.from.name : '主播添加' }}</p>
          </span>
        </Vue3Marquee>
      </template>
      <div v-else style="position: relative; top: 20%">
        <NEmpty class="music-request-empty" description="暂无人点歌" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.music-request-background {
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
.music-request-header {
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
.music-request-header-count {
  color: #ffffffbd;
  text-align: center;
  font-size: 14px;
}
.music-request-divider {
  margin: 0 auto;
  margin-top: -15px;
  margin-bottom: -15px;
  width: 90%;
}
.music-request-singing-container {
  height: 35px;
  margin: 0 10px 0 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.music-request-singing-empty {
  font-weight: bold;
  font-style: italic;
  color: #ffffffbe;
}
.music-request-singing-prefix {
  border: 2px solid rgb(231, 231, 231);
  height: 30px;
  width: 10px;
  border-radius: 10px;
}
.music-request-singing-container[playing='true'] .music-request-singing-prefix {
  background-color: #75c37f;
  animation: animated-border 3s linear infinite;
}
.music-request-singing-container[playing='false'] .music-request-singing-prefix {
  background-color: #c37575;
}
.music-request-singing-avatar {
  height: 30px;
  border-radius: 50%;
  /* 添加无限旋转动画 */
  animation: rotate 20s linear infinite;
}
/* 网页点歌 */
.music-request-singing-container[from='3'] .music-request-singing-avatar {
  display: none;
}
.music-request-singing-song-name {
  font-size: large;
  font-weight: bold;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 80%;
}
.music-request-singing-name {
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
.music-request-content {
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
.music-request-list-item {
  display: flex;
  width: 100%;
  align-self: flex-start;
  position: relative;
  align-items: center;
  justify-content: left;
  gap: 10px;
}
.music-request-list-item-song-name {
  font-size: 18px;
  font-weight: bold;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 80%;
}

/* 手动添加 */
.music-request-list-item[from='0'] .music-request-list-item-name {
  font-style: italic;
  font-weight: bold;
  color: #d2d8d6;
  font-size: 12px;
}
.music-request-list-item[from='0'] .music-request-list-item-avatar {
  display: none;
}

/* 弹幕点歌 */
.music-request-list-item[from='1'] {
}

.music-request-list-item-name {
  font-style: italic;
  font-size: 12px;
  color: rgba(204, 204, 204, 0.993);
  text-overflow: ellipsis;
  white-space: nowrap;

  margin-left: auto;
}
.music-request-list-item-index {
  text-align: center;
  height: 18px;
  padding: 2px;
  min-width: 15px;
  border-radius: 5px;
  background-color: #0f0f0f48;
  color: rgba(204, 204, 204, 0.993);
  font-size: 12px;
}
.music-request-list-item-level {
  text-align: center;
  height: 18px;
  padding: 2px;
  min-width: 15px;
  border-radius: 5px;
  background-color: #0f0f0f48;
  color: rgba(204, 204, 204, 0.993);
  font-size: 12px;
}
.music-request-list-item-level[has-level='false'] {
  display: none;
}
.music-request-tag {
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
.music-request-tag-key {
  font-style: italic;
  color: rgb(211, 211, 211);
  font-size: 12px;
}
.music-request-tag-value {
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
