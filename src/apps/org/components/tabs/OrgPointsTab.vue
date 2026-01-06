<script setup lang="ts">
import { NAlert } from 'naive-ui'
import OrgPointManage from '../OrgPointManage.vue'

defineProps<{
  isOrgAdmin: boolean
  orgId: number
  streamerOptions: { label: string, value: number }[]
}>()
</script>

<template>
  <template v-if="!isOrgAdmin">
    <NAlert type="warning" :bordered="false">
      需要组织管理员权限才能管理积分
    </NAlert>
  </template>
  <template v-else>
    <OrgPointManage
      :org-id="orgId"
      :streamer-options="streamerOptions"
    />
  </template>
</template>
