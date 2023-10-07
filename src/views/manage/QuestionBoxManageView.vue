<script setup lang="ts">
import { QAInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { BASE_API, QUESTION_API_URL } from '@/data/constants'
import { HeartOutline } from '@vicons/ionicons5'
import { NButton, NCard, NDivider, NIcon, NImage, NList, NListItem, NTabPane, NTabs, NTag, useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'

const recieveQuestions = ref<QAInfo[]>([])
const sendQuestions = ref<QAInfo[]>([])
const message = useMessage()

const selectedTabItem = ref('0')

async function GetRecieveQAInfo() {
  await QueryGetAPI<QAInfo[]>(QUESTION_API_URL + 'get-recieve')
    .then((data) => {
      if (data.code == 200) {
        recieveQuestions.value = data.data
        message.success('共收取 ' + data.data.length + ' 条提问')
        isRevieveGetted = true
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      message.error('发生错误')
      console.error(err)
    })
}
async function GetSendQAInfo() {
  await QueryGetAPI<QAInfo[]>(QUESTION_API_URL + 'get-send')
    .then((data) => {
      if (data.code == 200) {
        sendQuestions.value = data.data
        message.success('共发送 ' + data.data.length + ' 条提问')
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      message.error('发生错误')
      console.error(err)
    })
}
let isRevieveGetted = false
let isSendGetted = false
async function onTabChange(value: string) {
  if (value == '0' && !isRevieveGetted) {
    await GetRecieveQAInfo()
    isRevieveGetted = true
  } else if (value == '1' && !isSendGetted) {
    await GetSendQAInfo()
    isSendGetted = true
  }
}

onMounted(() => {
  GetRecieveQAInfo()
})
</script>

<template>
  <NButton type="primary"> 刷新 </NButton>
  <NDivider style="margin: 10px 0 10px 0" />
  <NTabs animated @update:value="onTabChange" v-model:value="selectedTabItem">
    <NTabPane tab="我收到的" name="0">
      <NList>
        <NListItem v-for="item in recieveQuestions" :key="item.id">
          <NCard>
            <template #header>
              匿名用户
              <NTag v-if="item.isSenderRegisted" size="small"> 已注册 </NTag>
            </template>
            <template #footer>
              <NButton>
                <template #icon>
                  <NIcon :component="HeartOutline"/>
                </template>
                收藏
              </NButton>
              <NButton>
                举报
              </NButton>
              <NButton>
                拉黑
              </NButton>
            </template>
            <NImage v-if="item.question.image" :src="item.question.image" />
            {{ item.question.message }}
          </NCard>
        </NListItem>
      </NList>
    </NTabPane>
    <NTabPane tab="我发送的" name="1"> </NTabPane>
  </NTabs>
</template>
