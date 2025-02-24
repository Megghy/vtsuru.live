<script setup lang="ts">
import { useAccount } from '@/api/account'
import { ResponseLiveInfoModel } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import EventFetcherStatusCard from '@/components/EventFetcherStatusCard.vue'
import LiveInfoContainer from '@/components/LiveInfoContainer.vue'
import { LIVE_API_URL } from '@/data/constants'
import { NAlert, NButton, NDivider, NList, NListItem, NPagination, NSpace, useMessage } from 'naive-ui'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const accountInfo = useAccount()
const message = useMessage()
const route = useRoute()
const router = useRouter()

const lives = ref<ResponseLiveInfoModel[]>(await getAll())
const page = ref(1)
const pageSize = ref(10)
const defaultDanmakusCount = ref(0)

async function getAll() {
  try {
    const data = await QueryGetAPI<ResponseLiveInfoModel[]>(LIVE_API_URL + 'get-all')
    if (data.code == 200) {
      return data.data
    } else {
      message.error('无法获取数据: ' + data.message)
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
  <NSpace vertical>
    <NAlert type="error" title="2024.2.26">
      近期逸站对开放平台直播弹幕流进行了极为严格的限制, 目前本站服务器只能连接个位数的直播间, 这使得在不使用
      <NButton tag="a" href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs" target="_blank" type="primary" text>
        VtsuruEventFetcher
      </NButton>
      的情况下获取弹幕数据几乎不可能实现.
      <br />
      在这种情况下如果你还需要记录直播弹幕请跟随上面链接里的教程部署
      <NButton tag="a" href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs" target="_blank" type="primary" text>
        VtsuruEventFetcher
      </NButton>
      , 否则只能记录直播的时间而不包含弹幕
    </NAlert>

    <EventFetcherStatusCard />
  </NSpace>
  <NDivider />
  <NAlert v-if="accountInfo?.isBiliVerified != true" type="info"> 尚未进行Bilibili认证 </NAlert>
  <template v-else>
    <NSpace vertical justify="center" align="center">
      <NPagination v-model:page="page" v-model:page-size="pageSize" show-quick-jumper show-size-picker
        :page-sizes="[10, 20, 30, 40]" :item-count="lives.length" />
    </NSpace>
    <NDivider />
    <NList bordered hoverable clickable>
      <NListItem @click="OnClickCover(live)" v-for="live in lives.slice((page - 1) * pageSize, page * pageSize)"
        v-bind:key="live.liveId">
        <LiveInfoContainer :live="live" :key="live.liveId" />
      </NListItem>
    </NList>
  </template>
</template>
