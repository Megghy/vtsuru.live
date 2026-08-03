<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { RouterView } from 'vue-router'

import type { AccountInfo } from '@/api/api-models'
import { cookie } from '@/api/auth'
import { QueryGetAPI } from '@/api/query'
import { ACCOUNT_API_URL } from '@/shared/config'

const props = defineProps<{
  accountInfo: AccountInfo
}>()

const toast = useToast()
const now = useNow({ interval: 1000 })
const canResendEmail = ref(false)
const logoutDialogOpen = ref(false)
const showBackToTop = ref(false)

const resendRemaining = computed(() => Math.max(0, (props.accountInfo.nextSendEmailTime ?? 0) - now.value.getTime()))
const resendCountdown = computed(() => {
  const seconds = Math.ceil(resendRemaining.value / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return minutes > 0 ? `${minutes}分${remainingSeconds.toString().padStart(2, '0')}秒` : `${remainingSeconds}秒`
})

watchEffect(() => {
  canResendEmail.value = props.accountInfo.isEmailVerified === false && resendRemaining.value <= 0
})

async function resendEmail() {
  try {
    const data = await QueryGetAPI(`${ACCOUNT_API_URL}send-verify-email`)
    if (data.code !== 200) {
      toast.add({ title: `发送失败: ${data.message}`, color: 'error' })
      return
    }

    canResendEmail.value = false
    toast.add({ title: '发送成功, 请检查你的邮箱. 如果没有收到, 请检查垃圾邮件', color: 'success' })
    props.accountInfo.nextSendEmailTime = Date.now() + 1000 * 60
  } catch (error) {
    console.error(error)
    toast.add({ title: `发送失败: ${String(error)}`, color: 'error' })
  }
}

function logout() {
  cookie.value = undefined
  window.location.reload()
}

function updateBackToTopVisibility() {
  showBackToTop.value = window.scrollY > 300
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  updateBackToTopVisibility()
  window.addEventListener('scroll', updateBackToTopVisibility, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', updateBackToTopVisibility)
})
</script>

<template>
  <div>
    <RouterView
      v-if="accountInfo.isEmailVerified"
      v-slot="{ Component, route: viewRoute }"
    >
      <template v-if="viewRoute.meta.keepAlive">
        <Suspense>
          <template #default>
            <KeepAlive>
              <div
                class="manage-page"
                :class="viewRoute.meta.pageWidth ? `manage-page--${viewRoute.meta.pageWidth}` : undefined"
              >
                <component :is="Component" />
              </div>
            </KeepAlive>
          </template>
          <template #fallback>
            <div class="manage-content-gate__loading">
              <USkeleton class="manage-content-gate__loading-indicator" />
            </div>
          </template>
        </Suspense>
      </template>
      <template v-else>
        <Suspense>
          <template #default>
            <div
              class="manage-page"
              :class="viewRoute.meta.pageWidth ? `manage-page--${viewRoute.meta.pageWidth}` : undefined"
            >
              <component
                :is="Component"
                :key="viewRoute.fullPath.split('#')[0]"
              />
            </div>
          </template>
          <template #fallback>
            <div class="manage-content-gate__loading">
              <USkeleton class="manage-content-gate__loading-indicator" />
            </div>
          </template>
        </Suspense>
      </template>
    </RouterView>

    <template v-if="!accountInfo.isEmailVerified">
      <div class="manage-page manage-page--md">
        <UCard>
          <div class="email-verification">
            <div class="email-verification__heading">
              <UIcon name="i-lucide-mail" class="email-verification__icon" />
              <h1>请验证您的邮箱</h1>
              <p>
                我们已向您的邮箱
                <strong>{{ accountInfo.bindEmail }}</strong>
                发送了验证链接，请查收并点击链接完成验证
              </p>
            </div>

            <UAlert
              color="warning"
              variant="soft"
            >
              <template #leading>
                <UIcon name="i-lucide-info" />
              </template>
              <template #description> 如果长时间未收到邮件，请检查垃圾邮件文件夹，或点击下方按钮重新发送 </template>
            </UAlert>

            <div class="email-verification__actions">
              <UButton
                color="primary"
                :disabled="!canResendEmail"
                @click="resendEmail"
              >
                <template #leading>
                  <UIcon name="i-lucide-mail" />
                </template>
                重新发送验证邮件
              </UButton>
              <UBadge
                v-if="!canResendEmail"
                color="warning"
                variant="subtle"
              >
                {{ resendCountdown }} 后可重新发送
              </UBadge>
            </div>

            <USeparator />

            <UButton
              color="neutral"
              variant="soft"
              @click="logoutDialogOpen = true"
            >
              <template #leading>
                <UIcon name="i-lucide-log-out" />
              </template>
              切换账号
            </UButton>
          </div>
        </UCard>
      </div>
    </template>

    <UTooltip
      v-if="showBackToTop"
      text="回到顶部"
    >
      <UButton
        class="manage-content-gate__back-top"
        color="neutral"
        variant="soft"
        square
        @click="scrollToTop"
      >
        <template #leading>
          <UIcon name="i-lucide-arrow-up" />
        </template>
      </UButton>
    </UTooltip>

    <UModal
      v-model:open="logoutDialogOpen"
      title="切换账号"
    >
      <template #body> 确定要登出当前账号吗？ </template>
      <template #footer>
        <div class="manage-content-gate__modal-actions">
          <UButton
            color="neutral"
            variant="soft"
            label="取消"
            @click="logoutDialogOpen = false"
          />
          <UButton
            color="error"
            label="确认登出"
            @click="logout"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.manage-content-gate__loading {
  display: grid;
  min-height: 180px;
  place-items: center;
}

.manage-content-gate__loading-indicator {
  width: 36px;
  height: 36px;
  border-radius: 999px;
}

.email-verification {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.email-verification__heading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.email-verification__heading h1,
.email-verification__heading p {
  margin: 0;
}

.email-verification__heading h1 {
  font-size: 20px;
  font-weight: 600;
}

.email-verification__heading p {
  color: var(--vtsuru-fg-muted);
}

.email-verification__heading strong {
  color: var(--vtsuru-brand);
}

.email-verification__icon {
  width: 48px;
  height: 48px;
  color: var(--vtsuru-brand);
}

.email-verification__actions,
.manage-content-gate__modal-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.manage-content-gate__back-top {
  position: fixed;
  right: 24px;
  bottom: 24px;
  z-index: 20;
}

.manage-content-gate__modal-actions {
  justify-content: flex-end;
}
</style>
