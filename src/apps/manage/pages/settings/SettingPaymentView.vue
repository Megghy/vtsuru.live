<script setup lang="ts">
import {
  NDivider,
  NTabPane,
  NTabs,
} from 'naive-ui'
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
  <div v-if="true && !isDev">
    WIP...
  </div>
  <NTabs>
    <NTabPane name="overview" tab="概览">
      {{ accountInfo.point }}
    </NTabPane>
  </NTabs>
  <component :is="tabDisplay(ConsumptionTypes.DanmakuStorage)" />
</template>
