<script setup lang="ts">
import {
  Flash24Filled,
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
  NTooltip,
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import { useVtsAction } from '@/apps/client/components/vts/useVtsAction'
import VtsConnectionCard from '@/apps/client/components/vts/VtsConnectionCard.vue'
import VtsFloatWindowPanel from '@/apps/client/components/vts/VtsFloatWindowPanel.vue'
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
import VtsShortcutPanel from '@/apps/client/components/vts/VtsShortcutPanel.vue'
import { ActionType } from '@/apps/client/store/autoAction/types'
import { useAutoAction } from '@/apps/client/store/useAutoAction'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { isTauri } from '@/shared/config'

const vts = useVtsStore()
const autoAction = useAutoAction()
const { run, message } = useVtsAction()
const router = useRouter()
const tab = ref<'control' | 'items' | 'settings'>('control')
const showConnectionDetail = ref(false)

onMounted(async () => {
  if (!isTauri()) return
  try {
    await vts.init()
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
    return
  }
  if (vts.wsUrl && vts.authToken && !vts.connected) {
    run(() => vts.connect())
  }
})

const statusType = computed(() => {
  if (vts.connecting) return 'info'
  if (!vts.connected) return 'error'
  if (!vts.authenticated) return 'warning'
  return 'success'
})

const statusText = computed(() => {
  if (vts.connecting) return '连接中...'
  if (!vts.connected) return '未连接'
  if (!vts.authenticated) return '等待授权'
  return '已连接并就绪'
})

const favoriteHotkeys = computed(() =>
  vts.hotkeys.filter((hk) => {
    const c = vts.hotkeyCustomizations.find((x) => x.hotkeyID === hk.hotkeyID)
    return c?.favorite || c?.pinned
  }),
)

const VTS_ACTION_TYPES = new Set([
  ActionType.VTS_HOTKEY,
  ActionType.VTS_PRESET,
  ActionType.VTS_DROP_ITEM,
  ActionType.VTS_PARAM_ADD,
  ActionType.VTS_MACRO,
  ActionType.VTS_ACCESSORY,
])

const linkedAutoActions = computed(() =>
  (autoAction.autoActions ?? []).filter((a) => VTS_ACTION_TYPES.has(a.actionType)),
)

const macroProgress = computed(() => {
  if (!vts.macroRunning) return null
  const m = vts.macros.find((x) => x.id === vts.macroRunning!.macroId)
  return {
    name: m?.name ?? '宏任务',
    step: vts.macroRunning.stepIndex + 1,
    total: vts.macroRunning.totalSteps,
    percent: Math.round(((vts.macroRunning.stepIndex + 1) / vts.macroRunning.totalSteps) * 100),
  }
})
</script>

<template>
  <div class="vts-page">
    <NFlex
      vertical
      :size="14"
    >
      <!-- 标准页面标头 -->
      <ClientPageHeader
        title="VTube Studio 控制中心"
        description="通过 VTS API 本地双向联动控制表情动作、机位预设、道具掉落与动作宏"
      >
        <template #actions>
          <NFlex
            align="center"
            :size="8"
          >
            <NTag
              :type="statusType"
              round
              :bordered="false"
            >
              {{ statusText }}
            </NTag>

            <NButton
              v-if="!vts.connected"
              size="small"
              type="primary"
              secondary
              :loading="vts.connecting"
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
              type="error"
              secondary
              @click="vts.disconnect"
            >
              <template #icon>
                <NIcon :component="PlugDisconnected24Filled" />
              </template>
              断开
            </NButton>

            <NButton
              size="small"
              quaternary
              @click="showConnectionDetail = !showConnectionDetail"
            >
              {{ showConnectionDetail ? '收起配置' : '连接配置' }}
            </NButton>
          </NFlex>
        </template>
      </ClientPageHeader>

      <NAlert
        v-if="!isTauri()"
        type="error"
      >
        当前不是桌面客户端环境，无法直接连接本地 VTube Studio 端口。
      </NAlert>

      <template v-else>
        <!-- 运行状态指示条 -->
        <NCard
          size="small"
          bordered
          class="vts-status-strip"
        >
          <NFlex
            align="center"
            justify="space-between"
            wrap
            :size="12"
          >
            <NFlex
              align="center"
              :size="10"
              wrap
            >
              <div class="model-badge">
                <span class="label">当前模型:</span>
                <NText strong>{{ vts.currentModelName || '未加载模型' }}</NText>
              </div>

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
                RTT {{ vts.lastRttMs }}ms
              </NTag>
            </NFlex>

            <NText
              depth="3"
              style="font-size: 12px"
            >
              端口: {{ vts.wsUrl || 'ws://127.0.0.1:8001' }}
            </NText>
          </NFlex>

          <NAlert
            v-if="vts.lastError"
            type="error"
            size="small"
            style="margin-top: 10px"
          >
            {{ vts.lastError }}
          </NAlert>
        </NCard>

        <!-- 详细连接配置展开卡片 -->
        <Transition name="vts-slide">
          <VtsConnectionCard v-if="showConnectionDetail" />
        </Transition>

        <!-- 宏执行实时进度条 -->
        <Transition name="vts-slide">
          <NCard
            v-if="macroProgress"
            size="small"
            bordered
            class="macro-progress-card"
          >
            <NFlex
              align="center"
              :size="12"
            >
              <NText strong>
                {{ macroProgress.name }}
              </NText>
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

        <!-- 常用动作与宏快捷操作栏 -->
        <Transition name="vts-fade">
          <NCard
            v-if="favoriteHotkeys.length > 0 || vts.macros.length > 0 || vts.presets.length > 0"
            size="small"
            bordered
          >
            <template #header>
              <span style="font-size: 13px; font-weight: 600">快捷操作面板</span>
            </template>
            <NFlex
              :wrap="true"
              :size="8"
            >
              <TransitionGroup name="vts-btn">
                <NTooltip
                  v-for="hk in favoriteHotkeys"
                  :key="hk.hotkeyID"
                  trigger="hover"
                >
                  <template #trigger>
                    <NButton
                      size="small"
                      :disabled="!vts.canOperate"
                      @click="run(() => vts.triggerHotkey(hk.hotkeyID))"
                    >
                      {{ vts.hotkeyCustomizations.find((c) => c.hotkeyID === hk.hotkeyID)?.displayName || hk.name }}
                    </NButton>
                  </template>
                  {{ hk.name }}{{ hk.description ? ` - ${hk.description}` : '' }}
                </NTooltip>
                <NButton
                  v-for="m in vts.macros"
                  :key="m.id"
                  size="small"
                  type="primary"
                  ghost
                  :disabled="!vts.canOperate || !!vts.macroRunning"
                  @click="run(() => vts.runMacro(m.id))"
                >
                  {{ m.name }}
                </NButton>
                <NButton
                  v-for="p in vts.presets"
                  :key="p.id"
                  size="small"
                  secondary
                  :disabled="!vts.canOperate"
                  @click="run(() => vts.applyPreset(p.id))"
                >
                  {{ p.name }}
                </NButton>
              </TransitionGroup>
            </NFlex>
          </NCard>
        </Transition>

        <!-- 统一 Segmented Tabs -->
        <NTabs
          v-model:value="tab"
          type="segment"
          animated
          class="vts-tabs"
        >
          <!-- 动作控制 -->
          <NTabPane
            name="control"
            tab="动作控制"
          >
            <template #tab>
              <NFlex
                align="center"
                :size="6"
              >
                <NIcon :component="VideoPerson24Filled" />
                <span>动作控制</span>
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
                :disabled="!vts.canOperate"
                @refresh="run(() => vts.refreshHotkeys())"
                @trigger="(id) => run(() => vts.triggerHotkey(id))"
              />
              <VtsMacroPanel />
              <VtsPresetPanel />
              <VtsPanicPanel />
            </NFlex>
          </NTabPane>

          <!-- 道具与参数 -->
          <NTabPane
            name="items"
            tab="道具与参数"
          >
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

          <!-- 联动与设置 -->
          <NTabPane
            name="settings"
            tab="联动与设置"
          >
            <template #tab>
              <NFlex
                align="center"
                :size="6"
              >
                <NIcon :component="Settings24Filled" />
                <span>联动与设置</span>
              </NFlex>
            </template>

            <NCollapse
              :default-expanded-names="['automation', 'window']"
              arrow-placement="right"
              class="client-readable"
            >
              <NCollapseItem
                title="自动化与 OBS 联动"
                name="automation"
              >
                <NFlex
                  vertical
                  :size="14"
                >
                  <VtsShortcutPanel />
                  <VtsObsLinkPanel />
                </NFlex>
              </NCollapseItem>

              <NCollapseItem
                title="悬浮窗与配置方案"
                name="window"
              >
                <NFlex
                  vertical
                  :size="14"
                >
                  <VtsFloatWindowPanel />
                  <VtsProfilePanel />
                  <VtsImportExportCard />
                </NFlex>
              </NCollapseItem>

              <NCollapseItem
                title="历史日志与关联诊断"
                name="diagnostics"
              >
                <NFlex
                  vertical
                  :size="14"
                >
                  <VtsHistoryPanel />
                  <NCard
                    v-if="linkedAutoActions.length > 0"
                    size="small"
                    bordered
                    title="关联的自动操作规则"
                  >
                    <NFlex
                      vertical
                      :size="8"
                    >
                      <NText depth="3"> 以下自动操作规则绑定了 VTS 动作 </NText>
                      <NFlex
                        v-for="a in linkedAutoActions"
                        :key="a.id"
                        align="center"
                        justify="space-between"
                        :wrap="true"
                        :size="8"
                        class="linked-action-row"
                      >
                        <NFlex
                          align="center"
                          :size="8"
                        >
                          <NTag
                            :type="a.enabled ? 'success' : 'default'"
                            size="small"
                          >
                            {{ a.enabled ? '启用' : '禁用' }}
                          </NTag>
                          <NText strong>{{ a.name || '未命名操作' }}</NText>
                          <NText depth="3">
                            {{ a.actionType }}
                          </NText>
                        </NFlex>
                        <NButton
                          size="small"
                          secondary
                          @click="router.push({ name: 'client-auto-action-manage' })"
                        >
                          前往配置
                        </NButton>
                      </NFlex>
                    </NFlex>
                  </NCard>
                </NFlex>
              </NCollapseItem>
            </NCollapse>
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
  max-width: 420px;
}

.vts-status-strip {
  border-radius: var(--vtsuru-radius, 6px);
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

/* 动效 */
.vts-slide-enter-active,
.vts-slide-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}

.vts-slide-enter-from,
.vts-slide-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0 !important;
  margin-bottom: 0 !important;
  transform: translateY(-8px);
}

.vts-slide-enter-to,
.vts-slide-leave-from {
  opacity: 1;
  max-height: 500px;
}

.vts-fade-enter-active,
.vts-fade-leave-active {
  transition: opacity 0.2s ease;
}

.vts-fade-enter-from,
.vts-fade-leave-to {
  opacity: 0;
}

.vts-btn-enter-active,
.vts-btn-leave-active {
  transition: all 0.2s ease;
}

.vts-btn-enter-from,
.vts-btn-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
