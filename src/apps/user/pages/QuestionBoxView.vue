<script setup lang="ts">
import type { QAInfo, UserInfo } from '@/api/api-models'
import { AddCircle24Regular, DismissCircle24Regular, History24Regular } from '@vicons/fluent'
import GraphemeSplitter from 'grapheme-splitter'
import {
  NAlert,
  NAvatar,
  NBadge,
  NButton,
  NCard,
  NCheckbox,
  NDivider,
  NDrawer,
  NDrawerContent,
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
  useMessage,
} from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useStorage } from '@vueuse/core'
import VueTurnstile from 'vue-turnstile'
import { useAccount } from '@/api/account'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { AVATAR_URL, FILE_API_URL, QUESTION_API_URL, TURNSTILE_KEY } from '@/shared/config'
import { uploadFiles } from '@/shared/services/fileUpload'

const { userInfo } = defineProps<{
  userInfo: UserInfo | undefined
}>()

// 本地提问历史接口
interface LocalQuestion {
  id: string
  targetUserId: number
  targetUserName: string
  message: string
  tag: string | null
  anonymousName: string
  anonymousEmail: string
  hasImage: boolean
  sendAt: number
}

// 基础状态变量
const message = useMessage()
const accountInfo = useAccount()
const route = useRoute()
const splitter = new GraphemeSplitter()

// 本地提问历史
const localQuestions = useStorage<LocalQuestion[]>('vtsuru-local-questions', [], undefined, {
  serializer: {
    read: (v: any) => v ? JSON.parse(v) : [],
    write: (v: any) => JSON.stringify(v),
  },
})
const showLocalQuestionsDrawer = ref(false)

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
const anonymousName = ref('')
const anonymousEmail = ref('')

// 图片上传相关状态
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

