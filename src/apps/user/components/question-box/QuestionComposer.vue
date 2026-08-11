<script setup lang="ts">
import {
  ArrowRight24Regular,
  CheckmarkCircle24Regular,
  Dismiss24Regular,
  History24Regular,
  Image24Regular,
  LockClosed24Regular,
  Mail24Regular,
  Send24Regular,
} from '@vicons/fluent'
import { NAvatar, NButton, NCheckbox, NIcon, NInput, NTag, useMessage } from 'naive-ui'
import { onBeforeUnmount, toRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VueTurnstile from 'vue-turnstile'

import type { UserInfo } from '@/api/api-models'
import { AVATAR_URL, TURNSTILE_KEY } from '@/shared/config'
import { isDarkMode } from '@/shared/utils'

import { useQuestionComposer } from './useQuestionComposer'

const props = defineProps<{
  userInfo?: UserInfo
  tags: string[]
  embedded?: boolean
  defaultTag?: string
}>()
const emit = defineEmits<{
  openHistory: []
  submitted: []
}>()

const route = useRoute()
const router = useRouter()
const message = useMessage()
const target = toRef(props, 'userInfo')
const composer = useQuestionComposer(target, () => emit('submitted'))
const {
  addFiles,
  canSubmit,
  canUploadImages,
  characterCount,
  composeAgain,
  cooldownSeconds,
  draft,
  identityName,
  imagePreviewUrls,
  isDragging,
  isIdentified,
  isSelf,
  isSending,
  isSent,
  isUserLoggedIn,
  isValidEmail,
  maxImages,
  removeImage,
  selectedFiles,
  sendQuestion,
  token,
  turnstile,
} = composer

watch(
  [() => route.query.tag, () => props.tags],
  ([queryTag, tags]) => {
    if (typeof queryTag !== 'string' || !tags.includes(queryTag) || draft.value.tag === queryTag) return
    draft.value = { ...draft.value, tag: queryTag }
  },
  { immediate: true },
)

let defaultTagApplied = false
let defaultTagTimer: number | undefined
watch(
  () => props.tags,
  (tags) => {
    const defaultValue = props.defaultTag
    if (!defaultValue || !tags.includes(defaultValue) || defaultTagApplied) return
    window.clearTimeout(defaultTagTimer)
    defaultTagTimer = window.setTimeout(() => {
      if (defaultTagApplied || draft.value.tag !== null) return
      draft.value = { ...draft.value, tag: defaultValue }
      defaultTagApplied = true
    }, 150)
  },
  { immediate: true },
)

onBeforeUnmount(() => window.clearTimeout(defaultTagTimer))

function notifyFile(messageText: string, type: 'warning' | 'error') {
  message[type](messageText)
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  addFiles(Array.from(input.files ?? []), notifyFile)
  input.value = ''
}

function handlePaste(event: ClipboardEvent) {
  if (!canUploadImages.value) return
  const files = Array.from(event.clipboardData?.files ?? [])
  if (!files.length) return
  event.preventDefault()
  addFiles(files, notifyFile)
}

function handleDrop(event: DragEvent) {
  isDragging.value = false
  if (!canUploadImages.value) return
  addFiles(Array.from(event.dataTransfer?.files ?? []), notifyFile)
}

async function submit() {
  try {
    await sendQuestion()
    message.success('已送达')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '提交失败')
  }
}
</script>

