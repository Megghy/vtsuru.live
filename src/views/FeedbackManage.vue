<script setup lang="ts">
import { useAccount } from '@/api/account'
import { FeedbackStatus, FeedbackType, ResponseFeedbackModel } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { FEEDBACK_API_URL } from '@/data/constants'
import { List } from 'linqts'
import { NButton, NCard, NCheckbox, NDivider, NEllipsis, NEmpty, NForm, NGrid, NGridItem, NInput, NModal, NRadioButton, NRadioGroup, NSpace, NSpin, NTag, NText, NTooltip, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'

interface FeedbackModel {
  message: string
  type: FeedbackType
  isAnonymous: boolean
}

const accountInfo = useAccount()
const message = useMessage()

const feedbacks = ref<ResponseFeedbackModel[]>(await get())
const orderType = ref<'time' | 'status'>('status')
const order = {
  [FeedbackStatus.Progressing]: 1,
  [FeedbackStatus.Padding]: 2,
  [FeedbackStatus.Todo]: 3,
  [FeedbackStatus.Finish]: 4,
  [FeedbackStatus.Reject]: 5,
}
const selectedFeedback = computed(() => {
  return feedbacks.value.sort((a, b) => {
    if (orderType.value == 'time') {
      return b.createAt - a.createAt
    } else {
      return (order[a.status] ?? 0) - (order[b.status] ?? 0)
    }
  })
})
const showAddModal = ref(false)
const newFeedback = ref<FeedbackModel>({
  message: '',
  type: 0,
  isAnonymous: false,
})

async function get() {
  try {
    const data = await QueryGetAPI<ResponseFeedbackModel[]>(FEEDBACK_API_URL() + 'get')
    if (data.code == 200) {
      return new List(data.data).OrderByDescending((s) => s.createAt).ToArray()
    } else {
      message.error('无法获取数据: ' + data.message)
      return []
    }
  } catch (err) {
    message.error('无法获取数据')
  }
  return []
}
async function add() {
  if (!newFeedback.value.message) {
    message.error('反馈内容不能为空')
    return
  }
  await QueryPostAPI<ResponseFeedbackModel>(FEEDBACK_API_URL() + 'add', newFeedback.value)
    .then((data) => {
      if (data.code == 200) {
        message.success('发送成功, 感谢你的反馈!')
        feedbacks.value.push(data.data)

        showAddModal.value = false
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      message.error('发送失败')
    })
}
</script>

<template>
  <NSpace>
    <NButton @click="showAddModal = true" type="info">添加反馈</NButton>
  </NSpace>
  <NDivider>
    <NTooltip>
      <template #trigger>
        <NRadioGroup v-model:value="orderType" size="small">
          <NRadioButton value="status">状态</NRadioButton>
          <NRadioButton value="time">时间</NRadioButton>
        </NRadioGroup>
      </template>
      排序方式
    </NTooltip>
  </NDivider>
  <NEmpty v-if="feedbacks.length == 0" description="暂无反馈" />
  <NSpace v-else>
    <NCard v-for="item in selectedFeedback" v-bind:key="item.createAt" size="small" embedded style="min-width: 300px">
      <template #header>
        <NTag v-if="item.status == FeedbackStatus.Padding" :bordered="false"> 等待中 </NTag>
        <NTag v-else-if="item.status == FeedbackStatus.Progressing" type="success">
          <template #icon>
            <NSpin :size="12" />
          </template>
          处理中
        </NTag>
        <NTag v-else-if="item.status == FeedbackStatus.Finish" :bordered="false" type="primary"> 已完成 </NTag>
        <NTag v-else-if="item.status == FeedbackStatus.Todo" :bordered="false" type="info"> 计划中 </NTag>
        <NTag v-else-if="item.status == FeedbackStatus.Reject" :bordered="false" type="warning"> 搁置 </NTag>
        <NDivider vertical />
        <NTag v-if="!item.userName"> 匿名 </NTag>
        <template v-else>
          <NEllipsis>
            {{ item.userName }}
          </NEllipsis>
        </template>
      </template>
      <template #header-extra>
        <NTag v-if="item.type == FeedbackType.Opinion" :bordered="false" size="small" type="info" :color="{ color: '#5f877d', textColor: 'white' }"> 建议 </NTag>
        <NTag v-else-if="item.type == FeedbackType.Bug" :bordered="false" size="small" type="info" :color="{ color: '#875f5f', textColor: 'white' }"> Bug </NTag>
        <NTag v-else-if="item.type == FeedbackType.FunctionRequest" :bordered="false" size="small" type="info" :color="{ color: '#5f6887', textColor: 'white' }"> 功能 </NTag>
        <NTag v-else-if="item.type == FeedbackType.Other" :bordered="false" size="small" type="info" :color="{ color: '#595557', textColor: 'white' }"> 其他 </NTag>
      </template>
      {{ item.message }}
      <template v-if="item.replyMessage" #footer>
        <NDivider style="margin: 0px 0 10px 0" />
        <NSpace align="center">
          <div :style="`border-radius: 4px; background-color: #75c37f; width: 10px; height: 15px`"></div>
          <NText>
            {{ item.replyMessage }}
          </NText>
        </NSpace>
      </template>
    </NCard>
  </NSpace>
  <NModal v-model:show="showAddModal" preset="card" title="添加反馈" style="width: 600px; max-width: 90vw">
    <NSpace vertical>
      <NInput v-model:value="newFeedback.message" type="textarea" placeholder="请输入反馈内容" clearable show-count maxlength="1000" />
      <NRadioGroup v-model:value="newFeedback.type" name="radiogroup">
        <NRadioButton :value="FeedbackType.Opinion">建议 / 意见</NRadioButton>
        <NRadioButton :value="FeedbackType.Bug">Bug</NRadioButton>
        <NRadioButton :value="FeedbackType.FunctionRequest">功能需求</NRadioButton>
        <NRadioButton :value="FeedbackType.Other">其他</NRadioButton>
      </NRadioGroup>
      <NCheckbox v-model:checked="newFeedback.isAnonymous">匿名</NCheckbox>
      <NDivider style="margin: 10px 0 10px 0" />
      <NButton @click="add" type="primary">发送</NButton>
    </NSpace>
  </NModal>
</template>
