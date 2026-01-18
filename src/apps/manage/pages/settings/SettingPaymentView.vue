<script setup lang="ts">
import { NTabPane, NTabs, NAlert, NCard, NDivider, NText } from 'naive-ui';
import { defineComponent, h, onMounted, shallowRef } from 'vue'
import { useAccount } from '@/api/account'
import { ConsumptionTypes } from '@/api/models/consumption'
import { isDev } from '@/shared/config'

const DanmakuStorageView = defineComponent({
  setup() {
    return () => h('div', [
      h(NDivider),
      h('div', 'WIP...'),
    ])
  },
})

const accountInfo = useAccount()
const currentComponent = shallowRef(DanmakuStorageView)

function tabDisplay(type: ConsumptionTypes) {
  switch (type) {
    case ConsumptionTypes.DanmakuStorage:
      return DanmakuStorageView
  }
  return DanmakuStorageView
}

onMounted(() => {
  currentComponent.value = tabDisplay(ConsumptionTypes.DanmakuStorage)
})
</script>

<template>
  <NCard
    title="增值"
    size="small"
    bordered
    :segmented="{ content: true }"
  >
    <NAlert
      v-if="!isDev"
      type="info"
      size="small"
      :bordered="false"
    >
      增值服务面板正在开发中（WIP）
    </NAlert>

    <template v-else>
      <NTabs type="line" animated size="small">
        <NTabPane name="overview" tab="概览">
          <NText depth="3">
            当前积分：{{ accountInfo.point }}
          </NText>
        </NTabPane>
      </NTabs>
      <component :is="tabDisplay(ConsumptionTypes.DanmakuStorage)" />
    </template>
  </NCard>
</template>
