<script setup lang="ts">
import { useAccount } from '@/api/account';
import { BaseRTCClient, MasterRTCClient, SlaveRTCClient } from '@/data/RTCClient';
import { useWebRTC } from '@/store/useRTC';
import { NButton, NInput, NSpin } from 'naive-ui';
import { computed, Ref, ref } from 'vue';
import { useRoute } from 'vue-router';
import DanmujiOBS from './obs/DanmujiOBS.vue';
import { useDanmakuClient } from '@/store/useDanmakuClient';

const target = ref('');
const accountInfo = useAccount()
const route = useRoute()
const inputMsg = ref('')

const isMaster = computed(() => {
  return route.query.slave == null || route.query.slave == undefined
})
const dc = useDanmakuClient()
const customCss = ref('')

let rtc= useWebRTC()
const danmujiRef = ref()

async function mount() {
  rtc.Init(isMaster.value ? 'master' : 'slave')
  dc.initOpenlive()
}
</script>

<template>
  <NSpin
    v-if="!accountInfo.id"
    show
  />
  <div
    v-else
    @vue:mounted="mount"
  >
    master: {{ isMaster }}
    <template v-if="isMaster">
      <NInput v-model:value="inputMsg" />
      <NButton @click="rtc.send('test', inputMsg)">
        发送
      </NButton>
    </template>

    <NInput
      v-model:value="customCss"
      placeholder="css"
      @update:value="s => danmujiRef?.setCss(s.toString())"
    />
    <DanmujiOBS
      ref="danmujiRef"
      :custom-css="customCss"
      style="width: 400px;height: 700px;"
      :is-o-b-s="false"
    />
  </div>
</template>