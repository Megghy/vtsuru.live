<script setup lang="ts">
import { useAccount } from '@/api/account'
import { QAInfo, UserInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { AVATAR_URL, QUESTION_API_URL, TURNSTILE_KEY } from '@/data/constants'
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
  NTag,
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
  biliInfo: any | undefined
  userInfo: UserInfo | undefined
}>()

// 状态变量
const message = useMessage()
const accountInfo = useAccount()
const questionMessage = ref('') // 提问内容
const fileList = ref<UploadFileInfo[]>([]) // 上传图片列表
const publicQuestions = ref<QAInfo[]>([]) // 公开提问列表
const tags = ref<string[]>([]) // 标签列表
const selectedTag = ref<string | null>(null) // 选中的标签
const isAnonymous = ref(true) // 是否匿名提问
const isSending = ref(false) // 是否正在发送
const isGetting = ref(true) // 是否正在获取数据

// 验证码相关
const token = ref('')
const turnstile = ref()

// 防刷控制
const nextSendQuestionTime = ref(Date.now())
const minSendQuestionTime = 30 * 1000 // 30秒冷却时间

// 字符分割器(用于正确计算表情符号等Unicode字符)
const splitter = new GraphemeSplitter()

// 计算属性
const isSelf = computed(() => {
  return userInfo?.id === accountInfo.value?.id
})

// 计算字符数量
function countGraphemes(value: string) {
  return splitter.countGraphemes(value)
}

// 发送提问
async function SendQuestion() {
  // 内容长度检查
  if (countGraphemes(questionMessage.value) < 3) {
    message.error('内容最少需要3个字')
    return
  }

  // 冷却时间检查
  if (nextSendQuestionTime.value > Date.now()) {
    message.error('冷却中, 剩余 ' + Math.ceil((nextSendQuestionTime.value - Date.now()) / 1000) + '秒')
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
        nextSendQuestionTime.value = Date.now() + minSendQuestionTime
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

// 转换文件为Base64
function getBase64(file: File | undefined | null) {
  if (!file) return null
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result?.toString().split(',')[1])
    reader.onerror = (error) => reject(error)
  })
}

// 文件列表变更处理
function OnFileListChange(files: UploadFileInfo[]) {
  if (files.length == 1) {
    const file = files[0]
    // 文件大小检查
    if ((file.file?.size ?? 0) > 10 * 1024 * 1024) {
      message.error('文件大小不能超过10MB')
      fileList.value = []
    }
  }
}

// 获取公开提问列表
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

// 获取标签列表
function getTags() {
  isGetting.value = true
  QueryGetAPI<string[]>(QUESTION_API_URL + 'get-tags', {
    id: userInfo?.id,
  })
    .then((data) => {
      if (data.code == 200) {
        // 处理标签数据
        if (userInfo?.id == accountInfo.value?.id) {
          // 自己查看自己的标签时，需要从对象中提取名称
          tags.value = data.data.map((tag: any) => {
            // 直接访问name属性，避免不必要的JSON序列化和解析
            return typeof tag === 'object' && tag !== null ? tag.name : tag
          })
        } else {
          // 查看他人标签时直接使用返回数据
          tags.value = data.data
        }
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

// 标签选择处理
function onSelectTag(tag: string) {
  // 切换选中状态
  selectedTag.value = selectedTag.value === tag ? null : tag
}

// 生命周期钩子
onMounted(() => {
  getPublicQuestions()
  getTags()
})

onUnmounted(() => {
  // 清理验证码资源
  turnstile.value?.remove()
})
</script>

<template>
  <div
    style="max-width: 700px; margin: 0 auto"
    title="提问"
  >
    <!-- 提问表单 -->
    <NCard embedded>
      <NSpace vertical>
        <!-- 话题选择区域 -->
        <NCard
          v-if="tags.length > 0"
          title="投稿话题 (可选)"
          size="small"
        >
          <NSpace>
            <NTag
              v-for="tag in tags"
              :key="tag"
              style="cursor: pointer"
              :bordered="false"
              :type="selectedTag === tag ? 'primary' : 'default'"
              @click="onSelectTag(tag)"
            >
              {{ tag }}
            </NTag>
          </NSpace>
        </NCard>

        <!-- 提问内容区域 -->
        <NSpace
          align="center"
          justify="center"
        >
          <NInput
            v-model:value="questionMessage"
            :disabled="isSelf"
            show-count
            maxlength="5000"
            type="textarea"
            :count-graphemes="countGraphemes"
            style="width: 300px"
          />
          <NUpload
            v-model:file-list="fileList"
            :max="1"
            accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.ico"
            list-type="image-card"
            :disabled="!accountInfo.id || isSelf"
            :default-upload="false"
            @update:file-list="OnFileListChange"
          >
            + 上传图片
          </NUpload>
        </NSpace>

        <NDivider style="margin: 10px 0" />

        <!-- 提示信息 -->
        <NSpace align="center">
          <NAlert
            v-if="!accountInfo.id && !isSelf"
            type="warning"
          >
            只有注册用户才能够上传图片
          </NAlert>
        </NSpace>

        <!-- 匿名选项 -->
        <NSpace
          v-if="accountInfo.id"
          vertical
        >
          <NCheckbox
            v-model:checked="isAnonymous"
            :disabled="isSelf"
            label="匿名提问"
          />
          <NDivider style="margin: 10px 0" />
        </NSpace>

        <!-- 操作按钮 -->
        <NSpace justify="center">
          <NButton
            :disabled="isSelf"
            type="primary"
            :loading="isSending || !token"
            @click="SendQuestion"
          >
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

        <!-- 验证码 -->
        <VueTurnstile
          ref="turnstile"
          v-model="token"
          :site-key="TURNSTILE_KEY"
          theme="auto"
          style="text-align: center"
        />

        <!-- 错误提示 -->
        <NAlert
          v-if="isSelf"
          type="warning"
        >
          不能给自己提问
        </NAlert>
      </NSpace>
    </NCard>

    <!-- 公开回复列表 -->
    <NDivider> 公开回复 </NDivider>
    <NList v-if="publicQuestions.length > 0">
      <NListItem
        v-for="item in publicQuestions"
        :key="item.id"
      >
        <NCard
          :embedded="!item.isReaded"
          hoverable
          size="small"
        >
          <!-- 问题头部 -->
          <template #header>
            <NSpace
              :size="0"
              align="center"
            >
              <NText
                depth="3"
                style="font-size: small"
              >
                <NTooltip>
                  <template #trigger>
                    <NTime
                      :time="item.sendAt"
                      :to="Date.now()"
                      type="relative"
                    />
                  </template>
                  <NTime :time="item.sendAt" />
                </NTooltip>
              </NText>
            </NSpace>
          </template>

          <!-- 问题内容 -->
          <NCard style="text-align: center">
            {{ item.question.message }}
            <br>
            <NImage
              v-if="item.question.image"
              :src="item.question.image"
              height="100"
              lazy
            />
          </NCard>

          <!-- 回答内容 -->
          <template
            v-if="item.answer"
            #footer
          >
            <NSpace
              align="center"
              :size="6"
              :wrap="false"
            >
              <NAvatar
                :src="AVATAR_URL + userInfo?.biliId + '?size=64'"
                circle
                :size="45"
                :img-props="{ referrerpolicy: 'no-referrer' }"
              />
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
