<script setup lang="ts">
import {
  ArrowLeft24Regular,
  CheckmarkCircle24Regular,
  Dismiss16Regular,
  Image24Regular,
  Send24Regular,
  Settings24Regular,
} from '@vicons/fluent'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed, nextTick, ref, watch } from 'vue'

import type { SupportTicketDetail } from '@/api/api-models'
import { SupportTicketAuthorType, SupportTicketStatus } from '@/api/api-models'
import { FileStore, uploadFiles } from '@/shared/services/fileUpload'
import {
  addSupportTicketMessage,
  resolveSupportTicket,
  updateSupportTicketPreferences,
} from '@/shared/services/supportTickets'
import {
  imagesForMessage,
  isOwnTicketMessage,
  remainingReplyImageSlots,
  supportTicketStatusMeta,
  supportTicketTypeLabel,
} from '@/shared/supportTicket'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Spin } from '@/shared/ui/spin'
import { Textarea } from '@/shared/ui/textarea'
import { toast } from '@/shared/utils'

interface LocalFileItem {
  id: string
  file: File
  url: string
}

const props = defineProps<{
  ticket?: SupportTicketDetail
  loading: boolean
  editable: boolean
}>()

const emit = defineEmits<{
  back: []
  refresh: []
}>()

const reply = ref('')
const replyFiles = ref<LocalFileItem[]>([])
const fileInputRef = ref<HTMLInputElement>()
const sending = ref(false)
const resolving = ref(false)
const savingPreferences = ref(false)
const showPreferences = ref(false)
const isPublic = ref(false)
const emailOnStaffReply = ref(false)
const timeline = ref<HTMLElement>()

const messages = computed(() => props.ticket?.messages ?? [])
const remainingImageSlots = computed(() => remainingReplyImageSlots(replyFiles.value.length))
const canSend = computed(() => Boolean(reply.value.trim() || replyFiles.value.length))

watch(
  () => props.ticket,
  async (ticket) => {
    if (!ticket) return
    isPublic.value = ticket.isPublic
    emailOnStaffReply.value = ticket.emailOnStaffReply
    await nextTick()
    timeline.value?.scrollTo({ top: timeline.value.scrollHeight })
  },
  { immediate: true },
)

function authorLabel(authorType: SupportTicketAuthorType) {
  if (authorType === SupportTicketAuthorType.Staff) return '站长'
  if (authorType === SupportTicketAuthorType.System) return '状态更新'
  return props.editable ? '我' : '用户'
}

function onFileSelect(e: Event) {
  const target = e.target as HTMLInputElement
  if (!target.files?.length) return
  const remaining = remainingImageSlots.value
  const files = Array.from(target.files).slice(0, remaining)
  for (const f of files) {
    if (!f.type.startsWith('image/')) {
      toast.error('只能上传图片文件')
      continue
    }
    replyFiles.value.push({
      id: `${f.name}-${Date.now()}-${Math.random()}`,
      file: f,
      url: URL.createObjectURL(f),
    })
  }
  target.value = ''
}

function removeFile(index: number) {
  const item = replyFiles.value[index]
  if (item) URL.revokeObjectURL(item.url)
  replyFiles.value.splice(index, 1)
}

async function sendReply() {
  const content = reply.value.trim()
  if (!props.ticket || (!content && !replyFiles.value.length)) return
  sending.value = true
  try {
    const files = replyFiles.value.map((item) => item.file)
    const uploaded = files.length ? await uploadFiles(files, FileStore.Tickets) : []
    await addSupportTicketMessage(
      props.ticket.id,
      content,
      uploaded.map((file) => file.id),
    )
    reply.value = ''
    replyFiles.value.forEach((f) => URL.revokeObjectURL(f.url))
    replyFiles.value = []
    emit('refresh')
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    sending.value = false
  }
}

async function resolve() {
  if (!props.ticket) return
  resolving.value = true
  try {
    await resolveSupportTicket(props.ticket.id)
    toast.success('工单已标记为已解决')
    emit('refresh')
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    resolving.value = false
  }
}

