<script setup lang="ts">
import { NCard } from 'naive-ui'

import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import ClientTranscriptionPanel from '@/apps/client/components/settings/ClientTranscriptionPanel.vue'
</script>

<template>
  <NCard
    size="small"
    style="margin-bottom: 12px;"
  >
    <ClientPageHeader
      title="语音转写"
      description="从直播音频实时转出文字"
    />
  </NCard>
  <NCard
    size="small"
    bordered
  >
    <ClientTranscriptionPanel />
  </NCard>
</template>
