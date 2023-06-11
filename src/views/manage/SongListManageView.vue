<script setup lang="ts">
import { SongsInfo } from '@/api/api-models'
import SongList from '@/components/SongList.vue'
import { ref } from 'vue'

const songs = ref<SongsInfo[]>([])
</script>

<template>
  <SongList :songs="songs" />
</template>