async function savePreferences() {
  if (!props.ticket) return
  savingPreferences.value = true
  try {
    await updateSupportTicketPreferences(props.ticket.id, {
      isPublic: isPublic.value,
      emailOnStaffReply: emailOnStaffReply.value,
    })
    showPreferences.value = false
    toast.success('工单设置已保存')
    emit('refresh')
  } catch (error) {
    toast.error((error as Error).message)
  } finally {
    savingPreferences.value = false
  }
}

function formatRelative(time: number) {
  return formatDistanceToNow(time, { addSuffix: true, locale: zhCN })
}
</script>

<template>
  <section
    class="ticket-detail flex flex-col min-w-0 min-h-0 h-full border border-border/80 rounded-lg bg-card p-4 gap-3"
    :class="{ 'ticket-detail--editable': editable }"
  >
    <div
      v-if="loading"
      class="ticket-detail__state py-16 flex justify-center"
    >
      <Spin />
    </div>
    <Empty
      v-else-if="!ticket"
      class="ticket-detail__state py-16"
      description="选择一个工单查看详情"
    />
    <template v-else>
      <header class="ticket-detail__header flex items-start justify-between gap-3 pb-3 border-b border-border/60">
        <div class="flex items-start gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            class="size-8 -ml-1 text-muted-foreground hover:text-foreground shrink-0 md:hidden"
            title="返回工单列表"
            @click="emit('back')"
          >
            <component :is="ArrowLeft24Regular" class="size-4" />
          </Button>

          <div class="ticket-detail__heading min-w-0 space-y-1">
            <div class="ticket-detail__title-row flex items-center gap-2 flex-wrap">
              <h2 class="text-sm font-semibold text-foreground truncate m-0">{{ ticket.title }}</h2>
              <Badge variant="secondary" class="text-[10px] h-4.5 px-1.5 font-normal">
                {{ supportTicketStatusMeta[ticket.status].label }}
              </Badge>
            </div>
            <div class="ticket-detail__meta flex items-center gap-2 text-muted-foreground text-[11px] flex-wrap">
              <span>#{{ ticket.id }}</span>
              <span>· {{ supportTicketTypeLabel(ticket.type) }}</span>
              <span v-if="ticket.isPublic">· 公开</span>
              <span>· 创建于 {{ formatRelative(ticket.createTime) }}</span>
            </div>
          </div>
        </div>

        <Button
          v-if="editable"
          variant="ghost"
          size="icon"
          class="size-8 text-muted-foreground hover:text-foreground shrink-0"
          title="工单设置"
          @click="showPreferences = true"
        >
          <component :is="Settings24Regular" class="size-4" />
        </Button>
      </header>

      <div
        ref="timeline"
        class="ticket-detail__timeline flex-1 min-h-0 overflow-y-auto space-y-3 pr-2 text-xs"
      >
        <div
          v-for="(item, index) in messages"
          :key="item.id"
          class="ticket-message flex flex-col gap-1"
          :class="{
            'items-end': isOwnTicketMessage(editable, item.authorType),
            'items-start': !isOwnTicketMessage(editable, item.authorType) && item.authorType !== SupportTicketAuthorType.System,
            'items-center py-2 text-muted-foreground text-[11px]': item.authorType === SupportTicketAuthorType.System,
          }"
        >
          <template v-if="item.authorType === SupportTicketAuthorType.System">
            <div class="flex items-center gap-2">
              <span>{{ item.content }}</span>
              <span>{{ formatRelative(item.createTime) }}</span>
            </div>
          </template>
          <template v-else>
            <div class="ticket-message__meta flex items-center gap-1.5 text-muted-foreground text-[11px]">
              <strong class="font-medium text-foreground">{{ authorLabel(item.authorType) }}</strong>
              <span>{{ formatRelative(item.createTime) }}</span>
            </div>
            <div
              class="ticket-message__bubble p-3 rounded-lg border max-w-[85%] space-y-2 leading-relaxed whitespace-pre-wrap break-words"
              :class="
                isOwnTicketMessage(editable, item.authorType)
                  ? 'bg-primary/10 border-primary/20 text-foreground'
                  : 'bg-muted/40 border-border text-foreground'
              "
            >
              <div
                v-if="imagesForMessage(ticket, item, index).length"
                class="ticket-message__images flex flex-wrap gap-1.5"
              >
                <img
                  v-for="image in imagesForMessage(ticket, item, index)"
                  :key="image.id"
                  class="ticket-message__image size-16 rounded object-cover border border-border/60"
                  :src="image.path"
                  :alt="image.name"
                />
              </div>
              <p v-if="item.content" class="m-0 text-xs">{{ item.content }}</p>
            </div>
          </template>
        </div>
      </div>

      <footer
        v-if="editable"
        class="ticket-detail__composer pt-3 border-t border-border/60 space-y-2 text-xs"
      >
        <!-- 图片预览与选择 -->
        <div class="flex items-center gap-2 flex-wrap">
          <div
            v-for="(item, i) in replyFiles"
            :key="item.id"
            class="relative size-12 rounded border border-border overflow-hidden group"
          >
            <img :src="item.url" class="size-full object-cover" alt="" />
            <button
              type="button"
              class="absolute top-0.5 right-0.5 size-3.5 rounded-full bg-black/60 text-white flex items-center justify-center"
              @click="removeFile(i)"
            >
              <component :is="Dismiss16Regular" class="size-2" />
            </button>
          </div>

          <button
            v-if="remainingImageSlots > 0"
            type="button"
            class="size-12 rounded border border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition"
            title="添加图片"
            @click="fileInputRef?.click()"
          >
            <component :is="Image24Regular" class="size-4" />
          </button>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/*"
            multiple
            class="hidden"
            @change="onFileSelect"
          />
        </div>

        <Textarea
          v-model="reply"
          rows="2"
          maxlength="5000"
          placeholder="继续补充信息或回复站长 (Ctrl+Enter 发送)"
          class="text-xs resize-none"
          @keydown.ctrl.enter.prevent="sendReply"
        />

        <div class="ticket-detail__actions flex items-center justify-between gap-2">
          <Popconfirm
            v-if="ticket.status !== SupportTicketStatus.Resolved"
            title="确认解决?"
            positive-text="确认解决"
            negative-text="取消"
            @positive-click="resolve"
          >
            <template #trigger>
              <Button
                variant="outline"
                size="sm"
                class="h-7 text-xs flex items-center gap-1 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                :disabled="resolving"
              >
                <component :is="CheckmarkCircle24Regular" class="size-3.5" />
                问题已解决
              </Button>
            </template>
            标记后仍可通过回复重新打开工单。
          </Popconfirm>
          <div v-else />

          <Button
            size="sm"
            class="h-7 text-xs flex items-center gap-1"
            :disabled="!canSend || sending"
            @click="sendReply"
          >
            <component :is="Send24Regular" class="size-3.5" />
            回复
          </Button>
        </div>
      </footer>
    </template>

    <!-- 设置弹窗 -->
    <Dialog v-model:open="showPreferences">
      <DialogContent class="sm:max-w-md p-4 space-y-3">
        <DialogHeader class="pb-2 border-b border-border/60">
          <DialogTitle class="text-sm font-semibold">工单设置</DialogTitle>
        </DialogHeader>

        <div class="space-y-3 text-xs">
          <label class="flex items-start gap-2 cursor-pointer">
            <Checkbox v-model:checked="isPublic" class="mt-0.5" />
            <div class="flex flex-col gap-0.5">
              <span class="font-medium text-foreground">公开此工单</span>
              <span class="text-muted-foreground text-[11px]">
                其他人可以查看工单内容和处理进度，不会公开你的身份信息。
              </span>
            </div>
          </label>

          <label class="flex items-start gap-2 cursor-pointer">
            <Checkbox v-model:checked="emailOnStaffReply" class="mt-0.5" />
            <div class="flex flex-col gap-0.5">
              <span class="font-medium text-foreground">站长回复时发送邮件</span>
              <span class="text-muted-foreground text-[11px]">站内通知不受此选项影响。</span>
            </div>
          </label>
        </div>

        <DialogFooter class="pt-2 border-t border-border/60">
          <Button
            variant="outline"
            size="sm"
            class="text-xs"
            @click="showPreferences = false"
          >
            取消
          </Button>
          <Button
            size="sm"
            class="text-xs"
            :disabled="savingPreferences"
            @click="savePreferences"
          >
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>
