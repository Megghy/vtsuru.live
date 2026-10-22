<script setup lang="ts">
import {
  Add24Regular,
  ArrowSync24Regular,
  Copy24Regular,
  Delete24Regular,
  Key24Regular,
  Person24Regular,
} from '@vicons/fluent'
import { computed, ref } from 'vue'

import { useAccount } from '@/api/account'
import { createBiliAuthUrl, parseBiliAuthCredential } from '@/apps/account/components/biliAuthCredential'
import { CURRENT_HOST } from '@/shared/config'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Spin } from '@/shared/ui/spin'
import { copyToClipboard, toast } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

const auth = useBiliAuth()
const account = useAccount()
const adding = ref(false)
const working = ref(false)
const credentialInput = ref('')
const refreshedLink = ref('')

const accountCount = computed(() => auth.biliTokens.length)
const maskedLoginUrl = computed(() => createBiliAuthUrl(CURRENT_HOST, '************'))
const usesAccountIdentity = computed(() => Boolean(account.value?.id && account.value?.biliUserAuthInfo))

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function switchAccount(token: string) {
  if (token === auth.biliToken) return

  working.value = true
  try {
    await auth.setCurrentAuth(token)
    if (!auth.biliAuth.id || auth.biliToken !== token) throw new Error('账号认证已失效')
    toast.success(`已切换至 ${auth.biliAuth.name}`)
  } catch (error) {
    toast.error(`切换失败：${errorText(error)}`)
  } finally {
    working.value = false
  }
}

async function removeAccount(token: string) {
  if (token !== auth.biliToken) {
    auth.biliTokens = auth.biliTokens.filter((item) => item.token !== token)
    toast.success('账号已移除')
    return
  }

  const next = auth.biliTokens.find((item) => item.token !== token)
  auth.logout()
  if (next) await auth.setCurrentAuth(next.token)
  toast.success(next ? `已切换至 ${next.name ?? `UID ${next.uId}`}` : '已退出认证账号')
}

async function addAccount() {
  let token: string
  try {
    token = parseBiliAuthCredential(credentialInput.value)
  } catch (error) {
    toast.warning(errorText(error))
    return
  }

  working.value = true
  try {
    await auth.setCurrentAuth(token)
    if (!auth.biliAuth.id || auth.biliToken !== token) throw new Error('认证信息无效或已过期')
    credentialInput.value = ''
    adding.value = false
    toast.success(`已添加 ${auth.biliAuth.name}`)
  } catch (error) {
    toast.error(`添加失败：${errorText(error)}`)
  } finally {
    working.value = false
  }
}

async function copyLoginUrl() {
  try {
    await copyToClipboard(createBiliAuthUrl(CURRENT_HOST, auth.biliToken))
    toast.success('快捷登录链接已复制')
  } catch (error) {
    toast.error(`复制失败：${errorText(error)}`)
  }
}

async function rotateLoginUrl() {
  working.value = true
  try {
    if (!(await auth.rotateSession())) {
      throw new Error('无法刷新登录链接')
    }
    refreshedLink.value = createBiliAuthUrl(CURRENT_HOST, auth.biliToken)
  } catch (error) {
    toast.error(`刷新失败：${errorText(error)}`)
  } finally {
    working.value = false
  }
}

function reset() {
  adding.value = false
  credentialInput.value = ''
}

defineExpose({ reset })
</script>

