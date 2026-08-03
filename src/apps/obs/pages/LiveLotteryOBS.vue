<script setup lang="ts">
import { useElementSize, useEventBus } from '@vueuse/core'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Vue3Marquee } from 'vue3-marquee'

import type { UpdateLiveLotteryUsersModel } from '@/api/api-models'
import { OpenLiveLotteryType } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { LOTTERY_API_URL } from '@/shared/config'
import { obsUpdateEventKey } from '@/app/events'

const props = defineProps<{
  code?: string
}>()

const route = useRoute()
const obsUpdateBus = useEventBus(obsUpdateEventKey)
const currentCode = computed<string>(() => {
  const v = props.code ?? (Array.isArray(route.query.code) ? route.query.code[0] : route.query.code)
  return typeof v === 'string' ? v : ''
})
const listContainerRef = ref()
const { height, width } = useElementSize(listContainerRef)

const result = ref<UpdateLiveLotteryUsersModel>({
  users: [],
  resultUsers: [],
  type: OpenLiveLotteryType.Waiting,
})
const users = computed(() => result.value.users)
const isMoreThanContainer = computed(() => {
  return users.value.length * 50 > height.value
})

async function refreshUsers() {
  try {
    const data = await QueryGetAPI<UpdateLiveLotteryUsersModel>(`${LOTTERY_API_URL}live/get-users`, {
      code: currentCode.value,
    })
    if (data.code === 200) {
      result.value = data.data
    }
  } catch (err) {
    console.error(err)
  }
}

await refreshUsers()

function handleImageError(e: Event) {
  const img = e.target as HTMLImageElement
  img.src = 'https://i2.hdslb.com/bfs/face/member/noface.jpg'
}

function handleObsUpdate() {
  void refreshUsers()
}

onMounted(() => obsUpdateBus.on(handleObsUpdate))
</script>

<template>
  <div
    class="lottery-background"
    v-bind="$attrs"
  >
    <p class="lottery-header">抽奖</p>
    <div
      v-if="result.type === OpenLiveLotteryType.Waiting"
      class="lottery-divider"
    >
      <p class="lottery-header-count">已有 {{ users.length }} 人</p>
    </div>
    <div
      ref="listContainerRef"
      class="lottery-content"
    >
      <template v-if="users.length > 0">
        <Vue3Marquee
          v-if="result.type === OpenLiveLotteryType.Waiting"
          vertical
          :pause="!isMoreThanContainer"
          :duration="20"
          :style="`height: ${height}px;`"
        >
          <span
            v-for="(user, index) in users"
            :id="index.toString()"
            :key="user.uId"
            class="lottery-list-item"
            style="height: 50px"
          >
            <img
              class="lottery-avatar"
              :src="`${user.avatar}@30h`"
              referrerpolicy="no-referrer"
              @error="handleImageError"
            />
            <div>
              <p class="lottery-name">{{ user.name }}</p>
            </div>
          </span>
        </Vue3Marquee>
      </template>
      <div
        v-else
        style="position: relative; top: 20%"
      >
        <p class="lottery-empty">暂无人参与</p>
      </div>
      <template v-if="result.type === OpenLiveLotteryType.Result">
        <p style="text-align: center; font-size: 20px; margin: 0; font-weight: bold; color: #eeabab">结果</p>
        <Vue3Marquee
          v-if="100 * result.resultUsers.length > width"
          justify="center"
          style="height: 100px"
        >
          <div
            v-for="user in result.resultUsers"
            :key="user.uId"
            title="抽奖结果"
            style="
              height: 100px;
              width: 100px;
              display: flex;
              flex-direction: column;
              align-items: center;
              border-radius: 5px;
              border: #fff 1px solid;
              padding: 10px;
              margin: 10px;
            "
          >
            <div class="lottery-result-user">
              <img
                height="50"
                width="50"
                style="border-radius: 50%"
                :src="`${user.avatar}@50h_50w`"
                referrerpolicy="no-referrer"
                @error="handleImageError"
              />
              <span class="lottery-result-name">
                {{ user.name }}
              </span>
            </div>
          </div>
        </Vue3Marquee>
        <div
          v-else
          class="lottery-results"
        >
          <div
            v-for="user in result.resultUsers"
            :key="user.uId"
            title="抽奖结果"
            style="
              height: 100px;
              width: 100px;
              display: flex;
              flex-direction: column;
              align-items: center;
              border-radius: 5px;
              border: #fff 1px solid;
              padding: 10px;
              margin: 10px;
            "
          >
            <img
              height="50"
              width="50"
              style="border-radius: 50%"
              :src="`${user.avatar}@50h_50w`"
              referrerpolicy="no-referrer"
              @error="handleImageError"
            />
            <span class="lottery-result-name">
              {{ user.name }}
            </span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.lottery-background {
  display: flex !important;
  flex-direction: column !important;
  height: 100% !important;
  width: 100% !important;
  min-height: 100px !important;
  min-width: 100px !important;
  background-color: var(--obs-classic-card-bg, rgba(15, 15, 15, 0.16)) !important;
  border-radius: 10px !important;
  color: white !important;
}
.lottery-header {
  margin: 0 !important;
  color: #fff !important;
  text-align: center !important;
  font-size: 24px !important;
  font-weight: bold !important;
  text-shadow:
    0 0 10px #ca7b7b6e,
    0 0 20px #ffffff8e,
    0 0 30px #61606086,
    0 0 40px rgba(64, 156, 179, 0.555) !important;
}
.lottery-header-count {
  color: #ffffffbd !important;
  text-align: center !important;
  font-size: 14px !important;
}
.lottery-divider {
  margin: -10px 10px -10px 10px !important;
  width: 90% !important;
  border-bottom: 1px solid #ffffffd5;
}
.lottery-content {
  background-color: var(--obs-classic-surface-bg, rgba(15, 15, 15, 0.2)) !important;
  margin: 10px !important;
  padding: 10px !important;
  height: 100% !important;
  border-radius: 10px !important;
}
.lottery-list-item {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  transition:
    color 0.3s cubic-bezier(0.4, 0, 0.2, 1),
    background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.lottery-avatar {
  height: 30px !important;
  border-radius: 50% !important;
}

.lottery-empty {
  margin: 0;
  color: #ffffffbd;
  text-align: center;
}

.lottery-results,
.lottery-result-user {
  display: flex;
  align-items: center;
  justify-content: center;
}

.lottery-result-user {
  flex-direction: column;
}

.lottery-result-name {
  margin-top: 10px;
  font-size: large;
}
</style>
