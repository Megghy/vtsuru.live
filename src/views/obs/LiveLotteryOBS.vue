<script setup lang="ts">
import { OpenLiveLotteryType, OpenLiveLotteryUserInfo, UpdateLiveLotteryUsersModel } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { LOTTERY_API_URL } from '@/data/constants'
import { useElementSize } from '@vueuse/core'
import { NCard, NDivider, NEmpty, NSpace, NText, useMessage } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Vue3Marquee } from 'vue3-marquee'

const props = defineProps<{
  code?: string
}>()

const message = useMessage()
const route = useRoute()
const currentCode = computed(() => {
  return props.code ?? route.query.code
})
const listContainerRef = ref()
const { height, width } = useElementSize(listContainerRef)

const result = ref(await getUsers())
const users = computed(() => {
  return result.value?.users
})
const isMoreThanContainer = computed(() => {
  return (users.value?.length ?? 0) * 50 > height.value
})

async function getUsers() {
  try {
    const data = await QueryGetAPI<UpdateLiveLotteryUsersModel>(LOTTERY_API_URL() + 'live/get-users', {
      code: currentCode.value,
    })
    if (data.code == 200) {
      return data.data
    }
  } catch (err) {}
  return {
    users: [],
    resultUsers: [],
    type: OpenLiveLotteryType.Waiting,
  } as UpdateLiveLotteryUsersModel
}

let timer: any
onMounted(() => {
  timer = setInterval(async () => {
    const r = await getUsers()
    if (r) {
      result.value = r
    }
  }, 2000)
})
onUnmounted(() => {
  clearInterval(timer)
})
</script>

<template>
  <div class="lottery-background" v-bind="$attrs">
    <p class="lottery-header">抽奖</p>
    <NDivider v-if="result.type == OpenLiveLotteryType.Waiting" class="lottery-divider">
      <p class="lottery-header-count">已有 {{ users?.length ?? 0 }} 人</p>
    </NDivider>
    <div class="lottery-content" ref="listContainerRef">
      <template v-if="users.length > 0">
        <Vue3Marquee v-if="result.type == OpenLiveLotteryType.Waiting" vertical :pause="!isMoreThanContainer" :duration="20" :style="`height: ${height}px;`">
          <span class="lottery-list-item" :id="index.toString()" v-for="(user, index) in users" :key="user.uId" style="height: 50px">
            <img class="lottery-avatar" :src="user.avatar + '@30h'" referrerpolicy="no-referrer" />
            <div>
              <p class="lottery-name">{{ user.name }}</p>
            </div>
          </span>
        </Vue3Marquee>
      </template>
      <div v-else style="position: relative; top: 20%">
        <NEmpty description="暂无人参与" />
      </div>
      <template v-if="result.type == OpenLiveLotteryType.Result">
        <p style="text-align: center; font-size: 20px; margin: 0; font-weight: bold; color: #eeabab">结果</p>
        <Vue3Marquee v-if="100 * result.resultUsers.length > width" justify="center" style="height: 100px">
          <div
            v-for="user in result.resultUsers"
            :key="user.uId"
            title="抽奖结果"
            style="height: 100px; width: 100px; display: flex; flex-direction: column; align-items: center; border-radius: 5px; border: #fff 1px solid; padding: 10px; margin: 10px"
          >
            <NSpace vertical>
              <img height="50" width="50" style="border-radius: 50%" :src="user.avatar + '@50h_50w'" referrerpolicy="no-referrer" />
              <NText style="font-size: large">
                {{ user.name }}
              </NText>
            </NSpace>
          </div>
        </Vue3Marquee>
        <NSpace justify="center">
          <div
            v-for="user in result.resultUsers"
            :key="user.uId"
            title="抽奖结果"
            style="height: 100px; width: 100px; display: flex; flex-direction: column; align-items: center; border-radius: 5px; border: #fff 1px solid; padding: 10px; margin: 10px"
          >
            <img height="50" width="50" style="border-radius: 50%" :src="user.avatar + '@50h_50w'" referrerpolicy="no-referrer" />
            <NText style="font-size: large; margin-top: 10px">
              {{ user.name }}
            </NText>
          </div>
        </NSpace>
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
  background-color: #0f0f0f48 !important;
  border-radius: 10px !important;
  color: white !important;
}
.lottery-header {
  margin: 0 !important;
  color: #fff !important;
  text-align: center !important;
  font-size: 24px !important;
  font-weight: bold !important;
  text-shadow: 0 0 10px #ca7b7b6e, 0 0 20px #ffffff8e, 0 0 30px #61606086, 0 0 40px rgba(64, 156, 179, 0.555) !important;
}
.lottery-header-count {
  color: #ffffffbd !important;
  text-align: center !important;
  font-size: 14px !important;
}
.lottery-divider {
  margin: -10px 10px -10px 10px !important;
  width: 90% !important;
}
.n-divider__line {
  background-color: #ffffffd5 !important;
}
.lottery-content {
  background-color: #0f0f0f4f !important;
  margin: 10px !important;
  padding: 10px !important;
  height: 100% !important;
  border-radius: 10px !important;
}
.lottery-list-item {
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
.lottery-avatar {
  height: 30px !important;
  border-radius: 50% !important;
}
</style>
