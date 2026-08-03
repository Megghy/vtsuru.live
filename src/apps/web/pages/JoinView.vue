<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isLoggedIn } from '@/api/account'
import { QueryGetAPI, QueryPostAPIWithParams } from '@/api/query'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { ORG_API_URL } from '@/shared/config'
import { showErrorToast, showSuccessToast } from '@/shared/services/toast'

import '@/apps/web/styles/web-page.css'

type JoinType = 'member' | 'streamer'

interface OrgJoinResponseModel {
  orgId: number
  orgName: string
}

interface OrgInvitePreviewModel {
  type: 'member' | 'streamer'
  orgId: number
  orgName: string
  expiresAt: number
  role: number | null
  createdByUserId: number
  createdByUserName: string | null
  targetUserId: number | null
  targetStreamerUserId: number | null
}

const route = useRoute()
const router = useRouter()

const joinType = computed<JoinType | null>(() => {
  const t = String(route.query.type || '')
    .trim()
    .toLowerCase()
  if (t === 'member' || t === 'streamer') return t
  return null
})

const token = computed<string>(() => String(route.query.token || '').trim())

const isBusy = ref(false)
const done = ref(false)
const doneOrgName = ref<string>('')

const previewLoading = ref(false)
const preview = ref<OrgInvitePreviewModel | null>(null)
const previewError = ref<string>('')

const canOperate = computed(() => Boolean(preview.value) && !previewLoading.value && !previewError.value)

const isValid = computed(() => Boolean(joinType.value) && token.value.length > 0)

function roleLabel(role: number | null) {
  if (role === 0) return 'Owner'
  if (role === 1) return 'Admin'
  return 'Member'
}

async function loadPreview() {
  if (!isValid.value) {
    preview.value = null
    previewError.value = ''
    return
  }

  previewLoading.value = true
  previewError.value = ''
  try {
    const resp = await QueryGetAPI<OrgInvitePreviewModel>(`${ORG_API_URL}invite/preview`, {
      type: joinType.value,
      token: token.value,
    })
    if (resp.code === 200) {
      preview.value = resp.data
      return
    }

    preview.value = null
    previewError.value = resp.message
  } catch (err) {
    preview.value = null
    previewError.value = err instanceof Error ? err.message : '加载邀请信息失败'
  } finally {
    previewLoading.value = false
  }
}

watch(
  [() => joinType.value, () => token.value],
  async () => {
    await loadPreview()
  },
  { immediate: true },
)

async function acceptMember() {
  if (!isValid.value || joinType.value !== 'member') return
  isBusy.value = true
  try {
    const resp = await QueryPostAPIWithParams<OrgJoinResponseModel>(
      `${ORG_API_URL}invite/member/accept`,
      { token: token.value },
      undefined,
    )
    if (resp.code === 200) {
      done.value = true
      doneOrgName.value = resp.data.orgName
      showSuccessToast(`已加入组织: ${resp.data.orgName}`)
      router.replace({ name: 'org-detail', params: { orgId: resp.data.orgId } })
    } else {
      showErrorToast(resp.message)
    }
  } catch (err) {
    showErrorToast(err instanceof Error ? err.message : '加入失败')
  } finally {
    isBusy.value = false
  }
}

async function acceptStreamer() {
  if (!isValid.value || joinType.value !== 'streamer') return
  isBusy.value = true
  try {
    const resp = await QueryPostAPIWithParams<OrgJoinResponseModel>(
      `${ORG_API_URL}invite/streamer/accept`,
      { token: token.value },
      undefined,
    )
    if (resp.code === 200) {
      done.value = true
      doneOrgName.value = resp.data.orgName
      showSuccessToast(`已授权组织: ${resp.data.orgName}`)
      router.replace({ name: 'org-detail', params: { orgId: resp.data.orgId } })
    } else {
      showErrorToast(resp.message)
    }
  } catch (err) {
    showErrorToast(err instanceof Error ? err.message : '授权失败')
  } finally {
    isBusy.value = false
  }
}

