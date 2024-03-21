<script setup lang="ts">
import { useAccount } from '@/api/account'
import { QAInfo, UserInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { QUESTION_API_URL, TURNSTILE_KEY } from '@/data/constants'
import GraphemeSplitter from 'grapheme-splitter'
import {
  NAlert,
  NAvatar,
  NButton,
  NCard,
  NCheckbox,
  NDivider,
  NEmpty,
  NImage,
  NInput,
  NList,
  NListItem,
  NSelect,
  NSpace,
  NText,
  NTime,
  NTooltip,
  NUpload,
  UploadFileInfo,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import VueTurnstile from 'vue-turnstile'

const { biliInfo, userInfo } = defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  biliInfo: any | undefined
  userInfo: UserInfo | undefined
}>()

const splitter = new GraphemeSplitter()

const message = useMessage()
const accountInfo = useAccount()
const token = ref('')
const turnstile = ref()

const isSelf = computed(() => {
  return userInfo?.id == accountInfo.value?.id
})

const questionMessage = ref('')
const fileList = ref<UploadFileInfo[]>([])
const publicQuestions = ref<QAInfo[]>([])
const tags = ref<string[]>([])
const selectedTag = ref()

const isAnonymous = ref(true)
const isSending = ref(false)
const isGetting = ref(true)

function countGraphemes(value: string) {
  return splitter.countGraphemes(value)
}
async function SendQuestion() {
  if (countGraphemes(questionMessage.value) < 3) {
    message.error('内容最少需要3个字')
    return
  }
  isSending.value = true
  await QueryPostAPI<QAInfo>(
    QUESTION_API_URL + 'send',
    {
      Target: userInfo?.id,
      IsAnonymous: !accountInfo.value || isAnonymous.value,
      Message: questionMessage.value,
      ImageBase64: fileList.value?.length > 0 ? await getBase64(fileList.value[0].file) : undefined,
      Tag: selectedTag.value,
    },
    [['Turnstile', token.value]],
  )
    .then((data) => {
      if (data.code == 200) {
        message.success('成功发送棉花糖')
        questionMessage.value = ''
        fileList.value = []
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      message.error('发送失败')
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
function getPublicQuestions() {
  isGetting.value = true
  QueryGetAPI<QAInfo[]>(QUESTION_API_URL + 'get-public', {
    id: userInfo?.id,
  })
    .then((data) => {
      if (data.code == 200) {
        publicQuestions.value = data.data
      } else {
        message.error('获取公开提问失败:' + data.message)
      }
    })
    .catch((err) => {
      message.error('获取公开提问失败')
    })
    .finally(() => {
      isGetting.value = false
    })
}
function getTags() {
  isGetting.value = true
  QueryGetAPI<string[]>(QUESTION_API_URL + 'get-tags', {
    id: userInfo?.id,
  })
    .then((data) => {
      if (data.code == 200) {
        tags.value = data.data
      } else {
        message.error('获取标签失败:' + data.message)
      }
    })
    .catch((err) => {
      message.error('获取标签失败: ' + err)
    })
    .finally(() => {
      isGetting.value = false
    })
}

onMounted(() => {
  getPublicQuestions()
  getTags()
})

onUnmounted(() => {
  turnstile.value?.remove()
})
</script>

<template>
  <div style="max-width: 700px; margin: 0 auto" title="提问">
    <NCard embedded>
      <NSpace vertical>
        <NSpace align="center" justify="center">
          <NSelect
            v-model:value="selectedTag"
            placeholder="(可选) 要提问的话题"
            filterable
            clearable
            :options="tags.map((s) => ({ label: s, value: s }))"
            style="width: 200px"
          >
            <template #header> 不选的话则是默认话题 </template>
          </NSelect>
          <NInput
            :disabled="isSelf"
            show-count
            maxlength="1000"
            type="textarea"
            :count-graphemes="countGraphemes"
            v-model:value="questionMessage"
            style="width: 300px"
          />
          <NUpload
            :max="1"
            accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.ico"
            list-type="image-card"
            :disabled="!accountInfo.id || isSelf"
            :default-upload="false"
            v-model:file-list="fileList"
            @update:file-list="OnFileListChange"
          >
            + 上传图片
          </NUpload>
        </NSpace>
        <NDivider style="margin: 10px 0 10px 0" />
        <NSpace align="center">
          <NAlert v-if="!accountInfo.id && !isSelf" type="warning"> 只有注册用户才能够上传图片 </NAlert>
        </NSpace>
        <NSpace v-if="accountInfo.id" vertical>
          <NCheckbox :disabled="isSelf" v-model:checked="isAnonymous" label="匿名提问" />
          <NDivider style="margin: 10px 0 10px 0" />
        </NSpace>
        <NSpace justify="center">
          <NButton :disabled="isSelf" type="primary" :loading="isSending || !token" @click="SendQuestion">
            发送
          </NButton>
          <NButton
            :disabled="isSelf || !accountInfo.id"
            type="info"
            @click="$router.push({ name: 'manage-questionBox', query: { send: '1' } })"
          >
            我发送的
          </NButton>
        </NSpace>
        <VueTurnstile
          ref="turnstile"
          :site-key="TURNSTILE_KEY"
          v-model="token"
          theme="auto"
          style="text-align: center"
        />
        <NAlert v-if="isSelf" type="warning"> 不能给自己提问 </NAlert>
      </NSpace>
    </NCard>
    <NDivider> 公开回复 </NDivider>
    <NList v-if="publicQuestions.length > 0">
      <NListItem v-for="item in publicQuestions" :key="item.id">
        <NCard :embedded="!item.isReaded" hoverable size="small">
          <template #header>
            <NSpace :size="0" align="center">
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
          <NCard style="text-align: center">
            {{ item.question.message }}
            <br />
            <NImage v-if="item.question.image" :src="item.question.image" height="100" lazy />
          </NCard>
          <template v-if="item.answer" #footer>
            <NSpace align="center" :size="6" :wrap="false">
              <NAvatar :src="biliInfo.face + '@64w'" circle :size="45" :img-props="{ referrerpolicy: 'no-referrer' }" />
              <NDivider vertical />
              <NText style="font-size: 16px">
                {{ item.answer?.message }}
              </NText>
            </NSpace>
          </template>
        </NCard>
      </NListItem>
    </NList>
    <NEmpty v-else />

    <NDivider />
  </div>
</template>
