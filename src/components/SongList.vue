<script setup lang="ts">
import type { VNodeChild } from 'vue'
import { ref } from 'vue'

import type { SongRequestInfo } from '@/api/client-types'
import type { ResponseSongModel } from '@/api/generated/model'
import SongListTable from '@/components/song-list/SongListTable.vue'

defineProps<{
  songs: ResponseSongModel[]
  canEdit?: boolean
  isSelf: boolean
  extraButton?: (song: ResponseSongModel) => VNodeChild[]
  liveRequestActive?: SongRequestInfo[]
}>()

const tableRef = ref<InstanceType<typeof SongListTable>>()

defineExpose({
  nextPage: () => tableRef.value?.nextPage(),
  prevPage: () => tableRef.value?.prevPage(),
  currentPage: () => tableRef.value?.currentPage,
})
</script>

<template>
  <SongListTable
    ref="tableRef"
    :songs="songs"
    :can-edit="canEdit"
    :is-self="isSelf"
    :extra-button="extraButton"
    :live-request-active="liveRequestActive"
  />
</template>
