<script setup lang="ts">
import type { LiveControl } from '@/apps/client/composables/useLiveControl'
import LiveCoverUpload from './LiveCoverUpload.vue'

const props = defineProps<{ control: LiveControl }>()
const c = props.control
const obsStore = c.obsStore
</script>

<template>
  <NCard
    title="直播控制"
    size="small"
    class="live-manage-card"
    bordered
  >
    <NFlex
      vertical
      :size="16"
    >
      <!-- 直播状态和操作 -->
      <div>
        <NFlex
          :size="12"
          align="center"
          wrap
          style="margin-bottom: 16px;"
        >
          <NTag
            :type="c.isLiving.value ? 'success' : 'default'"
            size="large"
            :bordered="false"
            style="padding: 8px 16px;"
          >
            <template #icon>
              <div
                style="
                  width: 8px;
                  height: 8px;
                  border-radius: 50%;
                  background: currentColor;
                  margin-right: 8px;
                "
              />
            </template>
            {{ c.isLiving.value ? '直播中' : '未开播' }}
          </NTag>

          <template v-if="!c.isLiving.value">
            <NPopconfirm
              v-if="c.needUpdateBeforeLive.value"
              @positive-click="c.handleStartLiveWithUpdate"
            >
              <template #trigger>
                <NButton
                  type="success"
                  size="large"
                  :disabled="!c.liveAreaId.value"
                >
                  开始直播
                </NButton>
              </template>
              检测到直播标题或分区已修改，是否先更新直播间信息再开播？
            </NPopconfirm>
            <NButton
              v-else
              type="success"
              size="large"
              :disabled="!c.liveAreaId.value"
              @click="c.handleStartLive"
            >
              开始直播
            </NButton>
          </template>
          <NButton
            v-else
            type="error"
            size="large"
            @click="c.handleStopLive"
          >
            停止直播
          </NButton>

          <!-- OBS 推流控制 -->
          <NTooltip v-if="obsStore.obsConnected && !c.isLiving.value">
            <template #trigger>
              <NButton
                :type="obsStore.obsStreamActive ? 'error' : 'primary'"
                size="large"
                disabled
              >
                {{ obsStore.obsStreamActive ? '停止 OBS 推流' : '开始 OBS 推流' }}
              </NButton>
            </template>
            请先开始直播后再控制 OBS 推流
          </NTooltip>
          <NButton
            v-else-if="obsStore.obsConnected && c.isLiving.value"
            :type="obsStore.obsStreamActive ? 'error' : 'primary'"
            size="large"
            :loading="obsStore.isTogglingObsStream"
            @click="obsStore.handleObsToggleStream"
          >
            {{ obsStore.obsStreamActive ? '停止 OBS 推流' : '开始 OBS 推流' }}
          </NButton>

          <NButton
            v-if="!c.isLiving.value && c.liveTitle.value"
            type="primary"
            :disabled="!c.liveAreaId.value && !c.liveTitle.value"
            @click="c.handleUpdateRoom"
          >
            更新直播间信息
          </NButton>
        </NFlex>
      </div>

      <NDivider style="margin: 0;" />

      <!-- 直播间设置 -->
      <div>
        <NText
          strong
          style="font-size: 16px; display: block; margin-bottom: 12px;"
        >
          直播间设置
        </NText>
        <NFlex
          vertical
          :size="12"
        >
          <div>
            <NText strong>
              直播间标题
            </NText>
            <NInput
              v-model:value="c.liveTitle.value"
              :status="c.titleChanged.value ? 'warning' : undefined"
              placeholder="输入直播间标题"
              maxlength="40"
              show-count
              size="large"
              style="margin-top: 8px;"
              @update:value="c.markTitleEdited"
            />
          </div>

          <div>
            <NText strong>
              直播分区
            </NText>
            <NCascader
              v-model:value="c.liveAreaId.value"
              :status="c.areaChanged.value ? 'warning' : undefined"
              :options="c.areaOptions.value"
              placeholder="请选择直播分区"
              filterable
              check-strategy="child"
              size="large"
              style="margin-top: 8px;"
              @update:value="c.markAreaEdited"
            />
          </div>
        </NFlex>
      </div>

      <NDivider style="margin: 0;" />

      <!-- 直播间公告 -->
      <div>
        <NText strong>
          直播间公告
        </NText>
        <NInput
          v-model:value="c.roomAnnouncement.value"
          type="textarea"
          placeholder="输入直播间公告（最多60个字符）"
          maxlength="60"
          show-count
          size="large"
          style="margin-top: 8px;"
          :autosize="{ minRows: 2, maxRows: 4 }"
        />
        <NButton
          style="margin-top: 8px;"
          type="primary"
          :loading="c.isUpdatingAnnouncement.value"
          @click="c.handleUpdateAnnouncement"
        >
          更新公告
        </NButton>
      </div>

      <NDivider style="margin: 0;" />

      <LiveCoverUpload :control="c" />
    </NFlex>
  </NCard>
</template>
