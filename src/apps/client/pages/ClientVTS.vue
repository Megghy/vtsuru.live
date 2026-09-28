<script setup lang="ts">
import {
  Flash24Filled,
  Grid24Regular,
  PlugConnected24Filled,
  PlugDisconnected24Filled,
  Settings24Filled,
  VideoPerson24Filled,
} from '@vicons/fluent'
import {
  NAlert,
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NFlex,
  NIcon,
  NProgress,
  NTabPane,
  NTabs,
  NTag,
  NText,
} from 'naive-ui'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import { useVtsAction } from '@/apps/client/components/vts/useVtsAction'
import VtsConnectionCard from '@/apps/client/components/vts/VtsConnectionCard.vue'
import VtsDeck from '@/apps/client/components/vts/VtsDeck.vue'
import VtsHistoryPanel from '@/apps/client/components/vts/VtsHistoryPanel.vue'
import VtsHotkeyBoard from '@/apps/client/components/vts/VtsHotkeyBoard.vue'
import VtsImportExportCard from '@/apps/client/components/vts/VtsImportExportCard.vue'
import VtsItemPanel from '@/apps/client/components/vts/VtsItemPanel.vue'
import VtsMacroPanel from '@/apps/client/components/vts/VtsMacroPanel.vue'
import VtsObsLinkPanel from '@/apps/client/components/vts/VtsObsLinkPanel.vue'
import VtsPanicPanel from '@/apps/client/components/vts/VtsPanicPanel.vue'
import VtsParameterPanel from '@/apps/client/components/vts/VtsParameterPanel.vue'
import VtsPresetPanel from '@/apps/client/components/vts/VtsPresetPanel.vue'
import VtsProfilePanel from '@/apps/client/components/vts/VtsProfilePanel.vue'
import { ActionType } from '@/apps/client/store/autoAction/types'
import { useAutoAction } from '@/apps/client/store/useAutoAction'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { isTauri } from '@/shared/config'

const vts = useVtsStore()
const autoAction = useAutoAction()
const { run } = useVtsAction()
const router = useRouter()
const tab = ref<'deck' | 'actions' | 'items' | 'settings'>('deck')

const status = computed(() => {
  if (vts.connected) return { type: 'success' as const, text: '已连接' }
  if (vts.connecting) return { type: 'info' as const, text: '等待 VTS / 授权中' }
  return { type: 'error' as const, text: '未连接' }
})

const VTS_ACTION_TYPES = new Set([
  ActionType.VTS_HOTKEY,
  ActionType.VTS_PRESET,
  ActionType.VTS_DROP_ITEM,
  ActionType.VTS_PARAM_ADD,
  ActionType.VTS_MACRO,
  ActionType.VTS_ACCESSORY,
])

const linkedAutoActions = computed(() => autoAction.autoActions.filter((a) => VTS_ACTION_TYPES.has(a.actionType)))

const macroProgress = computed(() => {
  const running = vts.macroRunning
  if (!running) return null
  return {
    name: vts.macros.find((x) => x.id === running.macroId)?.name ?? '宏',
    step: running.stepIndex + 1,
    total: running.totalSteps,
    percent: Math.round(((running.stepIndex + 1) / running.totalSteps) * 100),
  }
})
</script>

