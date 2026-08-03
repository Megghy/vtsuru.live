<script setup lang="ts">
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
const { run } = useVtsAction()
const toast = useToast()
const router = useRouter()
const tab = ref<'control' | 'items' | 'settings'>('control')
const tabItems = [
  { label: '控制', value: 'control' },
  { label: '道具与参数', value: 'items' },
  { label: '设置', value: 'settings' },
]
const showConnectionDetail = ref(false)

onMounted(async () => {
  if (!isTauri()) return
  try {
    await vts.init()
  } catch (err) {
    toast.add({ title: err instanceof Error ? err.message : String(err), color: 'error' })
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
    name: m?.name ?? '宏',
    step: vts.macroRunning.stepIndex + 1,
    total: vts.macroRunning.totalSteps,
    percent: Math.round(((vts.macroRunning.stepIndex + 1) / vts.macroRunning.totalSteps) * 100),
  }
})
</script>

<template>
  <div
    vertical
    :size="12"
  >
    <ClientPageHeader
      title="VTube Studio"
      description="通过 VTS API 控制表情动作、机位、道具和参数"
    />

    <UAlert
      v-if="!isTauri()"
      type="error"
    >
      当前不是桌面客户端环境
    </UAlert>

    <template v-else>
      <UCard
        size="small"
        class="vts-status-bar"
      >
        <div
          align="center"
          justify="space-between"
          :wrap="true"
          :size="8"
        >
          <div
            align="center"
            :size="8"
          >
            <UBadge
              :type="statusType"
              size="small"
            >
              {{ statusText }}
            </UBadge>
            <span
              v-if="vts.currentModelName"
              depth="3"
            >
              {{ vts.currentModelName }}
            </span>
            <span
              v-if="vts.statistics?.framerate"
              depth="3"
            >
              {{ vts.statistics.framerate }} FPS
            </span>
            <span
              v-if="vts.lastRttMs != null"
              depth="3"
            >
              {{ vts.lastRttMs }}ms
            </span>
          </div>
          <div
            align="center"
            :size="8"
          >
            <UButton
              v-if="!vts.connected"
              size="tiny"
              color="primary"
              :loading="vts.connecting"
              @click="run(() => vts.connect())"
            >
              连接
            </UButton>
            <UButton
              v-if="vts.connected"
              size="tiny"
              @click="vts.disconnect"
            >
              断开
            </UButton>
            <UButton
              size="tiny"
              variant="ghost"
              @click="showConnectionDetail = !showConnectionDetail"
            >
              {{ showConnectionDetail ? '收起' : '详情' }}
            </UButton>
          </div>
        </div>
        <UAlert
          v-if="vts.lastError"
          type="error"
          :show-icon="false"
          style="margin-top: 8px"
        >
          {{ vts.lastError }}
        </UAlert>
      </UCard>

      <Transition name="vts-slide">
        <VtsConnectionCard v-if="showConnectionDetail" />
      </Transition>

      <!-- 宏执行进度 -->
      <Transition name="vts-slide">
        <UCard
          v-if="macroProgress"
          size="small"
        >
          <div
            align="center"
            :size="12"
          >
            <span strong>
              {{ macroProgress.name }}
            </span>
            <span depth="3"> {{ macroProgress.step }}/{{ macroProgress.total }} </span>
            <UProgress
              type="line"
              :percentage="macroProgress.percent"
              :show-indicator="false"
              style="flex: 1; min-width: 100px"
            />
          </div>
        </UCard>
      </Transition>

      <!-- 快捷操作栏 -->
      <Transition name="vts-fade">
        <UCard
          v-if="favoriteHotkeys.length > 0 || vts.macros.length > 0 || vts.presets.length > 0"
          size="small"
        >
          <div
            :wrap="true"
            :size="8"
          >
            <TransitionGroup name="vts-btn">
              <UTooltip
                v-for="hk in favoriteHotkeys"
                :key="hk.hotkeyID"
              >
                <UButton
                  size="small"
                  :disabled="!vts.canOperate"
                  @click="run(() => vts.triggerHotkey(hk.hotkeyID))"
                >
                  {{ vts.hotkeyCustomizations.find((c) => c.hotkeyID === hk.hotkeyID)?.displayName || hk.name }}
                </UButton>
                <template #content> {{ hk.name }}{{ hk.description ? ` - ${hk.description}` : '' }} </template>
              </UTooltip>
              <UButton
                v-for="m in vts.macros"
                :key="m.id"
                size="small"
                color="primary"
                ghost
                :disabled="!vts.canOperate || !!vts.macroRunning"
                @click="run(() => vts.runMacro(m.id))"
              >
                {{ m.name }}
              </UButton>
              <UButton
                v-for="p in vts.presets"
                :key="p.id"
                size="small"
                variant="soft"
                :disabled="!vts.canOperate"
                @click="run(() => vts.applyPreset(p.id))"
              >
                {{ p.name }}
              </UButton>
            </TransitionGroup>
          </div>
        </UCard>
      </Transition>

      <div>
        <UTabs
          v-model="tab"
          :items="tabItems"
          :content="false"
        />
        <section v-show="tab === 'control'">
          <div
            vertical
            :size="12"
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
          </div>
        </section>

        <section v-show="tab === 'items'">
          <div
            vertical
            :size="12"
          >
            <VtsItemPanel />
            <VtsParameterPanel />
          </div>
        </section>

        <section v-show="tab === 'settings'">
          <div
            :default-expanded-names="['automation']"
            arrow-placement="right"
            class="client-readable"
          >
            <details
              title="自动化联动"
              name="automation"
            >
              <div
                vertical
                :size="16"
              >
                <VtsShortcutPanel />
                <VtsObsLinkPanel />
              </div>
            </details>
            <details
              title="窗口与配置"
              name="window"
            >
              <div
                vertical
                :size="16"
              >
                <VtsFloatWindowPanel />
                <VtsProfilePanel />
                <VtsImportExportCard />
              </div>
            </details>
            <details
              title="历史与诊断"
              name="diagnostics"
            >
              <div
                vertical
                :size="16"
              >
                <VtsHistoryPanel />
                <UCard
                  v-if="linkedAutoActions.length > 0"
                  size="small"
                  bordered
                  title="关联的自动动作"
                >
                  <div
                    vertical
                    :size="8"
                  >
                    <span depth="3"> 以下自动动作绑定了 VTS 操作 </span>
                    <div
                      v-for="a in linkedAutoActions"
                      :key="a.id"
                      align="center"
                      justify="space-between"
                      :wrap="true"
                      :size="8"
                    >
                      <div
                        align="center"
                        :size="8"
                      >
                        <UBadge
                          :type="a.enabled ? 'success' : 'default'"
                          size="small"
                        >
                          {{ a.enabled ? '启用' : '禁用' }}
                        </UBadge>
                        <span>{{ a.name || '未命名' }}</span>
                        <span depth="3">
                          {{ a.actionType }}
                        </span>
                      </div>
                      <UButton
                        size="small"
                        @click="router.push({ name: 'client-auto-action-manage' })"
                      >
                        编辑
                      </UButton>
                    </div>
                  </div>
                </UCard>
              </div>
            </details>
          </div>
        </section>
      </div>
    </template>
  </div>
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
