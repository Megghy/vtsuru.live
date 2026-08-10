<script setup lang="ts">
import { Add24Regular, ArrowSync24Regular, Copy24Regular, Delete24Regular, Key24Regular, Person24Regular } from '@vicons/fluent'
import { NAvatar, NButton, NEmpty, NIcon, NInput, NModal, NPopconfirm, NSpin, NTag, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'

import { createBiliAuthUrl, parseBiliAuthCredential } from '@/apps/account/components/biliAuthCredential'
import { CURRENT_HOST } from '@/shared/config'
import { useBiliAuth } from '@/store/useBiliAuth'

const auth = useBiliAuth()
const message = useMessage()
const adding = ref(false)
const working = ref(false)
const credentialInput = ref('')
const refreshedLink = ref('')

const accountCount = computed(() => auth.biliTokens.length)
const maskedLoginUrl = computed(() => createBiliAuthUrl(CURRENT_HOST, '************'))

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function switchAccount(token: string) {
  if (token === auth.biliToken) return

  working.value = true
  try {
    await auth.setCurrentAuth(token)
    if (!auth.biliAuth.id || auth.biliToken !== token) throw new Error('账号认证已失效')
    message.success(`已切换至 ${auth.biliAuth.name}`)
  } catch (error) {
    message.error(`切换失败：${errorText(error)}`)
  } finally {
    working.value = false
  }
}

async function removeAccount(token: string) {
  if (token !== auth.biliToken) {
    auth.biliTokens = auth.biliTokens.filter((item) => item.token !== token)
    message.success('账号已移除')
    return
  }

  const next = auth.biliTokens.find((item) => item.token !== token)
  auth.logout()
  if (next) await auth.setCurrentAuth(next.token)
  message.success(next ? `已切换至 ${next.name ?? `UID ${next.uId}`}` : '已退出认证账号')
}

async function addAccount() {
  let token: string
  try {
    token = parseBiliAuthCredential(credentialInput.value)
  } catch (error) {
    message.warning(errorText(error))
    return
  }

  working.value = true
  try {
    await auth.setCurrentAuth(token)
    if (!auth.biliAuth.id || auth.biliToken !== token) throw new Error('认证信息无效或已过期')
    credentialInput.value = ''
    adding.value = false
    message.success(`已添加 ${auth.biliAuth.name}`)
  } catch (error) {
    message.error(`添加失败：${errorText(error)}`)
  } finally {
    working.value = false
  }
}

async function copyLoginUrl() {
  try {
    await navigator.clipboard.writeText(createBiliAuthUrl(CURRENT_HOST, auth.biliToken))
    message.success('快捷登录链接已复制')
  } catch (error) {
    message.error(`复制失败：${errorText(error)}`)
  }
}

async function rotateLoginUrl() {
  working.value = true
  try {
    if (!await auth.rotateSession()) {
      throw new Error('无法刷新登录链接')
    }
    refreshedLink.value = createBiliAuthUrl(CURRENT_HOST, auth.biliToken)
  } catch (error) {
    message.error(`刷新失败：${errorText(error)}`)
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
  <section class="point-settings__panel">
    <div class="point-settings__panel-header">
      <div class="point-settings__panel-title">
        <span class="point-settings__panel-icon"><NIcon :component="Person24Regular" /></span>
        <div>
          <h2>认证账号</h2>
          <span>{{ accountCount }} 个账号</span>
        </div>
      </div>
      <NButton
        type="primary"
        secondary
        size="small"
        @click="adding = true"
      >
        <template #icon><NIcon :component="Add24Regular" /></template>
        添加账号
      </NButton>
    </div>

    <NSpin :show="working || auth.isLoading">
      <NEmpty
        v-if="accountCount === 0"
        size="small"
        class="point-settings__empty"
      />
      <div
        v-else
        class="point-settings__accounts"
      >
        <article
          v-for="item in auth.biliTokens"
          :key="item.token"
          class="point-settings__account"
          :class="{ 'is-current': item.token === auth.biliToken }"
        >
          <NAvatar
            round
            :src="item.token === auth.biliToken ? auth.biliAuth.avatar : undefined"
          >
            {{ item.name?.slice(0, 1) ?? 'B' }}
          </NAvatar>
          <div class="point-settings__account-copy">
            <strong>{{ item.name || 'Bilibili 用户' }}</strong>
            <span>UID {{ item.uId }}</span>
          </div>
          <NTag
            v-if="item.token === auth.biliToken"
            type="success"
            size="small"
            round
            :bordered="false"
          >
            当前
          </NTag>
          <NButton
            v-else
            size="tiny"
            secondary
            @click="switchAccount(item.token)"
          >
            切换
          </NButton>
          <NPopconfirm @positive-click="removeAccount(item.token)">
            <template #trigger>
              <NButton
                quaternary
                circle
                type="error"
                size="small"
                title="移除账号"
              >
                <template #icon><NIcon :component="Delete24Regular" /></template>
              </NButton>
            </template>
            {{ item.token === auth.biliToken ? '退出并移除当前账号？' : '移除这个账号？' }}
          </NPopconfirm>
        </article>
      </div>
    </NSpin>

    <div class="point-settings__credential">
      <div class="point-settings__credential-heading">
        <span class="point-settings__panel-icon"><NIcon :component="Key24Regular" /></span>
        <strong>快捷登录链接</strong>
        <NTag
          size="small"
          :bordered="false"
        >
          已遮盖
        </NTag>
      </div>
      <div class="point-settings__credential-row">
        <code>{{ maskedLoginUrl }}</code>
        <NButton
          secondary
          type="primary"
          :disabled="!auth.biliToken"
          @click="copyLoginUrl"
        >
          <template #icon><NIcon :component="Copy24Regular" /></template>
          复制
        </NButton>
        <NPopconfirm @positive-click="rotateLoginUrl">
          <template #trigger>
            <NButton
              secondary
              :disabled="!auth.biliAuth.id"
            >
              <template #icon><NIcon :component="ArrowSync24Regular" /></template>
              刷新
            </NButton>
          </template>
          刷新后当前登录链接会立即失效，确定继续吗？
        </NPopconfirm>
      </div>
    </div>
  </section>

  <NModal
    v-model:show="adding"
    preset="card"
    title="添加认证账号"
    class="point-settings__account-modal"
  >
    <NSpin :show="working">
      <NInput
        v-model:value="credentialInput"
        type="password"
        show-password-on="click"
        placeholder="粘贴登录链接、#auth=... 或认证 Token"
        @keyup.enter="addAccount"
      />
      <div class="point-settings__modal-actions">
        <NButton @click="adding = false">取消</NButton>
        <NButton
          type="primary"
          :loading="working"
          @click="addAccount"
        >
          添加账号
        </NButton>
      </div>
    </NSpin>
  </NModal>

  <NModal
    :show="Boolean(refreshedLink)"
    preset="card"
    title="新的快捷登录链接"
    :mask-closable="false"
    @update:show="(show) => { if (!show) refreshedLink = '' }"
  >
    <NInput
      :value="refreshedLink"
      readonly
      type="password"
      show-password-on="click"
    />
    <div class="point-settings__modal-actions">
      <NButton @click="copyLoginUrl">复制链接</NButton>
      <NButton
        type="primary"
        @click="refreshedLink = ''"
      >
        我已保存
      </NButton>
    </div>
  </NModal>
</template>
