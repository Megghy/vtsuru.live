<script setup lang="ts">
import type { QAInfo, Setting_QuestionBox, UserInfo } from '@/api/api-models'
import { AddCircle24Regular, DismissCircle24Regular } from '@vicons/fluent'
import GraphemeSplitter from 'grapheme-splitter'
import {
  NAlert,
  NAvatar,
  NButton,
  NCard,
  NCheckbox,
  NDivider,
  NEmpty,
  NIcon,
  NImage,
  NInput,
  NList,
  NListItem,
  NSpace,
  NSpin,
  NTag,
  NText,
  NTime,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import VueTurnstile from 'vue-turnstile'
import { useAccount } from '@/api/account'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { AVATAR_URL, FILE_API_URL, QUESTION_API_URL, TURNSTILE_KEY } from '@/data/constants'
import { uploadFiles } from '@/data/fileUpload'

const { biliInfo, userInfo } = defineProps<{
  biliInfo: any | undefined
  userInfo: UserInfo | undefined
}>()

// 基础状态变量
const message = useMessage()
const accountInfo = useAccount()
const route = useRoute()
const splitter = new GraphemeSplitter()

// 问题相关状态
const questionMessage = ref('')
const publicQuestions = ref<QAInfo[]>([])
const tags = ref<string[]>([])
const selectedTag = ref<string | null>(null)
const isAnonymous = ref(true)
const isSending = ref(false)
const isGetting = ref(true)
const token = ref('')
const turnstile = ref()
const nextSendQuestionTime = ref(Date.now())
const minSendQuestionTime = 30 * 1000

// 图片上传相关状态
const targetUserSetting = ref<Setting_QuestionBox | null>(null)
const allowUploadImage = computed(() => userInfo?.extra?.allowQuestionBoxUploadImage ?? false)
const anonymousImageToken = ref<string | null>(null)
const anonymousImagePreviewUrl = ref<string | null>(null)
const isUploadingAnonymousImage = ref(false)
const loggedInSelectedFiles = ref<File[]>([])
const loggedInImagePreviewUrls = ref<string[]>([])
const MAX_LOGGED_IN_IMAGES = 5
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// 计算属性
const isSelf = computed(() => userInfo?.id === accountInfo.value?.id)
const isUserLoggedIn = computed(() => !!accountInfo.value?.id)

// 辅助函数
function countGraphemes(value: string) {
  return splitter.countGraphemes(value)
}

// 图片处理公共方法
function validateImageFile(file: File): { valid: boolean, message?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, message: '文件大小不能超过10MB' }
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, message: '只支持上传 PNG, JPG, GIF, WEBP, SVG, ICO 格式的图片' }
  }

  return { valid: true }
}

function clearImageURLs(urls: string[]) {
  urls.forEach((url) => {
    if (url) URL.revokeObjectURL(url)
  })
}

// 匿名图片上传
async function uploadAnonymousImage(file: File) {
  if (!userInfo?.id) {
    message.error('无法获取目标用户信息')
    return
  }

  const validation = validateImageFile(file)
  if (!validation.valid) {
    message.error(validation.message || '图片上传失败')
    return
  }

  isUploadingAnonymousImage.value = true
  removeAnonymousImage()

  const formData = new FormData()
  formData.append('file', file)
  formData.append('targetUserId', userInfo.id.toString())

  try {
    const data = await QueryPostAPI<string>(`${FILE_API_URL}upload-anonymous`, formData)
    if (data.code === 200 && data.data) {
      anonymousImageToken.value = data.data
      const url = URL.createObjectURL(file)
      anonymousImagePreviewUrl.value = url
      message.success('匿名图片准备就绪')
    } else {
      message.error(data.message || '匿名图片上传失败')
      removeAnonymousImage()
    }
  } catch (err: any) {
    message.error(`匿名图片上传失败: ${err.message || err}`)
    removeAnonymousImage()
  } finally {
    isUploadingAnonymousImage.value = false
  }
}

function handleAnonymousFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    const file = input.files[0]

    // 如果已经有图片，提示不能多选
    if (anonymousImageToken.value) {
      message.warning('匿名模式下只能上传一张图片')
      input.value = ''
      return
    }

    uploadAnonymousImage(file)
    input.value = ''
  }
}

