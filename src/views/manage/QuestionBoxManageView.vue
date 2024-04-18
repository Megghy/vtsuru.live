<script setup lang="ts">
import { copyToClipboard, downloadImage } from '@/Utils'
import { DisableFunction, EnableFunction, SaveAccountSettings, SaveSetting, useAccount } from '@/api/account'
import { FunctionTypes, QAInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { QUESTION_API_URL } from '@/data/constants'
import router from '@/router'
import { Heart, HeartOutline, SwapHorizontal } from '@vicons/ionicons5'
import { saveAs } from 'file-saver'
import html2canvas from 'html2canvas'
import {
  NAffix,
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NDivider,
  NEmpty,
  NFlex,
  NIcon,
  NImage,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NList,
  NListItem,
  NModal,
  NPopconfirm,
  NScrollbar,
  NSelect,
  NSpace,
  NSpin,
  NSplit,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTime,
  NTooltip,
  useMessage,
} from 'naive-ui'
import QrcodeVue from 'qrcode.vue'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import QuestionItem from '@/components/QuestionItems.vue'
import { Delete24Filled, Delete24Regular, Eye24Filled, EyeOff24Filled, Info24Filled, } from '@vicons/fluent'
import { useQuestionBox } from '@/store/useQuestionBox'

const accountInfo = useAccount()
const route = useRoute()
const message = useMessage()

const useQB = useQuestionBox()

const selectedTabItem = ref(route.query.send ? '1' : '0')

const replyModalVisiable = ref(false)
const shareModalVisiable = ref(false)
const replyMessage = ref()
const addTagName = ref('')

const showSettingCard = ref(true)

const shareCardRef = ref()
const shareUrl = computed(() => 'https://vtsuru.live/@' + accountInfo.value?.name + '/question-box')

let isRevieveGetted = false
let isSendGetted = false
async function onTabChange(value: string) {
  return

  if (value == '0' && !isRevieveGetted) {
    await useQB.GetRecieveQAInfo()
    isRevieveGetted = true
  } else if (value == '1' && !isSendGetted) {
    await useQB.GetSendQAInfo()
    isSendGetted = true
  }
}
function onOpenModal(question: QAInfo) {
  useQB.currentQuestion = question
  replyMessage.value = question.answer?.message
  replyModalVisiable.value = true
}
function refresh() {
  isSendGetted = false
  isRevieveGetted = false
  if (selectedTabItem.value == '0') {
    useQB.GetRecieveQAInfo()
  } else if (selectedTabItem.value == '1') {
    useQB.GetSendQAInfo()
  }
}
function saveShareImage() {
  html2canvas(shareCardRef.value, {
    width: shareCardRef.value.clientWidth, //dom 原始宽度
    height: shareCardRef.value.clientHeight,
    backgroundColor: null,
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
      1,
    )
  })
}
function saveQRCode() {
  downloadImage(`https://api.qrserver.com/v1/create-qr-code/?data=${shareUrl.value}`, 'vtsuru-提问箱二维码.png')
}
async function saveSettings() {
  useQB.isLoading = true
  await SaveSetting('QuestionBox', accountInfo.value.settings.questionBox)
    .then((msg) => {
      if (msg) {
        message.success('已保存')
        return true
      } else {
        message.error('保存失败: ' + msg)
      }
    })
    .finally(() => {
      useQB.isLoading = false
    })
}

const parentRef = ref<HTMLElement | null>(null)

async function setFunctionEnable(enable: boolean) {
  let success = false
  if (enable) {
    success = await EnableFunction(FunctionTypes.QuestionBox)
  } else {
    success = await DisableFunction(FunctionTypes.QuestionBox)
  }
  if (success) {
    message.success('已' + (enable ? '启用' : '禁用'))
  } else {
    message.error('无法' + (enable ? '启用' : '禁用'))
  }
}

onMounted(() => {
  useQB.GetTags()
  useQB.GetRecieveQAInfo()
  useQB.GetSendQAInfo()

  useQB.displayQuestion = useQB.recieveQuestions.find(
    (s) => s.id == accountInfo.value?.settings.questionDisplay.currentQuestion,
  )
})
</script>

