<script setup lang="ts">
import { getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { disable, enable, isEnabled } from '@tauri-apps/plugin-autostart'
import { h, onMounted, ref, resolveComponent, watch } from 'vue'
import { useRoute } from 'vue-router'

import { ThemeType } from '@/api/api-models'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import LabelItem from '@/apps/client/components/LabelItem.vue'
import ClientBackupPanel from '@/apps/client/components/settings/ClientBackupPanel.vue'
import ClientTranscriptionPanel from '@/apps/client/components/settings/ClientTranscriptionPanel.vue'
import type { NotificationType } from '@/apps/client/store/useSettings'
import { useSettings } from '@/apps/client/store/useSettings'
import { usePersistedStorage } from '@/shared/storage/persist'
import { useWebFetcher } from '@/store/useWebFetcher'

// --- State ---

const route = useRoute()
const currentTab = ref((route.query.tab as string) || 'general')
const isLoading = ref(true)
const errorMsg = ref<string | null>(null)
const titleClickCount = ref(0) // 添加计数器状态变量
let resetTimeout: number | null = null // 用于重置计数器的超时ID

const setting = useSettings()
const currentVersion = await getVersion()

// 更新检查
const isCheckingUpdate = ref(false)
const handleCheckUpdate = async () => {
  isCheckingUpdate.value = true
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()

    if (update) {
      useToast().add({ title: `发现新版本 ${update.version}，正在下载更新...`, color: 'info' })

      // 下载并安装更新
      await update.downloadAndInstall()

      useToast().add({ title: '更新已下载，重启应用以完成更新', color: 'success' })

      // 询问是否立即重启
      const { relaunch } = await import('@tauri-apps/plugin-process')
      setTimeout(() => {
        void useWebFetcher()
          .Stop()
          .catch((err) => console.warn('重启前停止 EventFetcher 失败:', err))
          .then(() => relaunch())
      }, 2000)
    } else {
      useToast().add({ title: '当前已是最新版本', color: 'success' })
    }
  } catch (err: any) {
    console.error('检查更新失败:', err)
    useToast().add({ title: `检查更新失败: ${err}`, color: 'error' })
  } finally {
    isCheckingUpdate.value = false
  }
}

// Navigation
const navOptions: any[] = [
  { label: '常规', key: 'general' },
  { label: '通知', key: 'notification' },
  { label: '语音转写', key: 'transcription' },
  { label: '备份', key: 'backup' },
  { label: '其他', key: 'other' },
  { label: '关于', key: 'about' },
]

// Theme

const themeType = usePersistedStorage('Settings.Theme', ThemeType.Auto)

// Autostart Settings
const isStartOnBoot = ref(false)
const isUpdatingAutostart = ref(false)

// --- Lifecycle Hooks ---

onMounted(async () => {
  isLoading.value = true
  errorMsg.value = null
  try {
    isStartOnBoot.value = await isEnabled()
  } catch (err) {
    console.error('Failed to fetch autostart status:', err)
    errorMsg.value = '无法获取开机启动状态，请稍后重试。'
  } finally {
    isLoading.value = false
  }
})

// --- Watchers for Side Effects ---

watch(isStartOnBoot, async (newValue, oldValue) => {
  if (isLoading.value || newValue === oldValue) return

  errorMsg.value = null
  isUpdatingAutostart.value = true
  try {
    if (newValue) {
      await enable()
    } else {
      await disable()
    }
  } catch (err) {
    console.error('Failed to update autostart status:', err)
    errorMsg.value = `设置开机启动失败: ${err instanceof Error ? err.message : '未知错误'}`
    isStartOnBoot.value = oldValue
    useToast().add({ title: '设置开机启动失败', color: 'error' })
  } finally {
    isUpdatingAutostart.value = false
  }
})