function removeAnonymousImage() {
  if (anonymousImagePreviewUrl.value) {
    URL.revokeObjectURL(anonymousImagePreviewUrl.value as string)
    anonymousImagePreviewUrl.value = null
  }
  anonymousImageToken.value = null
}

// 已登录用户图片上传
function handleLoggedInFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files.length > 0) {
    // 处理多个文件 - 支持多选
    const newFiles = Array.from(input.files)

    // 检查每个文件
    for (const file of newFiles) {
      // 验证文件类型和大小
      const validation = validateImageFile(file)
      if (!validation.valid) {
        message.error(validation.message || '图片上传失败')
        continue
      }

      // 检查是否超出最大数量限制
      if (loggedInSelectedFiles.value.length >= MAX_LOGGED_IN_IMAGES) {
        message.warning(`最多只能上传${MAX_LOGGED_IN_IMAGES}张图片`)
        break
      }

      // 检查文件是否重复（通过文件名、大小和最后修改时间判断）
      // 避免重复选择相同图片
      const isDuplicate = loggedInSelectedFiles.value.some(existingFile =>
        existingFile.name === file.name
        && existingFile.size === file.size
        && existingFile.lastModified === file.lastModified,
      )

      if (isDuplicate) {
        message.warning(`文件"${file.name}"已存在，不会重复添加`)
        continue
      }

      // 添加到已选文件列表
      loggedInSelectedFiles.value.push(file)
      const url = URL.createObjectURL(file)
      loggedInImagePreviewUrls.value.push(url)
    }

    // 清空输入框，允许重新选择文件
    input.value = ''
  }
}

function removeLoggedInImage(index: number) {
  const url = loggedInImagePreviewUrls.value[index]
  if (url) {
    URL.revokeObjectURL(url as string)
  }
  loggedInImagePreviewUrls.value.splice(index, 1)
  loggedInSelectedFiles.value.splice(index, 1)
}

function clearAllLoggedInImages() {
  loggedInImagePreviewUrls.value.forEach((url) => {
    if (url) URL.revokeObjectURL(url as string)
  })
  loggedInImagePreviewUrls.value = []
  loggedInSelectedFiles.value = []
}

// API 交互方法
async function SendQuestion() {
  if (countGraphemes(questionMessage.value) < 3) {
    message.error('内容最少需要3个字')
    return
  }

  if (nextSendQuestionTime.value > Date.now()) {
    message.error(`冷却中, 剩余 ${Math.ceil((nextSendQuestionTime.value - Date.now()) / 1000)}秒`)
    return
  }

  isSending.value = true
  let uploadedFileIds: number[] = []
  let imagePayload: { id: number }[] | undefined
  let tokenPayload: string | undefined

  try {
    // 处理图片上传
    if (!isUserLoggedIn.value) {
      if (anonymousImageToken.value) {
        tokenPayload = anonymousImageToken.value
      }
    } else if (loggedInSelectedFiles.value.length > 0) {
      message.info('正在上传图片...')

      // 上传多张图片
      const uploadPromises = loggedInSelectedFiles.value.map(file =>
        uploadFiles(file, undefined, undefined, (stage) => {
          console.log('上传阶段:', stage)
        }),
      )

      const uploadResults = await Promise.all(uploadPromises)

      // 提取所有上传的文件ID
      uploadedFileIds = uploadResults
        .filter(result => result && result.length > 0)
        .map(result => result[0].id)

      if (uploadedFileIds.length > 0) {
        imagePayload = uploadedFileIds.map(id => ({ id }))
        message.success('图片上传成功')
      } else if (loggedInSelectedFiles.value.length > 0) {
        throw new Error('图片上传失败，未返回文件信息')
      }
    }

    // 发送问题
    const payload = {
      Target: userInfo?.id,
      IsAnonymous: !isUserLoggedIn.value || isAnonymous.value,
      Message: questionMessage.value,
      Tag: selectedTag.value,
      Images: imagePayload,
      ImageTokens: tokenPayload ? [tokenPayload] : undefined,
    }

    const data = await QueryPostAPI<QAInfo>(
      `${QUESTION_API_URL}send`,
      payload,
      [['Turnstile', token.value]],
    )

    if (data.code == 200) {
      message.success('成功发送棉花糖')
      questionMessage.value = ''
      removeAnonymousImage()
      clearAllLoggedInImages()
      nextSendQuestionTime.value = Date.now() + minSendQuestionTime
      getPublicQuestions()
    } else {
      message.error(data.message || '发送失败')
      if (tokenPayload && (data.message.includes('token') || data.code === 400)) {
        removeAnonymousImage()
      }
    }
  } catch (err: any) {
    message.error(`发送失败: ${err.message || err}`)
    if (loggedInSelectedFiles.value.length > 0 && uploadedFileIds.length === 0) {
      clearAllLoggedInImages()
    }
    if (tokenPayload && (err.message?.includes('token'))) {
      removeAnonymousImage()
    }
  } finally {
    isSending.value = false
    turnstile.value?.reset()
  }
}

