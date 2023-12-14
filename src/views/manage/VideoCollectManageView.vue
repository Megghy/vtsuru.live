<script setup lang="ts">
import { useAccount } from '@/api/account'
import { VideoCollectTable } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import VideoCollectInfoCard from '@/components/VideoCollectInfoCard.vue'
import { VIDEO_COLLECT_API_URL } from '@/data/constants'
import { Clock24Filled } from '@vicons/fluent'
import {
  CountdownProps,
  FormRules,
  NButton,
  NCard,
  NCountdown,
  NDatePicker,
  NDivider,
  NEllipsis,
  NEmpty,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NList,
  NListItem,
  NModal,
  NSpace,
  NSpin,
  NTag,
  NText,
  NTime,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { ref } from 'vue'

const accountInfo = useAccount()
const message = useMessage()

const isLoading = ref(true)
const createModalVisible = ref(false)
const formRef = ref()
const defaultModel = { maxVideoCount: 50 } as VideoCollectTable
const createVideoModel = ref<VideoCollectTable>(JSON.parse(JSON.stringify(defaultModel)))

const videoTables = ref<VideoCollectTable[]>(await get())

const createRules: FormRules = {
  name: [
    {
      required: true,
      message: '请输入征集表名称',
    },
  ],
  endAt: [
    {
      required: true,
      message: '请输入结束日期',
    },
    {
      required: true,
      message: '结束时间不能低于一小时',
      validator: (rule: unknown, value: string) => {
        const date = new Date(value)
        if (date.getTime() < new Date().getTime() + 1000 * 60 * 60) {
          return false
        }
        return true
      },
    },
  ],
  maxVideoCount: [
    {
      required: true,
      message: '请输入最大视频数量',
    },
    {
      required: true,
      message: '视频不能少于1个',
      trigger: ['input', 'blur'],
      validator: (rule: unknown, value: string) => {
        if (Number(value) < 1) {
          return false
        }
        return true
      },
    },
  ],
}
function dateDisabled(ts: number) {
  return ts < Date.now() + 1000 * 60 * 60
}

const isLoading2 = ref(false)
async function get() {
  try {
    isLoading.value = true
    const data = await QueryGetAPI<VideoCollectTable[]>(VIDEO_COLLECT_API_URL() + 'get-all')
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
function createTable() {
  formRef.value?.validate().then(async () => {
    isLoading2.value = true
    QueryPostAPI<VideoCollectTable>(VIDEO_COLLECT_API_URL() + 'create', createVideoModel.value)
      .then((data) => {
        if (data.code == 200) {
          videoTables.value.push(data.data)
          createModalVisible.value = false
          message.success('创建成功')
          createVideoModel.value = JSON.parse(JSON.stringify(defaultModel))
        } else {
          message.error('创建失败: ' + data.message)
        }
      })
      .catch((err) => {
        message.error('创建失败')
      })
      .finally(() => {
        isLoading2.value = false
      })
  })
}
</script>

<template>
  <NSpace>
    <NButton @click="createModalVisible = true" type="primary"> 新建征集表 </NButton>
  </NSpace>
  <NDivider />
  <NSpin :show="isLoading">
    <NSpace justify="center">
      <NEmpty v-if="videoTables.length == 0" />
      <NList v-else>
        <NListItem v-for="item in videoTables" :key="item.id">
          <VideoCollectInfoCard :item="item" canClick style="width: 500px; max-width: 70vw" />
        </NListItem>
      </NList>
    </NSpace>
  </NSpin>
  <NModal v-model:show="createModalVisible" preset="card" title="创建视频征集" style="width: 600px; max-width: 90vw">
    <NForm ref="formRef" :model="createVideoModel" :rules="createRules">
      <NFormItem label="标题" path="name">
        <NInput v-model:value="createVideoModel.name" placeholder="征集表的标题" maxlength="30" show-count />
      </NFormItem>
      <NFormItem label="描述" path="description">
        <NInput v-model:value="createVideoModel.description" placeholder="可以是备注之类的" maxlength="300" show-count />
      </NFormItem>
      <NFormItem label="视频数量" path="maxVideoCount">
        <NInputNumber v-model:value="createVideoModel.maxVideoCount" placeholder="最大数量" type="number" style="max-width: 150px" />
      </NFormItem>
      <NFormItem label="结束时间" path="endAt">
        <NDatePicker v-model:value="createVideoModel.endAt" type="datetime" placeholder="结束征集的时间" :isDateDisabled="dateDisabled" />
        <NDivider vertical />
        <NText depth="3"> 最低为一小时 </NText>
      </NFormItem>
      <NFormItem>
        <NSpace>
          <NButton type="primary" @click="createTable" :loading="isLoading2"> 创建 </NButton>
        </NSpace>
      </NFormItem>
    </NForm>
  </NModal>
</template>
