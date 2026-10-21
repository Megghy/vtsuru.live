<script setup lang="ts">
import { Alert, AlertDescription } from '@/shared/ui/alert'

import { useOrgContext } from '../composables/useOrgContext'

withDefaults(defineProps<{ message?: string }>(), {
  message: '需要组织管理员权限才能访问',
})

const { isOrgAdmin } = useOrgContext()
</script>

<template>
  <Alert
    v-if="!isOrgAdmin"
    class="text-xs bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
  >
    <AlertDescription class="text-xs">{{ message }}</AlertDescription>
  </Alert>
  <slot v-else />
</template>
