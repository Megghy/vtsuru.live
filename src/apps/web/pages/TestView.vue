<script setup lang="ts">
import { ref } from 'vue'

import { useAccount } from '@/api/account'
import DanmujiOBS from '@/apps/obs/pages/DanmujiOBS.vue'
import { Input } from '@/shared/ui/input'
import { Spin } from '@/shared/ui/spin'
import { useDanmakuClient } from '@/store/useDanmakuClient'

const accountInfo = useAccount()
const dc = useDanmakuClient()
const customCss = ref('')
const danmujiRef = ref()

async function mount() {
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
    <div class="max-w-md">
      <Input
        v-model="customCss"
        placeholder="css"
        @update:model-value="(s) => danmujiRef?.setCss(String(s))"
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
