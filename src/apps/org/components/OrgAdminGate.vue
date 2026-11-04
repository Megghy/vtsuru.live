<script setup lang="ts">
import { Alert, AlertDescription } from '@/shared/ui/alert'

import { useOrgContext } from '../composables/useOrgContext'

withDefaults(defineProps<{ message?: string }>(), {
  message: '需要组织管理员权限才能访问',
})

const { isOrgAdmin } = useOrgContext()
</script>

<template>
  <Alert size="sm" variant="warning" v-if="!isOrgAdmin">
    <AlertDescription>{{ message }}</AlertDescription>
  </Alert>
  <slot v-else />
</template>
