<script setup lang="ts">
import { useOrgContext } from '../composables/useOrgContext'

withDefaults(defineProps<{ message?: string }>(), {
  message: '需要组织管理员权限才能访问',
})

const { isOrgAdmin } = useOrgContext()
</script>

<template>
  <UAlert
    v-if="!isOrgAdmin"
    color="warning"
    icon="i-lucide-shield-alert"
    :title="message"
  />
  <slot v-else />
</template>