async function rejectStreamer() {
  if (!isValid.value || joinType.value !== 'streamer') return
  isBusy.value = true
  try {
    const resp = await QueryPostAPIWithParams<OrgJoinResponseModel>(
      `${ORG_API_URL}invite/streamer/reject`,
      { token: token.value },
      undefined,
    )
    if (resp.code === 200) {
      done.value = true
      doneOrgName.value = resp.data.orgName
      showSuccessToast(`已拒绝授权: ${resp.data.orgName}`)
      router.replace({ name: 'org-detail', params: { orgId: resp.data.orgId } })
    } else {
      showErrorToast(resp.message)
    }
  } catch (err) {
    showErrorToast(err instanceof Error ? err.message : '操作失败')
  } finally {
    isBusy.value = false
  }
}
</script>

<template>
  <div class="web-page web-page--md">
    <section class="join-page">
      <h1>加入 / 授权</h1>
      <template v-if="!isValid">
        <UEmpty
          icon="i-lucide-link-2-off"
          title="无效链接"
          description="缺少必要参数：type / token"
        />
        <USeparator />
        <UAlert color="info" description="链接格式：/join?type=member|streamer&token=..." />
      </template>

      <template v-else>
        <UAlert
          color="info"
          :description="
            joinType === 'member'
              ? '你正在通过邀请链接加入组织成为成员。'
              : '你正在通过邀请链接授权组织读取你的直播数据。'
          "
        />

        <USeparator />

        <UIcon
          v-if="previewLoading"
          name="i-lucide-loader-circle"
          class="join-page__spinner animate-spin"
        />
        <UEmpty
          v-else-if="previewError"
          icon="i-lucide-circle-x"
          title="邀请不可用"
          :description="previewError"
        />
        <dl
          v-else-if="preview"
          class="join-page__details"
        >
          <dt>组织</dt><dd>{{ preview.orgName }} (ID: {{ preview.orgId }})</dd>
          <dt>到期时间</dt><dd>{{ new Date(preview.expiresAt).toLocaleString('zh-CN') }}</dd>
          <dt>邀请人</dt><dd>{{ preview.createdByUserName || `User ${preview.createdByUserId}` }}</dd>
          <template v-if="preview.type === 'member'">
            <dt>加入角色</dt><dd><UBadge color="info" variant="subtle">{{ roleLabel(preview.role) }}</UBadge></dd>
          </template>
          <template v-if="preview.targetUserId">
            <dt>限制</dt><dd>仅限指定用户接受</dd>
          </template>
          <template v-if="preview.targetStreamerUserId">
            <dt>限制</dt><dd>仅限指定主播账号接受</dd>
          </template>
        </dl>

        <USeparator />

        <template v-if="!isLoggedIn">
          <UAlert color="warning" description="需要先登录才能继续。" />
          <RegisterAndLogin />
        </template>

        <template v-else>
          <UEmpty
            v-if="done"
            icon="i-lucide-circle-check"
            title="已完成"
            :description="doneOrgName ? `组织：${doneOrgName}` : ''"
          />
          <div
            v-else-if="canOperate"
            class="join-page__actions"
          >
              <template v-if="joinType === 'member'">
                <UButton
                  :loading="isBusy"
                  @click="acceptMember"
                >
                  确认加入
                </UButton>
              </template>

              <template v-else>
                  <UButton
                    :loading="isBusy"
                    @click="acceptStreamer"
                  >
                    授权
                  </UButton>
                  <UButton
                    color="error"
                    :loading="isBusy"
                    @click="rejectStreamer"
                  >
                    拒绝
                  </UButton>
              </template>
          </div>
        </template>
      </template>
    </section>
  </div>
</template>

<style scoped>
.join-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.join-page h1 {
  margin: 0;
  font-size: 22px;
}

.join-page__spinner {
  display: block;
  margin: 32px auto;
}

.join-page__details {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 10px 16px;
  margin: 0;
}

.join-page__details dt {
  color: var(--vtsuru-fg-muted);
}

.join-page__details dd {
  margin: 0;
}

.join-page__actions {
  display: flex;
  gap: 10px;
}
</style>
