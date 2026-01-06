<script lang="ts" setup>
import type { UserInfo } from '@/api/api-models'
import DefaultIndexTemplate from '@/apps/user/pages/indexTemplate/DefaultIndexTemplate.vue'

defineProps<{
  biliInfo: any | undefined
  userInfo: UserInfo | undefined
  template?: string | undefined
}>()

const componentType = DefaultIndexTemplate
</script>

<template>
  <div>
    <component
      :is="componentType"
      :user-info="userInfo"
      :bili-info="biliInfo"
    />
  </div>
</template>
