<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import type { SupportTicketDetail } from '@/api/api-models'
import { SupportTicketAuthorType, SupportTicketStatus } from '@/api/api-models'
import {
  addSupportTicketMessage,
  resolveSupportTicket,
  updateSupportTicketPreferences,
} from '@/shared/services/supportTickets'

import { formatTicketTime, ticketStatusColors, ticketStatusLabels } from './ticketPresentation'

const props = defineProps<{
  ticket?: SupportTicketDetail
  loading: boolean
  editable: boolean
}>()

const emit = defineEmits<{
  back: []
  refresh: []
}>()

const toast = useToast()
const reply = ref('')
const sending = ref(false)
const resolving = ref(false)
const savingPreferences = ref(false)
const showPreferences = ref(false)
const isPublic = ref(false)
const emailOnStaffReply = ref(false)
const timeline = ref<HTMLElement>()
const isResolveConfirmOpen = ref(false)
const imagePreview = ref<{ path: string; name: string }>()

const typeLabels = ['问题', '功能建议', '账号', '其他']
const messages = computed(() => props.ticket?.messages ?? [])

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

async function sendReply() {
  const content = reply.value.trim()
  if (!props.ticket || !content) return
  sending.value = true
  try {
    await addSupportTicketMessage(props.ticket.id, content)
    reply.value = ''
    emit('refresh')
  } catch (error) {
    toast.add({ title: (error as Error).message, color: 'error' })
  } finally {
    sending.value = false
  }
}

async function resolve() {
  if (!props.ticket) return
  resolving.value = true
  try {
    await resolveSupportTicket(props.ticket.id)
    toast.add({ title: '工单已标记为已解决', color: 'success' })
    isResolveConfirmOpen.value = false
    emit('refresh')
  } catch (error) {
    toast.add({ title: (error as Error).message, color: 'error' })
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
    toast.add({ title: '工单设置已保存', color: 'success' })
    emit('refresh')
  } catch (error) {
    toast.add({ title: (error as Error).message, color: 'error' })
  } finally {
    savingPreferences.value = false
  }
}
</script>

<template>
  <section class="ticket-detail">
    <div
      v-if="loading"
      class="ticket-detail__state"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="ticket-detail__spinner"
      />
    </div>
    <div
      v-else-if="!ticket"
      class="ticket-detail__state"
    >
      <UIcon name="i-lucide-message-square-text" />
      <span>选择一个工单查看详情</span>
    </div>
    <template v-else>
      <header class="ticket-detail__header">
        <UButton
          class="ticket-detail__back"
          color="neutral"
          variant="ghost"
          icon="i-lucide-arrow-left"
          aria-label="返回工单列表"
          @click="emit('back')"
        />
        <div class="ticket-detail__heading">
          <div class="ticket-detail__title-row">
            <h2>{{ ticket.title }}</h2>
            <UBadge
              size="sm"
              :color="ticketStatusColors[ticket.status]"
              :label="ticketStatusLabels[ticket.status]"
            />
          </div>
          <div class="ticket-detail__meta">
            <span>#{{ ticket.id }}</span>
            <span>{{ typeLabels[ticket.type] }}</span>
            <span v-if="ticket.isPublic">公开</span>
            <span>创建于 {{ new Date(ticket.createTime).toLocaleString() }}</span>
          </div>
        </div>
        <UButton
          v-if="editable"
          color="neutral"
          variant="ghost"
          icon="i-lucide-settings-2"
          aria-label="工单设置"
          @click="showPreferences = true"
        />
      </header>

      <div
        ref="timeline"
        class="ticket-detail__timeline"
      >
        <div
          v-if="ticket.images.length"
          class="ticket-images"
        >
          <button
            v-for="image in ticket.images"
            :key="image.id"
            type="button"
            class="ticket-image"
            @click="imagePreview = image"
          >
            <img
              :src="image.path"
              :alt="image.name"
            />
          </button>
        </div>

        <div
          v-for="item in messages"
          :key="item.id"
          class="ticket-message"
          :class="{
            'ticket-message--staff': item.authorType === SupportTicketAuthorType.Staff,
            'ticket-message--system': item.authorType === SupportTicketAuthorType.System,
          }"
        >
          <template v-if="item.authorType === SupportTicketAuthorType.System">
            <span>{{ item.content }}</span>
            <span>{{ formatTicketTime(item.createTime) }}</span>
          </template>
          <template v-else>
            <div class="ticket-message__meta">
              <strong>{{ authorLabel(item.authorType) }}</strong>
              <span>{{ formatTicketTime(item.createTime) }}</span>
            </div>
            <p>{{ item.content }}</p>
          </template>
        </div>
      </div>

      <footer
        v-if="editable"
        class="ticket-detail__composer"
      >
        <UTextarea
          v-model="reply"
          :rows="3"
          :maxrows="5"
          maxlength="5000"
          placeholder="继续补充信息或回复站长"
          @keydown.ctrl.enter.prevent="sendReply"
        />
        <div class="ticket-detail__actions">
          <UModal
            v-if="ticket.status !== SupportTicketStatus.Resolved"
            v-model:open="isResolveConfirmOpen"
            title="标记问题已解决"
          >
            <UButton
              color="neutral"
              variant="soft"
              icon="i-lucide-circle-check"
              :loading="resolving"
              >问题已解决</UButton
            >
            <template #body>
              <p>标记后仍可通过回复重新打开工单。</p>
            </template>
            <template #footer>
              <div class="ticket-preferences__footer">
                <UButton
                  color="neutral"
                  variant="ghost"
                  @click="isResolveConfirmOpen = false"
                  >取消</UButton
                >
                <UButton
                  color="success"
                  :loading="resolving"
                  @click="resolve"
                  >确认解决</UButton
                >
              </div>
            </template>
          </UModal>
          <UButton
            color="primary"
            icon="i-lucide-send"
            :disabled="!reply.trim()"
            :loading="sending"
            @click="sendReply"
            >回复</UButton
          >
        </div>
      </footer>
    </template>

    <UModal
      v-model:open="showPreferences"
      title="工单设置"
    >
      <template #body>
        <div class="ticket-preferences">
          <UCheckbox v-model="isPublic">公开此工单</UCheckbox>
          <span>其他人可以查看工单内容和处理进度，不会公开你的身份信息。</span>
          <UCheckbox v-model="emailOnStaffReply">站长回复时发送邮件</UCheckbox>
          <span>站内通知不受此选项影响。</span>
        </div>
      </template>
      <template #footer>
        <div class="ticket-preferences__footer">
          <UButton
            color="neutral"
            variant="ghost"
            @click="showPreferences = false"
            >取消</UButton
          >
          <UButton
            color="primary"
            :loading="savingPreferences"
            @click="savePreferences"
            >保存</UButton
          >
        </div>
      </template>
    </UModal>

    <UModal
      v-if="imagePreview"
      :open="Boolean(imagePreview)"
      :title="imagePreview.name"
      @update:open="!$event && (imagePreview = undefined)"
    >
      <template #body>
        <img
          class="ticket-image-preview"
          :src="imagePreview.path"
          :alt="imagePreview.name"
        />
      </template>
    </UModal>
  </section>