function getPublicQuestions() {
  isGetting.value = true
  QueryGetAPI<QAInfo[]>(`${QUESTION_API_URL}get-public`, {
    id: userInfo?.id,
  })
    .then((data) => {
      if (data.code == 200) {
        publicQuestions.value = data.data
      } else {
        message.error(`获取公开提问失败:${data.message}`)
      }
    })
    .catch((err) => {
      message.error('获取公开提问失败')
    })
    .finally(() => {
      isGetting.value = false
    })
}

async function getTagsAndSettings() {
  if (!userInfo?.id) return
  isGetting.value = true
  try {
    const tagsData = await QueryGetAPI<string[]>(`${QUESTION_API_URL}get-tags`, { id: userInfo.id })

    if (tagsData.code == 200) {
      if (userInfo?.id == accountInfo.value?.id) {
        tags.value = tagsData.data.map((tag: any) =>
          typeof tag === 'object' && tag !== null ? tag.name : tag,
        )
      } else {
        tags.value = tagsData.data
      }
      const tagFromQuery = route.query.tag as string | undefined
      if (tagFromQuery && tags.value.includes(tagFromQuery)) {
        selectedTag.value = tagFromQuery
      }
    } else {
      message.error(`获取标签失败:${tagsData.message}`)
    }
  } catch (err: any) {
    message.error(`获取信息失败: ${err.message || err}`)
  } finally {
    isGetting.value = false
  }
}

function onSelectTag(tag: string) {
  selectedTag.value = selectedTag.value === tag ? null : tag
}

// 生命周期钩子
onMounted(() => {
  getPublicQuestions()
  getTagsAndSettings()
})

onUnmounted(() => {
  turnstile.value?.remove()
  removeAnonymousImage()
  clearAllLoggedInImages()
})
</script>

