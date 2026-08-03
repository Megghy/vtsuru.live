<script setup lang="ts">
import { error as logError } from '@tauri-apps/plugin-log'
import { onMounted, ref } from 'vue'

import { useCooldown } from '@/apps/client/composables/useCooldown'
import type { CookieCloudConfig } from '@/apps/client/store/useBiliCookie'
import { COOKIE_CLOUD_KEY, useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useTauriStore } from '@/apps/client/store/useTauriStore'

const biliCookie = useBiliCookie()
const toast = useToast()
const feedback = (color: 'success' | 'error' | 'warning' | 'info', title: string) => {
  toast.add({ title, color })
}

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
    feedback('success', 'Cookie Cloud 配置已保存')
  } catch (err: any) {
    feedback('error', err?.message || String(err) || '保存配置失败')
  } finally {
    isLoadingCookiecloud.value = false
  }
}

async function manualSyncFromCloud() {
  if (syncCooldown.isCoolingDown()) {
    feedback('warning', `请等待 ${syncCooldown.remaining.value} 秒后再试`)
    return
  }
  try {
    isSyncingFromCloud.value = true
    await biliCookie.check(true) // 强制从 CookieCloud 同步
    syncCooldown.trigger()
    if (biliCookie.isCookieValid) {
      feedback('success', 'Cookie 同步成功')
    } else {
      feedback('error', 'Cookie 同步失败或无效')
    }
  } catch (err: any) {
    logError(`手动同步 Cookie 失败: ${err}`)
    feedback('error', `同步失败: ${err?.message || String(err) || '未知错误'}`)
  } finally {
    isSyncingFromCloud.value = false
  }
}

async function manualCheckCookie() {
  if (checkCooldown.isCoolingDown()) {
    feedback('warning', `请等待 ${checkCooldown.remaining.value} 秒后再试`)
    return
  }
  try {
    isCheckingCookie.value = true
    await biliCookie.check(false) // 只检查本地 Cookie
    checkCooldown.trigger()
    if (biliCookie.isCookieValid) {
      feedback('success', 'Cookie 有效')
    } else {
      feedback('error', 'Cookie 已失效')
    }
  } catch (err: any) {
    logError(`手动检查 Cookie 失败: ${err}`)
    feedback('error', `检查失败: ${err?.message || String(err) || '未知错误'}`)
  } finally {
    isCheckingCookie.value = false
  }
}
</script>

<template>
  <UCard
    title="Cookie Cloud 配置"
    size="small"
    bordered
    style="width: 100%"
  >
    <template #header-extra>
      <UBadge
        :type="
          biliCookie.cookieCloudState === 'valid'
            ? 'success'
            : biliCookie.cookieCloudState === 'syncing'
              ? 'info'
              : biliCookie.cookieCloudState === 'invalid'
                ? 'error'
                : 'default'
        "
      >
        {{
          biliCookie.cookieCloudState === 'valid'
            ? '已配置'
            : biliCookie.cookieCloudState === 'syncing'
              ? '同步中'
              : biliCookie.cookieCloudState === 'invalid'
                ? '配置无效'
                : '未配置'
        }}
      </UBadge>
    </template>
    <div
      vertical
      :size="8"
    >
      <UAlert type="info"> 设置 CookieCloud 后扫码登陆的登陆信息将被覆盖 </UAlert>
      <div>
        <span> Key </span>
        <UInput
          v-model="cookieCloudData.key"
          placeholder="请输入 Key"
        />
      </div>
      <div>
        <span> Password </span>
        <UInput
          v-model="cookieCloudData.password"
          placeholder="请输入 Password"
          type="password"
          show-password-on="click"
        />
      </div>
      <div>
        <span> Host (可选) </span>
        <UInput
          v-model="cookieCloudData.host"
          default-value="https://cookie.vtsuru.live"
          clearable
          placeholder="请输入 Host (可选)"
        />
      </div>
      <div :size="8">
        <UButton
          v-if="biliCookie.cookieCloudState === 'invalid' || biliCookie.cookieCloudState === 'unset'"
          color="primary"
          :loading="isLoadingCookiecloud"
          @click="setCookieCloud"
        >
          保存配置
        </UButton>
        <UPopover>
          <UButton color="error"> 清除配置 </UButton>
          <template #content="{ close }">
            <div class="space-y-3 p-3">
              <div>确定要清除配置吗？</div>
              <div class="flex justify-end gap-2">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click="close"
                  >取消</UButton
                >
                <UButton
                  size="xs"
                  color="error"
                  @click="
                    async () => {
                      close()
                      await biliCookie.clearCookieCloudConfig()
                      cookieCloudData.key = ''
                      cookieCloudData.password = ''
                      cookieCloudData.host = 'https://cookie.vtsuru.live'
                      feedback('success', '配置已清除')
                    }
                  "
                  >确认</UButton
                >
              </div>
            </div>
          </template>
        </UPopover>
      </div>
      <USeparator style="margin: 0"> 手动操作 </USeparator>
      <div :size="8">
        <UTooltip>
          <UButton
            :disabled="biliCookie.cookieCloudState !== 'valid' || syncCooldown.remaining.value > 0"
            :loading="isSyncingFromCloud"
            @click="manualSyncFromCloud"
          >
            <template #leading>
              <UIcon name="i-lucide-circle" />
            </template>
            {{
              syncCooldown.remaining.value > 0 ? `同步 Cookie (${syncCooldown.remaining.value}s)` : '从云端同步 Cookie'
            }}
          </UButton>
          <template #content>
            {{
              biliCookie.cookieCloudState !== 'valid'
                ? '请先配置有效的 Cookie Cloud'
                : syncCooldown.remaining.value > 0
                  ? `请等待 ${syncCooldown.remaining.value} 秒`
                  : '手动从 Cookie Cloud 拉取最新的 Cookie'
            }}
          </template>
        </UTooltip>
        <UTooltip>
          <UButton
            :disabled="!biliCookie.hasBiliCookie || checkCooldown.remaining.value > 0"
            :loading="isCheckingCookie"
            @click="manualCheckCookie"
          >
            <template #leading>
              <UIcon name="i-lucide-circle" />
            </template>
            {{
              checkCooldown.remaining.value > 0 ? `检查状态 (${checkCooldown.remaining.value}s)` : '检查 Cookie 状态'
            }}
          </UButton>
          <template #content>
            {{
              !biliCookie.hasBiliCookie
                ? '当前没有 Cookie'
                : checkCooldown.remaining.value > 0
                  ? `请等待 ${checkCooldown.remaining.value} 秒`
                  : '手动检查当前 Cookie 的有效性'
            }}
          </template>
        </UTooltip>
      </div>
    </div>
  </UCard>
</template>
