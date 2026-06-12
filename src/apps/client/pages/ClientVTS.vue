<script setup lang="ts">
import { NAlert, NButton, NCard, NFlex, NProgress, NTabPane, NTabs, NTag, NText, NTooltip } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { isTauri } from '@/shared/config'
import { useRouter } from 'vue-router'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import VtsConnectionCard from '@/apps/client/components/vts/VtsConnectionCard.vue'
import VtsFloatWindowPanel from '@/apps/client/components/vts/VtsFloatWindowPanel.vue'
import VtsHotkeyBoard from '@/apps/client/components/vts/VtsHotkeyBoard.vue'
import VtsImportExportCard from '@/apps/client/components/vts/VtsImportExportCard.vue'
import VtsPresetPanel from '@/apps/client/components/vts/VtsPresetPanel.vue'
import VtsMacroPanel from '@/apps/client/components/vts/VtsMacroPanel.vue'
import VtsParameterPanel from '@/apps/client/components/vts/VtsParameterPanel.vue'
import VtsPanicPanel from '@/apps/client/components/vts/VtsPanicPanel.vue'
import VtsItemPanel from '@/apps/client/components/vts/VtsItemPanel.vue'
import VtsHistoryPanel from '@/apps/client/components/vts/VtsHistoryPanel.vue'
import VtsObsLinkPanel from '@/apps/client/components/vts/VtsObsLinkPanel.vue'
import VtsProfilePanel from '@/apps/client/components/vts/VtsProfilePanel.vue'
import VtsShortcutPanel from '@/apps/client/components/vts/VtsShortcutPanel.vue'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { useAutoAction } from '@/apps/client/store/useAutoAction'
import { ActionType } from '@/apps/client/store/autoAction/types'
import { useVtsAction } from '@/apps/client/components/vts/useVtsAction'

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
  if (!vts.authenticated) return '未鉴权'
  return '已连接'
})

const favoriteHotkeys = computed(() =>
  vts.hotkeys.filter(hk => {
    const c = vts.hotkeyCustomizations.find(x => x.hotkeyID === hk.hotkeyID)
    return c?.favorite || c?.pinned
  }),
)

const VTS_ACTION_TYPES = [
  ActionType.VTS_HOTKEY, ActionType.VTS_PRESET, ActionType.VTS_DROP_ITEM,
  ActionType.VTS_PARAM_ADD, ActionType.VTS_MACRO, ActionType.VTS_ACCESSORY,
]

const linkedAutoActions = computed(() =>
  (autoAction.autoActions ?? []).filter(a => VTS_ACTION_TYPES.includes(a.actionType)),
)

const macroProgress = computed(() => {
  if (!vts.macroRunning) return null
  const m = vts.macros.find(x => x.id === vts.macroRunning!.macroId)
  return {
    name: m?.name ?? '宏',
    step: vts.macroRunning.stepIndex + 1,
    total: vts.macroRunning.totalSteps,
    percent: Math.round(((vts.macroRunning.stepIndex + 1) / vts.macroRunning.totalSteps) * 100),
  }
})
</script>

