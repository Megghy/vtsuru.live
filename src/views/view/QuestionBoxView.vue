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
import { useRoute } from 'vue-router'

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
const route = useRoute()

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
      // 检查 URL 参数中的 tag
      const tagFromQuery = route.query.tag as string | undefined
      if (tagFromQuery && tags.value.includes(tagFromQuery)) {
        selectedTag.value = tagFromQuery
      }
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
  <div class="question-box-container">
    <!-- 提问表单 -->
    <transition
      name="fade-slide-down"
      appear
    >
      <NCard
        embedded
        class="question-form-card"
        :class="{ 'self-user': isSelf }"
      >
        <NSpace vertical>
          <!-- 话题选择区域 -->
          <transition
            name="fade-scale"
            appear
          >
            <NCard
              v-if="tags.length > 0"
              title="投稿话题 (可选)"
              size="small"
              class="topic-card"
            >
              <transition-group
                name="tag-list"
                tag="div"
                class="tag-container"
              >
                <NTag
                  v-for="tag in tags"
                  :key="tag"
                  class="tag-item"
                  :bordered="false"
                  :type="selectedTag === tag ? 'primary' : 'default'"
                  :clearable="false"
                  @click="onSelectTag(tag)"
                >
                  {{ tag }}
                </NTag>
              </transition-group>
            </NCard>
          </transition>

          <!-- 提问内容区域 -->
          <div class="question-input-area">
            <NInput
              v-model:value="questionMessage"
              :disabled="isSelf"
              show-count
              maxlength="5000"
              type="textarea"
              :count-graphemes="countGraphemes"
              class="question-textarea"
              placeholder="在这里输入您的问题..."
            />
            <transition
              name="fade-scale"
            >
              <NUpload
                v-model:file-list="fileList"
                :max="1"
                accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.ico"
                list-type="image-card"
                :disabled="!accountInfo.id || isSelf"
                :default-upload="false"
                class="image-upload"
                @update:file-list="OnFileListChange"
              >
                <div class="upload-trigger">
                  <div class="upload-icon">
                    +
                  </div>
                  <span>上传图片</span>
                </div>
              </NUpload>
            </transition>
          </div>

          <NDivider class="form-divider" />

          <!-- 提示信息 -->
          <transition
            name="fade"
            appear
          >
            <NAlert
              v-if="!accountInfo.id && !isSelf"
              type="warning"
              class="login-alert"
            >
              只有注册用户才能够上传图片
            </NAlert>
          </transition>

          <!-- 匿名选项 -->
          <transition
            name="fade"
            appear
          >
            <NSpace
              v-if="accountInfo.id"
              vertical
              class="anonymous-option"
            >
              <NCheckbox
                v-model:checked="isAnonymous"
                :disabled="isSelf"
                label="匿名提问"
              />
              <NDivider class="form-divider" />
            </NSpace>
          </transition>

          <!-- 操作按钮 -->
          <div class="action-buttons">
            <NButton
              :disabled="isSelf"
              type="primary"
              :loading="isSending || !token"
              class="send-button"
              @click="SendQuestion"
            >
              发送
            </NButton>
            <NButton
              :disabled="isSelf || !accountInfo.id"
              type="info"
              class="my-questions-button"
              @click="$router.push({ name: 'manage-questionBox', query: { send: '1' } })"
            >
              我发送的
            </NButton>
          </div>

          <!-- 验证码 -->
          <div class="turnstile-container">
            <VueTurnstile
              ref="turnstile"
              v-model="token"
              :site-key="TURNSTILE_KEY"
              theme="auto"
            />
          </div>

          <!-- 错误提示 -->
          <transition
            name="fade-slide-up"
            appear
          >
            <NAlert
              v-if="isSelf"
              type="warning"
              class="self-alert"
            >
              不能给自己提问
            </NAlert>
          </transition>
        </NSpace>
      </NCard>
    </transition>

    <!-- 公开回复列表 -->
    <transition
      name="fade"
      appear
    >
      <div>
        <NDivider class="public-divider">
          <div class="divider-content">
            公开回复
          </div>
        </NDivider>
        <transition-group
          name="list-fade"
          tag="div"
          class="questions-list-container"
        >
          <NList
            v-if="publicQuestions.length > 0"
            class="questions-list"
          >
            <NListItem
              v-for="item in publicQuestions"
              :key="item.id"
              class="question-list-item"
            >
              <NCard
                :embedded="!item.isReaded"
                hoverable
                size="small"
                class="question-card"
                :class="{ 'unread': !item.isReaded }"
              >
                <!-- 问题头部 -->
                <template #header>
                  <NSpace
                    :size="0"
                    align="center"
                    class="question-header"
                  >
                    <NText
                      depth="3"
                      class="time-text"
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
                    <div
                      v-if="item.tag"
                      class="question-tag"
                    >
                      <NTag
                        size="small"
                        type="info"
                      >
                        {{ item.tag }}
                      </NTag>
                    </div>
                  </NSpace>
                </template>

                <!-- 问题内容 -->
                <NCard class="question-content">
                  <div class="question-message">
                    {{ item.question.message }}
                  </div>
                  <div
                    v-if="item.question.image"
                    class="question-image-container"
                  >
                    <NImage
                      :src="item.question.image"
                      class="question-image"
                      lazy
                      object-fit="contain"
                    />
                  </div>
                </NCard>

                <!-- 回答内容 -->
                <template
                  v-if="item.answer"
                  #footer
                >
                  <div class="answer-container">
                    <NSpace
                      align="center"
                      :wrap="false"
                      class="answer-content"
                    >
                      <NAvatar
                        :src="AVATAR_URL + userInfo?.biliId + '?size=64'"
                        circle
                        class="answer-avatar"
                        :img-props="{ referrerpolicy: 'no-referrer' }"
                      />
                      <NDivider
                        vertical
                        class="answer-divider"
                      />
                      <NText class="answer-text">
                        {{ item.answer?.message }}
                      </NText>
                    </NSpace>
                  </div>
                </template>
              </NCard>
            </NListItem>
          </NList>
          <NEmpty
            v-else
            class="empty-state"
          />
        </transition-group>
      </div>
    </transition>

    <NDivider />
  </div>