function isValidEmail(email: string): boolean {
  if (!email) return true // 空邮箱是允许的
  const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/
  return emailRegex.test(email)
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

  // 验证邮箱格式
  if (anonymousEmail.value && !isValidEmail(anonymousEmail.value)) {
    message.error('邮箱格式不正确')
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
      AnonymousName: !isUserLoggedIn.value && anonymousName.value ? anonymousName.value : undefined,
      AnonymousEmail: !isUserLoggedIn.value && anonymousEmail.value ? anonymousEmail.value : undefined,
    }

    const data = await QueryPostAPI<QAInfo>(
      `${QUESTION_API_URL}send`,
      payload,
      [['Turnstile', token.value]],
    )

    if (data.code == 200) {
      message.success('成功发送棉花糖')

      // 如果是未登录用户，保存到本地历史
      if (!isUserLoggedIn.value && userInfo) {
        const localQuestion: LocalQuestion = {
          id: `local-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          targetUserId: userInfo.id,
          targetUserName: userInfo.name || '未知用户',
          message: questionMessage.value,
          tag: selectedTag.value,
          anonymousName: anonymousName.value,
          anonymousEmail: anonymousEmail.value,
          hasImage: !!anonymousImageToken.value,
          sendAt: Date.now(),
        }
        localQuestions.value = [localQuestion, ...localQuestions.value]
      }

      questionMessage.value = ''
      anonymousName.value = ''
      anonymousEmail.value = ''
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
      console.error(err)
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

// 本地提问历史管理
function deleteLocalQuestion(id: string) {
  localQuestions.value = localQuestions.value.filter(q => q.id !== id)
  message.success('已删除')
}

function clearAllLocalQuestions() {
  localQuestions.value = []
  message.success('已清空所有本地提问记录')
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
  <div class="question-box-wrapper">
    <NDivider />
    <div class="question-box-container">
      <!-- 提问表单 -->
      <NCard
        :bordered="true"
        class="shadcn-card"
      >
        <div class="shadcn-card-header">
          <div class="header-main">
            <h2 class="title">向 {{ userInfo?.name || '主播' }} 提问</h2>
            <p class="subtitle">分享你的想法、建议或是简单打个招呼</p>
          </div>
          <NBadge
            v-if="!isUserLoggedIn"
            :value="localQuestions.length"
            :max="99"
            :show="localQuestions.length > 0"
          >
            <NButton
              secondary
              size="small"
              @click="showLocalQuestionsDrawer = true"
            >
              <template #icon>
                <NIcon :component="History24Regular" />
              </template>
              本地记录
            </NButton>
          </NBadge>
        </div>

        <NSpace vertical :size="16" class="shadcn-card-content">
          <!-- 话题选择区域 -->
          <div v-if="tags.length > 0" class="section">
            <label class="section-label">投稿话题</label>
            <div class="tag-grid">
              <NTag
                v-for="tag in tags"
                :key="tag"
                class="shadcn-tag"
                :bordered="true"
                :type="selectedTag === tag ? 'primary' : 'default'"
                @click="onSelectTag(tag)"
              >
                {{ tag }}
              </NTag>
            </div>
          </div>

          <!-- 问题输入区域 -->
          <div class="section">
            <label class="section-label">内容</label>
            <NInput
              v-model:value="questionMessage"
              :disabled="isSelf"
              show-count
              maxlength="10000"
              type="textarea"
              :count-graphemes="countGraphemes"
              class="shadcn-input"
              placeholder="在这里输入你想说的话..."
              :autosize="{ minRows: 4, maxRows: 12 }"
            />
          </div>

          <!-- 附件与选项 -->
          <div class="section options-grid">
            <!-- 匿名模式选项 - 已登录用户 -->
            <div v-if="isUserLoggedIn" class="option-item">
              <NCheckbox
                v-model:checked="isAnonymous"
                :disabled="isSelf"
                label="匿名提问"
              />
            </div>

            <!-- 匿名用户信息输入 - 未登录用户 -->
            <template v-if="!isUserLoggedIn && !isSelf">
              <div class="anonymous-fields">
                <NInput
                  v-model:value="anonymousName"
                  placeholder="昵称 (可选)"
                  maxlength="20"
                  size="medium"
                  class="shadcn-input-small"
                />
                <NInput
                  v-model:value="anonymousEmail"
                  placeholder="邮箱 (接收回复通知)"
                  maxlength="100"
                  size="medium"
                  class="shadcn-input-small"
                  :status="anonymousEmail && !isValidEmail(anonymousEmail) ? 'error' : undefined"
                />
              </div>
            </template>
          </div>

          <!-- 图片上传 -->
          <div v-if="!isSelf && (isUserLoggedIn || allowUploadImage)" class="section">
            <label class="section-label">图片附件</label>
            <div class="image-upload-area">
              <!-- 已登录用户 -->
              <template v-if="isUserLoggedIn">
                <div class="upload-grid">
                  <div
                    v-for="(url, index) in loggedInImagePreviewUrls"
                    :key="index"
                    class="upload-item"
                  >
                    <NImage :src="url" object-fit="cover" />
                    <NButton
                      circle
                      size="tiny"
                      type="error"
                      class="remove-btn"
                      @click="removeLoggedInImage(index)"
                    >
                      <template #icon><NIcon :component="DismissCircle24Regular" /></template>
                    </NButton>
                  </div>
                  <div
                    v-if="loggedInSelectedFiles.length < MAX_LOGGED_IN_IMAGES"
                    class="add-btn"
                    @click="($refs.loggedInFileInput as HTMLInputElement)?.click()"
                  >
                    <NIcon :component="AddCircle24Regular" />
                  </div>
                </div>
                <input ref="loggedInFileInput" type="file" style="display: none;" multiple @change="handleLoggedInFileSelect">
              </template>

              <!-- 匿名用户 -->
              <template v-else-if="allowUploadImage">
                <div class="upload-grid">
                  <div v-if="anonymousImageToken" class="upload-item">
                    <NImage :src="anonymousImagePreviewUrl!" object-fit="cover" />
                    <NButton
                      circle
                      size="tiny"
                      type="error"
                      class="remove-btn"
                      @click="removeAnonymousImage"
                    >
                      <template #icon><NIcon :component="DismissCircle24Regular" /></template>
                    </NButton>
                  </div>
                  <div
                    v-else
                    class="add-btn"
                    @click="($refs.anonymousFileInput as HTMLInputElement)?.click()"
                  >
                    <NIcon :component="AddCircle24Regular" />
                    <span class="btn-text">添加图片</span>
                  </div>
                </div>
                <input ref="anonymousFileInput" type="file" style="display: none;" @change="handleAnonymousFileSelect">
              </template>
            </div>
          </div>

          <!-- 底部操作 -->
          <div class="shadcn-footer">
            <div class="turnstile-wrapper">
              <VueTurnstile
                ref="turnstile"
                v-model="token"
                :site-key="TURNSTILE_KEY"
                theme="auto"
              />
            </div>

            <div class="actions">
              <NButton
                :disabled="isSelf || isUploadingAnonymousImage"
                type="primary"
                size="large"
                :loading="isSending || !token"
                class="shadcn-button-primary"
                @click="SendQuestion"
              >
                提交问题
              </NButton>
              <NButton
                v-if="isUserLoggedIn"
                :disabled="isSelf"
                size="large"
                class="shadcn-button-secondary"
                @click="$router.push({ name: 'manage-questionBox', query: { send: '1' } })"
              >
                已发送记录
              </NButton>
            </div>

            <NAlert v-if="isSelf" type="warning" :bordered="false" class="shadcn-alert">
              您不能向自己发起提问
            </NAlert>
          </div>
        </NSpace>
      </NCard>

      <!-- 公开列表 -->
      <div class="public-section">
        <div class="shadcn-divider">
          <span class="divider-label">公开回复</span>
          <div class="divider-line" />
        </div>

        <div v-if="publicQuestions.length > 0" class="questions-stack">
          <NCard
            v-for="item in publicQuestions"
            :key="item.id"
            :bordered="true"
            class="question-stack-card"
          >
            <div class="question-stack-header">
              <NTime :time="item.sendAt" type="relative" class="time" />
              <NTag v-if="item.tag" size="small" :bordered="false" class="tag">{{ item.tag }}</NTag>
            </div>

            <div class="question-stack-body">
              <div class="message">{{ item.question.message }}</div>
              <div v-if="item.questionImages?.length" class="images">
                <NImage
                  v-for="(img, idx) in item.questionImages"
                  :key="idx"
                  :src="img.path"
                  class="img"
                />
              </div>
            </div>

            <div v-if="item.answer" class="answer-stack-body">
              <div class="answer-header">
                <NAvatar
                  :src="`${AVATAR_URL + userInfo?.biliId}?size=64`"
                  circle
                  size="small"
                  class="avatar"
                />
                <span class="name">{{ userInfo?.name }} 的回复</span>
              </div>
              <div class="answer-message">{{ item.answer.message }}</div>
            </div>
          </NCard>
        </div>

        <NEmpty v-else-if="!isGetting" class="empty" description="暂无公开回复" />
        <NSpin v-else class="loading" />
      </div>

      <NDivider />

      <!-- 本地提问历史抽屉 -->
      <NDrawer
        v-model:show="showLocalQuestionsDrawer"
        :width="500"
        placement="right"
      >
        <NDrawerContent closable>
          <template #header>
            <NSpace justify="space-between" align="center" style="width: 100%;">
              <NText strong style="font-size: 16px;">
                本地提问记录
              </NText>
              <NButton
                v-if="localQuestions.length > 0"
                text
                type="error"
                size="small"
                @click="clearAllLocalQuestions"
              >
                清空全部
              </NButton>
            </NSpace>
          </template>

          <div v-if="localQuestions.length === 0" class="empty-local-questions">
            <NEmpty description="还没有本地提问记录" />
            <NText depth="3" style="text-align: center; display: block; margin-top: 12px;">
              未登录状态下发送的提问会保存到这里
            </NText>
          </div>

          <NList v-else>
            <NListItem
              v-for="item in localQuestions"
              :key="item.id"
              class="local-question-item"
            >
              <NCard
                size="small"
                class="local-question-card"
                hoverable
              >
                <template #header>
                  <NSpace :size="8" align="center" justify="space-between">
                    <NSpace :size="8" align="center">
                      <NText strong>
                        提给：{{ item.targetUserName }}
                      </NText>
                      <NTag v-if="item.tag" size="small" type="info">
                        {{ item.tag }}
                      </NTag>
                    </NSpace>
                    <NButton
                      text
                      type="error"
                      size="small"
                      @click="deleteLocalQuestion(item.id)"
                    >
                      <template #icon>
                        <NIcon :component="DismissCircle24Regular" />
                      </template>
                    </NButton>
                  </NSpace>
                </template>

                <NSpace vertical :size="8">
                  <div class="local-question-message">
                    {{ item.message }}
                  </div>

                  <NDivider style="margin: 8px 0;" />

                  <NSpace :size="4" vertical>
                    <NText depth="3" style="font-size: 12px;">
                      <NTime :time="item.sendAt" format="yyyy-MM-dd HH:mm:ss" />
                    </NText>
                    <NText v-if="item.anonymousName" depth="3" style="font-size: 12px;">
                      昵称：{{ item.anonymousName }}
                    </NText>
                    <NText v-if="item.anonymousEmail" depth="3" style="font-size: 12px;">
                      邮箱：{{ item.anonymousEmail }}
                    </NText>
                    <NTag v-if="item.hasImage" size="tiny" type="success">
                      包含图片
                    </NTag>
                  </NSpace>
                </NSpace>
              </NCard>
            </NListItem>
          </NList>

          <template #footer>
            <NAlert type="info" size="small">
              <template #icon>
                <NIcon :component="History24Regular" />
              </template>
              本地记录仅保存在浏览器，清除浏览器数据后将丢失
            </NAlert>
          </template>
        </NDrawerContent>
      </NDrawer>
    </div>
  </div>
</template>

<style scoped>
.question-box-wrapper {
  width: 100%;
}

.question-box-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 0 16px;
}

/* Shadcn-like Card */
.shadcn-card {
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background-color: var(--card-color);
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  transition: box-shadow 0.2s;
}

.shadcn-card.self-user {
  /* 移除左侧彩色边框 */
  opacity: 0.8;
}

.shadcn-card-header {
  padding: 16px 16px 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.header-main .title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0 0 2px;
  color: var(--text-color);
}

.header-main .subtitle {
  font-size: 12px;
  color: var(--text-color-3);
  margin: 0;
}

.shadcn-card-content {
  padding: 16px;
}

/* Sections */
.section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-label {
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  color: var(--text-color);
  opacity: 0.8;
  margin-bottom: 2px;
}

/* Tag Styles */
.tag-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.shadcn-tag {
  cursor: pointer;
  border-radius: 4px;
  padding: 2px 8px;
  font-size: 12px;
  transition: all 0.2s;
}

.shadcn-tag:hover {
  opacity: 0.8;
}

/* Input Styles */
.shadcn-input :deep(.n-input-wrapper) {
  padding: 6px 10px;
  border-radius: 4px;
}

.shadcn-input-small :deep(.n-input-wrapper) {
  border-radius: 4px;
}

.options-grid {
  padding: 0;
}

.anonymous-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

@media (max-width: 600px) {
  .anonymous-fields {
    grid-template-columns: 1fr;
  }
}

/* Image Upload Area */
.image-upload-area {
  min-height: 24px;
}

.upload-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.upload-item {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.upload-item .remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  z-index: 10;
  background-color: rgba(255, 255, 255, 0.9);
}

.add-btn {
  width: 64px;
  height: 64px;
  border-radius: 4px;
  border: 1px dashed var(--border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-color-3);
  transition: all 0.2s;
  gap: 2px;
}

.add-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
  background-color: rgba(var(--primary-color-rgb), 0.04);
}

.add-btn .btn-text {
  font-size: 10px;
}

/* Footer & Buttons */
.shadcn-footer {
  border-top: 1px solid var(--border-color);
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.turnstile-wrapper {
  display: flex;
  justify-content: center;
  transform: scale(0.85);
  margin-bottom: -4px;
}

.actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.shadcn-button-primary {
  min-width: 100px;
  height: 36px;
  font-weight: 500;
  border-radius: 4px;
}

.shadcn-button-secondary {
  min-width: 100px;
  height: 36px;
  font-weight: 500;
  border-radius: 4px;
}

.shadcn-alert {
  border-radius: 4px;
  padding: 8px 12px;
}

/* Public List Section */
.public-section {
  margin-top: 32px;
}

.shadcn-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.divider-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-color-3);
  white-space: nowrap;
}

.divider-line {
  height: 1px;
  flex-grow: 1;
  background-color: var(--border-color);
}

.questions-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.question-stack-card {
  border-radius: 4px;
  border: 1px solid var(--border-color);
  transition: background-color 0.2s;
}

.question-stack-card:hover {
  background-color: rgba(0, 0, 0, 0.01);
}

.question-stack-header {
  padding: 10px 12px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.question-stack-header .time {
  font-size: 11px;
  color: var(--text-color-3);
}

.question-stack-body {
  padding: 10px 12px;
}

.question-stack-body .message {
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  color: var(--text-color);
}

.question-stack-body .images {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.question-stack-body .images .img {
  width: 64px;
  height: 64px;
  border-radius: 4px;
  border: 1px solid var(--border-color);
}

.answer-stack-body {
  margin: 0 12px 12px;
  padding: 10px;
  background-color: rgba(var(--primary-color-rgb), 0.02);
  border-radius: 4px;
  border: 1px solid rgba(var(--primary-color-rgb), 0.08);
}

.answer-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
}

.answer-header .name {
  font-size: 12px;
  font-weight: 600;
  color: var(--primary-color);
}

.answer-message {
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  color: var(--text-color);
}

.empty, .loading {
  padding: 32px 0;
}

/* 本地提问历史样式 */
.empty-local-questions {
  padding: 32px 16px;
}

.local-question-item {
  margin-bottom: 10px;
}

.local-question-card {
  border-radius: 4px;
  transition: all 0.2s ease;
}

.local-question-card:hover {
  border-color: var(--primary-color);
}

.local-question-message {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
  padding: 4px 0;
}
</style>