<template>
  <div class="vts-page">
    <NFlex
      vertical
      :size="14"
    >
      <ClientPageHeader
        title="VTube Studio 控制中心"
        description="通过 VTS 插件 API 在本地控制表情、热键、机位、道具与动作宏，可配合自动操作与 OBS 场景联动"
      >
        <template #actions>
          <NFlex
            align="center"
            :size="8"
          >
            <NTag
              :type="status.type"
              round
              :bordered="false"
            >
              {{ status.text }}
            </NTag>
            <NButton
              v-if="!vts.connected && !vts.connecting"
              size="small"
              type="primary"
              secondary
              @click="run(() => vts.connect())"
            >
              <template #icon>
                <NIcon :component="PlugConnected24Filled" />
              </template>
              连接
            </NButton>
            <NButton
              v-else
              size="small"
              secondary
              @click="run(() => vts.disconnect())"
            >
              <template #icon>
                <NIcon :component="PlugDisconnected24Filled" />
              </template>
              {{ vts.connecting ? '取消' : '断开' }}
            </NButton>
          </NFlex>
        </template>
      </ClientPageHeader>

      <NAlert
        v-if="!isTauri()"
        type="error"
      >
        当前不是桌面客户端环境，无法连接本地 VTube Studio。
      </NAlert>

      <template v-else>
        <NAlert
          v-if="vts.connecting"
          type="info"
          :show-icon="false"
        >
          正在等待 VTube Studio：请确认 VTS 已启动并开启「启动 API」；首次连接需在 VTS 弹窗中点击「允许」。
        </NAlert>

        <NCard
          v-else-if="vts.connected"
          size="small"
          bordered
        >
          <NFlex
            align="center"
            :size="10"
            wrap
          >
            <span class="model-badge">
              <span class="label">当前模型</span>
              <NText strong>{{ vts.currentModelName || '未加载模型' }}</NText>
            </span>
            <NTag
              v-if="vts.statistics?.framerate"
              size="small"
              :bordered="false"
              type="info"
            >
              {{ vts.statistics.framerate }} FPS
            </NTag>
            <NTag
              v-if="vts.lastRttMs != null"
              size="small"
              :bordered="false"
              :type="vts.lastRttMs < 50 ? 'success' : 'warning'"
            >
              延迟 {{ vts.lastRttMs }}ms
            </NTag>
            <NTag
              v-if="vts.faceFound === false"
              size="small"
              :bordered="false"
              type="warning"
            >
              面部丢失
            </NTag>
          </NFlex>
        </NCard>

        <NAlert
          v-if="vts.lastError"
          type="error"
          closable
          @close="vts.lastError = null"
        >
          {{ vts.lastError }}
        </NAlert>

        <Transition name="vts-slide">
          <NCard
            v-if="macroProgress"
            size="small"
            bordered
          >
            <NFlex
              align="center"
              :size="12"
            >
              <NText strong>{{ macroProgress.name }}</NText>
              <NTag
                size="tiny"
                type="info"
                round
              >
                {{ macroProgress.step }} / {{ macroProgress.total }}
              </NTag>
              <NProgress
                type="line"
                :percentage="macroProgress.percent"
                :show-indicator="false"
                style="flex: 1; min-width: 120px"
              />
            </NFlex>
          </NCard>
        </Transition>

        <NTabs
          v-model:value="tab"
          type="segment"
          animated
          class="vts-tabs"
        >
          <NTabPane name="deck">
            <template #tab>
              <NFlex
                align="center"
                :size="6"
              >
                <NIcon :component="Grid24Regular" />
                <span>操作台</span>
              </NFlex>
            </template>
            <VtsDeck />
          </NTabPane>

          <NTabPane name="actions">
            <template #tab>
              <NFlex
                align="center"
                :size="6"
              >
                <NIcon :component="VideoPerson24Filled" />
                <span>热键与宏</span>
              </NFlex>
            </template>
            <NFlex
              vertical
              :size="12"
              class="client-readable"
            >
              <VtsHotkeyBoard
                :hotkeys="vts.hotkeys"
                :model-name="vts.currentModelName"
                :disabled="!vts.connected"
                @refresh="run(() => vts.refreshModelState())"
                @trigger="(id) => run(() => vts.triggerHotkey(id))"
              />
              <VtsMacroPanel />
              <VtsPresetPanel />
              <VtsPanicPanel />
            </NFlex>
          </NTabPane>

          <NTabPane name="items">
            <template #tab>
              <NFlex
                align="center"
                :size="6"
              >
                <NIcon :component="Flash24Filled" />
                <span>道具与参数</span>
              </NFlex>
            </template>
            <NFlex
              vertical
              :size="12"
              class="client-readable"
            >
              <VtsItemPanel />
              <VtsParameterPanel />
            </NFlex>
          </NTabPane>

          <NTabPane name="settings">
            <template #tab>
              <NFlex
                align="center"
                :size="6"
              >
                <NIcon :component="Settings24Filled" />
                <span>设置</span>
              </NFlex>
            </template>
            <NFlex
              vertical
              :size="12"
              class="client-readable"
            >
              <VtsConnectionCard />
              <VtsObsLinkPanel />
              <NCollapse arrow-placement="right">
                <NCollapseItem
                  title="配置方案与备份"
                  name="profiles"
                >
                  <NFlex
                    vertical
                    :size="12"
                  >
                    <VtsProfilePanel />
                    <VtsImportExportCard />
                  </NFlex>
                </NCollapseItem>
                <NCollapseItem
                  :title="`关联的自动操作规则 (${linkedAutoActions.length})`"
                  name="rules"
                >
                  <NFlex
                    vertical
                    :size="8"
                  >
                    <NText depth="3"> 在「自动操作」中可以让礼物、弹幕、上舰等事件自动触发 VTS 动作 </NText>
                    <NFlex
                      v-for="a in linkedAutoActions"
                      :key="a.id"
                      align="center"
                      :size="8"
                      class="linked-action-row"
                    >
                      <NTag
                        :type="a.enabled ? 'success' : 'default'"
                        size="small"
                      >
                        {{ a.enabled ? '启用' : '禁用' }}
                      </NTag>
                      <NText strong>{{ a.name || '未命名操作' }}</NText>
                    </NFlex>
                    <NButton
                      size="small"
                      secondary
                      style="align-self: flex-start"
                      @click="router.push({ name: 'client-auto-action-manage' })"
                    >
                      前往自动操作
                    </NButton>
                  </NFlex>
                </NCollapseItem>
                <NCollapseItem
                  title="操作记录"
                  name="history"
                >
                  <VtsHistoryPanel />
                </NCollapseItem>
              </NCollapse>
            </NFlex>
          </NTabPane>
        </NTabs>
      </template>
    </NFlex>
  </div>
</template>

<style scoped>
.vts-page {
  width: 100%;
}

.vts-tabs :deep(.n-tabs-rail) {
  max-width: 520px;
}

.model-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.model-badge .label {
  color: var(--vtsuru-fg-muted);
}

.linked-action-row {
  padding: 8px 12px;
  background: var(--vtsuru-bg-elevated);
  border-radius: var(--vtsuru-radius, 6px);
  border: 1px solid var(--vtsuru-border);
}

.vts-slide-enter-active,
.vts-slide-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}

.vts-slide-enter-from,
.vts-slide-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-8px);
}

.vts-slide-enter-to,
.vts-slide-leave-from {
  opacity: 1;
  max-height: 200px;
}
</style>
