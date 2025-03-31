<script lang="ts" setup>
import { UserInfo, VideoCollectTable } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import VideoCollectInfoCard from '@/components/VideoCollectInfoCard.vue'
import { VIDEO_COLLECT_API_URL } from '@/data/constants'
import { NEmpty, NFlex, NList, NListItem, NSpin, useMessage } from 'naive-ui'
import { ref } from 'vue'

const props = defineProps<{
  biliInfo: any | undefined
  userInfo: UserInfo
  template?: string | undefined
}>()

const isLoading = ref(true)
const message = useMessage()

const videoTables = ref<VideoCollectTable[]>(await get())
async function get() {
  try {
    isLoading.value = true
    const data = await QueryGetAPI<VideoCollectTable[]>(VIDEO_COLLECT_API_URL + 'get-active', {
      id: props.userInfo.id,
    })
    if (data.code == 200) {
      //videoTables.value = data.data
      return data.data
    } else {
      message.error('获取失败: ' + data.message)
      return []
    }
  } catch (err) {
    message.error('获取失败')
    return []
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div>
    <NSpin :show="isLoading">
      <NFlex justify="center">
        <NEmpty
          v-if="videoTables.length == 0"
          description="没有正在进行的征集表"
        />
        <NList v-else>
          <NListItem
            v-for="item in videoTables"
            :key="item.id"
          >
            <VideoCollectInfoCard
              :item="item"
              can-click
              style="width: 500px; max-width: 70vw"
              from="user"
            />
          </NListItem>
        </NList>
      </NFlex>
    </NSpin>
  </div>
</template>
