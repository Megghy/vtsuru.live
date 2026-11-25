<script setup lang="ts">
import {
  ArrowRight,
  CheckCircle2,
  History,
  ImagePlus,
  Lock,
  Mail,
  Megaphone,
  PauseCircle,
  Send,
  X,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, toRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { ResponseUserInfo } from '@/api/generated/model'
import CaptchaWidget from '@/apps/user/components/CaptchaWidget.vue'
import { AVATAR_URL } from '@/shared/config'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { ImagePreview } from '@/shared/ui/image-preview'
import { Input } from '@/shared/ui/input'
import { Tag } from '@/shared/ui/tag'
import { Textarea } from '@/shared/ui/textarea'
import { useMessage } from '@/shared/utils'

import { useQuestionComposer } from './useQuestionComposer'

const props = defineProps<{
  userInfo?: ResponseUserInfo
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
  allowAnonymous,
  allowDefaultPublic,
  allowUnregistedUser,
  canSubmit,
  canUploadImages,
  characterCount,
  composeAgain,
  cooldownSeconds,
  draft,
  hasValidMessageLength,
  identityName,
  imagePreviewUrls,
  isDragging,
  isIdentified,
  isMessageTooLong,
  isPaused,
  isSelf,
  isSending,
  isSent,
  isUserLoggedIn,
  isValidEmail,
  maxImages,
  maxMessageLength,
  notice,
  pauseMessage,
  removeImage,
  selectedFiles,
  sendQuestion,
  submitDisabledReason,
  token,
  turnstile,
} = composer

const headerKicker = computed(() => {
  if (isPaused.value) return '暂停收件'
  if (allowDefaultPublic.value && draft.value.allowPublic !== false) return '提问箱 · 公开问答'
  return '私密留言'
})

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
    :data-site-surface="embedded ? undefined : 'card'"
  >
    <header class="composer-header">
      <Avatar class="size-12">
        <AvatarImage
          :src="
            userInfo?.faceUrl ||
            userInfo?.streamerInfo?.faceUrl ||
            (userInfo?.biliId ? `${AVATAR_URL + userInfo.biliId}?size=96` : undefined)
          "
          referrerpolicy="no-referrer"
          :alt="`${userInfo?.name || '主播'} 的头像`"
        />
        <AvatarFallback>{{ (userInfo?.name || '主')[0] }}</AvatarFallback>
      </Avatar>
      <div class="header-copy">
        <span class="header-kicker">{{ headerKicker }}</span>
        <h1>给 {{ userInfo?.name || '主播' }} 留句话</h1>
        <p>{{ isPaused ? '暂不接受新提问，你可以继续浏览已公开的问答。' : '说说你正在想的事。' }}</p>
      </div>
      <Button
        v-if="!isUserLoggedIn"
        variant="secondary"
        class="history-action gap-1.5"
        @click="emit('openHistory')"
      >
        <History class="size-3.5" />
        本地记录
      </Button>
      <Button
        v-else
        variant="secondary"
        class="history-action gap-1.5"
        :disabled="isSelf"
        @click="router.push({ name: 'manage-questionBox', query: { send: '1' } })"
      >
        <History class="size-3.5" />
        已发送
      </Button>
    </header>

    <!-- 主播自定义提问箱公告 -->
    <div
      v-if="notice"
      class="mt-4 flex items-start gap-2.5 p-3 rounded-[var(--radius)] border border-primary/25 bg-primary/8 text-xs text-foreground leading-relaxed"
    >
      <Megaphone class="size-4 text-primary shrink-0 mt-0.5" />
      <div class="min-w-0 whitespace-pre-wrap break-words">{{ notice }}</div>
    </div>

    <Transition
      name="composer-state"
      mode="out-in"
    >
      <div
        v-if="isPaused && !isSelf"
        key="paused"
        class="sent-state"
      >
        <span class="sent-icon"><PauseCircle class="size-8 text-muted-foreground inline-block" /></span>
        <span class="sent-kicker">TEMPORARILY PAUSED</span>
        <h2>提问箱已暂停收件</h2>
        <p class="whitespace-pre-wrap break-words">{{ pauseMessage }}</p>
      </div>

      <div
        v-else-if="isSent"
        key="sent"
        class="sent-state"
      >
        <span class="sent-icon"><CheckCircle2 class="size-8 text-emerald-500 inline-block" /></span>
        <span class="sent-kicker">MESSAGE DELIVERED</span>
        <h2>已经送达</h2>
        <p>这条留言已进入 {{ userInfo?.name || '主播' }} 的提问箱。</p>
        <div class="flex items-center gap-2 flex-wrap justify-center">
          <Button
            variant="secondary"
            class="gap-1.5"
            @click="composeAgain"
          >
            再写一条
            <ArrowRight class="size-3.5" />
          </Button>
          <Button
            v-if="!isUserLoggedIn"
            variant="outline"
            class="gap-1.5"
            @click="emit('openHistory')"
          >
            <History class="size-3.5" />
            查看本地记录
          </Button>
        </div>
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
              <Button
                variant="ghost"
                size="xs"
                class="topic-banner-clear h-auto p-0 text-muted-foreground font-normal"
                @click="draft = { ...draft, tag: null }"
              >
                取消
              </Button>
            </div>
          </Transition>
          <div class="topic-list">
            <Button
              v-for="tag in tags"
              :key="tag"
              variant="outline"
              size="xs"
              class="topic-chip rounded-full font-normal"
              :class="{ 'is-active': draft.tag === tag }"
              :aria-pressed="draft.tag === tag"
              @click="draft = { ...draft, tag: draft.tag === tag ? null : tag }"
            >
              {{ tag }}
            </Button>
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
          <Textarea
            v-model="draft.message"
            class="message-input min-h-[140px] resize-y border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 rounded-none"
            :disabled="isSelf"
            :maxlength="maxMessageLength"
            placeholder="写下你想说的话..."
            @paste="handlePaste"
          />
          <div class="editor-footer">
            <span class="identity-state">
              <Lock class="size-3.5 inline-block mr-1" />
              {{ identityName }}
            </span>
            <span
              class="tabular-nums"
              :class="{ 'is-invalid': (characterCount > 0 && !hasValidMessageLength) || isMessageTooLong }"
            >
              {{ isMessageTooLong ? '已超出字数限制 · ' : characterCount > 0 && !hasValidMessageLength ? '至少 3 个字 · ' : '' }}{{ characterCount }} / {{ maxMessageLength }}
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
              <ImagePlus class="size-3.5 inline-block mr-1" />
              <span>添加图片</span>
            </label>
            <span class="tabular-nums">{{ selectedFiles.length }} / {{ maxImages }}</span>
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
              <ImagePreview
                :src="url"
                :alt="`待发送图片 ${index + 1}`"
                :gallery="imagePreviewUrls"
                :index="index"
                wrapper-class="block size-full"
              >
                <template #default="{ open }">
                  <div
                    role="button"
                    tabindex="0"
                    class="size-full cursor-zoom-in focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    :aria-label="`放大查看第 ${index + 1} 张图片`"
                    @click="open()"
                    @keydown.enter.prevent="open()"
                    @keydown.space.prevent="open()"
                  >
                    <img
                      :src="url"
                      :alt="`待发送图片 ${index + 1}`"
                    />
                  </div>
                </template>
              </ImagePreview>
              <Button
                variant="ghost"
                size="icon-xs"
                class="z-10 absolute top-1 right-1 rounded-full bg-black/60 text-white hover:bg-black/80"
                :aria-label="`移除第 ${index + 1} 张图片`"
                @click.stop="removeImage(index)"
              >
                <X class="size-3.5" />
              </Button>
            </figure>
          </TransitionGroup>
        </div>

        <div
          v-if="!isSelf"
          class="identity-panel"
        >
          <div class="identity-copy">
            <Lock class="size-4 inline-block mr-1 text-muted-foreground" />
            <div>
              <strong>{{ isIdentified ? '提交身份' : '匿名留言' }}</strong>
              <span>{{ isIdentified ? identityName : '邮箱仅用于接收回复通知，不会对外公开' }}</span>
            </div>
          </div>
          <div
            v-if="isIdentified && allowAnonymous"
            class="flex items-center space-x-2"
          >
            <Checkbox
              id="hide-identity"
              v-model="draft.isAnonymous"
            />
            <label
              for="hide-identity"
              class="text-sm cursor-pointer select-none"
            >
              隐藏我的身份
            </label>
          </div>
          <div
            v-else-if="isIdentified && !allowAnonymous"
            class="text-xs text-muted-foreground"
          >
            <span>对方已开启实名提问，将以当前身份提交</span>
          </div>
          <div
            v-else-if="!allowUnregistedUser"
            class="text-xs text-destructive"
          >
            <span>对方已禁止未登录用户提问，请先登录或完成 B 站认证</span>
          </div>
          <div
            v-else
            class="guest-fields"
          >
            <Input
              v-model="draft.anonymousName"
              maxlength="20"
              placeholder="昵称（可选）"
            />
            <div class="relative flex items-center">
              <Mail class="size-4 absolute left-3 text-muted-foreground pointer-events-none" />
              <Input
                v-model="draft.anonymousEmail"
                maxlength="100"
                class="pl-9"
                placeholder="邮箱（可选）"
                :class="draft.anonymousEmail && !isValidEmail(draft.anonymousEmail) ? 'border-destructive' : ''"
              />
            </div>
          </div>
        </div>

        <div
          v-if="!isSelf && allowDefaultPublic"
          class="public-consent"
        >
          <div class="flex items-center space-x-2">
            <Checkbox
              id="allow-public"
              v-model="draft.allowPublic"
            />
            <label
              for="allow-public"
              class="text-sm font-medium cursor-pointer select-none"
            >
              公开展示这条
            </label>
          </div>
          <span class="text-xs text-muted-foreground ml-6">取消后只有主播能看到，不会出现在提问页公开列表</span>
        </div>

        <div
          v-if="isSelf"
          class="self-state"
        >
          <Lock class="size-4 inline-block mr-1" />
          <span>当前是你自己的提问箱</span>
        </div>
        <footer
          v-else
          class="submit-row"
        >
          <div class="verification-box">
            <CaptchaWidget
              ref="turnstile"
              v-model="token"
            />
          </div>
          <div class="submit-action">
            <Tag
              v-if="cooldownSeconds > 0"
              variant="secondary"
            >
              {{ cooldownSeconds }} 秒后可再次提交
            </Tag>
            <Tag
              v-else-if="token && submitDisabledReason"
              variant="secondary"
            >
              {{ submitDisabledReason }}
            </Tag>
            <Button
              size="lg"
              class="gap-1.5"
              :disabled="!canSubmit"
              :loading="isSending"
              @click="submit"
            >
              {{ selectedFiles.length && isSending ? '正在上传' : '送出留言' }}
              <Send class="size-4" />
            </Button>
          </div>
        </footer>
      </div>
    </Transition>
  </section>
</template>

<style scoped src="./QuestionComposer.css"></style>