<template>
  <section
    class="question-composer"
    :class="{ 'is-embedded': embedded }"
  >
    <header class="composer-header">
      <NAvatar
        round
        :size="48"
        :src="
          userInfo?.faceUrl ||
          userInfo?.streamerInfo?.faceUrl ||
          (userInfo?.biliId ? `${AVATAR_URL + userInfo.biliId}?size=96` : undefined)
        "
        :img-props="{ referrerpolicy: 'no-referrer', alt: `${userInfo?.name || '主播'} 的头像` }"
      />
      <div class="header-copy">
        <span class="header-kicker">私密留言</span>
        <h1>给 {{ userInfo?.name || '主播' }} 留句话</h1>
        <p>说说你正在想的事。</p>
      </div>
      <NButton
        v-if="!isIdentified"
        secondary
        size="small"
        class="history-action"
        @click="emit('openHistory')"
      >
        <template #icon><NIcon :component="History24Regular" /></template>
        本地记录
      </NButton>
      <NButton
        v-else-if="isUserLoggedIn"
        secondary
        size="small"
        class="history-action"
        :disabled="isSelf"
        @click="router.push({ name: 'manage-questionBox', query: { send: '1' } })"
      >
        <template #icon><NIcon :component="History24Regular" /></template>
        已发送
      </NButton>
    </header>

    <Transition
      name="composer-state"
      mode="out-in"
    >
      <div
        v-if="isSent"
        key="sent"
        class="sent-state"
      >
        <span class="sent-icon"><NIcon :component="CheckmarkCircle24Regular" /></span>
        <span class="sent-kicker">MESSAGE DELIVERED</span>
        <h2>已经送达</h2>
        <p>这条留言已进入 {{ userInfo?.name || '主播' }} 的提问箱。</p>
        <NButton
          type="primary"
          secondary
          @click="composeAgain"
        >
          再写一条
          <template #icon><NIcon :component="ArrowRight24Regular" /></template>
        </NButton>
      </div>

      <div
        v-else
        key="editor"
        class="composer-body"
      >
        <div
          v-if="tags.length"
          class="topic-section"
        >
          <div class="field-heading">
            <span>选择话题</span>
            <small>可选</small>
          </div>
          <Transition name="topic-banner">
            <div
              v-if="draft.tag"
              :key="draft.tag"
              class="topic-banner"
            >
              <span class="topic-banner-kicker">CURRENT TOPIC</span>
              <strong>{{ draft.tag }}</strong>
              <button
                type="button"
                class="topic-banner-clear"
                @click="draft = { ...draft, tag: null }"
              >
                取消
              </button>
            </div>
          </Transition>
          <div class="topic-list">
            <button
              v-for="tag in tags"
              :key="tag"
              type="button"
              class="topic-chip"
              :class="{ 'is-active': draft.tag === tag }"
              :aria-pressed="draft.tag === tag"
              @click="draft = { ...draft, tag: draft.tag === tag ? null : tag }"
            >
              {{ tag }}
            </button>
          </div>
        </div>

        <div
          class="message-editor"
          :class="{ 'is-dragging': isDragging }"
          @dragenter.prevent="isDragging = true"
          @dragover.prevent
          @dragleave.self="isDragging = false"
          @drop.prevent="handleDrop"
        >
          <NInput
            v-model:value="draft.message"
            class="message-input"
            :disabled="isSelf"
            type="textarea"
            maxlength="10000"
            :autosize="{ minRows: 6, maxRows: 14 }"
            placeholder="写下你想说的话..."
            @paste="handlePaste"
          />
          <div class="editor-footer">
            <span class="identity-state">
              <NIcon :component="LockClosed24Regular" />
              {{ identityName }}
            </span>
            <span :class="{ 'is-invalid': characterCount > 0 && characterCount < 3 }">
              {{ characterCount }} / 10000
            </span>
          </div>
        </div>

        <div
          v-if="canUploadImages"
          class="attachment-section"
        >
          <div class="attachment-toolbar">
            <label class="upload-action">
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/x-icon"
                @change="handleFileSelect"
              />
              <NIcon :component="Image24Regular" />
              <span>添加图片</span>
            </label>
            <span>{{ selectedFiles.length }} / {{ maxImages }}</span>
          </div>
          <TransitionGroup
            v-if="imagePreviewUrls.length"
            name="attachment"
            tag="div"
            class="attachment-grid"
          >
            <figure
              v-for="(url, index) in imagePreviewUrls"
              :key="url"
              class="attachment-item"
            >
              <img
                :src="url"
                alt=""
              />
              <button
                type="button"
                :aria-label="`移除第 ${index + 1} 张图片`"
                :title="`移除第 ${index + 1} 张图片`"
                @click="removeImage(index)"
              >
                <NIcon :component="Dismiss24Regular" />
              </button>
            </figure>
          </TransitionGroup>
        </div>

        <div
          v-if="!isSelf"
          class="identity-panel"
        >
          <div class="identity-copy">
            <NIcon :component="LockClosed24Regular" />
            <div>
              <strong>{{ isIdentified ? '提交身份' : '匿名留言' }}</strong>
              <span>{{ isIdentified ? identityName : '邮箱仅用于接收回复通知' }}</span>
            </div>
          </div>
          <NCheckbox
            v-if="isIdentified"
            v-model:checked="draft.isAnonymous"
          >
            隐藏我的身份
          </NCheckbox>
          <div
            v-else
            class="guest-fields"
          >
            <NInput
              v-model:value="draft.anonymousName"
              maxlength="20"
              placeholder="昵称（可选）"
            />
            <NInput
              v-model:value="draft.anonymousEmail"
              maxlength="100"
              placeholder="邮箱（可选）"
              :status="draft.anonymousEmail && !isValidEmail(draft.anonymousEmail) ? 'error' : undefined"
            >
              <template #prefix><NIcon :component="Mail24Regular" /></template>
            </NInput>
          </div>
        </div>

        <div
          v-if="isSelf"
          class="self-state"
        >
          <NIcon :component="LockClosed24Regular" />
          <span>当前是你自己的提问箱</span>
        </div>
        <footer
          v-else
          class="submit-row"
        >
          <div class="verification-box">
            <VueTurnstile
              ref="turnstile"
              v-model="token"
              :site-key="TURNSTILE_KEY"
              :theme="isDarkMode ? 'dark' : 'light'"
              size="flexible"
            />
          </div>
          <div class="submit-action">
            <NTag
              v-if="cooldownSeconds > 0"
              size="small"
              :bordered="false"
            >
              {{ cooldownSeconds }} 秒后可再次提交
            </NTag>
            <NButton
              type="primary"
              size="large"
              :disabled="!canSubmit"
              :loading="isSending"
              @click="submit"
            >
              {{ selectedFiles.length && isSending ? '正在上传' : '送出留言' }}
              <template #icon><NIcon :component="Send24Regular" /></template>
            </NButton>
          </div>
        </footer>
      </div>
    </Transition>
  </section>
</template>

<style scoped src="./QuestionComposer.css"></style>
