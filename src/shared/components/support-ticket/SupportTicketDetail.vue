<script setup lang="ts">
import type { SupportTicketDetail } from '@/api/api-models'
import { SupportTicketAuthorType, SupportTicketStatus } from '@/api/api-models'
import { ArrowLeft24Regular, CheckmarkCircle24Regular, Send24Regular, Settings24Regular } from '@vicons/fluent'
import {
  NButton,
  NCheckbox,
  NEmpty,
  NIcon,
  NImage,
  NImageGroup,
  NInput,
  NModal,
  NPopconfirm,
  NSpin,
  NTag,
  NTime,
  useMessage,
} from 'naive-ui'
import { computed, nextTick, ref, watch } from 'vue'
import {
  addSupportTicketMessage,
  resolveSupportTicket,
  updateSupportTicketPreferences,
} from '@/shared/services/supportTickets'

const props = defineProps<{
  ticket?: SupportTicketDetail
  loading: boolean
  editable: boolean
}>()

const emit = defineEmits<{
  back: []
  refresh: []
}>()

const message = useMessage()
const reply = ref('')
const sending = ref(false)
const resolving = ref(false)
const savingPreferences = ref(false)
const showPreferences = ref(false)
const isPublic = ref(false)
const emailOnStaffReply = ref(false)
const timeline = ref<HTMLElement>()

const statusLabels = ['待处理', '处理中', '等待你回复', '已解决']
const statusTypes = ['default', 'info', 'warning', 'success'] as const
const typeLabels = ['问题', '功能建议', '账号', '其他']

const messages = computed(() => props.ticket?.messages ?? [])

watch(() => props.ticket, async (ticket) => {
  if (!ticket) return
  isPublic.value = ticket.isPublic
  emailOnStaffReply.value = ticket.emailOnStaffReply
  await nextTick()
  timeline.value?.scrollTo({ top: timeline.value.scrollHeight })
}, { immediate: true })

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
    message.error((error as Error).message)
  } finally {
    sending.value = false
  }
}

async function resolve() {
  if (!props.ticket) return
  resolving.value = true
  try {
    await resolveSupportTicket(props.ticket.id)
    message.success('工单已标记为已解决')
    emit('refresh')
  } catch (error) {
    message.error((error as Error).message)
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
    message.success('工单设置已保存')
    emit('refresh')
  } catch (error) {
    message.error((error as Error).message)
  } finally {
    savingPreferences.value = false
  }
}
</script>

<template>
  <section class="ticket-detail">
    <div v-if="loading" class="ticket-detail__state">
      <NSpin size="medium" />
    </div>
    <NEmpty v-else-if="!ticket" class="ticket-detail__state" description="选择一个工单查看详情" />
    <template v-else>
      <header class="ticket-detail__header">
        <NButton class="ticket-detail__back" quaternary circle title="返回工单列表" @click="emit('back')">
          <template #icon>
            <NIcon :component="ArrowLeft24Regular" />
          </template>
        </NButton>
        <div class="ticket-detail__heading">
          <div class="ticket-detail__title-row">
            <h2>{{ ticket.title }}</h2>
            <NTag :type="statusTypes[ticket.status]" :bordered="false" size="small">
              {{ statusLabels[ticket.status] }}
            </NTag>
          </div>
          <div class="ticket-detail__meta">
            <span>#{{ ticket.id }}</span>
            <span>{{ typeLabels[ticket.type] }}</span>
            <span v-if="ticket.isPublic">公开</span>
            <span>创建于 <NTime :time="ticket.createTime" /></span>
          </div>
        </div>
        <NButton v-if="editable" quaternary circle title="工单设置" @click="showPreferences = true">
          <template #icon>
            <NIcon :component="Settings24Regular" />
          </template>
        </NButton>
      </header>

      <div ref="timeline" class="ticket-detail__timeline">
        <NImageGroup v-if="ticket.images.length">
          <div class="ticket-images">
            <NImage
              v-for="image in ticket.images"
              :key="image.id"
              class="ticket-image"
              object-fit="cover"
              :src="image.path"
              :alt="image.name"
            />
          </div>
        </NImageGroup>

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
            <NTime :time="item.createTime" type="relative" />
          </template>
          <template v-else>
            <div class="ticket-message__meta">
              <strong>{{ authorLabel(item.authorType) }}</strong>
              <NTime :time="item.createTime" type="relative" />
            </div>
            <p>{{ item.content }}</p>
          </template>
        </div>
      </div>

      <footer v-if="editable" class="ticket-detail__composer">
        <NInput
          v-model:value="reply"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 5 }"
          maxlength="5000"
          show-count
          placeholder="继续补充信息或回复站长"
          @keydown.ctrl.enter.prevent="sendReply"
        />
        <div class="ticket-detail__actions">
          <NPopconfirm
            v-if="ticket.status !== SupportTicketStatus.Resolved"
            positive-text="确认解决"
            negative-text="取消"
            @positive-click="resolve"
          >
            <template #trigger>
              <NButton secondary :loading="resolving">
                <template #icon>
                  <NIcon :component="CheckmarkCircle24Regular" />
                </template>
                问题已解决
              </NButton>
            </template>
            标记后仍可通过回复重新打开工单。
          </NPopconfirm>
          <NButton type="primary" :disabled="!reply.trim()" :loading="sending" @click="sendReply">
            <template #icon>
              <NIcon :component="Send24Regular" />
            </template>
            回复
          </NButton>
        </div>
      </footer>
    </template>

    <NModal
      v-model:show="showPreferences"
      preset="card"
      title="工单设置"
      class="ticket-preferences-modal"
    >
      <div class="ticket-preferences">
        <NCheckbox v-model:checked="isPublic">
          公开此工单
        </NCheckbox>
        <span>其他人可以查看工单内容和处理进度，不会公开你的身份信息。</span>
        <NCheckbox v-model:checked="emailOnStaffReply">
          站长回复时发送邮件
        </NCheckbox>
        <span>站内通知不受此选项影响。</span>
      </div>
      <template #footer>
        <div class="ticket-preferences__footer">
          <NButton @click="showPreferences = false">
            取消
          </NButton>
          <NButton type="primary" :loading="savingPreferences" @click="savePreferences">
            保存
          </NButton>
        </div>
      </template>
    </NModal>
  </section>