function renderNotificationEnable(name: NotificationType) {
  return h(
    resolveComponent('UCheckbox'),
    {
      modelValue: setting.settings.notificationSettings?.enableTypes.includes(name),
      onUpdateModelValue: (value: boolean) => {
        setting.settings.notificationSettings.enableTypes ??= []
        if (value) {
          setting.settings.notificationSettings.enableTypes.push(name)
        } else {
          setting.settings.notificationSettings.enableTypes = setting.settings.notificationSettings.enableTypes.filter(
            (type) => type !== name,
          )
        }
        setting.save()
      },
    },
    () => '启用',
  )
}

// --- 隐藏功能处理函数 ---
function handleTitleClick() {
  titleClickCount.value++

  if (resetTimeout !== null) {
    clearTimeout(resetTimeout)
  }

  resetTimeout = setTimeout(() => {
    titleClickCount.value = 0
  }, 3000) as unknown as number

  if (titleClickCount.value === 10) {
    invoke('open_dev_tools').then(() => {
      useToast().add({ title: '已打开 Dev Tools', color: 'success' })
    })
  }
}
</script>

<template>
  <div
    vertical
    :size="12"
    class="client-readable"
  >
    <UCard
      size="small"
      bordered
    >
      <ClientPageHeader>
        <template #title>
          <span
            strong
            @click="handleTitleClick"
          >
            设置
          </span>
        </template>
        <template #description> 客户端行为、外观与通知偏好 </template>
      </ClientPageHeader>
    </UCard>

    <div
      cols="24"
      item-responsive
      responsive="screen"
      :x-gap="12"
      :y-gap="12"
    >
      <div span="24 900:6">
        <UCard
          size="small"
          bordered
          content-style="padding: 0;"
        >
          <UNavigationMenu
            v-model="currentTab"
            :items="navOptions"
            :indent="18"
          />
        </UCard>
      </div>

      <div span="24 900:18">
        <div :show="isLoading">
          <div
            vertical
            :size="12"
          >
            <UAlert
              v-if="errorMsg"
              title="操作错误"
              type="error"
              size="small"
              closable
              @close="errorMsg = null"
            >
              {{ errorMsg }}
            </UAlert>

            <Transition
              name="fade"
              mode="out-in"
            >
              <div :key="currentTab">
                <template v-if="currentTab === 'general'">
                  <div
                    vertical
                    :size="12"
                  >
                    <UCard
                      title="启动"
                      size="small"
                      bordered
                    >
                      <div
                        vertical
                        :size="8"
                        align="start"
                      >
                        <LabelItem
                          label="开机时启动应用"
                          label-placement="left"
                        >
                          <USwitch
                            v-model="isStartOnBoot"
                            :disabled="isLoading || isUpdatingAutostart"
                            :loading="isUpdatingAutostart"
                          />
                        </LabelItem>
                        <LabelItem
                          v-if="isStartOnBoot"
                          label="启动后最小化到托盘"
                          label-placement="left"
                        >
                          <USwitch
                            v-model="setting.settings.bootAsMinimized"
                            @update:model-value="setting.save()"
                          />
                        </LabelItem>
                      </div>
                    </UCard>

                    <UCard
                      title="外观"
                      size="small"
                      bordered
                    >
                      <UFormField
                        label="主题模式"
                        label-placement="left"
                      >
                        <URadioGroup
                          v-model="themeType"
                          name="theme-mode"
                          :items="[
                            { label: '亮色', value: ThemeType.Light },
                            { label: '暗色', value: ThemeType.Dark },
                            { label: '跟随系统', value: ThemeType.Auto },
                          ]"
                          orientation="horizontal"
                        />
                      </UFormField>
                    </UCard>
                  </div>
                </template>

                <template v-else-if="currentTab === 'notification'">
                  <UCard
                    title="通知"
                    size="small"
                    bordered
                  >
                    <UAlert
                      type="warning"
                      size="small"
                      :bordered="false"
                    >
                      未完全完成
                    </UAlert>
                    <USeparator />
                    <div
                      vertical
                      :size="12"
                    >
                      <UCheckbox
                        v-model="setting.settings.enableNotification"
                        @update:model-value="() => setting.save()"
                      >
                        启用通知
                      </UCheckbox>

                      <template v-if="setting.settings.enableNotification">
                        <UCard
                          size="small"
                          bordered
                          title="提问箱通知"
                        >
                          <template #header-extra>
                            <component :is="renderNotificationEnable('question-box')" />
                          </template>
                        </UCard>
                        <UCard
                          size="small"
                          bordered
                          title="积分兑换通知"
                        >
                          <template #header-extra>
                            <component :is="renderNotificationEnable('goods-buy')" />
                          </template>
                        </UCard>
                        <UCard
                          size="small"
                          bordered
                          title="弹幕相关"
                        >
                          <template #header-extra>
                            <component :is="renderNotificationEnable('danmaku')" />
                          </template>
                        </UCard>
                        <UCard
                          size="small"
                          bordered
                          title="私信失败通知"
                        >
                          <template #header-extra>
                            <component :is="renderNotificationEnable('message-failed')" />
                          </template>
                          <span depth="3"> 当 B 站私信发送失败时通知你 </span>
                        </UCard>
                        <UCard
                          size="small"
                          bordered
                          title="弹幕发送失败通知"
                        >
                          <template #header-extra>
                            <component :is="renderNotificationEnable('live-danmaku-failed')" />
                          </template>
                          <span depth="3"> 当直播弹幕发送失败时通知你 </span>
                        </UCard>
                      </template>
                    </div>
                  </UCard>
                </template>

                <template v-else-if="currentTab === 'backup'">
                  <UCard
                    title="备份"
                    size="small"
                    bordered
                  >
                    <ClientBackupPanel />
                  </UCard>
                </template>

                <template v-else-if="currentTab === 'transcription'">
                  <UCard
                    title="语音转写"
                    size="small"
                    bordered
                  >
                    <ClientTranscriptionPanel />
                  </UCard>
                </template>

                <template v-else-if="currentTab === 'other'">
                  <UCard
                    title="其他"
                    size="small"
                    bordered
                  >
                    <span depth="3"> 其他设置将显示在这里。 </span>
                  </UCard>
                </template>

                <template v-else-if="currentTab === 'about'">
                  <UCard
                    title="关于"
                    size="small"
                    bordered
                  >
                    <template #header-extra>
                      <div
                        style="width: 10px; height: 10px"
                        @click="$router.push({ name: 'client-test' })"
                      />
                    </template>
                    <div
                      vertical
                      :size="8"
                    >
                      <span depth="3"> VTsuruEventFetcher Tauri </span>
                      <span depth="3"> 版本: {{ currentVersion }} </span>
                      <div>
                        <span depth="3"> 作者: </span>
                        <UButton
                          tag="a"
                          href="https://space.bilibili.com/10021741"
                          target="_blank"
                          color="info"
                          variant="link"
                        >
                          Megghy
                        </UButton>
                      </div>
                      <div>
                        <span depth="3"> 仓库: </span>
                        <UButton
                          tag="a"
                          href="https://github.com/Megghy/vtsuru.live/tree/master/src/client"
                          target="_blank"
                          color="info"
                          variant="link"
                        >
                          界面/逻辑
                        </UButton>
                        <USeparator vertical />
                        <UButton
                          tag="a"
                          href="https://github.com/Megghy/vtsuru-fetcher-client"
                          target="_blank"
                          color="info"
                          variant="link"
                        >
                          Tauri 客户端
                        </UButton>
                      </div>
                      <span depth="3"> 反馈: 🐧 873260337 </span>
                      <USeparator />
                      <div
                        align="center"
                        justify="space-between"
                      >
                        <span>检查更新</span>
                        <UButton
                          size="small"
                          :loading="isCheckingUpdate"
                          @click="handleCheckUpdate"
                        >
                          检查更新
                        </UButton>
                      </div>
                    </div>
                  </UCard>
                </template>
              </div>
            </Transition>
          </div>
          <span>正在加载设置...</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
