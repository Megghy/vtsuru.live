<script setup lang="ts">
import { NModal, NScrollbar } from 'naive-ui'

// @ts-expect-error Markdown files are compiled as Vue components by the Vite plugin.
import UserAgreement from '@/content/agreements/UserAgreement.md'

const show = defineModel<boolean>('show', { required: true })
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    title="用户协议"
    class="point-settings__agreement"
  >
    <NScrollbar class="point-settings__agreement-scroll">
      <UserAgreement />
    </NScrollbar>
  </NModal>
</template>
