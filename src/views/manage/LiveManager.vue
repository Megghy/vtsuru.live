<script setup lang="ts">
import type { ResponseLiveInfoModel } from '@/api/api-models'
import { NAlert, NDivider, NList, NListItem, NPagination, NSpace, useMessage } from 'naive-ui'
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStorage } from '@vueuse/core'
import { useAccount } from '@/api/account'
import { QueryGetAPI } from '@/api/query'
import EventFetcherStatusCard from '@/components/EventFetcherStatusCard.vue'
import LiveInfoContainer from '@/components/LiveInfoContainer.vue'
import { LIVE_API_URL } from '@/data/constants'

defineOptions({ name: 'ManageLiveView' })

const accountInfo = useAccount()
const message = useMessage()
const route = useRoute()
const router = useRouter()

const lives = ref<ResponseLiveInfoModel[]>(await getAll())
const page = useSessionStorage<number>('ManageLive.page', 1)
const pageSize = useStorage<number>('ManageLive.pageSize', 10)
const defaultDanmakusCount = ref(0)

watch([lives, pageSize], () => {
  const total = lives.value.length
  const size = pageSize.value || 10
  const maxPage = Math.max(1, Math.ceil(total / size))
  if (page.value > maxPage) page.value = maxPage
})

async function getAll() {
  try {
    const data = await QueryGetAPI<ResponseLiveInfoModel[]>(`${LIVE_API_URL}get-all`)
    if (data.code == 200) {
      return data.data
    } else {
      message.error(`无法获取数据: ${data.message}`)
      return []
    }
  } catch (err) {
    message.error('无法获取数据')
  }
  return []
}

function OnClickCover(live: ResponseLiveInfoModel) {
  router.push({
    name: 'manage-liveDetail',
    params: { id: live.liveId },
  })
}
</script>

<template>
  <NSpace
    vertical
    justify="center"
    align="center"
  >
    <EventFetcherAlert />
    <EventFetcherStatusCard />
  </NSpace>
  <NDivider />
  <NAlert
    v-if="accountInfo?.isBiliVerified != true"
    type="info"
  >
    尚未进行Bilibili认证
  </NAlert>
  <template v-else>
    <NSpace
      vertical
      justify="center"
      align="center"
    >
      <NPagination
        v-model:page="page"
        v-model:page-size="pageSize"
        show-quick-jumper
        show-size-picker
        :page-sizes="[10, 20, 30, 40]"
        :item-count="lives.length"
      />
    </NSpace>
    <NDivider />
    <NList
      bordered
      hoverable
      clickable
    >
      <NListItem
        v-for="live in lives.slice((page - 1) * pageSize, page * pageSize)"
        :key="live.liveId"
        @click="OnClickCover(live)"
      >
        <LiveInfoContainer
          :key="live.liveId"
          :live="live"
        />
      </NListItem>
    </NList>
  </template>
</template>