<template>
  <div class="question-box-container">
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

          <!-- 问题输入区域 -->
          <div class="question-input-area">
            <NInput
              v-model:value="questionMessage"
              :disabled="isSelf"
              show-count
              maxlength="5000"
              type="textarea"
              :count-graphemes="countGraphemes"
              class="question-textarea"
              placeholder="随便说点"
            />
          </div>

          <!-- 图片上传区域 - 重构为更简洁的条件块 -->
          <div class="image-upload-container">
            <!-- 已登录用户图片上传 -->
            <template v-if="isUserLoggedIn && !isSelf">
              <NSpin :show="isSending && loggedInSelectedFiles.length > 0">
                <NCard
                  size="small"
                  class="image-upload-card"
                >
                  <div class="upload-header">
                    <NText class="upload-title">
                      图片 (最多{{ MAX_LOGGED_IN_IMAGES }}张)
                    </NText>
                  </div>

                  <div class="upload-images-grid">
                    <div
                      v-for="(url, index) in loggedInImagePreviewUrls"
                      :key="index"
                      class="upload-image-item"
                    >
                      <div class="image-preview-wrapper">
                        <NImage
                          :src="url"
                          object-fit="cover"
                          class="upload-preview-image"
                        />
                        <NButton
                          circle
                          size="tiny"
                          type="error"
                          class="remove-image-btn"
                          @click="removeLoggedInImage(index)"
                        >
                          <template #icon>
                            <NIcon :component="DismissCircle24Regular" />
                          </template>
                        </NButton>
                      </div>
                    </div>

                    <div
                      v-if="loggedInSelectedFiles.length < MAX_LOGGED_IN_IMAGES"
                      class="upload-add-item"
                      @click="($refs.loggedInFileInput as HTMLInputElement)?.click()"
                    >
                      <NIcon
                        :component="AddCircle24Regular"
                        class="add-icon"
                      />
                    </div>
                  </div>

                  <input
                    ref="loggedInFileInput"
                    type="file"
                    accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.ico"
                    style="display: none;"
                    multiple
                    @change="handleLoggedInFileSelect"
                  >
                </NCard>
              </NSpin>
            </template>

            <!-- 匿名用户图片上传 -->
            <template v-else-if="!isUserLoggedIn && !isSelf && allowUploadImage">
              <NSpin :show="isUploadingAnonymousImage">
                <NCard
                  size="small"
                  class="image-upload-card"
                >
                  <div class="upload-header">
                    <NText class="upload-title">
                      匿名图片
                    </NText>
                  </div>

                  <div class="anonymous-upload-container">
                    <template v-if="!anonymousImageToken">
                      <div
                        class="anonymous-upload-btn"
                        @click="($refs.anonymousFileInput as HTMLInputElement)?.click()"
                      >
                        <NIcon
                          :component="AddCircle24Regular"
                          class="add-icon"
                        />
                      </div>
                    </template>
                    <template v-else>
                      <div class="image-preview-wrapper">
                        <NImage
                          v-if="anonymousImagePreviewUrl"
                          :src="anonymousImagePreviewUrl"
                          object-fit="cover"
                          class="upload-preview-image"
                        />
                        <NButton
                          circle
                          size="tiny"
                          type="error"
                          class="remove-image-btn"
                          @click="removeAnonymousImage"
                        >
                          <template #icon>
                            <NIcon :component="DismissCircle24Regular" />
                          </template>
                        </NButton>
                      </div>
                    </template>
                  </div>

                  <input
                    ref="anonymousFileInput"
                    type="file"
                    accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.ico"
                    style="display: none;"
                    @change="handleAnonymousFileSelect"
                  >
                </NCard>
              </NSpin>
            </template>

            <!-- 未开启匿名图片上传提示 -->
            <template v-else-if="!isUserLoggedIn && !isSelf && !allowUploadImage && targetUserSetting !== null">
              <NTooltip>
                <template #trigger>
                  <NCard
                    size="small"
                    class="image-upload-card upload-disabled"
                  >
                    <div class="upload-header">
                      <NText class="upload-title">
                        图片
                      </NText>
                    </div>
                    <div class="disabled-container">
                      <NText depth="3">
                        未开启匿名图片上传
                      </NText>
                    </div>
                  </NCard>
                </template>
                主播不允许上传图片
              </NTooltip>
            </template>
          </div>

          <NDivider class="form-divider" />

          <!-- 提示区域 - 合并条件 -->
          <NAlert
            v-if="!isUserLoggedIn && !isSelf && !allowUploadImage"
            type="info"
            class="login-alert"
          >
            {{ '主播不允许上传图片' }}
          </NAlert>

          <!-- 匿名选项 -->
          <transition
            name="fade"
            appear
          >
            <NSpace
              v-if="isUserLoggedIn"
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
              :disabled="isSelf || isUploadingAnonymousImage"
              type="primary"
              :loading="isSending || !token"
              class="send-button"
              @click="SendQuestion"
            >
              发送
            </NButton>
            <NButton
              :disabled="isSelf || !isUserLoggedIn"
              type="info"
              class="my-questions-button"
              @click="$router.push({ name: 'manage-questionBox', query: { send: '1' } })"
            >
              我发送的
            </NButton>
          </div>

          <!-- 验证组件 -->
          <div class="turnstile-container">
            <VueTurnstile
              ref="turnstile"
              v-model="token"
              :site-key="TURNSTILE_KEY"
              theme="auto"
            />
          </div>

          <!-- 自己提示 -->
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

    <!-- 公开提问列表 -->
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
                :class="{ unread: !item.isReaded }"
              >
                <!-- 问题头部 -->
                <template #header>
                  <NSpace
                    :size="5"
                    align="center"
                    class="question-header"
                  >
                    <NText
                      depth="3"
                      class="time-text"
                      style="margin-left: 8px;"
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
                <NCard
                  class="question-content"
                  size="small"
                >
                  <div
                    v-if="item.question.message"
                    class="question-message"
                  >
                    {{ item.question.message }}
                  </div>
                  <NDivider style="margin: 0;" />
                  <div
                    v-if="item.questionImages && item.questionImages.length > 0"
                    class="question-image-container"
                  >
                    <NImage
                      v-for="(img, index) in item.questionImages"
                      :key="index"
                      :src="img.path"
                      class="question-image"
                      :img-props="{ height: '100px' }"
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
                        :src="`${AVATAR_URL + userInfo?.biliId}?size=64`"
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
            v-else-if="!isGetting"
            class="empty-state"
            description="还没有公开回复"
          />
          <NSpin
            v-else
            style="width: 100%; margin-top: 20px;"
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
/* 基础容器样式 */
.question-box-container {
  max-width: 700px;
  margin: 0 auto;
  position: relative;
  width: 100%;
  padding: 0 16px;
  box-sizing: border-box;
}