</template>

<style scoped>
.n-list {
  background-color: transparent;
}

.question-box-container {
  max-width: 700px;
  margin: 0 auto;
  position: relative;
  width: 100%;
  padding: 0 16px;
}

/* 卡片样式 */
.question-form-card {
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  overflow: hidden;
}

.question-form-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
}

.self-user {
  border-left: 4px solid #f5222d;
}

/* 话题选择卡片 */
.topic-card {
  border-radius: 8px;
  overflow: hidden;
}

.tag-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-item {
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  border-radius: 16px;
}

.tag-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 提问输入区域 */
.question-textarea {
  flex: 1;
  border-radius: 8px;
  transition: all 0.3s ease;
  width: 100% !important; /* 使用 !important 确保不被其他样式覆盖 */
  min-height: 100px; /* 设置最小高度 */
  resize: vertical; /* 允许垂直调整大小 */
}

/* 设置 naive-ui 内部元素样式 */
.question-textarea :deep(.n-input__textarea) {
  min-width: 100% !important;
  width: 100% !important;
}

.question-textarea :deep(.n-input__textarea-el) {
  min-width: 100% !important;
  width: 100% !important;
}

/* 确保输入框容器占满可用空间 */
.question-input-area {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin: 16px 0;
  width: 100%;
}

@media (min-width: 640px) {
  .question-input-area {
    flex-direction: row;
    align-items: flex-start;
  }

  /* 在水平布局中设置输入框区域的最小宽度 */
  .question-textarea {
    min-width: 75%; /* 占据至少75%的宽度 */
  }
}

