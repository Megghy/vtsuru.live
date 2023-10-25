<script setup lang="ts">
import { QAInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { ACCOUNT_API_URL, QUESTION_API_URL } from '@/data/constants'
import { Heart, HeartOutline } from '@vicons/ionicons5'
import {
  NButton,
  NCard,
  NDivider,
  NGradientText,
  NIcon,
  NImage,
  NInput,
  NInputGroup,
  NList,
  NListItem,
  NModal,
  NSpace,
  NSpin,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTime,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { List } from 'linqts'
import router from '@/router'
import html2canvas from 'html2canvas'
import QrcodeVue from 'qrcode.vue'
import { useAccount } from '@/api/account'
import { saveAs } from 'file-saver'
import { copyToClipboard } from '@/Utils'

const accountInfo = useAccount()

const recieveQuestions = ref<QAInfo[]>([])
const recieveQuestionsFiltered = computed(() => {
  return onlyFavorite.value ? recieveQuestions.value.filter((d) => d.isFavorite) : recieveQuestions.value
})
const sendQuestions = ref<QAInfo[]>([])
const message = useMessage()

const selectedTabItem = ref('0')
const isRepling = ref(false)
const onlyFavorite = ref(false)
const isLoading = ref(true)

const replyModalVisiable = ref(false)
const shareModalVisiable = ref(false)
const currentQuestion = ref<QAInfo>()
const replyMessage = ref()

const shareCardRef = ref()
const shareUrl = computed(() => 'https://vtsuru.live/user/' + accountInfo.value?.name + '/question-box')

async function GetRecieveQAInfo() {
  isLoading.value = true
  await QueryGetAPI<QAInfo[]>(QUESTION_API_URL + 'get-recieve')
    .then((data) => {
      if (data.code == 200) {
        if (data.data.length > 0) {
          recieveQuestions.value = new List(data.data)
            .OrderBy((d) => d.isReaded)
            //.ThenByDescending(d => d.isFavorite)
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
    .finally(() => {
      isLoading.value = false
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
    favorite: fav,
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
function saveShareImage() {
  html2canvas(shareCardRef.value, {
    width: shareCardRef.value.clientWidth, //dom 原始宽度
    height: shareCardRef.value.clientHeight,
    backgroundColor:null,
    scrollY: 0, // html2canvas默认绘制视图内的页面，需要把scrollY，scrollX设置为0
    scrollX: 0,
    useCORS: true, //支持跨域，但好像没什么用
    allowTaint: true, //允许跨域（默认false）
    scale: 1,
  }).then((canvas) => {
    // 生成的ba64图片
    canvas.toBlob(
      (data) => {
        saveAs(data, `vtsuru-提问箱-${accountInfo.value?.name}.png`)
      },
      'image/png',
      1
    )
  })
}

onMounted(() => {
  GetRecieveQAInfo()
})
</script>

<template>
  <NSpace>
    <NButton type="primary" @click="refresh"> 刷新 </NButton>
    <NButton type="primary" @click="shareModalVisiable = true" secondary> 分享 </NButton>
  </NSpace>
  <NDivider style="margin: 10px 0 10px 0" />
  <NSpin v-if="isLoading" show />
  <NTabs v-else animated @update:value="onTabChange" v-model:value="selectedTabItem">
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
  <NModal v-model:show="shareModalVisiable" preset="card" title="分享" style="width: 600px">
    <div ref="shareCardRef" class="share-card container">
      <NText class="share-card title"> 向我提问 </NText>
      <NText class="share-card type"> 提 问 箱 </NText>
      <NText class="share-card name">
        {{ accountInfo?.name }}
      </NText>
      <NDivider class="share-card divider-1" />
      <NText class="share-card site"> VTSURU.LIVE </NText>
      <QrcodeVue class="share-card qrcode" :value="shareUrl" level="Q" :size="100" background="#00000000" foreground="#ffffff" :margin="1" />
    </div>
    <NDivider style="margin: 10px" />
    <NInputGroup>
      <NInput :value="shareUrl" />
      <NButton secondary @click="copyToClipboard(shareUrl)"> 复制 </NButton>
    </NInputGroup>
    <br /><br />
    <NSpace justify="center">
      <NButton type="primary" @click="saveShareImage"> 保存卡片 </NButton>
    </NSpace>
  </NModal>
</template>

<style>
.n-list {
  background-color: transparent;
}

.share-card.container {
  position: relative;
  height: 200px;
  width: 550px;
  border-radius: 10px;
  background: linear-gradient(to right, #66bea3, #9179be);
}
.share-card.qrcode {
  position: absolute;
  right: 10px;
  top: 10px;
  border-radius: 4px;
  background: linear-gradient(to right, #3d554e, #503e74);
}
.share-card.title {
  position: absolute;
  font-size: 80px;
  bottom: -17px;
  left: 5px;
  color: #e6e6e662;
  font-weight: 550;
}
/* .share-card.type {
  position: absolute;
  font-size: 20px;
  transform:rotate(90deg);
  left: 300px;
  bottom: 20px;
  color: #e6e6e6b6;
} */
.share-card.type {
  position: absolute;
  font-size: 20px;
  left: 332px;
  bottom: 55px;
  font-weight: 550;
  color: #e6e6e662;
}
.share-card.name {
  position: absolute;
  font-size: 30px;
  left: 10px;
  bottom: 95px;
  max-width: 300px;
  word-wrap: break-word;
  line-height: 1.3;
  color: #e6e6e6;
  font-weight: 550;
}
.share-card.site {
  position: absolute;
  font-size: 12px;
  right: 20px;
  top: 110px;
  color: #e6e6e6a4;
  font-weight: 550;
}
.share-card.divider-1 {
  position: absolute;
  width: 400px;
  left: 5px;
  bottom: 66px;
  background-color: #c0c0c057;
}
</style>
