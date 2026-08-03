<script setup lang="ts">
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { useVtsAction } from '@/apps/client/components/vts/useVtsAction'
import VtsHotkeyBoard from '@/apps/client/components/vts/VtsHotkeyBoard.vue'
import { useVtsFloatWindow, VTS_FLOAT_WINDOW_BROADCAST_CHANNEL } from '@/apps/client/store/useVtsFloatWindow'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { isTauri } from '@/shared/config'

const vts = useVtsStore()
const floatWindow = useVtsFloatWindow()
const { run } = useVtsAction()

const tab = ref<'hotkeys' | 'macros' | 'items' | 'panic'>('hotkeys')
const tabItems = [
  { label: '表情动作', value: 'hotkeys' },
  { label: '宏', value: 'macros' },
  { label: '道具', value: 'items' },
  { label: '应急', value: 'panic' },
]
let bc: BroadcastChannel | undefined

const connectionTag = computed(() => {
  if (!vts.connected) return { type: 'error' as const, text: '未连接' }
  if (!vts.authenticated) return { type: 'warning' as const, text: '未鉴权' }
  return { type: 'success' as const, text: '已连接' }
})

async function applyToCurrentWindow() {
  if (!isTauri()) return
  const w = getCurrentWebviewWindow()
  await w.setAlwaysOnTop(floatWindow.settings.alwaysOnTop)
  await w.setIgnoreCursorEvents(floatWindow.settings.clickThrough)
}

onMounted(() => {
  if (!isTauri()) return
  run(async () => {
    await floatWindow.init()
    await vts.init()
    await applyToCurrentWindow()
    bc = new BroadcastChannel(VTS_FLOAT_WINDOW_BROADCAST_CHANNEL)
    bc.onmessage = async (event) => {
      if (event.data?.type === 'update-setting') {
        floatWindow.applyIncomingSettings(event.data.data)
        await applyToCurrentWindow()
      }
    }
    bc.postMessage({ type: 'window-ready' })
    bc.postMessage({ type: 'update-setting', data: floatWindow.settings })
  })
})

onUnmounted(() => {
  bc?.close()
  bc = undefined
})
</script>

<template>
  <div
    class="vts-float"
    :style="{ opacity: floatWindow.settings.opacity }"
  >
    <div
      class="vts-float__header"
      data-tauri-drag-region
    >
      <div
        align="center"
        justify="space-between"
        :wrap="false"
        :size="8"
        style="width: 100%"
      >
        <div
          align="center"
          :wrap="false"
          :size="8"
        >
          <UBadge
            :type="connectionTag.type"
            size="small"
          >
            {{ connectionTag.text }}
          </UBadge>
          <span
            depth="3"
            style="font-size: 12px"
          >
            VTS 快捷面板
          </span>
        </div>
        <div
          align="center"
          :wrap="false"
          :size="6"
        >
          <UButton
            size="tiny"
            :disabled="vts.connecting || vts.connected"
            @click="run(() => vts.connect())"
          >
            连接
          </UButton>
          <UButton
            size="tiny"
            :disabled="!vts.connected || vts.authenticated"
            @click="run(() => vts.authenticate())"
          >
            鉴权
          </UButton>
          <UButton
            size="tiny"
            :disabled="!vts.connected"
            @click="vts.disconnect"
          >
            断开
          </UButton>
        </div>
      </div>
    </div>

    <UAlert
      v-if="!isTauri()"
      type="error"
      :show-icon="false"
      style="margin: 8px"
    >
      仅支持桌面客户端环境
    </UAlert>
    <UAlert
      v-else-if="vts.lastError"
      type="error"
      :show-icon="false"
      style="margin: 8px"
    >
      {{ vts.lastError }}
    </UAlert>

    <div class="vts-float__body">
      <div>
        <UTabs
          v-model="tab"
          :items="tabItems"
          :content="false"
          size="sm"
        />
        <section v-show="tab === 'hotkeys'">
          <VtsHotkeyBoard
            :hotkeys="vts.hotkeys"
            :model-name="vts.currentModelName"
            :disabled="!vts.canOperate"
            :embedded="true"
            :grid-cols="3"
            :show-search="false"
            :default-only-favorites="true"
            :show-model-name="false"
            @refresh="vts.refreshHotkeys"
            @trigger="vts.triggerHotkey"
          />
        </section>

        <section v-show="tab === 'macros'">
          <div
            vertical
            :size="8"
          >
            <span
              depth="3"
              style="font-size: 12px"
            >
              按顺序执行，任一步失败即终止
            </span>
            <USeparator style="margin: 4px 0" />
            <div
              v-for="m in vts.macros"
              :key="m.id"
              align="center"
              justify="space-between"
              :size="8"
            >
              <span>{{ m.name }}</span>
              <UButton
                size="tiny"
                color="primary"
                :disabled="!vts.canOperate"
                @click="run(() => vts.runMacro(m.id))"
              >
                运行
              </UButton>
            </div>
          </div>
        </section>

        <section v-show="tab === 'items'">
          <div
            vertical
            :size="10"
          >
            <span
              depth="3"
              style="font-size: 12px"
            >
              配饰: 切换显隐 | 整活: 掉落道具
            </span>
            <USeparator style="margin: 4px 0" />
            <div
              vertical
              :size="8"
            >
              <span
                depth="3"
                style="font-size: 12px"
              >
                配饰
              </span>
              <div
                v-for="a in vts.accessories"
                :key="a.id"
                align="center"
                justify="space-between"
                :size="8"
              >
                <span>{{ a.name }}</span>
                <UButton
                  size="tiny"
                  :disabled="!vts.canOperate"
                  @click="run(() => vts.toggleAccessory(a.id, !a.visible))"
                >
                  {{ a.visible ? '隐藏' : '显示' }}
                </UButton>
              </div>
            </div>
            <USeparator style="margin: 4px 0" />
            <div
              vertical
              :size="8"
            >
              <span
                depth="3"
                style="font-size: 12px"
              >
                整活
              </span>
              <div
                v-for="p in vts.pranks"
                :key="p.id"
                align="center"
                justify="space-between"
                :size="8"
              >
                <span>{{ p.name }}</span>
                <UButton
                  size="tiny"
                  color="warning"
                  :disabled="!vts.canOperate"
                  @click="
                    run(() =>
                      p.hotkeyID ? vts.triggerHotkey(p.hotkeyID) : vts.dropItem(p.fileName, { x: 0, size: 1 }),
                    )
                  "
                >
                  掉落
                </UButton>
              </div>
            </div>
          </div>
        </section>

        <section v-show="tab === 'panic'">
          <div
            vertical
            :size="10"
          >
            <span
              depth="3"
              style="font-size: 12px"
            >
              需要先在主界面配置对应热键
            </span>
            <div
              :wrap="true"
              :size="8"
            >
              <UButton
                size="small"
                color="primary"
                :disabled="!vts.canOperate"
                @click="run(() => vts.panicCalibrate())"
              >
                校准
              </UButton>
              <UButton
                size="small"
                color="warning"
                :disabled="!vts.canOperate"
                @click="run(() => vts.panicResetPhysics())"
              >
                重置物理
              </UButton>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vts-float {
  width: 100vw;
  height: 100vh;
  background: rgba(16, 16, 20, 0.65);
  border-radius: 10px;
  overflow: hidden;
}
.vts-float__header {
  height: 34px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  background: rgba(0, 0, 0, 0.35);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.vts-float__body {
  height: calc(100vh - 34px);
  padding: 8px;
  overflow: auto;
}
</style>
