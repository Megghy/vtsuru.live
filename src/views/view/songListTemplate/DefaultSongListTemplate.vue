<script setup lang="ts">
import { useAccount } from '@/api/account';
import { SongsInfo, UserInfo } from '@/api/api-models'
import SongList from '@/components/SongList.vue'
import { NDivider } from 'naive-ui';

const accountInfo = useAccount()

const props = defineProps<{
  userInfo: UserInfo | undefined
  songs: SongsInfo[] | undefined
}>()
</script>

<template>
  <SongList v-if="songs" :songs="songs ?? []" :is-self="accountInfo?.id.toString() == $route.params.id?.toString()"/>
  <NDivider/>
</template>