<template>
  <NFlex vertical :size="12">
    <ClientPageHeader title="VTube Studio" description="通过 VTS API 控制表情动作、机位、道具和参数" />

    <NAlert v-if="!isTauri()" type="error">
      当前不是桌面客户端环境
    </NAlert>

    <template v-else>
      <NCard size="small" class="vts-status-bar">
        <NFlex align="center" justify="space-between" :wrap="true" :size="8">
          <NFlex align="center" :size="8">
            <NTag :type="statusType" size="small">
              {{ statusText }}
            </NTag>
            <NText v-if="vts.currentModelName" depth="3">
              {{ vts.currentModelName }}
            </NText>
            <NText v-if="vts.statistics?.framerate" depth="3">
              {{ vts.statistics.framerate }} FPS
            </NText>
            <NText v-if="vts.lastRttMs != null" depth="3">
              {{ vts.lastRttMs }}ms
            </NText>
          </NFlex>
          <NFlex align="center" :size="6">
            <NButton v-if="!vts.connected" size="tiny" type="primary" :loading="vts.connecting" @click="run(() => vts.connect())">
              连接
            </NButton>
            <NButton v-if="vts.connected" size="tiny" @click="vts.disconnect">
              断开
            </NButton>
            <NButton size="tiny" quaternary @click="showConnectionDetail = !showConnectionDetail">
              {{ showConnectionDetail ? '收起' : '详情' }}
            </NButton>
          </NFlex>
        </NFlex>
        <NAlert v-if="vts.lastError" type="error" :show-icon="false" style="margin-top: 8px">
          {{ vts.lastError }}
        </NAlert>
      </NCard>

      <Transition name="vts-slide">
        <VtsConnectionCard v-if="showConnectionDetail" />
      </Transition>

      <!-- 宏执行进度 -->
      <Transition name="vts-slide">
        <NCard v-if="macroProgress" size="small">
          <NFlex align="center" :size="10">
            <NText strong>
              {{ macroProgress.name }}
            </NText>
            <NText depth="3">
              {{ macroProgress.step }}/{{ macroProgress.total }}
            </NText>
            <NProgress type="line" :percentage="macroProgress.percent" :show-indicator="false" style="flex: 1; min-width: 100px" />
          </NFlex>
        </NCard>
      </Transition>

      <!-- 快捷操作栏 -->
      <Transition name="vts-fade">
        <NCard v-if="favoriteHotkeys.length > 0 || vts.macros.length > 0 || vts.presets.length > 0" size="small">
          <NFlex :wrap="true" :size="6">
            <TransitionGroup name="vts-btn">
              <NTooltip v-for="hk in favoriteHotkeys" :key="hk.hotkeyID" trigger="hover">
                <template #trigger>
                  <NButton size="small" :disabled="!vts.canOperate" @click="run(() => vts.triggerHotkey(hk.hotkeyID))">
                    {{ vts.hotkeyCustomizations.find(c => c.hotkeyID === hk.hotkeyID)?.displayName || hk.name }}
                  </NButton>
                </template>
                {{ hk.name }}{{ hk.description ? ` - ${hk.description}` : '' }}
              </NTooltip>
              <NButton v-for="m in vts.macros" :key="m.id" size="small" type="primary" ghost :disabled="!vts.canOperate || !!vts.macroRunning" @click="run(() => vts.runMacro(m.id))">
                {{ m.name }}
              </NButton>
              <NButton v-for="p in vts.presets" :key="p.id" size="small" secondary :disabled="!vts.canOperate" @click="run(() => vts.applyPreset(p.id))">
                {{ p.name }}
              </NButton>
            </TransitionGroup>
          </NFlex>
        </NCard>
      </Transition>

      <NTabs v-model:value="tab" type="line" animated>
        <NTabPane name="control" tab="控制">
          <NFlex vertical :size="12">
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

        <NTabPane name="items" tab="道具与参数">
          <NFlex vertical :size="12">
            <VtsItemPanel />
            <VtsParameterPanel />
          </NFlex>
        </NTabPane>

        <NTabPane name="settings" tab="设置">
          <NFlex vertical :size="12">
            <VtsShortcutPanel />
            <VtsObsLinkPanel />
            <VtsFloatWindowPanel />
            <VtsProfilePanel />
            <VtsImportExportCard />
            <VtsHistoryPanel />

            <NCard v-if="linkedAutoActions.length > 0" size="small" title="关联的自动动作">
              <NFlex vertical :size="8">
                <NText depth="3">
                  以下自动动作绑定了 VTS 操作
                </NText>
                <NFlex v-for="a in linkedAutoActions" :key="a.id" align="center" justify="space-between" :wrap="true" :size="8">
                  <NFlex align="center" :size="8">
                    <NTag :type="a.enabled ? 'success' : 'default'" size="small">
                      {{ a.enabled ? '启用' : '禁用' }}
                    </NTag>
                    <NText>{{ a.name || '未命名' }}</NText>
                    <NText depth="3">
                      {{ a.actionType }}
                    </NText>
                  </NFlex>
                  <NButton size="small" @click="router.push({ name: 'client-auto-action-manage' })">
                    编辑
                  </NButton>
                </NFlex>
              </NFlex>
            </NCard>
          </NFlex>
        </NTabPane>
      </NTabs>
    </template>
  </NFlex>
</template>

<style scoped>
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

.vts-btn-enter-active {
  transition: all 0.2s ease;
}
.vts-btn-enter-from {
  opacity: 0;
  transform: scale(0.9);
}
.vts-btn-leave-active {
  transition: all 0.15s ease;
}
.vts-btn-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
