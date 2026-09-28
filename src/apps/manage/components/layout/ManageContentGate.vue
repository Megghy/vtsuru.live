<script setup lang="ts">
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
  NTag,
  NText,
  useMessage,
  useThemeVars,
} from 'naive-ui'
import { computed, ref, watchEffect } from 'vue'
import { RouterView, useRoute } from 'vue-router'

import { logoutAccount } from '@/api/account'
import type { AccountInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import AccountSecurityPanel from '@/apps/account/components/AccountSecurityPanel.vue'
import ManageDanmakuStatusBanner from '@/apps/manage/components/event-fetcher/ManageDanmakuStatusBanner.vue'
import { useManageWorkspace } from '@/apps/manage/composables/useManageWorkspace'
import { ACCOUNT_API_URL } from '@/shared/config'

const props = defineProps<{
  accountInfo: AccountInfo
}>()

const message = useMessage()
const themeVars = useThemeVars()
const route = useRoute()
const canResendEmail = ref(false)
const { workspace } = useManageWorkspace()
const isEmailWaitPreview = computed(() => {
  if (!('preview' in route.query)) return false
  const raw = route.query.preview
  const text = String(Array.isArray(raw) ? raw[0] : (raw ?? ''))
  return text === '' || text === '1' || text === 'email' || text === 'verify'
})
const displayEmail = computed(() => props.accountInfo.bindEmail || 'you@example.com')
const showDashboard = computed(
  () => workspace.value === 'streamer' && props.accountInfo.isEmailVerified && !isEmailWaitPreview.value,
)
const showBindEmail = computed(
  () => workspace.value === 'streamer' && !props.accountInfo.bindEmail && !isEmailWaitPreview.value,
)
const showEmailWait = computed(() => workspace.value === 'streamer' && !showDashboard.value && !showBindEmail.value)

watchEffect(() => {
  if (isEmailWaitPreview.value) {
    canResendEmail.value = true
    return
  }
  if (props.accountInfo?.isEmailVerified === false) {
    canResendEmail.value = (props.accountInfo?.nextSendEmailTime ?? -1) <= 0
    return
  }
  canResendEmail.value = false
})

async function resendEmail() {
  if (isEmailWaitPreview.value) {
    message.info('预览模式，不会发送邮件')
    return
  }
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

</script>

<template>
  <NElement class="content-gate">
    <RouterView
      v-if="showDashboard"
      v-slot="{ Component, route: viewRoute }"
    >
      <div
        class="manage-page"
        :class="viewRoute.meta.pageWidth ? `manage-page--${viewRoute.meta.pageWidth}` : undefined"
      >
        <ManageDanmakuStatusBanner v-if="viewRoute.meta.danmaku" />
        <KeepAlive>
          <component
            :is="Component"
            v-if="viewRoute.meta.keepAlive"
            :key="String(viewRoute.name ?? viewRoute.path)"
          />
        </KeepAlive>
        <component
          :is="Component"
          v-if="!viewRoute.meta.keepAlive"
          :key="viewRoute.fullPath.split('#')[0]"
        />
      </div>
    </RouterView>

    <template v-else-if="showBindEmail">
      <div class="manage-page manage-page--md">
        <NAlert
          type="info"
          title="绑定邮箱后使用主播后台"
          style="margin-bottom: 12px"
        >
          主播功能需要已验证的邮箱。绑定后我们会发送验证邮件，完成验证即可进入后台。
        </NAlert>
        <AccountSecurityPanel />
      </div>
    </template>

    <template v-else-if="showEmailWait">
      <div class="manage-page manage-page--md manage-page--center">
        <NCard
          size="small"
          :bordered="true"
        >
          <NFlex
            vertical
            size="large"
            align="center"
          >
            <NFlex
              justify="center"
              align="center"
              vertical
            >
              <NIcon
                size="48"
                :color="themeVars.primaryColor"
              >
                <Mail24Filled />
              </NIcon>
              <NText style="font-size: 20px; margin-top: 16px; font-weight: 500"> 请查收验证邮件 </NText>
              <NText
                depth="3"
                style="text-align: center; margin-top: 8px"
              >
                注册时已向
                <NText
                  type="primary"
                  strong
                >
                  {{ displayEmail }}
                </NText>
                发送验证链接，打开邮件中的链接即可进入后台
              </NText>
            </NFlex>

            <NAlert
              type="warning"
              style="max-width: 450px"
            >
              <template #icon>
                <NIcon>
                  <Info24Filled />
                </NIcon>
              </template>
              如果长时间未收到邮件，请检查垃圾邮件文件夹，或点击下方按钮重新发送
            </NAlert>

            <NFlex>
              <NButton
                type="primary"
                :disabled="!canResendEmail"
                style="min-width: 140px"
                @click="resendEmail"
              >
                <template #icon>
                  <NIcon>
                    <Mail24Filled />
                  </NIcon>
                </template>
                重新发送验证邮件
              </NButton>
              <NTag
                v-if="!canResendEmail"
                type="warning"
                round
              >
                <NCountdown
                  :duration="(accountInfo?.nextSendEmailTime ?? 0) - Date.now()"
                  @finish="canResendEmail = true"
                />
                后可重新发送
              </NTag>
            </NFlex>

            <NDivider style="width: 80%; min-width: 250px" />

            <NPopconfirm @positive-click="logoutAccount">
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
          </NFlex>
        </NCard>
      </div>
    </template>

    <NBackTop />
  </NElement>
</template>

<style scoped>
.content-gate {
  display: flex;
  flex: 1;
  min-height: 100%;
  flex-direction: column;
}
</style>
