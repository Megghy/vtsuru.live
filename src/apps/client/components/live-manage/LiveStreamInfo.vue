<script setup lang="ts">
import type { LiveControl } from '@/apps/client/composables/useLiveControl'

const props = defineProps<{ control: LiveControl }>()
const c = props.control
const obsStore = c.obsStore
</script>

<template>
  <UCard
    title="推流信息"
    embedded
    size="small"
    class="live-manage-card"
  >
    <div
      vertical
      :size="12"
    >
      <UAlert
        v-if="!c.rtmpServer.value"
        type="info"
        :bordered="false"
      >
        开播后将自动获取推流地址，请在 OBS 中配置使用
      </UAlert>

      <div>
        <span strong> 推流服务器 </span>
        <div style="margin-top: 8px">
          <UInput
            :value="c.rtmpServer.value"
            readonly
            size="large"
            placeholder="开播后自动获取"
          />
          <UButton
            :disabled="!c.rtmpServer.value"
            size="large"
            @click="c.copyToClipboard(c.rtmpServer.value)"
          >
            复制
          </UButton>
        </div>
      </div>

      <div>
        <span strong> 推流码 </span>
        <div style="margin-top: 8px">
          <UInput
            :value="c.rtmpCode.value"
            readonly
            size="large"
            type="password"
            show-password-on="click"
            placeholder="开播后自动获取"
          />
          <UButton
            size="large"
            :disabled="!c.rtmpCode.value"
            @click="c.copyToClipboard(c.rtmpCode.value)"
          >
            复制
          </UButton>
          <UButton
            v-if="obsStore.obsConnected"
            color="primary"
            size="large"
            :disabled="!c.rtmpServer.value || !c.rtmpCode.value"
            @click="c.handleSyncStreamKeyToObs"
          >
            同步到 OBS
          </UButton>
        </div>
      </div>

      <span
        depth="3"
        style="font-size: 12px; display: block"
      >
        请在 OBS 等推流软件中将服务器设置为上方地址，串流密钥设置为上方推流码。
      </span>
    </div>
  </UCard>
</template>
