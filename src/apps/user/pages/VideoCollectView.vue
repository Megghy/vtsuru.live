<script lang="ts" setup>
import { ref } from 'vue'

import type { UserInfo, VideoCollectTable } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import VideoCollectInfoCard from '@/components/VideoCollectInfoCard.vue'
import { VIDEO_COLLECT_API_URL } from '@/shared/config'

const props = defineProps<{
  biliInfo: any | undefined
  userInfo: UserInfo
  template?: string | undefined
}>()

const isLoading = ref(true)
const toast = useToast()

const videoTables = ref<VideoCollectTable[]>(await get())
async function get() {
  try {
    isLoading.value = true
    const data = await QueryGetAPI<VideoCollectTable[]>(`${VIDEO_COLLECT_API_URL}get-active`, {
      id: props.userInfo.id,
    })
    if (data.code === 200) {
      // videoTables.value = data.data
      return data.data
    } else {
      toast.add({ title: `获取失败: ${data.message}`, color: 'error' })
      return []
    }
  } catch (err) {
    console.error(err)
    toast.add({ title: '获取失败', color: 'error' })
    return []
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <div class="video-collect-view">
    <UCard
      size="small"
      :bordered="true"
      title="视频征集"
      class="user-page-card"
    >
      <div :aria-busy="isLoading">
        <template v-if="videoTables.length === 0">
          <div
            justify="center"
            style="padding: 20px 0"
          >
            <UEmpty
              description="没有正在进行的征集表"
              class="public-empty"
            />
          </div>
        </template>
        <ul
          v-else
          class="video-collect-list"
        >
          <li
            v-for="item in videoTables"
            :key="item.id"
          >
            <VideoCollectInfoCard
              :item="item"
              can-click
              from="user"
            />
          </li>
        </ul>
      </div>
    </UCard>
  </div>
</template>

<style scoped>
.video-collect-view {
  display: flex;
  flex-direction: column;
  gap: var(--vtsuru-page-spacing);
}

.video-collect-list :deep(li) {
  width: 100%;
  min-width: 0;
}
</style>
