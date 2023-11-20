<script setup lang="ts">
import { Setting_SongRequest, SongRequestInfo, SongsInfo, UserInfo } from '@/api/api-models';
import { NGridItem, NGrid } from 'naive-ui'

const props = defineProps<{
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
  songRequestSettings: Setting_SongRequest
  songRequretActive: SongRequestInfo[]
  currentData: SongsInfo[] | undefined
}>()
</script>
<template>
  <NGrid>
    <NGridItem> </NGridItem>
  </NGrid>
</template>
