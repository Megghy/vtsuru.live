<script setup lang="ts">
import { QAInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { ACCOUNT_API_URL, BASE_API, QUESTION_API_URL } from '@/data/constants'
import { Heart, HeartOutline } from '@vicons/ionicons5'
import { NButton, NCard, NDivider, NIcon, NImage, NInput, NList, NListItem, NModal, NSpace, NSwitch, NTabPane, NTabs, NTag, NText, NTime, NTooltip, useMessage } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { List } from 'linqts'
import router from '@/router'

const recieveQuestions = ref<QAInfo[]>([])
const recieveQuestionsFiltered = computed(() => {
  return onlyFavorite.value ? recieveQuestions.value.filter((d) => d.isFavorite) : recieveQuestions.value
})
const sendQuestions = ref<QAInfo[]>([])
const message = useMessage()

const selectedTabItem = ref('0')
const isRepling = ref(false)
const onlyFavorite = ref(false)

const replyModalVisiable = ref(false)
const currentQuestion = ref<QAInfo>()
const replyMessage = ref()

async function GetRecieveQAInfo() {
  await QueryGetAPI<QAInfo[]>(QUESTION_API_URL + 'get-recieve')
    .then((data) => {
      if (data.code == 200) {
        if (data.data.length > 0) {
          recieveQuestions.value = new List(data.data)
            .OrderBy((d) => d.isReaded)
            .ThenByDescending((d) => d.sendAt)
            .ToArray()
        }
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
async function reply() {
  isRepling.value = true
  await QueryPostAPI<QAInfo>(QUESTION_API_URL + 'reply', {
    Id: currentQuestion.value?.id,
    Message: replyMessage.value,
  })
    .then((data) => {
      if (data.code == 200) {
        var index = recieveQuestions.value.findIndex((q) => q.id == currentQuestion.value?.id)
        if (index > -1) {
          recieveQuestions.value[index] = data.data
        }
        message.success('回复成功')
        currentQuestion.value = undefined
        replyModalVisiable.value = false
      } else {
        message.error('发送失败: ' + data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('发送失败')
    })
    .finally(() => {
      isRepling.value = false
    })
}
async function read(question: QAInfo, read: boolean) {
  await QueryGetAPI(QUESTION_API_URL + 'read', {
    id: question.id,
    read: read ? 'true' : 'false',
  })
    .then((data) => {
      if (data.code == 200) {
        question.isReaded = read
      } else {
        message.error('修改失败: ' + data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('修改失败')
    })
}
async function favorite(question: QAInfo, fav: boolean) {
  await QueryGetAPI(QUESTION_API_URL + 'favorite', {
    id: question.id,
    favorite: fav ? 'true' : 'false',
  })
    .then((data) => {
      if (data.code == 200) {
        question.isFavorite = fav
      } else {
        message.error('修改失败: ' + data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('修改失败')
    })
}
async function blacklist(question: QAInfo) {
  await QueryGetAPI(ACCOUNT_API_URL + 'black-list/add', {
    id: question.sender.id,
  })
    .then(async (data) => {
      if (data.code == 200) {
        await QueryGetAPI(QUESTION_API_URL + 'del', {
          id: question.id,
        })
          .then((data) => {
            if (data.code == 200) {
              message.success('已拉黑 ' + question.sender.name)
            } else {
              message.error('修改失败: ' + data.message)
            }
          })
          .catch((err) => {
            console.error(err)
          })
      } else {
        message.error('拉黑失败: ' + data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('拉黑失败')
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
function onOpenModal(question: QAInfo) {
  currentQuestion.value = question
  replyMessage.value = question.answer?.message
  replyModalVisiable.value = true
}
function refresh() {
  isSendGetted = false
  isRevieveGetted = false
  onTabChange(selectedTabItem.value)
}

onMounted(() => {
  GetRecieveQAInfo()
})
</script>

<template>
  <NButton type="primary" @click="refresh"> 刷新 </NButton>
  <NDivider style="margin: 10px 0 10px 0" />
  <NTabs animated @update:value="onTabChange" v-model:value="selectedTabItem">
    <NTabPane tab="我收到的" name="0">
      只显示收藏 <NSwitch v-model:value="onlyFavorite" />
      <NList :bordered="false">
        <NListItem v-for="item in recieveQuestionsFiltered" :key="item.id">
          <NCard :embedded="!item.isReaded" hoverable size="small">
            <template #header>
              <NSpace :size="0" align="center">
                <template v-if="!item.isReaded">
                  <NTag type="warning" size="tiny"> 未读 </NTag>
                  <NDivider vertical />
                </template>
                <NText :depth="item.sender?.name ? 1 : 3" style="margin-top: 3px">
                  {{ item.sender?.name ?? '匿名用户' }}
                </NText>
                <NTag v-if="item.isSenderRegisted" size="small" type="info" :bordered="false" style="margin-left: 5px"> 已注册 </NTag>
                <NDivider vertical />
                <NText depth="3" style="font-size: small">
                  <NTooltip>
                    <template #trigger>
                      <NTime :time="item.sendAt" :to="Date.now()" type="relative" />
                    </template>
                    <NTime />
                  </NTooltip>
                </NText>
              </NSpace>
            </template>
            <template #footer>
              <NSpace>
                <NButton size="small" @click="favorite(item, !item.isFavorite)">
                  <template #icon>
                    <NIcon :component="item.isFavorite ? Heart : HeartOutline" :color="item.isFavorite ? '#dd484f' : ''" />
                  </template>
                  收藏
                </NButton>
                <NButton size="small"> 举报 </NButton>
                <NButton size="small" @click="blacklist(item)"> 拉黑 </NButton>
              </NSpace>
            </template>
            <template #header-extra>
              <NButton @click="onOpenModal(item)" :type="item.isReaded ? 'default' : 'primary'" :secondary="item.isReaded"> {{ item.answer ? '查看回复' : '回复' }} </NButton>
            </template>
            <template v-if="item.question?.image">
              <NImage v-if="item.question?.image" :src="item.question.image" height="100" lazy />
              <br />
            </template>
            <NButton text @click="onOpenModal(item)">
              {{ item.question?.message }}
            </NButton>
          </NCard>
        </NListItem>
      </NList>
    </NTabPane>
    <NTabPane tab="我发送的" name="1">
      <NList>
        <NListItem v-for="item in sendQuestions" :key="item.id">
          <NCard hoverable size="small">
            <template #header>
              <NSpace :size="0" align="center">
                发给
                <NDivider vertical />
                <NButton text type="info" @click="router.push('/user/' + item.target.id)">
                  {{ item.target.name }}
                </NButton>
                <NDivider vertical />
                <NText depth="3" style="font-size: small">
                  <NTooltip>
                    <template #trigger>
                      <NTime :time="item.sendAt" :to="Date.now()" type="relative" />
                    </template>
                    <NTime />
                  </NTooltip>
                </NText>
              </NSpace>
            </template>
            <template v-if="item.answer" #footer>
              <NDivider style="margin: 0" />
              <NCard :bordered="false" size="small">
                <template #header>
                  <NSpace align="center">
                    <NTag size="small" type="warning" :bordered="false">
                      {{ item.target.name }}
                    </NTag>
                    回复
                  </NSpace>
                </template>
                {{ item.answer.message }}
              </NCard>
            </template>
            <template v-if="item.question?.image">
              <NImage :src="item.question.image" height="100" lazy />
              <br />
            </template>
            {{ item.question?.message }}
          </NCard>
        </NListItem>
      </NList>
    </NTabPane>
  </NTabs>
  <NModal preset="card" v-model:show="replyModalVisiable" style="max-width: 600px">
    <template #header> 回复 </template>
    <NInput placeholder="请输入回复" type="textarea" v-model:value="replyMessage" maxlength="1000" show-count clearable />
    <NDivider style="margin: 10px 0 10px 0" />
    <NButton :loading="isRepling" @click="reply" type="primary"> 发送 </NButton>
  </NModal>
</template>

<style>
.n-list{
  background-color: transparent;
}
</style>
