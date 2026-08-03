<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed } from 'vue'

import type { ResponseQueueModel } from '@/api/api-models'
import { QueueFrom, QueueStatus } from '@/api/api-models'
import UserBadges from '@/apps/open-live/components/UserBadges.vue'
import { getQueuePaymentMeta, useQueue } from '@/composables/useQueue'

const props = defineProps<{
  queueData: ResponseQueueModel
  index: number
}>()

const store = useQueue()

const isProcessing = computed(() => props.queueData.status === QueueStatus.Progressing)
const isManaging = computed(() => store.queueDataBeingManaged === props.queueData.id)
const hasOtherProcessing = computed(() =>
  store.queue.some((s) => s.id !== props.queueData.id && s.status === QueueStatus.Progressing),
)
const paymentMeta = computed(() => getQueuePaymentMeta(props.queueData))
const canBlock = computed(
  () =>
    store.configCanEdit &&
    (props.queueData.from === QueueFrom.Danmaku || props.queueData.from === QueueFrom.Gift) &&
    !!props.queueData.user?.uid,
)
const cardThemeOverrides = { color: 'var(--vtsuru-bg-muted)' }

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
      return { ...base, backgroundColor: 'var(--vtsuru-success)' }
    case QueueStatus.Finish:
      return {
        ...base,
        backgroundColor: 'var(--vtsuru-bg-inset)',
        color: 'var(--vtsuru-fg)',
        border: '1px solid var(--vtsuru-border)',
      }
    case QueueStatus.Cancel:
      return { ...base, backgroundColor: 'var(--vtsuru-error)' }
    default:
      return { ...base, backgroundColor: 'var(--vtsuru-info)' }
  }
})
</script>

<template>
  <UCard
    size="small"
    :theme-overrides="cardThemeOverrides"
    content-style="padding: 8px 12px;"
    bordered
    :style="isProcessing ? 'border-left: 4px solid var(--vtsuru-success);' : undefined"
  >
    <div
      justify="space-between"
      align="center"
      :wrap="false"
    >
      <!-- 左侧信息 -->
      <div
        align="center"
        :size="8"
        :wrap="false"
      >
        <span
          :style="indexStyle"
          class="queue-index"
          :class="{ 'queue-index-processing': isProcessing }"
        >
          {{ index }}
        </span>
        <span
          strong
          style="font-size: 16px"
        >
          <UTooltip>
            {{ queueData.user?.name }}
            <template #content>
              {{ queueData.user?.uid ? `UID: ${queueData.user?.uid}` : `OpenID: ${queueData.user?.oid}` }}
            </template>
          </UTooltip>
        </span>

        <UserBadges
          :user="queueData.user"
          :show-fan-medal="store.settings.showFanMadelInfo"
          size="tiny"
        />

        <!-- 付费信息 -->
        <UTooltip
          v-if="store.settings.showPayment && paymentMeta.hasMysteryBoxPayment"
          placement="top"
        >
          <UBadge
            size="small"
            :bordered="false"
            type="warning"
          >
            {{ paymentMeta.shortText }}
          </UBadge>
          <template #content>
            {{ paymentMeta.detailText }}
          </template>
        </UTooltip>
        <UBadge
          v-if="store.settings.showPayment && paymentMeta.giftPriceText"
          size="small"
          :bordered="false"
          type="error"
        >
          ￥ {{ paymentMeta.giftPriceText }}
        </UBadge>

        <!-- 附加内容 -->
        <UTooltip
          v-if="queueData.content"
          placement="right"
        >
          <UIcon
            name="i-lucide-circle"
            size="16"
            style="cursor: help; color: var(--vtsuru-fg-muted)"
          />
          <template #content>
            <UCard
              size="small"
              :bordered="false"
              style="max-width: 300px"
            >
              <template #header>
                <span style="font-size: small; color: gray">
                  {{ `来自${queueData?.from === QueueFrom.Gift ? '礼物' : '弹幕'}: ` }}
                </span>
              </template>
              {{ queueData?.content }}
            </UCard>
          </template>
        </UTooltip>

        <!-- 时间 -->
        <UTooltip placement="bottom">
          <span
            depth="3"
            style="font-size: 12px"
          >
            <time
              :key="store.updateKey"
              :time="queueData.createAt"
              type="relative"
            />
          </span>
          <template #content>
            <time
              :time="queueData.createAt"
              format="yyyy-MM-dd HH:mm:ss"
            />
          </template>
        </UTooltip>
      </div>

      <!-- 右侧操作 -->
      <div
        justify="end"
        align="center"
        :size="6"
        :wrap="false"
        style="flex-shrink: 0"
      >
        <UTooltip>
          <UButton
            square
            size="small"
            :color="isProcessing ? 'warning' : 'primary'"
            :ghost="isProcessing"
            :disabled="hasOtherProcessing"
            :loading="store.isLoading && isManaging"
            @click="manage(isProcessing ? QueueStatus.Waiting : QueueStatus.Progressing)"
          >
            <template #leading>
              <UIcon name="i-lucide-circle" />
            </template>
          </UButton>
          <template #content>
            {{ hasOtherProcessing ? '已有其他用户正在处理中' : isProcessing ? '暂停处理 (返回等待)' : '开始处理' }}
          </template>
        </UTooltip>

        <UTooltip>
          <UButton
            square
            size="small"
            color="success"
            :loading="store.isLoading && isManaging"
            @click="manage(QueueStatus.Finish)"
          >
            <template #leading>
              <UIcon name="i-lucide-circle" />
            </template>
          </UButton>
          <template #content> 标记为已完成 </template>
        </UTooltip>

        <UTooltip v-if="canBlock">
          <UPopover>
            <UButton
              circle
              size="sm"
              color="warning"
              :loading="store.isLoading && isManaging"
              @click="store.queueDataBeingManaged = queueData.id"
            >
              <template #leading>
                <UIcon name="i-lucide-circle" />
              </template>
            </UButton>
            <template #content="{ close }">
              <div class="space-y-3 p-3">
                <div>确定要将 {{ queueData.user?.name }} 加入 黑名单并取消排队吗？</div>
                <div class="flex justify-end gap-2">
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    @click="close"
                    >取消</UButton
                  >
                  <UButton
                    size="xs"
                    color="warning"
                    @click="(close(), store.blockUser(queueData))"
                    >确认</UButton
                  >
                </div>
              </div>
            </template>
          </UPopover>
          <template #content> 拉黑用户 (B站) </template>
        </UTooltip>

        <UTooltip>
          <UButton
            square
            size="small"
            color="error"
            :loading="store.isLoading && isManaging"
            @click="manage(QueueStatus.Cancel)"
          >
            <template #leading>
              <UIcon name="i-lucide-circle" />
            </template>
          </UButton>
          <template #content> 取消排队 </template>
        </UTooltip>
      </div>
    </div>
  </UCard>
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
  border: 2px solid var(--vtsuru-success);
  opacity: 0.35;
}
</style>
