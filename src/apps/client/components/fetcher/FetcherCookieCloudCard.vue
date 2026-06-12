<script setup lang="ts">
import type { CookieCloudConfig } from '@/apps/client/store/useBiliCookie'
import { CloudDownloadOutline, RefreshOutline } from '@vicons/ionicons5'
import { error as logError } from '@tauri-apps/plugin-log'
import { useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useCooldown } from '@/apps/client/composables/useCooldown'
import { COOKIE_CLOUD_KEY, useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useTauriStore } from '@/apps/client/store/useTauriStore'

const biliCookie = useBiliCookie()
const message = useMessage()

const COOLDOWN_DURATION = 5 * 1000 // 5 秒冷却

const cookieCloud = useTauriStore().getTarget<CookieCloudConfig>(COOKIE_CLOUD_KEY, {
  host: 'https://cookie.vtsuru.live',
  key: '',
  password: '',
})
const cookieCloudData = ref<CookieCloudConfig>({ host: 'https://cookie.vtsuru.live', key: '', password: '' })
onMounted(async () => {
  const stored = await cookieCloud.get()
  if (stored) cookieCloudData.value = stored
})
const isLoadingCookiecloud = ref(false)
const isSyncingFromCloud = ref(false)
const isCheckingCookie = ref(false)

const syncCooldown = useCooldown(COOLDOWN_DURATION)
const checkCooldown = useCooldown(COOLDOWN_DURATION)

async function setCookieCloud() {
  try {
    isLoadingCookiecloud.value = true
    await biliCookie.setCookieCloudConfig(cookieCloudData.value)
    message.success('Cookie Cloud 配置已保存')
  } catch (err: any) {
    message.error(err?.message || String(err) || '保存配置失败')
  } finally {
    isLoadingCookiecloud.value = false
  }
}

async function manualSyncFromCloud() {
  if (syncCooldown.isCoolingDown()) {
    message.warning(`请等待 ${syncCooldown.remaining.value} 秒后再试`)
    return
  }
  try {
    isSyncingFromCloud.value = true
    await biliCookie.check(true) // 强制从 CookieCloud 同步
    syncCooldown.trigger()
    if (biliCookie.isCookieValid) {
      message.success('Cookie 同步成功')
    } else {
      message.error('Cookie 同步失败或无效')
    }
  } catch (err: any) {
    logError(`手动同步 Cookie 失败: ${err}`)
    message.error(`同步失败: ${err?.message || String(err) || '未知错误'}`)
  } finally {
    isSyncingFromCloud.value = false
  }
}

async function manualCheckCookie() {
  if (checkCooldown.isCoolingDown()) {
    message.warning(`请等待 ${checkCooldown.remaining.value} 秒后再试`)
    return
  }
  try {
    isCheckingCookie.value = true
    await biliCookie.check(false) // 只检查本地 Cookie
    checkCooldown.trigger()
    if (biliCookie.isCookieValid) {
      message.success('Cookie 有效')
    } else {
      message.error('Cookie 已失效')
    }
  } catch (err: any) {
    logError(`手动检查 Cookie 失败: ${err}`)
    message.error(`检查失败: ${err?.message || String(err) || '未知错误'}`)
  } finally {
    isCheckingCookie.value = false
  }
}
</script>

<template>
  <NCard
    title="Cookie Cloud 配置"
    size="small"
    bordered
    style="width: 100%; margin-bottom: 12px;"
  >
    <template #header-extra>
      <NTag
        :type="biliCookie.cookieCloudState === 'valid' ? 'success' : biliCookie.cookieCloudState === 'syncing' ? 'info' : biliCookie.cookieCloudState === 'invalid' ? 'error' : 'default'"
      >
        {{
          biliCookie.cookieCloudState === 'valid' ? '已配置'
          : biliCookie.cookieCloudState === 'syncing' ? '同步中'
            : biliCookie.cookieCloudState === 'invalid' ? '配置无效' : '未配置'
        }}
      </NTag>
    </template>
    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
      <NAlert type="info">
        设置 CookieCloud 后扫码登陆的登陆信息将被覆盖
      </NAlert>
      <NInputGroup>
        <NInputGroupLabel>
          Key
        </NInputGroupLabel>
        <NInput v-model:value="cookieCloudData.key" placeholder="请输入 Key" />
      </NInputGroup>
      <NInputGroup>
        <NInputGroupLabel>
          Password
        </NInputGroupLabel>
        <NInput
          v-model:value="cookieCloudData.password"
          placeholder="请输入 Password"
          type="password"
          show-password-on="click"
        />
      </NInputGroup>
      <NInputGroup>
        <NInputGroupLabel>
          Host (可选)
        </NInputGroupLabel>
        <NInput
          v-model:value="cookieCloudData.host"
          default-value="https://cookie.vtsuru.live"
          clearable
          placeholder="请输入 Host (可选)"
        />
      </NInputGroup>
      <NFlex gap="small">
        <NButton
          v-if="biliCookie.cookieCloudState === 'invalid' || biliCookie.cookieCloudState === 'unset'"
          type="primary"
          :loading="isLoadingCookiecloud"
          @click="setCookieCloud"
        >
          保存配置
        </NButton>
        <NPopconfirm
          v-else
          type="error"
          @positive-click="async () => {
            await biliCookie.clearCookieCloudConfig();
            cookieCloudData.key = '';
            cookieCloudData.password = '';
            cookieCloudData.host = 'https://cookie.vtsuru.live';
            message.success('配置已清除');
          }"
        >
          <template #trigger>
            <NButton type="error">
              清除配置
            </NButton>
          </template>
          确定要清除配置吗？
        </NPopconfirm>
      </NFlex>
      <NDivider style="margin: 8px 0;">
        手动操作
      </NDivider>
      <NFlex gap="small">
        <NTooltip>
          <template #trigger>
            <NButton
              :disabled="biliCookie.cookieCloudState !== 'valid' || syncCooldown.remaining.value > 0"
              :loading="isSyncingFromCloud"
              @click="manualSyncFromCloud"
            >
              <template #icon>
                <NIcon :component="CloudDownloadOutline" />
              </template>
              {{ syncCooldown.remaining.value > 0 ? `同步 Cookie (${syncCooldown.remaining.value}s)` : '从云端同步 Cookie' }}
            </NButton>
          </template>
          {{ biliCookie.cookieCloudState !== 'valid' ? '请先配置有效的 Cookie Cloud' : syncCooldown.remaining.value > 0 ? `请等待 ${syncCooldown.remaining.value} 秒` : '手动从 Cookie Cloud 拉取最新的 Cookie' }}
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <NButton
              :disabled="!biliCookie.hasBiliCookie || checkCooldown.remaining.value > 0"
              :loading="isCheckingCookie"
              @click="manualCheckCookie"
            >
              <template #icon>
                <NIcon :component="RefreshOutline" />
              </template>
              {{ checkCooldown.remaining.value > 0 ? `检查状态 (${checkCooldown.remaining.value}s)` : '检查 Cookie 状态' }}
            </NButton>
          </template>
          {{ !biliCookie.hasBiliCookie ? '当前没有 Cookie' : checkCooldown.remaining.value > 0 ? `请等待 ${checkCooldown.remaining.value} 秒` : '手动检查当前 Cookie 的有效性' }}
        </NTooltip>
      </NFlex>
    </div>
  </NCard>
</template>
