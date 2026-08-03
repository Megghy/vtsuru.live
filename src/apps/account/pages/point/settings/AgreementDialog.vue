<script setup lang="ts">
// @ts-expect-error Markdown files are compiled as Vue components by the Vite plugin.
import UserAgreement from '@/content/agreements/UserAgreement.md'

const open = defineModel<boolean>('open', { required: true })
</script>

<template>
  <UModal
    v-model:open="open"
    title="用户协议"
    :ui="{ content: 'point-settings__agreement' }"
  >
    <template #body>
      <div class="point-settings__agreement-scroll">
        <UserAgreement />
      </div>
    </template>
  </UModal>
</template>