</template>

<style scoped>
.ticket-detail { display: flex; flex-direction: column; min-width: 0; height: min(720px, calc(100vh - 150px)); }
.ticket-detail__state { display: grid; flex: 1; place-content: center; }
.ticket-detail__header { display: flex; align-items: flex-start; gap: 10px; padding: 16px 18px; border-bottom: 1px solid var(--vtsuru-border); }
.ticket-detail__heading { flex: 1; min-width: 0; }
.ticket-detail__title-row { display: flex; align-items: center; gap: 10px; }
.ticket-detail__title-row h2 { overflow-wrap: anywhere; margin: 0; color: var(--vtsuru-fg); font-size: 18px; line-height: 1.4; letter-spacing: 0; }
.ticket-detail__meta { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 4px; color: var(--vtsuru-fg-muted); font-size: 12px; }
.ticket-detail__back { display: none; }
.ticket-detail__timeline { flex: 1; overflow-y: auto; padding: 18px; }
.ticket-images { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-bottom: 20px; }
.ticket-image { width: 100%; aspect-ratio: 1; overflow: hidden; border-radius: 6px; }
.ticket-message { width: fit-content; max-width: min(78%, 660px); margin-bottom: 16px; }
.ticket-message__meta { display: flex; gap: 10px; align-items: center; margin-bottom: 5px; color: var(--vtsuru-fg-muted); font-size: 12px; }
.ticket-message p { margin: 0; padding: 10px 13px; border: 1px solid var(--vtsuru-border); border-radius: 6px; color: var(--vtsuru-fg); background: var(--vtsuru-bg-muted); line-height: 1.65; overflow-wrap: anywhere; white-space: pre-wrap; }
.ticket-message--staff { margin-left: auto; }
.ticket-message--staff .ticket-message__meta { justify-content: flex-end; }
.ticket-message--staff p { border-color: var(--vtsuru-brand-soft); background: var(--vtsuru-brand-tint); }
.ticket-message--system { display: flex; align-items: center; justify-content: center; gap: 10px; width: 100%; max-width: none; color: var(--vtsuru-fg-muted); font-size: 12px; }
.ticket-detail__composer { padding: 12px 16px 14px; border-top: 1px solid var(--vtsuru-border); background: var(--vtsuru-bg); }
.ticket-detail__actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
.ticket-preferences { display: grid; gap: 7px; }
.ticket-preferences > span { margin: -3px 0 9px 24px; color: var(--vtsuru-fg-muted); font-size: 12px; }
.ticket-preferences__footer { display: flex; justify-content: flex-end; gap: 8px; }
:global(.ticket-preferences-modal) { width: min(440px, calc(100vw - 32px)); }

@media (max-width: 760px) {
  .ticket-detail { height: calc(100dvh - 100px); }
  .ticket-detail__header { padding: 12px; }
  .ticket-detail__back { display: inline-flex; }
  .ticket-detail__title-row h2 { font-size: 16px; }
  .ticket-detail__timeline { padding: 14px 12px; }
  .ticket-images { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .ticket-message { max-width: 90%; }
  .ticket-detail__composer { padding: 10px 12px; }
}
</style>