/* 表单卡片样式 */
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

/* 话题选择区样式 */
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

/* 问题输入区域 */
.question-input-area {
  margin: 16px 0;
  width: 100%;
}

.question-textarea {
  width: 100% !important;
  min-height: 200px;
  resize: vertical;
  border-radius: 8px;
  transition: all 0.3s ease;
}

/* 图片上传区域 */
.image-upload-container {
  width: 100%;
  margin-bottom: 10px;
}

.image-upload-card {
  max-width: 500px;
  width: 100%;
  margin: 0 auto;
  text-align: center;
  border-radius: 6px;
  padding: 10px;
  transition: all 0.2s ease;
  border: 1px solid var(--border-color);
  background-color: var(--background-color);
}

.image-upload-card:hover {
  background-color: var(--hover-background-color);
}

.upload-header {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.upload-title {
  font-size: 13px;
  color: #666;
}

/* 已登录用户图片上传网格 */
.upload-images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
}

.upload-image-item, .upload-add-item {
  aspect-ratio: 1 / 1;
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-add-item {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--border-color);
  cursor: pointer;
}

.add-icon {
  font-size: 24px;
  color: var(--text-color);
}

.remove-image-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  opacity: 0.9;
}

/* 匿名图片上传样式 */
.anonymous-upload-container {
  height: 60px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.anonymous-upload-btn {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px dashed var(--border-color);
  border-radius: 4px;
  cursor: pointer;
}

.disabled-container {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.upload-disabled {
  cursor: not-allowed;
  opacity: 0.7;
  background-color: var(--hover-background-color);
}

/* 通用元素 */
.form-divider {
  margin: 10px 0;
  opacity: 0.6;
}

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

/* 操作按钮 */
.anonymous-option {
  margin: 8px 0;
}

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

.turnstile-container {
  display: flex;
  justify-content: center;
  margin: 8px 0;
}

/* 公开提问区域 */
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
  margin-left: auto;
}

.question-content {
  text-align: left;
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
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 12px;
  width: 100%;
  overflow: hidden;
}

/* 回答区域 */
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

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.fade-slide-down-enter-active,
.fade-slide-down-leave-active {
  transition: all 0.5s ease;
}

.fade-slide-down-enter-from,
.fade-slide-down-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

.fade-slide-up-enter-active,
.fade-slide-up-leave-active {
  transition: all 0.5s ease;
}

.fade-slide-up-enter-from,
.fade-slide-up-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.fade-scale-enter-active,
.fade-scale-leave-active {
  transition: all 0.5s ease;
}

.fade-scale-enter-from,
.fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

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
