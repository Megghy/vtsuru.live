<script setup lang="ts">
import { useAccount } from '@/api/account'
import { ConsumptionTypes } from '@/api/models/consumption'
import {
  NFlex,
  NIcon,
  NLayout,
  NLayoutSider,
  NMenu,
  NTabPane,
  NTabs,
  NDivider
} from 'naive-ui'
import { h, onMounted, ref, defineComponent, shallowRef } from 'vue'
import { useConsumptionSettingStore } from '@/store/usePaymentSettingStore'
import { CheckmarkCircle24Filled } from '@vicons/fluent'
import { isDev } from '@/data/constants'

const DanmakuStorageView = defineComponent({
  setup() {
    return () => h('div', [
      h(NDivider),
      h('div', 'WIP...')
    ])
  }
})

const accountInfo = useAccount()
const useConsumption = useConsumptionSettingStore()
const currentComponent = shallowRef(DanmakuStorageView)

const enabledIcon = h(NIcon, {
  component: CheckmarkCircle24Filled,
  color: 'lightgrey'
})
const disabledIcon = h(NIcon, {
  component: CheckmarkCircle24Filled,
  color: 'red'
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