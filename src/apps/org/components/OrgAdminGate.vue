<script setup lang="ts">
import { NAlert } from 'naive-ui'
import { useOrgContext } from '../composables/useOrgContext'

withDefaults(defineProps<{ message?: string }>(), {
  message: '需要组织管理员权限才能访问',
})

const { isOrgAdmin } = useOrgContext()
</script>

<template>
  <NAlert v-if="!isOrgAdmin" type="warning" :bordered="false">
    {{ message }}
  </NAlert>
  <slot v-else />
</template>
