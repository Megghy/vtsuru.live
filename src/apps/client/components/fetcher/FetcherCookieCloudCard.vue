<script setup lang="ts">
import { error as logError } from '@tauri-apps/plugin-log'
import { CloudDownloadOutline, RefreshOutline } from '@vicons/ionicons5'
import { onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useCooldown } from '@/apps/client/composables/useCooldown'
import type { CookieCloudConfig } from '@/apps/client/store/useBiliCookie'
import { COOKIE_CLOUD_KEY, useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useTauriStore } from '@/apps/client/store/useTauriStore'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const biliCookie = useBiliCookie()

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
    toast.success('Cookie Cloud 配置已保存')
  } catch (err: any) {
    toast.error(err?.message || String(err) || '保存配置失败')
  } finally {
    isLoadingCookiecloud.value = false
  }
}

async function manualSyncFromCloud() {
  if (syncCooldown.isCoolingDown()) {
    toast.warning(`请等待 ${syncCooldown.remaining.value} 秒后再试`)
    return
  }
  try {
    isSyncingFromCloud.value = true
    await biliCookie.check(true) // 强制从 CookieCloud 同步
    syncCooldown.trigger()
    if (biliCookie.isCookieValid) {
      toast.success('Cookie 同步成功')
    } else {
      toast.error('Cookie 同步失败或无效')
    }
  } catch (err: any) {
    logError(`手动同步 Cookie 失败: ${err}`)
    toast.error(`同步失败: ${err?.message || String(err) || '未知错误'}`)
  } finally {
    isSyncingFromCloud.value = false
  }
}

async function manualCheckCookie() {
  if (checkCooldown.isCoolingDown()) {
    toast.warning(`请等待 ${checkCooldown.remaining.value} 秒后再试`)
    return
  }
  try {
    isCheckingCookie.value = true
    await biliCookie.check(false) // 只检查本地 Cookie
    checkCooldown.trigger()
    if (biliCookie.isCookieValid) {
      toast.success('Cookie 有效')
    } else {
      toast.error('Cookie 已失效')
    }
  } catch (err: any) {
    logError(`手动检查 Cookie 失败: ${err}`)
    toast.error(`检查失败: ${err?.message || String(err) || '未知错误'}`)
  } finally {
    isCheckingCookie.value = false
  }
}
</script>

<template>
  <Card class="border bg-card w-full">
    <CardHeader class="p-3 pb-2 border-b flex flex-row items-center justify-between">
      <CardTitle class="text-sm font-semibold">Cookie Cloud 配置</CardTitle>
      <Badge
        variant="outline"
        class="h-5 text-[10px]"
        :class="
          biliCookie.cookieCloudState === 'valid'
            ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
            : biliCookie.cookieCloudState === 'syncing'
              ? 'border-sky-500/40 text-sky-600 bg-sky-500/10'
              : biliCookie.cookieCloudState === 'invalid'
                ? 'border-destructive/40 text-destructive bg-destructive/10'
                : 'border-border text-muted-foreground'
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
      </Badge>
    </CardHeader>
    <CardContent class="p-3 space-y-3">
      <Alert class="py-2 px-2.5 border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
        <AlertDescription class="text-xs m-0"> 设置 CookieCloud 后扫码登陆的登陆信息将被覆盖 </AlertDescription>
      </Alert>

      <div class="space-y-2">
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground w-20 shrink-0">Key</span>
          <Input
            v-model="cookieCloudData.key"
            placeholder="请输入 Key"
            class="flex-1"
          />
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground w-20 shrink-0">Password</span>
          <Input
            v-model="cookieCloudData.password"
            placeholder="请输入 Password"
            type="password"
            class="flex-1"
          />
        </div>

        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground w-20 shrink-0">Host (可选)</span>
          <Input
            v-model="cookieCloudData.host"
            placeholder="请输入 Host (可选)"
            class="flex-1"
          />
        </div>
      </div>

      <div class="flex items-center gap-2 pt-1">
        <Button
          v-if="biliCookie.cookieCloudState === 'invalid' || biliCookie.cookieCloudState === 'unset'"
          :disabled="isLoadingCookiecloud"
          @click="setCookieCloud"
        >
          保存配置
        </Button>
        <Popconfirm
          v-else
          title="清除配置"
          @positive-click="
            async () => {
              await biliCookie.clearCookieCloudConfig()
              cookieCloudData.key = ''
              cookieCloudData.password = ''
              cookieCloudData.host = 'https://cookie.vtsuru.live'
              toast.success('配置已清除')
            }
          "
        >
          <template #trigger>
            <Button
              variant="outline"
              class="border-destructive/40 text-destructive hover:bg-destructive/10"
            >
              清除配置
            </Button>
          </template>
          确定要清除配置吗？
        </Popconfirm>
      </div>

      <div class="relative py-1">
        <div class="absolute inset-0 flex items-center">
          <span class="w-full border-t" />
        </div>
        <div class="relative flex justify-center text-[10px] uppercase">
          <span class="bg-card px-2 text-muted-foreground font-medium">手动操作</span>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                class="gap-1.5"
                :disabled="
                  biliCookie.cookieCloudState !== 'valid' || syncCooldown.remaining.value > 0 || isSyncingFromCloud
                "
                @click="manualSyncFromCloud"
              >
                <CloudDownloadOutline class="size-3.5" />
                {{
                  syncCooldown.remaining.value > 0
                    ? `同步 Cookie (${syncCooldown.remaining.value}s)`
                    : '从云端同步 Cookie'
                }}
              </Button>
            </TooltipTrigger>
            <TooltipContent class="text-xs">
              {{
                biliCookie.cookieCloudState !== 'valid'
                  ? '请先配置有效的 Cookie Cloud'
                  : syncCooldown.remaining.value > 0
                    ? `请等待 ${syncCooldown.remaining.value} 秒`
                    : '手动从 Cookie Cloud 拉取最新的 Cookie'
              }}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                class="gap-1.5"
                :disabled="!biliCookie.hasBiliCookie || checkCooldown.remaining.value > 0 || isCheckingCookie"
                @click="manualCheckCookie"
              >
                <RefreshOutline class="size-3.5" />
                {{
                  checkCooldown.remaining.value > 0
                    ? `检查状态 (${checkCooldown.remaining.value}s)`
                    : '检查 Cookie 状态'
                }}
              </Button>
            </TooltipTrigger>
            <TooltipContent class="text-xs">
              {{
                !biliCookie.hasBiliCookie
                  ? '当前没有 Cookie'
                  : checkCooldown.remaining.value > 0
                    ? `请等待 ${checkCooldown.remaining.value} 秒`
                    : '手动检查当前 Cookie 的有效性'
              }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </CardContent>
  </Card>
</template>
