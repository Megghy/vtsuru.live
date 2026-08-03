<script setup lang="ts">
import type { LiveControl } from '@/apps/client/composables/useLiveControl'

import LiveCoverUpload from './LiveCoverUpload.vue'

const props = defineProps<{ control: LiveControl }>()
const c = props.control
const obsStore = c.obsStore
</script>

<template>
  <UCard
    title="直播控制"
    size="small"
    class="live-manage-card"
    bordered
  >
    <div
      vertical
      :size="16"
    >
      <!-- 直播状态和操作 -->
      <div>
        <div
          :size="12"
          align="center"
          wrap
          style="margin-bottom: 16px"
        >
          <UBadge
            :type="c.isLiving.value ? 'success' : 'default'"
            size="large"
            :bordered="false"
            style="padding: 8px 16px"
          >
            <template #leading>
              <div style="width: 8px; height: 8px; border-radius: 50%; background: currentColor; margin-right: 8px" />
            </template>
            {{ c.isLiving.value ? '直播中' : '未开播' }}
          </UBadge>

          <template v-if="!c.isLiving.value">
            <UPopover v-if="c.needUpdateBeforeLive.value">
              <UButton
                color="success"
                size="large"
                :disabled="!c.liveAreaId.value"
              >
                开始直播
              </UButton>
              <template #content="{ close }">
                <div class="space-y-3 p-3">
                  <div>检测到直播标题或分区已修改，是否先更新直播间信息再开播？</div>
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
                      color="primary"
                      @click="(close(), c.handleStartLiveWithUpdate)"
                      >确认</UButton
                    >
                  </div>
                </div>
              </template>
            </UPopover>
            <UButton
              v-else
              color="success"
              size="large"
              :disabled="!c.liveAreaId.value"
              @click="c.handleStartLive"
            >
              开始直播
            </UButton>
          </template>
          <UButton
            v-else
            color="error"
            size="large"
            @click="c.handleStopLive"
          >
            停止直播
          </UButton>

          <!-- OBS 推流控制 -->
          <UTooltip v-if="obsStore.obsConnected && !c.isLiving.value">
            <UButton
              :color="obsStore.obsStreamActive ? 'error' : 'primary'"
              size="large"
              disabled
            >
              {{ obsStore.obsStreamActive ? '停止 OBS 推流' : '开始 OBS 推流' }}
            </UButton>
            <template #content> 请先开始直播后再控制 OBS 推流 </template>
          </UTooltip>
          <UButton
            v-else-if="obsStore.obsConnected && c.isLiving.value"
            :color="obsStore.obsStreamActive ? 'error' : 'primary'"
            size="large"
            :loading="obsStore.isTogglingObsStream"
            @click="obsStore.handleObsToggleStream"
          >
            {{ obsStore.obsStreamActive ? '停止 OBS 推流' : '开始 OBS 推流' }}
          </UButton>

          <UButton
            v-if="!c.isLiving.value && c.liveTitle.value"
            color="primary"
            :disabled="!c.liveAreaId.value && !c.liveTitle.value"
            @click="c.handleUpdateRoom"
          >
            更新直播间信息
          </UButton>
        </div>
      </div>

      <USeparator style="margin: 0" />

      <!-- 直播间设置 -->
      <div>
        <span
          strong
          style="font-size: 16px; display: block; margin-bottom: 12px"
        >
          直播间设置
        </span>
        <div
          vertical
          :size="12"
        >
          <div>
            <span strong> 直播间标题 </span>
            <UInput
              v-model="c.liveTitle.value"
              :status="c.titleChanged.value ? 'warning' : undefined"
              placeholder="输入直播间标题"
              maxlength="40"
              show-count
              size="large"
              style="margin-top: 8px"
              @update:value="c.markTitleEdited"
            />
          </div>

          <div>
            <span strong> 直播分区 </span>
            <USelectMenu
              v-model="c.liveAreaId.value"
              :status="c.areaChanged.value ? 'warning' : undefined"
              :items="c.areaOptions.value"
              placeholder="请选择直播分区"
              filterable
              check-strategy="child"
              size="large"
              style="margin-top: 8px"
              @update:value="c.markAreaEdited"
              value-key="value"
            />
          </div>
        </div>
      </div>

      <USeparator style="margin: 0" />

      <!-- 直播间公告 -->
      <div>
        <span strong> 直播间公告 </span>
        <UInput
          v-model="c.roomAnnouncement.value"
          type="textarea"
          placeholder="输入直播间公告（最多60个字符）"
          maxlength="60"
          show-count
          size="large"
          style="margin-top: 8px"
          :autosize="{ minRows: 2, maxRows: 4 }"
        />
        <UButton
          style="margin-top: 8px"
          color="primary"
          :loading="c.isUpdatingAnnouncement.value"
          @click="c.handleUpdateAnnouncement"
        >
          更新公告
        </UButton>
      </div>

      <USeparator style="margin: 0" />

      <LiveCoverUpload :control="c" />
    </div>
  </UCard>
</template>
