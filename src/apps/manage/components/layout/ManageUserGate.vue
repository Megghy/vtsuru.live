<script setup lang="ts">
import { AlertCircle, CheckCircle2, Copy, ShieldAlert } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import { createBiliAuthUrl, hasBiliAuthInUrl, readBiliAuthFromUrl } from '@/apps/account/components/biliAuthCredential'
import { CURRENT_HOST } from '@/shared/config'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Spin } from '@/shared/ui/spin'
import { useMessage } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

const auth = useBiliAuth()
const accountInfo = useAccount()
const route = useRoute()
const router = useRouter()
const message = useMessage()
const isMigrating = ref(false)
const migrationError = ref('')
const migrationLink = computed(() => createBiliAuthUrl(CURRENT_HOST, auth.replacementToken ?? ''))
const isReady = computed(() => auth.isAuthed && auth.biliAuth.id > 0 && !auth.isInvalid)

async function clearAuthFromUrl() {
  const query = { ...route.query }
  delete query.auth
  await router.replace({ path: route.path, query, hash: '' })
}

async function consumeAuthToken() {
  if (route.query.auth) {
    await clearAuthFromUrl()
    message.warning('旧版认证链接已失效，请重新完成账户认证')
    return
  }
  if (!hasBiliAuthInUrl(window.location.hash)) return

  try {
    const source = window.location.hash
    await clearAuthFromUrl()
    const token = readBiliAuthFromUrl(source)
    if (!token) return
    if (auth.usesAccountIdentity) {
      message.warning('当前已登录站内账号，如需绑定身份请使用账户设置中的认证入口')
      return
    }
    await auth.setCurrentAuth(token)
  } catch (error) {
    message.error(error instanceof Error ? error.message : '认证链接格式无效')
  }
}

async function migrateLegacyAuth() {
  if (isMigrating.value) return
  isMigrating.value = true
  migrationError.value = ''
  try {
    if (!(await auth.migrateLegacyToken())) migrationError.value = '旧登录链接无法迁移，请重新认证'
  } catch (error) {
    migrationError.value = error instanceof Error ? error.message : '旧登录链接无法迁移，请重新认证'
  } finally {
    isMigrating.value = false
  }
}

async function copyMigrationLink() {
  try {
    await navigator.clipboard.writeText(migrationLink.value)
    message.success('已复制新的登录链接')
  } catch {
    message.warning('无法复制，请手动选择登录链接')
  }
}

watch(() => route.fullPath, consumeAuthToken, { immediate: true })
watch(
  () => auth.legacyToken,
  (token) => token && void migrateLegacyAuth(),
)
onMounted(async () => {
  try {
    await auth.getAuthInfo()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '无法载入 Bilibili 账户')
  }
})
</script>

<template>
  <div
    v-if="auth.isLoading && !isReady"
    class="flex flex-col items-center justify-center min-h-[280px] gap-3 text-muted-foreground"
  >
    <Spin size="large" />
    <span class="text-xs">正在载入 Bilibili 账户</span>
  </div>

  <RouterView
    v-else-if="isReady"
    v-slot="{ Component, route: viewRoute }"
  >
    <div
      class="manage-page"
      :class="viewRoute.meta.pageWidth ? `manage-page--${viewRoute.meta.pageWidth}` : undefined"
    >
      <Transition
        name="page-fade"
        mode="out-in"
      >
        <component
          :is="Component"
          :key="`${String(viewRoute.name)}-${auth.biliAuth.id}`"
        />
      </Transition>
    </div>
  </RouterView>

  <div
    v-else
    class="manage-page manage-page--md flex items-center justify-center p-6"
  >
    <Card class="w-full max-w-md text-center p-6">
      <CardHeader class="flex flex-col items-center p-0 space-y-3">
        <div
          class="size-12 rounded-full flex items-center justify-center"
          :class="auth.isInvalid ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'"
        >
          <ShieldAlert
            v-if="auth.isInvalid"
            class="size-6"
          />
          <AlertCircle
            v-else
            class="size-6"
          />
        </div>
        <CardTitle class="text-base font-semibold">
          {{ auth.isInvalid ? 'Bilibili 认证已失效' : '先完成 Bilibili 认证' }}
        </CardTitle>
        <CardDescription class="text-xs text-muted-foreground"> 认证后即可查看积分、订单和积分记录。 </CardDescription>
      </CardHeader>
      <CardFooter class="flex justify-center p-0 pt-6">
        <Button @click="router.push({ name: 'bili-auth' })">
          {{ auth.isInvalid ? '重新认证' : accountInfo.id ? '绑定 Bilibili' : '开始认证' }}
        </Button>
      </CardFooter>
    </Card>
  </div>

  <Dialog :open="auth.requiresLegacyMigration">
    <DialogContent class="sm:max-w-md">
      <template v-if="auth.replacementToken">
        <DialogHeader>
          <DialogTitle class="text-sm font-semibold">保存新的登录链接</DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            登录链接已更新，请复制并妥善保存新的长期登录链接。
          </DialogDescription>
        </DialogHeader>
        <div class="py-2">
          <Input
            :model-value="migrationLink"
            readonly
            type="text"
            class="font-mono"
          />
        </div>
        <DialogFooter class="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            class="gap-1.5"
            @click="copyMigrationLink"
          >
            <Copy class="size-3.5" />
            复制链接
          </Button>
          <Button @click="auth.finishLegacyMigration()"> 我已保存 </Button>
        </DialogFooter>
      </template>
      <template v-else>
        <DialogHeader>
          <DialogTitle class="text-sm font-semibold">
            {{ migrationError ? '无法生成新链接' : '正在更新登录链接' }}
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            {{ migrationError || '完成后会在这里显示新的长期登录链接。' }}
          </DialogDescription>
        </DialogHeader>
        <div class="flex items-center justify-center py-6">
          <Button
            v-if="migrationError"
            @click="migrateLegacyAuth"
          >
            重试
          </Button>
          <Spin
            v-else
            size="medium"
          />
        </div>
      </template>
    </DialogContent>
  </Dialog>
</template>
