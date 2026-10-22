<script setup lang="ts">
import { DocumentText24Regular } from '@vicons/fluent'
import { ref } from 'vue'

import { useAccount } from '@/api/account'
import AccountPageHeader from '@/apps/account/components/AccountPageHeader.vue'
import AccountSecurityPanel from '@/apps/account/components/AccountSecurityPanel.vue'
import { Button } from '@/shared/ui/button'

import AccountAccessPanel from './settings/AccountAccessPanel.vue'
import AddressSettingsPanel from './settings/AddressSettingsPanel.vue'
import AgreementDialog from './settings/AgreementDialog.vue'

import './settings/pointUserSettings.css'

const addressPanel = ref<InstanceType<typeof AddressSettingsPanel>>()
const account = useAccount()
const accountPanel = ref<InstanceType<typeof AccountAccessPanel>>()
const securityPanel = ref<InstanceType<typeof AccountSecurityPanel>>()
const showAgreement = ref(false)

function reset() {
  addressPanel.value?.reset()
  accountPanel.value?.reset()
  securityPanel.value?.reset()
  showAgreement.value = false
}

defineExpose({ reset })
</script>

<template>
  <div class="point-settings">
    <AccountPageHeader
      title="账户设置"
      subtitle="管理你的收件地址、B站登录凭证与账户安全设置。"
    >
      <template #actions>
        <Button
          variant="outline"
          class="flex items-center gap-1.5"
          @click="showAgreement = true"
        >
          <component
            :is="DocumentText24Regular"
            class="size-4"
          />
          用户协议
        </Button>
      </template>
    </AccountPageHeader>

    <div class="point-settings__sections">
      <AddressSettingsPanel
        ref="addressPanel"
        @show-agreement="showAgreement = true"
      />
      <AccountAccessPanel ref="accountPanel" />
      <AccountSecurityPanel
        v-if="account.id"
        ref="securityPanel"
      />
    </div>

    <AgreementDialog v-model:show="showAgreement" />
  </div>
</template>
