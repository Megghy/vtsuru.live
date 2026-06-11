<script setup lang="ts">
import type { CSSProperties } from 'vue'
import type { ResponseQueueModel } from '@/api/api-models'
import { Checkmark12Regular, ClipboardTextLtr24Filled, Dismiss16Filled, Info24Filled, PresenceBlocked16Regular } from '@vicons/fluent'
import { NButton, NCard, NFlex, NIcon, NPopconfirm, NTag, NText, NTime, NTooltip } from 'naive-ui';
import { computed } from 'vue'
import { QueueFrom, QueueStatus } from '@/api/api-models'
import { getQueuePaymentMeta, useQueue } from '@/composables/useQueue'
import UserBadges from '@/apps/open-live/components/UserBadges.vue'

const props = defineProps<{
  queueData: ResponseQueueModel
  index: number
}>()

const store = useQueue()

const isProcessing = computed(() => props.queueData.status === QueueStatus.Progressing)
const isManaging = computed(() => store.queueDataBeingManaged === props.queueData.id)
const hasOtherProcessing = computed(() =>
  store.queue.some(s => s.id !== props.queueData.id && s.status === QueueStatus.Progressing),
)
const paymentMeta = computed(() => getQueuePaymentMeta(props.queueData))
const canBlock = computed(() =>
  store.configCanEdit
  && (props.queueData.from === QueueFrom.Danmaku || props.queueData.from === QueueFrom.Gift)
  && !!props.queueData.user?.uid,
)

function manage(status: QueueStatus) {
  store.queueDataBeingManaged = props.queueData.id
  store.updateStatus(props.queueData, status)
}

const indexStyle = computed<CSSProperties>(() => {
  const base: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    color: '#fff',
    fontSize: '13px',
    transition: 'opacity 0.2s',
  }
  switch (props.queueData.status) {
    case QueueStatus.Progressing:
      return { ...base, backgroundColor: 'var(--n-success-color)' }
    case QueueStatus.Finish:
      return { ...base, backgroundColor: 'var(--n-color-embedded)', color: 'var(--n-text-color)', border: '1px solid var(--n-border-color)' }
    case QueueStatus.Cancel:
      return { ...base, backgroundColor: 'var(--n-error-color)' }
    default:
      return { ...base, backgroundColor: 'var(--n-info-color)' }
  }
})
</script>

<template>
  <NCard
    embedded
    size="small"
    content-style="padding: 8px 12px;"
    :bordered="isProcessing"
    :style="isProcessing ? 'border-left: 4px solid var(--n-success-color);' : 'border-left: 4px solid transparent;'"
  >
    <NFlex justify="space-between" align="center" :wrap="false">
      <!-- 左侧信息 -->
      <NFlex align="center" :size="8" :wrap="false">
        <span
          :style="indexStyle"
          class="queue-index"
          :class="{ 'queue-index-processing': isProcessing }"
        >
          {{ index }}
        </span>
        <NText strong style="font-size: 16px;">
          <NTooltip>
            <template #trigger>
              {{ queueData.user?.name }}
            </template>
            {{ queueData.user?.uid ? `UID: ${queueData.user?.uid}` : `OpenID: ${queueData.user?.oid}` }}
          </NTooltip>
        </NText>

        <UserBadges :user="queueData.user" :show-fan-medal="store.settings.showFanMadelInfo" size="tiny" />

        <!-- 付费信息 -->
        <NTooltip
          v-if="store.settings.showPayment && paymentMeta.hasMysteryBoxPayment"
          placement="top"
        >
          <template #trigger>
            <NTag size="small" :bordered="false" type="warning">
              {{ paymentMeta.shortText }}
            </NTag>
          </template>
          {{ paymentMeta.detailText }}
        </NTooltip>
        <NTag
          v-if="store.settings.showPayment && paymentMeta.giftPriceText"
          size="small"
          :bordered="false"
          type="error"
        >
          ￥ {{ paymentMeta.giftPriceText }}
        </NTag>

        <!-- 附加内容 -->
        <NTooltip v-if="queueData.content" placement="right">
          <template #trigger>
            <NIcon :component="Info24Filled" size="16" style="cursor: help; color: var(--n-text-color-3);" />
          </template>
          <NCard size="small" :bordered="false" style="max-width: 300px;">
            <template #header>
              <span style="font-size: small; color: gray;">
                {{ `来自${queueData?.from === QueueFrom.Gift ? '礼物' : '弹幕'}: ` }}
              </span>
            </template>
            {{ queueData?.content }}
          </NCard>
        </NTooltip>

        <!-- 时间 -->
        <NTooltip placement="bottom">
          <template #trigger>
            <NText depth="3" style="font-size: 12px;">
              <NTime :key="store.updateKey" :time="queueData.createAt" type="relative" />
            </NText>
          </template>
          <NTime :time="queueData.createAt" format="yyyy-MM-dd HH:mm:ss" />
        </NTooltip>
      </NFlex>

      <!-- 右侧操作 -->
      <NFlex justify="end" align="center" :size="6" :wrap="false" style="flex-shrink: 0;">
        <NTooltip>
          <template #trigger>
            <NButton
              circle
              size="small"
              :type="isProcessing ? 'warning' : 'primary'"
              :ghost="isProcessing"
              :disabled="hasOtherProcessing"
              :loading="store.isLoading && isManaging"
              @click="manage(isProcessing ? QueueStatus.Waiting : QueueStatus.Progressing)"
            >
              <template #icon>
                <NIcon :component="ClipboardTextLtr24Filled" />
              </template>
            </NButton>
          </template>
          {{ hasOtherProcessing ? '已有其他用户正在处理中' : (isProcessing ? '暂停处理 (返回等待)' : '开始处理') }}
        </NTooltip>

        <NTooltip>
          <template #trigger>
            <NButton
              circle
              size="small"
              type="success"
              :loading="store.isLoading && isManaging"
              @click="manage(QueueStatus.Finish)"
            >
              <template #icon>
                <NIcon :component="Checkmark12Regular" />
              </template>
            </NButton>
          </template>
          标记为已完成
        </NTooltip>

        <NTooltip v-if="canBlock">
          <template #trigger>
            <NPopconfirm @positive-click="store.blockUser(queueData)">
              <template #trigger>
                <NButton
                  circle
                  size="small"
                  type="warning"
                  :loading="store.isLoading && isManaging"
                  @click="store.queueDataBeingManaged = queueData.id"
                >
                  <template #icon>
                    <NIcon :component="PresenceBlocked16Regular" />
                  </template>
                </NButton>
              </template>
              确定要将 {{ queueData.user?.name }} 加入 黑名单并取消排队吗？
            </NPopconfirm>
          </template>
          拉黑用户 (B站)
        </NTooltip>

        <NTooltip>
          <template #trigger>
            <NButton
              circle
              size="small"
              type="error"
              :loading="store.isLoading && isManaging"
              @click="manage(QueueStatus.Cancel)"
            >
              <template #icon>
                <NIcon :component="Dismiss16Filled" />
              </template>
            </NButton>
          </template>
          取消排队
        </NTooltip>
      </NFlex>
    </NFlex>
  </NCard>
</template>

<style scoped>
.queue-index:hover {
  opacity: 0.85;
}

.queue-index-processing {
  position: relative;
}

.queue-index-processing::after {
  content: '';
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border-radius: 50%;
  border: 2px solid var(--n-success-color);
  opacity: 0.35;
}
</style>
