<script setup lang="ts">
import type { VideoCollectDetail, VideoCollectTable } from '@/api/api-models'
import {
  NAlert,
  NButton,
  NCard,
  NDivider,
  NInput,
  NInputNumber,
  NLayoutContent,
  NResult,
  NSpace,
  NText,
  useMessage,
} from 'naive-ui'
import { onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import VueTurnstile from 'vue-turnstile'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import VideoCollectInfoCard from '@/components/VideoCollectInfoCard.vue'
import { TURNSTILE_KEY, VIDEO_COLLECT_API_URL } from '@/data/constants'

interface AddVideoModel {
  id: string
  video: string
  name: string
  uid: number
  description: string
}

const message = useMessage()
const route = useRoute()

const token = ref('')
const turnstile = ref()

const table = ref<VideoCollectTable | null>(await get())
const addModel = ref({} as AddVideoModel)
const isLoading = ref(false)

async function get() {
  try {
    const data = await QueryGetAPI<VideoCollectDetail>(`${VIDEO_COLLECT_API_URL}get`, { id: route.params.id })
    if (data.code == 200) {
      return data.data.table
    }
  } catch (err) {
    message.error('获取失败')
  }
  return null
}
async function add() {
  if (!addModel.value.video) {
    message.error('请输入视频')
    return
  }
  isLoading.value = true
  addModel.value.id = table.value?.id ?? route.params.id.toString()
  await QueryPostAPI(`${VIDEO_COLLECT_API_URL}add`, addModel.value, [['Turnstile', token.value]])
    .then((data) => {
      if (data.code == 200) {
        message.success('已成功推荐视频')
        setTimeout(() => {
          location.reload()
        }, 1000)
      } else {
        message.error(`添加失败: ${data.message}`)
      }
    })
    .catch((err) => {
      message.error('添加失败')
    })
    .finally(() => {
      isLoading.value = false
      turnstile.value?.reset()
    })
}
onUnmounted(() => {
  turnstile.value?.remove()
})
</script>

<template>
  <NLayoutContent style="position: relative; height: 100vh">
    <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%)">
      <NResult
        v-if="!table"
        status="404"
        title="指定收集表不存在"
        description="检查一下你输入的链接吧"
      />
      <NCard
        v-else
        style="width: 500px; max-width: 90vw"
      >
        <template #header>
          视频征集
          <NDivider vertical />
          <NButton
            text
            @click="$router.push({ name: 'user-index', params: { id: table.owner?.name } })"
          >
            <NText
              depth="3"
              style="font-size: 14px"
            >
              {{ table.owner?.name }}
            </NText>
          </NButton>
        </template>
        <VideoCollectInfoCard
          :item="table"
          :can-click="false"
          from="user"
        />
        <NDivider />
        <NAlert
          v-if="table.isFinish"
          type="error"
          title="该征集表已截止"
        />
        <NSpace
          v-else
          vertical
        >
          <NInput
            v-model:value="addModel.video"
            placeholder="B站视频链接或BVID"
          />
          <NInput
            v-model:value="addModel.name"
            placeholder="(选填) 推荐人"
          />
          <NInputNumber
            v-model:value="addModel.uid"
            placeholder="(选填) 推荐人UId"
            :show-button="false"
          />
          <NInput
            v-model:value="addModel.description"
            placeholder="(选填) 推荐理由"
          />
          <NButton
            type="primary"
            :loading="isLoading || !token"
            @click="add"
          >
            推荐视频
          </NButton>

          <VueTurnstile
            ref="turnstile"
            v-model="token"
            :site-key="TURNSTILE_KEY"
            theme="auto"
            style="text-align: center"
          />
        </NSpace>
      </NCard>
    </div>
  </NLayoutContent>
</template>
