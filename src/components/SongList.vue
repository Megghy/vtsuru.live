<script setup lang="ts">
import type { VNodeChild } from 'vue'
import type { SongsInfo } from '@/api/api-models'
import SongListTable from '@/components/song-list/SongListTable.vue'
import { ref } from 'vue'

defineProps<{
  songs: SongsInfo[]
  canEdit?: boolean
  isSelf: boolean
  extraButton?: (song: SongsInfo) => VNodeChild[]
}>()

const tableRef = ref<InstanceType<typeof SongListTable>>()

defineExpose({
  nextPage: () => tableRef.value?.nextPage(),
  prevPage: () => tableRef.value?.prevPage(),
  currentPage: () => tableRef.value?.currentPage,
})
</script>

<template>
  <SongListTable ref="tableRef" :songs="songs" :can-edit="canEdit" :is-self="isSelf" :extra-button="extraButton" />
</template>
