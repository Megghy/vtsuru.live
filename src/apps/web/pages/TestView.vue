<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useAccount } from '@/api/account'
import DanmujiOBS from '@/apps/obs/pages/DanmujiOBS.vue'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { useWebRTC } from '@/store/useRTC'

const accountInfo = useAccount()
const route = useRoute()
const inputMsg = ref('')

const isMaster = computed(() => {
  return route.query.slave == null
})
const dc = useDanmakuClient()
const customCss = ref('')

const rtc = useWebRTC()
const danmujiRef = ref()

async function mount() {
  rtc.Init(isMaster.value ? 'master' : 'slave')
  dc.initOpenlive()
}
</script>

<template>
  <UIcon
    v-if="!accountInfo.id"
    name="i-lucide-loader-circle"
    class="size-6 animate-spin"
  />
  <div
    v-else
    @vue:mounted="mount"
  >
    master: {{ isMaster }}
    <template v-if="isMaster">
      <UInput v-model="inputMsg" />
      <UButton @click="rtc.send('test', inputMsg)"> 发送 </UButton>
    </template>

    <UInput
      v-model="customCss"
      placeholder="css"
      @update:model-value="(s) => danmujiRef?.setCss(s.toString())"
    />
    <DanmujiOBS
      ref="danmujiRef"
      :custom-css="customCss"
      style="width: 400px; height: 700px"
      :is-o-b-s="false"
    />
  </div>
</template>
