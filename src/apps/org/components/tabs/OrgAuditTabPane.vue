<script setup lang="ts">
import { NAlert } from 'naive-ui';
import OrgAuditTab from '../OrgAuditTab.vue'

defineProps<{
  isOrgAdmin: boolean
  orgId: number
}>()
</script>

<template>
  <template v-if="!isOrgAdmin">
    <NAlert type="warning" :bordered="false">
      需要组织管理员权限才能查看审计
    </NAlert>
  </template>
  <template v-else>
    <OrgAuditTab :org-id="orgId" />
  </template>
</template>
