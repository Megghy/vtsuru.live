<script setup lang="ts">
import { NAlert, NButton, NDivider, NFlex, NTabPane, NTabs, NTag, NText, useMessage } from 'naive-ui'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { isTauri } from '@/shared/config'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { useVtsFloatWindow, VTS_FLOAT_WINDOW_BROADCAST_CHANNEL } from '@/apps/client/store/useVtsFloatWindow'
import VtsHotkeyBoard from '@/apps/client/components/vts/VtsHotkeyBoard.vue'

const vts = useVtsStore()
const floatWindow = useVtsFloatWindow()
const message = useMessage()

const tab = ref<'hotkeys' | 'macros' | 'items' | 'panic'>('hotkeys')
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

onMounted(async () => {
  if (!isTauri()) return
  try {
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
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
})

onUnmounted(() => {
  bc?.close()
  bc = undefined
})

async function connect() {
  try {
    await vts.connect()
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

async function auth() {
  try {
    await vts.authenticate()
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

async function runMacro(macroId: string) {
  try {
    await vts.runMacro(macroId)
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

async function toggleAccessory(id: string, nextVisible: boolean) {
  try {
    await vts.toggleAccessory(id, nextVisible)
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

async function dropPrank(prank: { fileName: string, hotkeyID?: string }) {
  try {
    if (prank.hotkeyID) {
      await vts.triggerHotkey(prank.hotkeyID)
      return
    }
    if (!prank.fileName) {
      throw new Error('未配置 fileName 或 hotkey')
    }
    await vts.dropItem(prank.fileName, { x: 0, size: 1 })
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

async function calibrate() {
  try {
    await vts.panicCalibrate()
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}

async function resetPhysics() {
  try {
    await vts.panicResetPhysics()
  } catch (err) {
    message.error(err instanceof Error ? err.message : String(err))
  }
}
</script>

<template>
  <div class="vts-float" :style="{ opacity: floatWindow.settings.opacity }">
    <div class="vts-float__header" data-tauri-drag-region>
      <NFlex align="center" justify="space-between" :wrap="false" :size="8" style="width: 100%">
        <NFlex align="center" :wrap="false" :size="8">
          <NTag :type="connectionTag.type" size="small">
            {{ connectionTag.text }}
          </NTag>
          <NText depth="3" style="font-size: 12px">
            VTS 小窗
          </NText>
        </NFlex>
        <NFlex align="center" :wrap="false" :size="6">
          <NButton size="tiny" :disabled="vts.connecting || vts.connected" @click="connect">
            连接
          </NButton>
          <NButton size="tiny" :disabled="!vts.connected || vts.authenticated" @click="auth">
            鉴权
          </NButton>
          <NButton size="tiny" :disabled="!vts.connected" @click="vts.disconnect">
            断开
          </NButton>
        </NFlex>
      </NFlex>
    </div>

    <NAlert v-if="!isTauri()" type="error" :show-icon="false" style="margin: 8px">
      仅支持 Tauri 环境。
    </NAlert>

    <NAlert v-else-if="vts.lastError" type="error" :show-icon="false" style="margin: 8px">
      {{ vts.lastError }}
    </NAlert>

    <div class="vts-float__body">
      <NTabs v-model:value="tab" type="line" size="small" animated>
        <NTabPane name="hotkeys" tab="Hotkeys">
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
        </NTabPane>
        <NTabPane name="macros" tab="Macros">
          <NFlex vertical :size="8">
            <NText depth="3" style="font-size: 12px">
              Macro 串行执行，任一步失败直接报错。
            </NText>
            <NDivider style="margin: 4px 0" />
            <NFlex v-for="m in vts.macros" :key="m.id" align="center" justify="space-between" :size="8" :wrap="true">
              <NText>
                {{ m.name }}
              </NText>
              <NButton size="tiny" type="primary" :disabled="!vts.canOperate" @click="runMacro(m.id)">
                运行
              </NButton>
            </NFlex>
          </NFlex>
        </NTabPane>
        <NTabPane name="items" tab="Items">
          <NFlex vertical :size="10">
            <NText depth="3" style="font-size: 12px">
              配饰：实例显隐；整活：按文件掉落。
            </NText>
            <NDivider style="margin: 4px 0" />
            <NFlex vertical :size="8">
              <NText depth="3" style="font-size: 12px">
                配饰
              </NText>
              <NFlex v-for="a in vts.accessories" :key="a.id" align="center" justify="space-between" :wrap="true" :size="8">
                <NText>
                  {{ a.name }}
                </NText>
                <NButton size="tiny" :disabled="!vts.canOperate" @click="toggleAccessory(a.id, !a.visible)">
                  {{ a.visible ? '脱' : '戴' }}
                </NButton>
              </NFlex>
            </NFlex>

            <NDivider style="margin: 4px 0" />

            <NFlex vertical :size="8">
              <NText depth="3" style="font-size: 12px">
                整活（掉落）
              </NText>
              <NFlex v-for="p in vts.pranks" :key="p.id" align="center" justify="space-between" :wrap="true" :size="8">
                <NText>
                  {{ p.name }}
                </NText>
                <NButton size="tiny" type="warning" :disabled="!vts.canOperate" @click="dropPrank({ fileName: p.fileName, hotkeyID: p.hotkeyID })">
                  掉落
                </NButton>
              </NFlex>
            </NFlex>
          </NFlex>
        </NTabPane>
        <NTabPane name="panic" tab="Panic">
          <NFlex vertical :size="10">
            <NText depth="3" style="font-size: 12px">
              通过 Hotkey 实现：需要先在主界面配置对应 hotkeyID。
            </NText>
            <NFlex :wrap="true" :size="8">
              <NButton size="small" type="primary" :disabled="!vts.canOperate" @click="calibrate">
                一键校准
              </NButton>
              <NButton size="small" type="warning" :disabled="!vts.canOperate" @click="resetPhysics">
                物理重置
              </NButton>
            </NFlex>
          </NFlex>
        </NTabPane>
      </NTabs>
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
