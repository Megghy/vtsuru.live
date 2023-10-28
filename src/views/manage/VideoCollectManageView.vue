<script setup lang="ts">
import { useAccount } from '@/api/account'
import { VideoCollectTable } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { VIDEO_COLLECT_API_URL } from '@/data/constants'
import { NCard, NDivider, NList, NListItem, NSpace, NSpin, useMessage } from 'naive-ui'
import { ref } from 'vue'

const accountInfo = useAccount()
const message = useMessage()

const videoTables = ref<VideoCollectTable[]>([])

const isLoading = ref(true)

function get() {
  QueryGetAPI<VideoCollectTable[]>(VIDEO_COLLECT_API_URL + 'get-all')
    .then((data) => {
      if (data.code == 200) {
        videoTables.value = data.data
      } else {
        message.error('获取失败: ' + data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('获取失败')
    })
    .finally(() => {
      isLoading.value = false
    })
}
</script>

<template>
  <NSpace> </NSpace>
  <NDivider />
  <NSpin :show="isLoading">
    <NSpace justify="center">
      <NList>
        <NListItem>
          <NCard size="small">
            <template #header> </template>
          </NCard>
        </NListItem>
      </NList>
    </NSpace>
  </NSpin>
</template>
