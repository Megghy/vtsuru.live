<script setup lang="ts">
import { useAccount } from '@/api/account'
import { FeedbackStatus, FeedbackType, ResponseFeedbackModel } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import FeedbackItem from '@/components/FeedbackItem.vue'
import { FEEDBACK_API_URL } from '@/data/constants'
import { List } from 'linqts'
import {
  NButton,
  NCheckbox,
  NDivider,
  NEmpty,
  NInput,
  NModal,
  NRadioButton,
  NRadioGroup,
  NSpace,
  NText,
  NTooltip,
  useMessage,
} from 'naive-ui'
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
  [FeedbackStatus.Developing]: 6,
}
const selectedFeedback = computed(() => {
  // eslint-disable-next-line vue/no-side-effects-in-computed-properties
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
    const data = await QueryGetAPI<ResponseFeedbackModel[]>(FEEDBACK_API_URL + 'get')
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
  await QueryPostAPI<ResponseFeedbackModel>(FEEDBACK_API_URL + 'add', newFeedback.value)
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
  <NSpace align="center">
    <NTooltip :disabled="accountInfo !== undefined">
      <template #trigger>
        <NButton @click="showAddModal = true" type="info" :disabled="!accountInfo">添加反馈</NButton>
      </template>
      你需要登陆后才能提交反馈
    </NTooltip>
    <NText depth="3"> 或者直接加群 873260337 说也可以 </NText>
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
  <NSpace v-else-if="orderType == 'time'">
    <FeedbackItem v-for="item in selectedFeedback" :item="item" :key="item.createAt" />
  </NSpace>
  <template v-else>
    <NDivider> 开发计划 </NDivider>
    <NEmpty v-if="selectedFeedback.filter((f) => f.status == FeedbackStatus.Developing).length == 0" description="无" />
    <NSpace v-else>
      <FeedbackItem
        v-for="item in selectedFeedback.filter((f) => f.status == FeedbackStatus.Developing)"
        :item="item"
        :key="item.createAt"
      />
    </NSpace>
    <NDivider> 处理中 </NDivider>
    <NEmpty
      v-if="selectedFeedback.filter((f) => f.status == FeedbackStatus.Progressing).length == 0"
      description="无"
    />
    <NSpace v-else>
      <FeedbackItem
        v-for="item in selectedFeedback.filter((f) => f.status == FeedbackStatus.Progressing)"
        :item="item"
        :key="item.createAt"
      />
    </NSpace>
    <NDivider> 等待回复 </NDivider>
    <NEmpty v-if="selectedFeedback.filter((f) => f.status == FeedbackStatus.Padding).length == 0" description="无" />
    <NSpace v-else>
      <FeedbackItem
        v-for="item in selectedFeedback.filter((f) => f.status == FeedbackStatus.Padding)"
        :item="item"
        :key="item.createAt"
      />
    </NSpace>
    <NDivider> 计划中 </NDivider>
    <NEmpty v-if="selectedFeedback.filter((f) => f.status == FeedbackStatus.Todo).length == 0" description="无" />
    <NSpace v-else>
      <FeedbackItem
        v-for="item in selectedFeedback.filter((f) => f.status == FeedbackStatus.Todo)"
        :item="item"
        :key="item.createAt"
      />
    </NSpace>
    <NDivider> 已完成 </NDivider>
    <NEmpty v-if="selectedFeedback.filter((f) => f.status == FeedbackStatus.Finish).length == 0" description="无" />
    <NSpace v-else>
      <FeedbackItem
        v-for="item in selectedFeedback.filter((f) => f.status == FeedbackStatus.Finish)"
        :item="item"
        :key="item.createAt"
      />
    </NSpace>
    <NDivider> 搁置 </NDivider>
    <NEmpty v-if="selectedFeedback.filter((f) => f.status == FeedbackStatus.Reject).length == 0" description="无" />
    <NSpace v-else>
      <FeedbackItem
        v-for="item in selectedFeedback.filter((f) => f.status == FeedbackStatus.Reject)"
        :item="item"
        :key="item.createAt"
      />
    </NSpace>
  </template>
  <NModal v-model:show="showAddModal" preset="card" title="添加反馈" style="width: 600px; max-width: 90vw">
    <NSpace vertical>
      <NInput
        v-model:value="newFeedback.message"
        type="textarea"
        placeholder="请输入反馈内容"
        clearable
        show-count
        maxlength="1000"
      />
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
