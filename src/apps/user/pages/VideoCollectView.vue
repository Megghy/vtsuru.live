<script lang="ts" setup>
import { onMounted, ref } from 'vue'

import type { ResponseUserInfo, ResponseVideoCollectModel } from '@/api/generated/model'
import { getApiVideoCollectGetActive } from '@/api/generated/video-collect/video-collect'
import VideoCollectInfoCard from '@/components/VideoCollectInfoCard.vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Spin } from '@/shared/ui/spin'
import { useMessage } from '@/shared/utils'

const props = defineProps<{
  userInfo: ResponseUserInfo
}>()

const isLoading = ref(true)
const message = useMessage()

const videoTables = ref<ResponseVideoCollectModel[]>([])

async function get() {
  try {
    isLoading.value = true
    const data = (await getApiVideoCollectGetActive({
      id: String(props.userInfo.id),
    })) as unknown as {
      code: number
      message?: string
      data?: ResponseVideoCollectModel[]
    }
    if (data.code === 200) {
      videoTables.value = data.data ?? []
    } else {
      message.error(`获取失败: ${data.message}`)
    }
  } catch (err) {
    console.error(err)
    message.error('获取失败')
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  get()
})
</script>

<template>
  <div class="flex flex-col gap-[var(--vtsuru-page-spacing)]">
    <Card>
      <CardHeader class="py-3 px-4">
        <CardTitle class="text-base font-medium">视频征集</CardTitle>
      </CardHeader>
      <CardContent class="p-4 pt-0">
        <Spin :show="isLoading">
          <template v-if="videoTables.length === 0">
            <div class="flex justify-center py-5">
              <Empty description="没有正在进行的征集表" />
            </div>
          </template>
          <div
            v-else
            class="video-collect-list flex flex-col divide-y divide-border"
          >
            <div
              v-for="item in videoTables"
              :key="item.id"
              class="py-3 first:pt-0 last:pb-0"
            >
              <VideoCollectInfoCard
                :item="item"
                can-click
                from="user"
              />
            </div>
          </div>
        </Spin>
      </CardContent>
    </Card>
  </div>
</template>