.image-upload {
  min-width: 112px;
}

.upload-trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  width: 100%;
  opacity: 0.8;
  transition: all 0.3s ease;
}

.upload-trigger:hover {
  opacity: 1;
  transform: scale(1.05);
}

.upload-icon {
  font-size: 24px;
  margin-bottom: 4px;
}

/* 分隔线 */
.form-divider {
  margin: 10px 0;
  opacity: 0.6;
}

/* 警告提示 */
.login-alert,
.self-alert {
  border-radius: 8px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    box-shadow: 0 0 0 0 rgba(255, 213, 79, 0.4);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(255, 213, 79, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(255, 213, 79, 0);
  }
}

/* 匿名选项 */
.anonymous-option {
  margin: 8px 0;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin: 8px 0 16px 0;
}

.send-button,
.my-questions-button {
  min-width: 100px;
  transition: all 0.3s ease;
  border-radius: 20px;
}

.send-button:not(:disabled):hover,
.my-questions-button:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* 验证码容器 */
.turnstile-container {
  display: flex;
  justify-content: center;
  margin: 8px 0;
}

/* 公开回复部分 */
.public-divider {
  margin: 32px 0 24px;
  position: relative;
}

.divider-content {
  font-weight: bold;
  color: #36ad6a;
  background-image: linear-gradient(90deg, #36ad6a, #18a058);
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
  display: inline-block;
  padding: 0 8px;
  position: relative;
}

.questions-list-container {
  position: relative;
}

.questions-list {
  border-radius: 12px;
  overflow: hidden;
}

.question-list-item {
  margin-bottom: 16px;
}

.question-card {
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.question-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.1);
}

.unread {
  box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.3);
}

.question-header {
  padding: 8px 0;
}

.time-text {
  font-size: 12px;
  opacity: 0.8;
}

.question-tag {
  margin-left: 8px;
}

.question-content {
  text-align: center;
  padding: 16px;
  background-color: rgba(0, 0, 0, 0.02);
  border-radius: 6px;
}

.question-message {
  white-space: pre-wrap;
  word-break: break-word;
  margin-bottom: 12px;
}

.question-image-container {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}

.question-image {
  max-height: 200px;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.question-image:hover {
  transform: scale(1.02);
}

.answer-container {
  padding: 12px;
  background-color: rgba(24, 160, 88, 0.06);
  border-radius: 8px;
  margin-top: 8px;
}

.answer-content {
  gap: 12px;
}

.answer-avatar {
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 2px solid #fff;
  transition: all 0.3s ease;
}

.answer-avatar:hover {
  transform: scale(1.05);
}

.answer-divider {
  height: 24px;
  margin: 0 4px;
}

.answer-text {
  font-size: 16px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.empty-state {
  padding: 24px;
  opacity: 0.7;
}

/* 过渡动效 */
/* 淡入淡出 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 下滑淡入 */
.fade-slide-down-enter-active,
.fade-slide-down-leave-active {
  transition: all 0.5s ease;
}

.fade-slide-down-enter-from,
.fade-slide-down-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* 上滑淡入 */
.fade-slide-up-enter-active,
.fade-slide-up-leave-active {
  transition: all 0.5s ease;
}

.fade-slide-up-enter-from,
.fade-slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

/* 缩放淡入 */
.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.5s ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

/* 标签列表过渡 */
.tag-list-move {
  transition: all 0.5s ease;
}

.tag-list-enter-active,
.tag-list-leave-active {
  transition: all 0.5s ease;
}

.tag-list-enter-from,
.tag-list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}

/* 问题列表过渡 */
.list-fade-move {
  transition: transform 0.5s ease;
}

.list-fade-enter-active,
.list-fade-leave-active {
  transition: all 0.5s ease;
}

.list-fade-enter-from,
.list-fade-leave-to {
  opacity: 0;
  transform: translateY(30px);
}
</style>
