<script setup lang="ts">
import { useAccount } from '@/api/account'
import { SongsInfo, UserInfo } from '@/api/api-models'
import SongList from '@/components/SongList.vue'
import { NDivider } from 'naive-ui'

const accountInfo = useAccount()

defineProps<{
  userInfo: UserInfo | undefined
  biliInfo: any | undefined
  currentData: SongsInfo[] | undefined
}>()
</script>

<template>
  <NDivider style="margin-top: 10px" />
  <SongList v-if="currentData" :songs="currentData ?? []" :is-self="accountInfo?.id == userInfo?.id" v-bind="$attrs" />
  <NDivider />
</template>