</template>

<style scoped>
.ticket-detail {
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: min(720px, calc(100vh - 150px));
}
.ticket-detail__state {
  display: grid;
  flex: 1;
  place-content: center;
  gap: 10px;
  color: var(--vtsuru-fg-muted);
  text-align: center;
}
.ticket-detail__spinner {
  font-size: 24px;
  animation: spin 0.8s linear infinite;
}
.ticket-detail__header {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--vtsuru-border);
}
.ticket-detail__heading {
  flex: 1;
  min-width: 0;
}
.ticket-detail__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.ticket-detail__title-row h2 {
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--vtsuru-fg);
  font-size: 18px;
  line-height: 1.4;
  letter-spacing: 0;
}
.ticket-detail__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-top: 4px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
.ticket-detail__back {
  display: none;
}
.ticket-detail__timeline {
  flex: 1;
  overflow-y: auto;
  padding: 18px;
}
.ticket-images {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 20px;
}
.ticket-image {
  aspect-ratio: 1;
  overflow: hidden;
  padding: 0;
  border: 0;
  border-radius: 6px;
  cursor: zoom-in;
}
.ticket-image img,
.ticket-image-preview {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.ticket-image-preview {
  max-height: 75vh;
  object-fit: contain;
}
.ticket-message {
  width: fit-content;
  max-width: min(78%, 660px);
  margin-bottom: 16px;
}
.ticket-message__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 5px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
.ticket-message p {
  margin: 0;
  padding: 10px 13px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  color: var(--vtsuru-fg);
  background: var(--vtsuru-bg-muted);
  line-height: 1.65;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
.ticket-message--staff {
  margin-left: auto;
}
.ticket-message--staff .ticket-message__meta {
  justify-content: flex-end;
}
.ticket-message--staff p {
  border-color: var(--vtsuru-brand-soft);
  background: var(--vtsuru-brand-tint);
}
.ticket-message--system {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  max-width: none;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
.ticket-detail__composer {
  padding: 12px 16px 14px;
  border-top: 1px solid var(--vtsuru-border);
  background: var(--vtsuru-bg);
}
.ticket-detail__actions,
.ticket-preferences__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
.ticket-preferences {
  display: grid;
  gap: 7px;
}
.ticket-preferences > span {
  margin: -3px 0 9px 24px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 760px) {
  .ticket-detail {
    height: calc(100dvh - 100px);
  }
  .ticket-detail__header {
    padding: 12px;
  }
  .ticket-detail__back {
    display: inline-flex;
  }
  .ticket-detail__title-row h2 {
    font-size: 16px;
  }
  .ticket-detail__timeline {
    padding: 14px 12px;
  }
  .ticket-images {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .ticket-message {
    max-width: 90%;
  }
  .ticket-detail__composer {
    padding: 10px 12px;
  }
}
</style>
