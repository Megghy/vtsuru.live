<script setup lang="ts">
import type { LiveControl } from '@/apps/client/composables/useLiveControl'

const props = defineProps<{ control: LiveControl }>()
const c = props.control
const obsStore = c.obsStore
</script>

<template>
  <NCard
    title="推流信息"
    embedded
    size="small"
    class="live-manage-card"
  >
    <NFlex
      vertical
      :size="12"
    >
      <NAlert
        v-if="!c.rtmpServer.value"
        type="info"
        :bordered="false"
      >
        开播后将自动获取推流地址，请在 OBS 中配置使用
      </NAlert>

      <div>
        <NText strong>
          推流服务器
        </NText>
        <NInputGroup style="margin-top: 8px;">
          <NInput
            :value="c.rtmpServer.value"
            readonly
            size="large"
            placeholder="开播后自动获取"
          />
          <NButton
            :disabled="!c.rtmpServer.value"
            size="large"
            @click="c.copyToClipboard(c.rtmpServer.value)"
          >
            复制
          </NButton>
        </NInputGroup>
      </div>

      <div>
        <NText strong>
          推流码
        </NText>
        <NInputGroup style="margin-top: 8px;">
          <NInput
            :value="c.rtmpCode.value"
            readonly
            size="large"
            type="password"
            show-password-on="click"
            placeholder="开播后自动获取"
          />
          <NButton
            size="large"
            :disabled="!c.rtmpCode.value"
            @click="c.copyToClipboard(c.rtmpCode.value)"
          >
            复制
          </NButton>
          <NButton
            v-if="obsStore.obsConnected"
            type="primary"
            size="large"
            :disabled="!c.rtmpServer.value || !c.rtmpCode.value"
            @click="c.handleSyncStreamKeyToObs"
          >
            同步到 OBS
          </NButton>
        </NInputGroup>
      </div>

      <NText
        depth="3"
        style="font-size: 12px; display: block;"
      >
        请在 OBS 等推流软件中将服务器设置为上方地址，串流密钥设置为上方推流码。
      </NText>
    </NFlex>
  </NCard>
</template>
