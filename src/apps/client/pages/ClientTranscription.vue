<script setup lang="ts">
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import ClientTranscriptionPanel from '@/apps/client/components/settings/ClientTranscriptionPanel.vue'
import { Card, CardContent } from '@/shared/ui/card'
</script>

<template>
  <Card class="mb-3 p-3">
    <ClientPageHeader
      title="语音转写"
      description="从直播音频实时转出文字"
    />
  </Card>
  <Card class="p-3">
    <ClientTranscriptionPanel />
  </Card>
</template>