<template>
  <NSpace align="center">
    <NAlert
      :type="accountInfo.settings.enableFunctions.includes(FunctionTypes.QuestionBox) ? 'success' : 'warning'"
      style="max-width: 200px"
    >
      启用提问箱
      <NDivider vertical />
      <NSwitch
        :value="accountInfo?.settings.enableFunctions.includes(FunctionTypes.QuestionBox)"
        @update:value="setFunctionEnable"
      />
    </NAlert>
    <NButton type="primary" @click="refresh"> 刷新 </NButton>
    <NButton type="primary" @click="shareModalVisiable = true" secondary> 分享 </NButton>
    <NButton
      type="primary"
      @click="$router.push({ name: 'user-questionBox', params: { id: accountInfo.name } })"
      secondary
    >
      前往提问页
    </NButton>
  </NSpace>
  <NDivider style="margin: 10px 0 10px 0" />
  <NSpin v-if="useQB.isLoading" show />
  <NTabs v-else animated @update:value="onTabChange" v-model:value="selectedTabItem">
    <NTabPane tab="我收到的" name="0" display-directive="show:lazy">
      <NDivider vertical />
      <NFlex align="center">
        <NButton @click="$router.push({ name: 'question-display' })" type="primary"> 打开展示页 </NButton>
        <NSelect
          v-model:value="useQB.displayTag"
          placeholder="选择当前话题"
          filterable
          clearable
          :options="useQB.tags.map((s) => ({ label: s.name, value: s.name }))"
          style="width: 200px"
        >
          <template #header> <NText strong depth="3"> 在设置选项卡中添加或删除话题 </NText> </template>
        </NSelect>
        <NCheckbox v-model:checked="useQB.onlyFavorite"> 只显示收藏 </NCheckbox>
        <NCheckbox v-model:checked="useQB.onlyPublic"> 只显示公开 </NCheckbox>
        <NCheckbox v-model:checked="useQB.onlyUnread"> 只显示未读 </NCheckbox>
      </NFlex>
      <NDivider style="margin: 10px 0 10px 0" />
      <NEmpty v-if="useQB.recieveQuestionsFiltered.length == 0" description="暂无收到的提问" />
      <QuestionItem v-else :questions="useQB.recieveQuestionsFiltered">
        <template #footer="{ item }">
          <NSpace>
            <NButton v-if="!item.isReaded" size="small" @click="useQB.read(item, true)" type="success">
              设为已读
            </NButton>
            <NButton v-else size="small" @click="useQB.read(item, false)" type="warning">重设为未读</NButton>
            <NButton size="small" @click="useQB.favorite(item, !item.isFavorite)">
              <template #icon>
                <NIcon :component="item.isFavorite ? Heart : HeartOutline" :color="item.isFavorite ? '#dd484f' : ''" />
              </template>
              收藏
            </NButton>
            <NPopconfirm @positive-click="useQB.DelQA(item.id)">
              <template #trigger>
                <NButton size="small" type="error">
                  <template #icon>
                    <NIcon :component="Delete24Filled"/>
                  </template>
                  删除
                </NButton>
              </template>
              确认删除这条提问？
            </NPopconfirm>
            <!-- <NTooltip>
                        <template #trigger>
                          <NButton size="small"> 举报 </NButton>
                        </template>
                        暂时还没写
                      </NTooltip> -->
            <NButton size="small" @click="useQB.blacklist(item)" type="warning"> 拉黑 </NButton>
          </NSpace>
        </template>
        <template #header-extra="{ item }">
          <NButton @click="onOpenModal(item)" :type="item.isReaded ? 'default' : 'info'" :secondary="item.isReaded">
            {{ item.answer ? '查看回复' : '回复' }}
          </NButton>
        </template>
      </QuestionItem>
    </NTabPane>
    <NTabPane ref="parentRef" tab="我发送的" name="1" display-directive="show:lazy">
      <NEmpty v-if="useQB.sendQuestions.length == 0" description="暂无发送的提问" />
      <NList v-else>
        <NListItem v-for="item in useQB.sendQuestions" :key="item.id">
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
                    <NText depth="3"> 回复 </NText>
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
    <NTabPane tab="设置" name="2" display-directive="show:lazy">
      <NDivider> 设定 </NDivider>
      <NSpin :show="useQB.isLoading">
        <NCheckbox
          v-model:checked="accountInfo.settings.questionBox.allowUnregistedUser"
          @update:checked="saveSettings"
        >
          允许未注册用户进行提问
        </NCheckbox>
        <NDivider>
          标签
          <NTooltip>
            <template #trigger>
              <NIcon :component="Info24Filled" />
            </template>
            类似于话题, 可以在投稿时选择
          </NTooltip>
        </NDivider>
        <NFlex>
          <NInputGroup style="max-width: 400px">
            <NInputGroupLabel> 标签名称 </NInputGroupLabel>
            <NInput v-model:value="addTagName" placeholder="就是名称" maxlength="30" show-count clearable />
            <NButton type="primary" @click="useQB.addTag(addTagName)"> 添加 </NButton>
          </NInputGroup>
        </NFlex>
        <br />
        <NEmpty v-if="useQB.tags.length == 0" description="暂无标签" />
        <NFlex v-else>
          <NList bordered>
            <NListItem v-for="item in useQB.tags.sort((a, b) => b.createAt - a.createAt)" :key="item.name">
              <NFlex align="center">
                <NTag :bordered="false" size="small" :type="item.visiable ? 'success' : 'error'">
                  {{ item.name }}
                </NTag>
                <NTooltip>
                  <template #trigger>
                    <NPopconfirm @positive-click="useQB.updateTagVisiable(item.name, !item.visiable)">
                      <template #trigger>
                        <NButton :type="item.visiable ? 'success' : 'error'" text>
                          <template #icon>
                            <NIcon v-if="item.visiable" :component="Eye24Filled" />
                            <NIcon v-else :component="EyeOff24Filled" />
                          </template>
                        </NButton>
                      </template>
                      确定要{{ item.visiable ? '隐藏' : '显示' }}这个标签吗?
                    </NPopconfirm>
                  </template>
                  {{ item.visiable ? '隐藏' : '显示' }}
                </NTooltip>
                <NPopconfirm @positive-click="useQB.delTag(item.name)">
                  <template #trigger>
                    <NButton type="error" text>
                      <template #icon>
                        <NIcon :component="Delete24Regular" />
                      </template>
                    </NButton>
                  </template>
                  确定要删除这个标签吗?
                </NPopconfirm>
              </NFlex>
            </NListItem>
          </NList>
        </NFlex>
        <NDivider> 通知 </NDivider>
        <NCheckbox v-model:checked="accountInfo.settings.sendEmail.recieveQA" @update:checked="saveSettings">
          收到新提问时发送邮件
        </NCheckbox>
        <NCheckbox v-model:checked="accountInfo.settings.sendEmail.recieveQAReply" @update:checked="saveSettings">
          提问后收到回复时发送邮件
        </NCheckbox>
      </NSpin>
    </NTabPane>
  </NTabs>
  <NModal preset="card" v-model:show="replyModalVisiable" style="max-width: 90vw; width: 500px">
    <template #header> 回复 </template>
    <NSpace vertical>
      <NInput
        placeholder="请输入回复"
        type="textarea"
        v-model:value="replyMessage"
        maxlength="1000"
        show-count
        clearable
      />
      <NSpin :show="useQB.isChangingPublic">
        <NCheckbox @update:checked="(v) => useQB.setPublic(v)" :default-checked="useQB.currentQuestion?.isPublic">
          公开可见
        </NCheckbox>
      </NSpin>
    </NSpace>
    <NDivider style="margin: 10px 0 10px 0" />
    <NButton
      :loading="useQB.isRepling"
      @click="useQB.reply(useQB.currentQuestion?.id ?? -1, replyMessage)"
      type="primary"
      :secondary="useQB.currentQuestion?.answer ? true : false"
    >
      {{ useQB.currentQuestion?.answer ? '修改' : '发送' }}
    </NButton>
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
      <QrcodeVue
        class="share-card qrcode"
        :value="shareUrl"
        level="Q"
        :size="100"
        background="#00000000"
        foreground="#ffffff"
        :margin="1"
      />
    </div>
    <NDivider style="margin: 10px" />
    <NInputGroup>
      <NInput :value="shareUrl" />
      <NButton secondary @click="copyToClipboard(shareUrl)"> 复制 </NButton>
    </NInputGroup>
    <br /><br />
    <NSpace justify="center">
      <NButton type="primary" @click="saveShareImage"> 保存卡片 </NButton>
      <NButton type="primary" @click="saveQRCode"> 保存二维码 </NButton>
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
