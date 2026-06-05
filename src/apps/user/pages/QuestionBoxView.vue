<script setup lang="ts">
import type { QAInfo, UserInfo } from '@/api/api-models'
import { AddCircle24Regular, DismissCircle24Regular, History24Regular } from '@vicons/fluent'
import {
  NAlert, NAvatar, NBadge, NButton, NCard, NCheckbox, NDivider, NDrawer, NDrawerContent, NEmpty, NIcon, NImage, NInput, NList, NListItem, NFlex, NPagination, NSpin, NTag, NText, NTime, useMessage } from 'naive-ui';
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import VueTurnstile from 'vue-turnstile'
import { useAccount } from '@/api/account'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { AVATAR_URL, QUESTION_API_URL, TURNSTILE_KEY } from '@/shared/config'
import { useBiliAuth } from '@/store/useBiliAuth'
import { usePersistedStorage } from '@/shared/storage/persist'

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
const biliAuth = useBiliAuth()
const route = useRoute()
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

// 本地提问历史
const localQuestions = usePersistedStorage<LocalQuestion[]>('vtsuru-local-questions', [], {
  serializer: {
    read: (v: any) => v ? JSON.parse(v) : [],
    write: (v: any) => JSON.stringify(v),
  },
})
const showLocalQuestionsDrawer = ref(false)

// 问题相关状态
const questionMessage = ref('')
const publicQuestions = ref<QAInfo[]>([])
const publicPageSize = ref(10)
const publicPageNum = ref(1)
const pagedPublicQuestions = computed(() =>
  publicQuestions.value.slice((publicPageNum.value - 1) * publicPageSize.value, publicPageNum.value * publicPageSize.value),
)
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
const selectedFiles = ref<File[]>([])
const imagePreviewUrls = ref<string[]>([])
const maxImages = computed(() => isIdentified.value ? 9 : 3)
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/x-icon']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// 计算属性
const isUserLoggedIn = computed(() => !!accountInfo.value?.id)
const isBiliAuthed = computed(() => biliAuth.isAuthed && !!biliAuth.biliAuth?.userId)
const isIdentified = computed(() => isUserLoggedIn.value || isBiliAuthed.value)
const isSelf = computed(() => {
  if (userInfo?.id === accountInfo.value?.id) return true
  if (!userInfo?.biliId || !biliAuth.biliAuth?.userId) return false
  return String(userInfo.biliId) === String(biliAuth.biliAuth.userId)
})

// 辅助函数
function countGraphemes(value: string) {
  return [...segmenter.segment(value)].length
}

function isValidEmail(email: string): boolean {
  if (!email) return true // 空邮箱是允许的
  const emailRegex = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/
  return emailRegex.test(email)
}

// 图片处理
function validateImageFile(file: File): { valid: boolean, message?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, message: '文件大小不能超过10MB' }
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return { valid: false, message: '只支持上传 PNG, JPG, GIF, WEBP, SVG, ICO 格式的图片' }
  }
  return { valid: true }
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files?.length) return

  for (const file of Array.from(input.files)) {
    const validation = validateImageFile(file)
    if (!validation.valid) {
      message.error(validation.message!)
      continue
    }
    if (selectedFiles.value.length >= maxImages.value) {
      message.warning(`最多只能上传${maxImages.value}张图片`)
      break
    }
    const isDuplicate = selectedFiles.value.some(f =>
      f.name === file.name && f.size === file.size && f.lastModified === file.lastModified,
    )
    if (isDuplicate) {
      message.warning(`文件"${file.name}"已存在`)
      continue
    }
    selectedFiles.value.push(file)
    imagePreviewUrls.value.push(URL.createObjectURL(file))
  }
  input.value = ''
}

function removeImage(index: number) {
  URL.revokeObjectURL(imagePreviewUrls.value[index])
  imagePreviewUrls.value.splice(index, 1)
  selectedFiles.value.splice(index, 1)
}

