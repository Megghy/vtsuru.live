<script setup lang="ts">
import { DocumentText24Regular } from '@vicons/fluent'
import { NButton, NIcon } from 'naive-ui'
import { ref } from 'vue'

import AccountAccessPanel from './settings/AccountAccessPanel.vue'
import AddressSettingsPanel from './settings/AddressSettingsPanel.vue'
import AgreementDialog from './settings/AgreementDialog.vue'

import './settings/pointUserSettings.css'

const addressPanel = ref<InstanceType<typeof AddressSettingsPanel>>()
const accountPanel = ref<InstanceType<typeof AccountAccessPanel>>()
const showAgreement = ref(false)

function reset() {
  addressPanel.value?.reset()
  accountPanel.value?.reset()
  showAgreement.value = false
}

defineExpose({ reset })
</script>

<template>
  <div class="point-settings">
    <header class="point-settings__header">
      <div>
        <span class="point-settings__eyebrow">ACCOUNT</span>
        <h1>账户设置</h1>
      </div>
      <NButton
        quaternary
        size="small"
        @click="showAgreement = true"
      >
        <template #icon><NIcon :component="DocumentText24Regular" /></template>
        用户协议
      </NButton>
    </header>

    <div class="point-settings__sections">
      <AddressSettingsPanel
        ref="addressPanel"
        @show-agreement="showAgreement = true"
      />
      <AccountAccessPanel ref="accountPanel" />
    </div>

    <AgreementDialog v-model:show="showAgreement" />
  </div>
</template>
