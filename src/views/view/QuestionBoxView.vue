<script setup lang="ts">
import { NAlert, NButton, NCard, NCheckbox, NDivider, NInput, NSpace, NTab, NTabPane, NTabs, NText, NUpload, UploadFileInfo, useMessage } from 'naive-ui'
import GraphemeSplitter from 'grapheme-splitter'
import { computed, onMounted, ref } from 'vue'
import { useAccount } from '@/api/account'
import { useUser } from '@/api/user'
import { QAInfo, UserInfo } from '@/api/api-models'
import { QueryPostAPI, QueryPostAPIWithParams } from '@/api/query'
import { QUESTION_API_URL, TURNSTILE_KEY } from '@/data/constants'
import VueTurnstile from 'vue-turnstile'

const splitter = new GraphemeSplitter()

const message = useMessage()
const accountInfo = useAccount()
const userInfo = ref<UserInfo>()
const token = ref('')
const turnstile = ref()

const isSelf = computed(() => {
  return userInfo.value?.id == accountInfo.value?.id
})

const questionMessage = ref('')
const fileList = ref<UploadFileInfo[]>([])

const isAnonymous = ref(true)
const isSending = ref(false)

function countGraphemes(value: string) {
  return splitter.countGraphemes(value)
}
async function SendQuestion() {
  if (countGraphemes(questionMessage.value) < 10) {
    message.error('内容最少需要10个字')
    return
  }
  isSending.value = true
  await QueryPostAPI<QAInfo>(
    QUESTION_API_URL + 'send',
    {
      Target: userInfo.value?.id,
      IsAnonymous: !accountInfo.value || isAnonymous.value,
      Message: questionMessage.value,
      ImageBase64: fileList.value?.length > 0 ? await getBase64(fileList.value[0].file) : undefined,
    },
    [['Turnstile', token.value]]
  )
    .then((data) => {
      if (data.code == 200) {
        message.success('成功发送棉花糖')
        questionMessage.value = ''
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      message.error('发送失败')
      console.error(err)
    })
    .finally(() => {
      isSending.value = false
      turnstile.value?.reset()
    })
}
function getBase64(file: File | undefined | null) {
  if (!file) return null
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result?.toString().split(',')[1])
    reader.onerror = (error) => reject(error)
  })
}
function OnFileListChange(files: UploadFileInfo[]) {
  if (files.length == 1) {
    var file = files[0]
    if ((file.file?.size ?? 0) > 10 * 1024 * 1024) {
      message.error('文件大小不能超过10MB')
      fileList.value = []
    }
  }
}

onMounted(async () => {
  userInfo.value = await useUser()
})
</script>

<template>
  <NCard embedded style="max-width: 700px; margin: 0 auto" title="提问">
    <NSpace vertical>
      <NInput :disabled="isSelf" show-count maxlength="1000" type="textarea" :count-graphemes="countGraphemes" v-model:value="questionMessage"> </NInput>
      <NDivider style="margin: 10px 0 10px 0" />
      <NSpace align="center">
        <NUpload
          :max="1"
          accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.ico"
          list-type="image-card"
          :disabled="!accountInfo || isSelf"
          :default-upload="false"
          v-model:file-list="fileList"
          @update:file-list="OnFileListChange"
        >
          + 上传图片
        </NUpload>
        <NAlert v-if="!accountInfo && !isSelf" type="warning"> 只有注册用户才能够上传图片 </NAlert>
      </NSpace>
      <NSpace vertical>
        <NCheckbox v-if="accountInfo" :disabled="isSelf" v-model:checked="isAnonymous" label="匿名提问" />
      </NSpace>
      <NDivider style="margin: 10px 0 10px 0" />
      <NSpace justify="center">
        <NButton :disabled="isSelf" type="primary" :loading="isSending || !token" @click="SendQuestion"> 发送 </NButton>
      </NSpace>
      <VueTurnstile ref="turnstile" :site-key="TURNSTILE_KEY" v-model="token" theme="auto" style="text-align: center" />
      <NAlert v-if="isSelf" type="warning"> 不能给自己提问 </NAlert>
    </NSpace>
  </NCard>
</template>