function clearAllImages() {
  imagePreviewUrls.value.forEach(url => URL.revokeObjectURL(url))
  imagePreviewUrls.value = []
  selectedFiles.value = []
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

  if (anonymousEmail.value && !isValidEmail(anonymousEmail.value)) {
    message.error('邮箱格式不正确')
    return
  }

  if (!token.value) {
    message.warning('正在等待人机验证，请稍后再试')
    return
  }

  isSending.value = true

  try {
    const formData = new FormData()
    formData.append('Data', JSON.stringify({
      Target: userInfo?.id,
      IsAnonymous: !isIdentified.value || isAnonymous.value,
      Message: questionMessage.value,
      Tag: selectedTag.value,
      AnonymousName: !isIdentified.value && anonymousName.value ? anonymousName.value : undefined,
      AnonymousEmail: !isIdentified.value && anonymousEmail.value ? anonymousEmail.value : undefined,
    }))
    for (const file of selectedFiles.value) {
      formData.append('Files', file)
    }

    const headers: [string, string][] = [['Turnstile', token.value]]
    const data = biliAuth.isAuthed
      ? await biliAuth.QueryBiliAuthPostAPI<QAInfo>(`${QUESTION_API_URL}send`, formData, headers)
      : await QueryPostAPI<QAInfo>(`${QUESTION_API_URL}send`, formData, headers)

    if (data.code == 200) {
      message.success('成功发送棉花糖')

      if (!isIdentified.value && userInfo) {
        const localQuestion: LocalQuestion = {
          id: `local-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          targetUserId: userInfo.id,
          targetUserName: userInfo.name || '未知用户',
          message: questionMessage.value,
          tag: selectedTag.value,
          anonymousName: anonymousName.value,
          anonymousEmail: anonymousEmail.value,
          hasImage: selectedFiles.value.length > 0,
          sendAt: Date.now(),
        }
        localQuestions.value = [localQuestion, ...localQuestions.value]
      }

      questionMessage.value = ''
      anonymousName.value = ''
      anonymousEmail.value = ''
      clearAllImages()
      nextSendQuestionTime.value = Date.now() + minSendQuestionTime
      getPublicQuestions()
    } else {
      message.error(data.message || '发送失败')
    }
  } catch (err: any) {
    message.error(`发送失败: ${err.message || err}`)
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
  clearAllImages()
})
</script>

<template>
  <div class="question-box-wrapper">
    <div class="question-box-container">
      <!-- 提问表单 -->
      <NCard size="small" bordered>
        <template #header>
          <div class="header-main">
            <h2 class="title">
              向 {{ userInfo?.name || '主播' }} 提问
            </h2>
            <p class="subtitle">
              分享你的想法、建议或是简单打个招呼
            </p>
          </div>
        </template>
        <template #header-extra>
          <NBadge
            v-if="!isIdentified"
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
        </template>

        <NFlex vertical :size="16">
          <!-- 话题选择区域 -->
          <div v-if="tags.length > 0" class="section">
            <label class="section-label">投稿话题</label>
            <div class="tag-grid">
              <NTag
                v-for="tag in tags"
                :key="tag"
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
              placeholder="在这里输入你想说的话..."
              :autosize="{ minRows: 4, maxRows: 12 }"
            />
          </div>

          <!-- 附件与选项 -->
          <div class="section options-grid">
            <!-- 匿名模式选项 - 已登录用户 -->
            <div v-if="isIdentified" class="option-item">
              <NCheckbox
                v-model:checked="isAnonymous"
                :disabled="isSelf"
                label="匿名提问"
              />
            </div>

            <!-- 匿名用户信息输入 - 未登录用户 -->
            <template v-if="!isIdentified && !isSelf">
              <div class="anonymous-fields">
                <NInput
                  v-model:value="anonymousName"
                  placeholder="昵称 (可选)"
                  maxlength="20"
                  size="medium"
                />
                <NInput
                  v-model:value="anonymousEmail"
                  placeholder="邮箱 (接收回复通知)"
                  maxlength="100"
                  size="medium"
                  :status="anonymousEmail && !isValidEmail(anonymousEmail) ? 'error' : undefined"
                />
              </div>
            </template>
          </div>

          <!-- 图片上传 -->
          <div v-if="!isSelf && (isIdentified || allowUploadImage)" class="section">
            <label class="section-label">图片附件</label>
            <div class="image-upload-area">
              <div class="upload-grid">
                <div
                  v-for="(url, index) in imagePreviewUrls"
                  :key="index"
                  class="upload-item"
                >
                  <NImage :src="url" object-fit="cover" />
                  <NButton
                    circle
                    size="tiny"
                    type="error"
                    class="remove-btn"
                    @click="removeImage(index)"
                  >
                    <template #icon>
                      <NIcon :component="DismissCircle24Regular" />
                    </template>
                  </NButton>
                </div>
                <div
                  v-if="selectedFiles.length < maxImages"
                  class="add-btn"
                  @click="($refs.fileInput as HTMLInputElement)?.click()"
                >
                  <NIcon :component="AddCircle24Regular" />
                </div>
              </div>
              <input
                ref="fileInput"
                type="file"
                style="display: none;"
                multiple
                accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/x-icon"
                @change="handleFileSelect"
              >
            </div>
          </div>

          <!-- 底部操作 -->
          <NDivider style="margin: 0;" />
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
                :disabled="isSelf || !token"
                type="primary"
                size="large"
                :loading="isSending || !token"
                @click="SendQuestion"
              >
                {{ isSending && selectedFiles.length > 0 ? '正在上传图片...' : (!token ? '人机验证中...' : '提交问题') }}
              </NButton>
              <NButton
                v-if="isUserLoggedIn"
                :disabled="isSelf"
                size="large"
                @click="$router.push({ name: 'manage-questionBox', query: { send: '1' } })"
              >
                已发送记录
              </NButton>
            </div>

            <NAlert v-if="isSelf" type="warning" :bordered="false">
              您不能向自己发起提问
            </NAlert>
          </div>
        </NFlex>
      </NCard>

      <!-- 公开列表 -->
      <div class="public-section">
        <div class="shadcn-divider">
          <span class="divider-label">公开回复</span>
          <div class="divider-line" />
        </div>

        <div v-if="publicQuestions.length > 0" class="questions-stack">
          <NCard
            v-for="item in pagedPublicQuestions"
            :key="item.id"
            :bordered="true"
            size="small"
            content-style="padding: 0"
          >
            <div class="question-stack-header">
              <NTime :time="item.sendAt" type="relative" class="time" />
              <NTag v-if="item.tag" size="small" :bordered="false" class="tag">
                {{ item.tag }}
              </NTag>
            </div>

            <div class="question-stack-body">
              <div class="message">
                {{ item.question.message }}
              </div>
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
              <NDivider style="margin: 0 0 15px 0;" />
              <div class="answer-header">
                <NAvatar
                  :src="`${AVATAR_URL + userInfo?.biliId}?size=64`"
                  circle
                  :img-props="{
                    referrerpolicy: 'no-referrer',
                  }"
                  size="small"
                  class="avatar"
                />
                <span class="name">{{ userInfo?.name }} 的回复</span>
              </div>
              <div class="answer-message">
                {{ item.answer.message }}
              </div>
            </div>
          </NCard>
        </div>
        <NPagination
          v-if="publicQuestions.length > publicPageSize"
          v-model:page="publicPageNum"
          :item-count="publicQuestions.length"
          :page-size="publicPageSize"
          style="margin-top: 16px; justify-content: center;"
        />

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
            <NFlex justify="space-between" align="center" style="width: 100%;">
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
            </NFlex>
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
                  <NFlex :size="8" align="center" justify="space-between">
                    <NFlex :size="8" align="center">
                      <NText strong>
                        提给：{{ item.targetUserName }}
                      </NText>
                      <NTag v-if="item.tag" size="small" type="info">
                        {{ item.tag }}
                      </NTag>
                    </NFlex>
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
                  </NFlex>
                </template>

                <NFlex vertical :size="8">
                  <div class="local-question-message">
                    {{ item.message }}
                  </div>

                  <NDivider style="margin: 8px 0;" />

                  <NFlex :size="4" vertical>
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
                  </NFlex>
                </NFlex>
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
  width: 100%;
}

.header-main .title {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin: 0 0 2px;
  color: var(--n-text-color);
}

.header-main .subtitle {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin: 0;
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
  color: var(--n-text-color);
  opacity: 0.8;
  margin-bottom: 2px;
}

.tag-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
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
  border-radius: var(--n-border-radius);
  overflow: hidden;
  border: 1px solid var(--n-border-color);
}
.upload-item .remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  z-index: 10;
}

.add-btn {
  width: 64px;
  height: 64px;
  border-radius: var(--n-border-radius);
  border: 1px dashed var(--n-border-color);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--n-text-color-3);
  transition: border-color 0.15s ease, color 0.15s ease, background-color 0.15s ease;
  gap: 2px;
}

.add-btn:hover {
  border-color: var(--n-primary-color);
  color: var(--n-primary-color);
  background-color: rgba(var(--n-primary-color-rgb), 0.04);
}

.add-btn .btn-text {
  font-size: 10px;
}

/* Footer & Buttons */
.shadcn-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.turnstile-wrapper {
  display: flex;
  justify-content: center;
  padding: 4px 0;
  max-width: 320px;
  margin: 0 auto;
}

@media (max-width: 600px) {
  .turnstile-wrapper {
    transform: scale(0.92);
    transform-origin: center;
  }
}

.actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}

/* Public List Section */
.public-section {
  margin-top: 24px;
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
  color: var(--n-text-color-3);
  white-space: nowrap;
}

.divider-line {
  height: 1px;
  flex-grow: 1;
  background-color: var(--n-border-color);
}

.questions-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.question-stack-header {
  padding: 10px 12px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.question-stack-header .time {
  font-size: 11px;
  color: var(--n-text-color-3);
}

.question-stack-body {
  padding: 8px 12px 10px;
}

.question-stack-body .message {
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  color: var(--n-text-color);
}

.question-stack-body .images {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.question-stack-body .images .img {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  max-width: 180px;
  max-height: 96px;
  border-radius: var(--n-border-radius);
  border: 1px solid var(--n-border-color);
  overflow: hidden;
  background-color: var(--n-color-embedded);
}

.question-stack-body .images .img :deep(img) {
  max-width: 180px;
  max-height: 96px;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
}

.answer-stack-body {
  margin: 0 12px 10px;
  padding: 8px 10px;
  background-color: rgba(var(--n-primary-color-rgb), 0.02);
  border-radius: var(--n-border-radius);
  border: 1px solid rgba(var(--n-primary-color-rgb), 0.08);
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
  color: var(--n-primary-color);
}

.answer-message {
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  color: var(--n-text-color);
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
  border-radius: var(--n-border-radius);
}

.local-question-card:hover {
  border-color: var(--n-primary-color);
}

.local-question-message {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
  padding: 4px 0;
}
</style>
