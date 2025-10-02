<script setup lang="ts">
import { CheckmarkCircle24Filled } from '@vicons/fluent'
import {
  NDivider,
  NIcon,
  NTabPane,
  NTabs,
} from 'naive-ui'
import { defineComponent, h, onMounted, shallowRef } from 'vue'
import { useAccount } from '@/api/account'
import { ConsumptionTypes } from '@/api/models/consumption'
import { isDev } from '@/data/constants'
import { useConsumptionSettingStore } from '@/store/usePaymentSettingStore'

const DanmakuStorageView = defineComponent({
  setup() {
    return () => h('div', [
      h(NDivider),
      h('div', 'WIP...'),
    ])
  },
})

const accountInfo = useAccount()
const useConsumption = useConsumptionSettingStore()
const currentComponent = shallowRef(DanmakuStorageView)

const enabledIcon = h(NIcon, {
  component: CheckmarkCircle24Filled,
  color: 'lightgrey',
})
const disabledIcon = h(NIcon, {
  component: CheckmarkCircle24Filled,
  color: 'red',
})

function tabDisplay(type: ConsumptionTypes) {
  const setting = useConsumption.GetSetting(type)
  switch (type) {
    case ConsumptionTypes.DanmakuStorage:
      return DanmakuStorageView
  }
}

async function getAccountPaymentSettings() {
  try {
  } catch (error) {
    console.error(error)
  }
}

onMounted(() => {
  getAccountPaymentSettings()
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
