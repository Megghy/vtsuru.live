<script setup lang="ts">
import { useAccount } from '@/api/account';
import { MasterRTCClient, SlaveRTCClient } from '@/data/RTCClient';
import { useWebRTC } from '@/store/useRTC';
import { NButton, NInput, NSpin } from 'naive-ui';
import { LogLevel, Peer } from 'peerjs';
import { computed, onMounted, Ref, ref } from 'vue';
import { useRoute } from 'vue-router';

const target = ref('');
const accountInfo = useAccount()
const route = useRoute()
const inputMsg = ref('')

const isMaster = computed(() => {
  return route.query.slave == null || route.query.slave == undefined
})

let rtc: Ref<MasterRTCClient | undefined, MasterRTCClient | undefined> | Ref<SlaveRTCClient | undefined, SlaveRTCClient | undefined>

function mount() {
  rtc = useWebRTC().Init(isMaster.value ? 'master' : 'slave')
}
</script>

<template>
  <NSpin show v-if="!accountInfo.id" />
  <div v-else @vue:mounted="mount">
    master: {{ isMaster }}
    {{ rtc?.peer?.id }}
    <template v-if="isMaster">
      <NInput v-model:value="inputMsg" />
      <NButton @click="rtc.send('test', inputMsg)"> 发送 </NButton>
    </template>
  </div>
</template>