<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useAccount } from '@/api/account'
import DanmujiOBS from '@/apps/obs/pages/DanmujiOBS.vue'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Spin } from '@/shared/ui/spin'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { useWebRTC } from '@/store/useRTC'

const accountInfo = useAccount()
const route = useRoute()
const inputMsg = ref('')

const isMaster = computed(() => {
  return route.query.slave == null || route.query.slave == undefined
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
  <div
    v-if="!accountInfo.id"
    class="p-8 flex justify-center"
  >
    <Spin />
  </div>
  <div
    v-else
    class="p-6 space-y-4"
    @vue:mounted="mount"
  >
    <div class="text-sm text-muted-foreground">master: {{ isMaster }}</div>
    <template v-if="isMaster">
      <div class="flex gap-2 max-w-md">
        <Input v-model="inputMsg" />
        <Button @click="rtc.send('test', inputMsg)"> 发送 </Button>
      </div>
    </template>

    <div class="max-w-md">
      <Input v-model="customCss" placeholder="css" @update:model-value="(s) => danmujiRef?.setCss(String(s))"
      />
    </div>
    <DanmujiOBS
      ref="danmujiRef"
      :custom-css="customCss"
      style="width: 400px; height: 700px"
      :is-o-b-s="false"
    />
  </div>
</template>
