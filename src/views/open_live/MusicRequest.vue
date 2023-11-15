<script setup lang="ts">
import { useAccount } from '@/api/account'
import { SongRequestInfo } from '@/api/api-models'
import DanmakuClient, { AuthInfo, DanmakuInfo, RoomAuthInfo, SCInfo } from '@/data/DanmakuClient'
import { NList, NTabPane, NTabs, useMessage } from 'naive-ui'
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const accountInfo = useAccount()
const message = useMessage()

const props = defineProps<{
  client: DanmakuClient
  roomInfo: RoomAuthInfo
  code: string | undefined
}>()

const activeSongs = ref<SongRequestInfo[]>([])

function onGetDanmaku(danmaku: DanmakuInfo) {

}
function onGetSC(danmaku: SCInfo) {

}

onMounted(() => {
  props.client.on('danmaku', onGetDanmaku)
  props.client.on('sc', onGetSC)
})
onUnmounted(() => {
  props.client.off('danmaku', onGetDanmaku)
  props.client.off('sc', onGetSC)
})
</script>

<template>
  开发中...
  <NTabs animated>
    <NTabPane name="list" tab="列表">
      <NList>

      </NList>
    </NTabPane>
    <NTabPane name="history" tab="历史">

    </NTabPane>
  </NTabs>
</template>
