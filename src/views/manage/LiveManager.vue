<script setup lang="ts">
import { useAccount } from '@/api/account'
import { ResponseLiveInfoModel } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import LiveInfoContainer from '@/components/LiveInfoContainer.vue'
import { LIVE_API_URL } from '@/data/constants'
import { List } from 'linqts'
import { NButton, NDivider, NList, NListItem, NAlert, NPagination, NPopover, NSpace, NStatistic, NTag, NTime, NTooltip, useMessage } from 'naive-ui'
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
    const data = await QueryGetAPI<ResponseLiveInfoModel[]>(LIVE_API_URL() + 'get-all')
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
    <NAlert type="warning"> 测试功能, 尚不稳定 </NAlert>
    <NAlert type="info">
      当前本站正在测试直接从服务端记录并储存数据, 不过并不清楚B站的风控策略, 此功能不一定会长期有效
      <br />
      在我们被限制连接之前无需部署 VtsuruEventFetcher 即可使用相关功能 (如记录上舰和SC以及直播记录) 😊
    </NAlert>
  </NSpace>
  <br />
  <NAlert v-if="accountInfo?.isBiliVerified != true" type="info"> 尚未进行Bilibili认证 </NAlert>
  <template v-else>
    <NSpace vertical justify="center" align="center">
      <NPagination v-model:page="page" show-quick-jumper show-size-picker :page-sizes="[10, 20, 30, 40]" :item-count="lives.length" />
    </NSpace>
    <NDivider />
    <NList bordered hoverable clickable>
      <NListItem @click="OnClickCover(live)" v-for="live in lives" v-bind:key="live.liveId">
        <LiveInfoContainer :live="live" />
      </NListItem>
    </NList>
  </template>
</template>
