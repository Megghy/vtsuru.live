<script setup lang="ts">
import { useAccount } from '@/api/account';
import { SongsInfo, UserInfo } from '@/api/api-models'
import SongList from '@/components/SongList.vue'
import { NDivider } from 'naive-ui';

const accountInfo = useAccount()

defineProps<{
  userInfo: UserInfo | undefined
  songs: SongsInfo[] | undefined
}>()
</script>

<template>
  <NDivider style="margin-top: 10px;"/>
  <SongList v-if="songs" :songs="songs ?? []" :is-self="accountInfo?.id == userInfo?.id"/>
  <NDivider/>
</template>
