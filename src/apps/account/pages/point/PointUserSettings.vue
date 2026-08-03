<script setup lang="ts">
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
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-lucide-file-text"
        @click="showAgreement = true"
      >
        用户协议
      </UButton>
    </header>

    <div class="point-settings__sections">
      <AddressSettingsPanel
        ref="addressPanel"
        @show-agreement="showAgreement = true"
      />
      <AccountAccessPanel ref="accountPanel" />
    </div>

    <AgreementDialog v-model:open="showAgreement" />
  </div>
</template>
