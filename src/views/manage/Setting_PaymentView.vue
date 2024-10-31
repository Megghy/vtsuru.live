<script setup lang="ts">
import { useAccount } from '@/api/account';
import { ConsumptionTypes } from '@/api/models/consumption';
import { NFlex, NIcon, NLayout, NLayoutSider, NMenu, NTabPane, NTabs } from 'naive-ui';
import { h, onMounted } from 'vue';
import { useConsumptionSettingStore } from '@/store/usePaymentSettingStore';
import { CheckmarkCircle24Filled } from '@vicons/fluent';

const accountInfo = useAccount()
const useConsumption = useConsumptionSettingStore()

const { } = defineProps<{

}>()
const enabledIcon = h(NIcon, { component: CheckmarkCircle24Filled, color: 'lightgrey' })
const disabledIcon = h(NIcon, { component: CheckmarkCircle24Filled, color: 'red' })
const tabDisplay = (type: ConsumptionTypes) => {
  const setting = useConsumption.GetSetting(type)
  return h(NFlex, {}, () => [
    h(NIcon, { component: setting.isEnabled ? enabledIcon : disabledIcon, }),
    h('span', {}, setting.isEnabled ? '已启用' : '未启用'),
  ])
}

async function getAccountPaymentSettings() {
  try {

  } catch (error) {
    console.error(error)
  }
}

onMounted(() => {
  getAccountPaymentSettings()
});
</script>

<template>
  <NTabs animated type="line">
    <NTabPane name="弹幕储存" tab="弹幕储存">
      <template #tab>
        <component :is="tabDisplay(ConsumptionTypes.DanmakuStorage)" />
      </template>
    </NTabPane>
  </NTabs>
</template>