<template>
  <section class="point-settings__panel rounded-lg border border-border bg-card p-4 space-y-4">
    <div class="point-settings__panel-header flex items-center justify-between pb-3 border-b border-border/60">
      <div class="point-settings__panel-title flex items-center gap-2.5">
        <span
          class="point-settings__panel-icon size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"
        >
          <component
            :is="Person24Regular"
            class="size-4"
          />
        </span>
        <div>
          <h2 class="text-sm font-semibold text-foreground">认证账号</h2>
          <span class="text-xs text-muted-foreground">{{
            usesAccountIdentity ? '站内账号身份' : `${accountCount} 个快捷账号`
          }}</span>
        </div>
      </div>
      <Button
        v-if="!usesAccountIdentity"
        variant="outline"
        class="flex items-center gap-1"
        @click="adding = true"
      >
        <component
          :is="Add24Regular"
          class="size-3.5"
        />
        添加账号
      </Button>
    </div>

    <div
      v-if="working || auth.isLoading"
      class="py-10 flex justify-center"
    >
      <Spin />
    </div>

    <template v-else>
      <div
        v-if="usesAccountIdentity"
        class="point-settings__identity p-3.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-xs space-y-1"
      >
        <div class="font-semibold text-emerald-600 dark:text-emerald-400">已绑定 Bilibili 用户身份</div>
        <div class="text-foreground">
          {{ account.biliUserAuthInfo?.name }} · UID {{ account.biliUserAuthInfo?.userId }}
        </div>
        <div class="text-muted-foreground text-[11px]">可使用 B 站 UID 与本站密码登录。</div>
      </div>

      <Empty
        v-else-if="accountCount === 0"
        description="暂无认证账号"
        class="py-6"
      />

      <div
        v-else
        class="point-settings__accounts divide-y divide-border/60"
      >
        <article
          v-for="item in auth.biliTokens"
          :key="item.token"
          class="point-settings__account py-2.5 flex items-center gap-3"
          :class="{
            'opacity-100 font-medium': item.token === auth.biliToken,
            'opacity-85': item.token !== auth.biliToken,
          }"
        >
          <Avatar class="size-9 shrink-0">
            <AvatarImage :src="item.token === auth.biliToken ? auth.biliAuth.avatar : undefined" />
            <AvatarFallback>{{ item.name?.slice(0, 1) ?? 'B' }}</AvatarFallback>
          </Avatar>
          <div class="point-settings__account-copy flex-1 min-w-0">
            <strong class="text-xs text-foreground block truncate">{{ item.name || 'Bilibili 用户' }}</strong>
            <span class="text-[11px] font-mono text-muted-foreground">UID {{ item.uId }}</span>
          </div>
          <Badge
            v-if="item.token === auth.biliToken"
            variant="default"
            class="text-[10px] h-5 px-1.5"
          >
            当前
          </Badge>
          <Button
            size="xs"
            v-else
            variant="outline"
            class="px-2"
            @click="switchAccount(item.token)"
          >
            切换
          </Button>
          <Popconfirm
            :title="item.token === auth.biliToken ? '退出并移除当前账号？' : '移除这个账号？'"
            positive-text="确认"
            negative-text="取消"
            @positive-click="removeAccount(item.token)"
          >
            <template #trigger>
              <Button
                variant="ghost"
                size="icon"
                class="size-7 text-destructive hover:bg-destructive/10"
                title="移除账号"
              >
                <component
                  :is="Delete24Regular"
                  class="size-3.5"
                />
              </Button>
            </template>
            {{ item.token === auth.biliToken ? '退出并移除当前账号？' : '移除这个账号？' }}
          </Popconfirm>
        </article>
      </div>
    </template>

    <div
      v-if="!usesAccountIdentity"
      class="point-settings__credential p-3 rounded-lg border border-border/80 bg-muted/20 space-y-2 text-xs"
    >
      <div class="point-settings__credential-heading flex items-center gap-1.5">
        <component
          :is="Key24Regular"
          class="size-3.5 text-muted-foreground"
        />
        <strong class="text-foreground">快捷登录链接</strong>
        <Badge
          variant="secondary"
          class="text-[10px] h-4.5 px-1 font-normal"
          >已遮盖</Badge
        >
      </div>
      <div class="point-settings__credential-row flex items-center gap-2">
        <code
          class="flex-1 min-w-0 px-2 py-1 bg-background rounded border border-border font-mono text-[11px] text-muted-foreground truncate"
        >
          {{ maskedLoginUrl }}
        </code>
        <Button
          variant="outline"
          class="flex items-center gap-1 shrink-0"
          :disabled="!auth.biliToken"
          @click="copyLoginUrl"
        >
          <component
            :is="Copy24Regular"
            class="size-3.5"
          />
          复制
        </Button>
        <Popconfirm
          title="刷新登录链接？"
          positive-text="刷新"
          negative-text="取消"
          @positive-click="rotateLoginUrl"
        >
          <template #trigger>
            <Button
              variant="outline"
              class="flex items-center gap-1 shrink-0"
              :disabled="!auth.biliAuth.id"
            >
              <component
                :is="ArrowSync24Regular"
                class="size-3.5"
              />
              刷新
            </Button>
          </template>
          刷新后当前登录链接会立即失效，确定继续吗？
        </Popconfirm>
      </div>
    </div>
  </section>

  <!-- 添加账号弹窗 -->
  <Dialog v-model:open="adding">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="text-base font-semibold">添加认证账号</DialogTitle>
      </DialogHeader>

      <div class="space-y-3 py-2 text-xs">
        <Input
          v-model="credentialInput"
          type="password"
          placeholder="粘贴登录链接、#auth=... 或认证 Token"
          class="font-mono"
          @keyup.enter="addAccount"
        />
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          @click="adding = false"
        >
          取消
        </Button>
        <Button
          :disabled="working"
          @click="addAccount"
        >
          添加账号
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- 刷新后的新链接提示弹窗 -->
  <Dialog
    :open="Boolean(refreshedLink)"
    @update:open="!$event && (refreshedLink = '')"
  >
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="text-base font-semibold">新的快捷登录链接</DialogTitle>
      </DialogHeader>
      <div class="space-y-2 py-2 text-xs">
        <p class="text-muted-foreground">请保存好新的登录链接，原链接已失效：</p>
        <Input
          :model-value="refreshedLink"
          readonly
          class="font-mono"
        />
      </div>
      <DialogFooter>
        <Button
          class="flex items-center gap-1"
          @click="
            copyToClipboard(refreshedLink);
            toast.success('已复制新链接');
            refreshedLink = ''
          "
        >
          <component
            :is="Copy24Regular"
            class="size-3.5"
          />
          复制并关闭
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
