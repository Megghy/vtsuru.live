<script setup lang="ts">
import type { AccountInfo } from '@/api/api-models'
import { Info24Filled, Mail24Filled, PersonFeedback24Filled } from '@vicons/fluent'
import {
  NAlert,
  NBackTop,
  NButton,
  NCard,
  NCountdown,
  NDivider,
  NElement,
  NFlex,
  NIcon,
  NPopconfirm,
  NSpace,
  NSpin,
  NTag,
  NText,
  useMessage,
  useThemeVars,
} from 'naive-ui'
import { ref, watchEffect } from 'vue'
import { RouterView } from 'vue-router'
import { cookie } from '@/api/auth'
import { QueryGetAPI } from '@/api/query'
import { ACCOUNT_API_URL } from '@/shared/config'

const props = defineProps<{
  accountInfo: AccountInfo
}>()

const message = useMessage()
const themeVars = useThemeVars()
const canResendEmail = ref(false)

watchEffect(() => {
  if (props.accountInfo?.isEmailVerified === false) {
    canResendEmail.value = (props.accountInfo?.nextSendEmailTime ?? -1) <= 0
    return
  }
  canResendEmail.value = false
})

async function resendEmail() {
  try {
    const data = await QueryGetAPI(`${ACCOUNT_API_URL}send-verify-email`)
    if (data.code !== 200) {
      message.error(`发送失败: ${data.message}`)
      return
    }
    canResendEmail.value = false
    message.success('发送成功, 请检查你的邮箱. 如果没有收到, 请检查垃圾邮件')
    if (typeof props.accountInfo?.nextSendEmailTime === 'number') {
      props.accountInfo.nextSendEmailTime += 1000 * 60
    } else {
      props.accountInfo.nextSendEmailTime = Date.now() + 1000 * 60
    }
  } catch (err) {
    console.error(err)
    message.error(`发送失败: ${String(err)}`)
  }
}

function logout() {
  cookie.value = undefined
  window.location.reload()
}
</script>

<template>
  <NElement>
    <RouterView v-if="accountInfo?.isEmailVerified" v-slot="{ Component, route: viewRoute }">
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
            <NSpin show />
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
              <component :is="Component" :key="viewRoute.fullPath" />
            </div>
          </template>
          <template #fallback>
            <NSpin show />
          </template>
        </Suspense>
      </template>
    </RouterView>

    <template v-else>
      <div class="manage-page manage-page--md">
        <NCard size="small" :bordered="true">
          <NSpace vertical size="large" align="center">
            <NFlex justify="center" align="center" vertical>
              <NIcon size="48" :color="themeVars.primaryColor">
                <Mail24Filled />
              </NIcon>
              <NText style="font-size: 20px; margin-top: 16px; font-weight: 500;">
                请验证您的邮箱
              </NText>
              <NText depth="3" style="text-align: center; margin-top: 8px;">
                我们已向您的邮箱 <NText type="primary" strong>
                  {{ accountInfo?.bindEmail }}
                </NText> 发送了验证链接，请查收并点击链接完成验证
              </NText>
            </NFlex>

            <NAlert type="warning" style="max-width: 450px;">
              <template #icon>
                <NIcon>
                  <Info24Filled />
                </NIcon>
              </template>
              如果长时间未收到邮件，请检查垃圾邮件文件夹，或点击下方按钮重新发送
            </NAlert>

            <NSpace>
              <NButton
                type="primary"
                :disabled="!canResendEmail"
                style="min-width: 140px;"
                @click="resendEmail"
              >
                <template #icon>
                  <NIcon>
                    <Mail24Filled />
                  </NIcon>
                </template>
                重新发送验证邮件
              </NButton>
              <NTag v-if="!canResendEmail" type="warning" round>
                <NCountdown
                  :duration="(accountInfo?.nextSendEmailTime ?? 0) - Date.now()"
                  @finish="canResendEmail = true"
                />
                后可重新发送
              </NTag>
            </NSpace>

            <NDivider style="width: 80%; min-width: 250px;" />

            <NPopconfirm @positive-click="logout">
              <template #trigger>
                <NButton secondary>
                  <template #icon>
                    <NIcon>
                      <PersonFeedback24Filled />
                    </NIcon>
                  </template>
                  切换账号
                </NButton>
              </template>
              确定要登出当前账号吗？
            </NPopconfirm>
          </NSpace>
        </NCard>
      </div>
    </template>

    <NBackTop />
  </NElement>
</template>
