<script setup lang="ts">
import type { LiveControl } from '@/apps/client/composables/useLiveControl'

const props = defineProps<{ control: LiveControl }>()
const obsStore = props.control.obsStore

const handleToggleConnect = () => {
  if (obsStore.obsConnected) {
    obsStore.handleObsDisconnect()
  } else {
    obsStore.handleObsConnect()
  }
}
</script>

<template>
  <UCard
    embedded
    size="small"
    class="live-manage-card"
  >
    <template #header>
      <div
        align="center"
        justify="space-between"
      >
        <span strong> OBS 控制 / 统计 </span>
        <UTooltip placement="bottom">
          <span
            depth="3"
            style="font-size: 12px; cursor: help"
          >
            使用说明
          </span>
          <template #content>
            <div style="max-width: 260px">
              <p style="margin: 0 0 8px">在 OBS 中开启 WebSocket：</p>
              <ol style="padding-left: 18px; margin: 0">
                <li>在 OBS 菜单中选择「工具 - WebSocket 服务器设置」</li>
                <li>选择「开启 WebSocket 服务器」</li>
                <li>服务器密码选择手动输入或点击「生成密码」自动生成，也可留空</li>
                <li>点击「应用」</li>
                <li>点击「显示连接信息」，记下端口与密码</li>
              </ol>
              <p style="margin: 8px 0 0">在上方输入对应的连接信息，点击「连接」即可</p>
            </div>
          </template>
        </UTooltip>
      </div>
    </template>
    <div
      vertical
      :size="16"
    >
      <div
        align="center"
        justify="space-between"
      >
        <UButton
          :color="obsStore.obsStreamActive ? 'error' : 'success'"
          :disabled="!obsStore.obsConnected"
          :loading="obsStore.isTogglingObsStream"
          @click="obsStore.handleObsToggleStream"
        >
          {{ obsStore.obsStreamActive ? '停止推流' : '开始推流' }}
        </UButton>

        <UBadge
          v-if="obsStore.obsStreamReconnecting"
          type="warning"
          size="small"
        >
          重连中
        </UBadge>
      </div>

      <div
        vertical
        :size="8"
      >
        <div>
          <UInput
            v-model="obsStore.obsAddress"
            placeholder="OBS WebSocket 地址 (默认: ws://127.0.0.1:4455)"
            :disabled="obsStore.obsConnected"
          />
          <UInput
            v-model="obsStore.obsPassword"
            type="password"
            placeholder="OBS WebSocket 密码 (可选)"
            :disabled="obsStore.obsConnected"
            show-password-on="click"
          />
        </div>

        <div
          align="center"
          justify="space-between"
        >
          <UButton
            :color="obsStore.obsConnected ? 'neutral' : 'primary'"
            :loading="obsStore.obsConnecting"
            @click="handleToggleConnect"
          >
            {{ obsStore.obsConnected ? '断开 OBS' : '连接 OBS' }}
          </UButton>

          <UBadge
            :type="obsStore.obsConnected ? (obsStore.obsStreamActive ? 'success' : 'info') : 'default'"
            size="medium"
          >
            {{ obsStore.obsConnected ? (obsStore.obsStreamActive ? '已连接 · 正在推流' : '已连接') : '未连接' }}
          </UBadge>
        </div>

        <UAlert
          v-if="obsStore.obsError"
          type="error"
          size="small"
        >
          {{ obsStore.obsError }}
        </UAlert>
      </div>

      <!-- __STATS__ -->
      <div
        :x-gap="12"
        :y-gap="12"
        responsive="screen"
        item-responsive
        cols="1 s:2 m:3"
      >
        <div>
          <div label="码率">
            {{ obsStore.obsStats.bitrateKbps != null ? `${obsStore.obsStats.bitrateKbps.toFixed(0)} kbps` : '—' }}
          </div>
        </div>
        <div>
          <div label="帧率">
            {{ obsStore.obsStats.fps != null ? `${obsStore.obsStats.fps.toFixed(1)} fps` : '—' }}
          </div>
        </div>
        <div>
          <div label="丢帧（输出）">
            <UTooltip
              v-if="
                obsStore.obsStats.outputSkippedFrames != null &&
                obsStore.obsStats.outputTotalFrames != null &&
                obsStore.obsStats.outputTotalFrames > 0
              "
            >
              <span style="cursor: help">
                {{ ((obsStore.obsStats.outputSkippedFrames / obsStore.obsStats.outputTotalFrames) * 100).toFixed(2) }}%
              </span>
              <template #content>
                {{ obsStore.obsStats.outputSkippedFrames }} / {{ obsStore.obsStats.outputTotalFrames }}
              </template>
            </UTooltip>
            <template v-else> — </template>
          </div>
        </div>
        <div>
          <div label="CPU 使用率">
            {{ obsStore.obsStats.cpuUsage != null ? `${obsStore.obsStats.cpuUsage.toFixed(1)} %` : '—' }}
          </div>
        </div>
        <div>
          <div label="内存使用">
            {{ obsStore.obsStats.memoryUsage != null ? `${obsStore.obsStats.memoryUsage.toFixed(0)} MB` : '—' }}
          </div>
        </div>
        <div>
          <div label="渲染跳帧">
            <UTooltip
              v-if="
                obsStore.obsStats.renderSkippedFrames != null &&
                obsStore.obsStats.renderTotalFrames != null &&
                obsStore.obsStats.renderTotalFrames > 0
              "
            >
              <span style="cursor: help">
                {{ ((obsStore.obsStats.renderSkippedFrames / obsStore.obsStats.renderTotalFrames) * 100).toFixed(2) }}%
              </span>
              <template #content>
                {{ obsStore.obsStats.renderSkippedFrames }} / {{ obsStore.obsStats.renderTotalFrames }}
              </template>
            </UTooltip>
            <template v-else> — </template>
          </div>
        </div>
      </div>

      <!-- __SCENE__ -->
      <!-- OBS 场景控制 -->
      <USeparator style="margin: 0" />

      <span
        strong
        style="display: block"
      >
        OBS 场景控制
      </span>

      <!-- 场景切换 -->
      <div>
        <div
          align="center"
          justify="space-between"
          style="margin-bottom: 8px"
        >
          <span strong> 场景切换 </span>
          <UBadge
            :type="obsStore.currentObsScene ? 'success' : 'default'"
            size="small"
          >
            当前：{{ obsStore.currentObsScene || '未连接' }}
          </UBadge>
        </div>

        <div
          v-if="obsStore.obsScenes.length > 0"
          :size="8"
          wrap
        >
          <UBadge
            v-for="scene in obsStore.obsScenes"
            :key="scene"
            :type="scene === obsStore.currentObsScene ? 'primary' : 'default'"
            :bordered="scene !== obsStore.currentObsScene"
            size="medium"
            style="cursor: pointer"
            :loading="obsStore.isSwitchingScene"
            @click="
              () => {
                if (!obsStore.isSwitchingScene && scene !== obsStore.currentObsScene) {
                  obsStore.switchToScene(scene)
                }
              }
            "
          >
            {{ scene }}
          </UBadge>
        </div>
        <UEmpty
          v-else
          description="暂无可用场景"
          size="small"
        />
      </div>

      <!-- 场景配置 -->
      <USeparator style="margin: 0" />

      <span strong> 场景联动配置 </span>

      <div
        vertical
        :size="8"
      >
        <div
          align="center"
          justify="space-between"
        >
          <span>启用自动场景切换</span>
          <USwitch
            v-model="obsStore.obsSceneConfig.autoSwitchEnabled"
            @update:model-value="obsStore.saveSceneConfig"
          />
        </div>

        <div
          align="center"
          justify="space-between"
        >
          <div>
            <span>开播下播后自动切换 OBS 推流状态</span>
            <span
              depth="3"
              style="font-size: 12px; display: block; margin-top: 2px"
            >
              开播时自动开始推流，下播时自动停止推流
            </span>
          </div>
          <USwitch
            v-model="obsStore.obsSceneConfig.autoToggleStream"
            @update:model-value="obsStore.saveSceneConfig"
          />
        </div>
      </div>

      <template v-if="obsStore.obsSceneConfig.autoSwitchEnabled">
        <div
          vertical
          :size="12"
        >
          <div>
            <span strong> 开播场景 </span>
            <USelectMenu
              v-model="obsStore.obsSceneConfig.startScene"
              :items="obsStore.obsScenes.map((scene) => ({ label: scene, value: scene }))"
              placeholder="选择开播时自动切换的场景"
              :disabled="!obsStore.obsConnected || obsStore.obsScenes.length === 0"
              style="margin-top: 8px"
              @update:value="obsStore.saveSceneConfig"
              value-key="value"
            />
          </div>

          <div>
            <span strong> 下播场景 </span>
            <USelectMenu
              v-model="obsStore.obsSceneConfig.stopScene"
              :items="obsStore.obsScenes.map((scene) => ({ label: scene, value: scene }))"
              placeholder="选择下播时自动切换的场景"
              :disabled="!obsStore.obsConnected || obsStore.obsScenes.length === 0"
              style="margin-top: 8px"
              @update:value="obsStore.saveSceneConfig"
              value-key="value"
            />
          </div>

          <div>
            <span strong> 等待场景 </span>
            <USelectMenu
              v-model="obsStore.obsSceneConfig.waitingScene"
              :items="obsStore.obsScenes.map((scene) => ({ label: scene, value: scene }))"
              placeholder="选择等待直播时的场景（可选）"
              :disabled="!obsStore.obsConnected || obsStore.obsScenes.length === 0"
              style="margin-top: 8px"
              @update:value="obsStore.saveSceneConfig"
              value-key="value"
            />
          </div>
        </div>
      </template>

      <!-- 错误提示 -->
      <UAlert
        v-if="obsStore.obsSceneError"
        type="error"
        size="small"
      >
        {{ obsStore.obsSceneError }}
      </UAlert>

      <!-- 帮助提示 -->
      <span
        depth="3"
        style="font-size: 12px; display: block"
      >
        配置场景联动后，开播/下播时会自动切换到对应的场景。请确保 OBS 中已创建相应的场景。
      </span>
    </div>
  </UCard>
</template>
