<script setup lang="ts">
import { NAlert, NButton, NCard, NDescriptions, NDescriptionsItem, NDivider, NFlex, NResult, NSpace, NSpin, NTag, NTime, useMessage } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isLoggedIn } from '@/api/account'
import { QueryGetAPI, QueryPostAPIWithParams } from '@/api/query'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { ORG_API_URL } from '@/data/constants'

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
const message = useMessage()

const joinType = computed<JoinType | null>(() => {
  const t = String(route.query.type || '').trim().toLowerCase()
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
    const resp = await QueryGetAPI<OrgInvitePreviewModel>(
      `${ORG_API_URL}invite/preview`,
      { type: joinType.value, token: token.value },
    )
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

watch([() => joinType.value, () => token.value], async () => {
  await loadPreview()
}, { immediate: true })

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
      message.success(`已加入组织: ${resp.data.orgName}`)
      router.replace({ name: 'org-detail', params: { orgId: resp.data.orgId } })
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加入失败')
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
      message.success(`已授权组织: ${resp.data.orgName}`)
      router.replace({ name: 'org-detail', params: { orgId: resp.data.orgId } })
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '授权失败')
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
      message.success(`已拒绝授权: ${resp.data.orgName}`)
      router.replace({ name: 'org-detail', params: { orgId: resp.data.orgId } })
    } else {
      message.error(resp.message)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '操作失败')
  } finally {
    isBusy.value = false
  }
}
</script>

<template>
  <div style="max-width: 720px; margin: 0 auto; padding: 16px;">
    <NCard title="加入 / 授权" :segmented="{ content: true }">
      <template v-if="!isValid">
        <NResult status="error" title="无效链接" description="缺少必要参数：type / token" />
        <NDivider />
        <NAlert type="info" :bordered="false">
          链接格式：/join?type=member|streamer&token=...
        </NAlert>
      </template>

      <template v-else>
        <NAlert type="info" :bordered="false">
          <template v-if="joinType === 'member'">
            你正在通过邀请链接加入组织成为成员。
          </template>
          <template v-else>
            你正在通过邀请链接授权组织读取你的直播数据。
          </template>
        </NAlert>

        <NDivider />

        <NSpin :show="previewLoading">
          <template v-if="previewError">
            <NResult status="error" title="邀请不可用" :description="previewError" />
          </template>
          <template v-else-if="preview">
            <NDescriptions size="small" :column="1">
              <NDescriptionsItem label="组织">
                {{ preview.orgName }} (ID: {{ preview.orgId }})
              </NDescriptionsItem>
              <NDescriptionsItem label="到期时间">
                <NTime :time="preview.expiresAt" format="yyyy-MM-dd HH:mm" />
              </NDescriptionsItem>
              <NDescriptionsItem label="邀请人">
                {{ preview.createdByUserName || `User ${preview.createdByUserId}` }}
              </NDescriptionsItem>
              <NDescriptionsItem v-if="preview.type === 'member'" label="加入角色">
                <NTag size="small" :bordered="false" type="info">
                  {{ roleLabel(preview.role) }}
                </NTag>
              </NDescriptionsItem>
              <NDescriptionsItem v-if="preview.targetUserId" label="限制">
                仅限指定用户接受
              </NDescriptionsItem>
              <NDescriptionsItem v-if="preview.targetStreamerUserId" label="限制">
                仅限指定主播账号接受
              </NDescriptionsItem>
            </NDescriptions>
          </template>
        </NSpin>

        <NDivider />

        <template v-if="!isLoggedIn">
          <NAlert type="warning" :bordered="false" style="margin-bottom: 12px;">
            需要先登录才能继续。
          </NAlert>
          <RegisterAndLogin />
        </template>

        <template v-else>
          <template v-if="done">
            <NResult status="success" title="已完成" :description="doneOrgName ? `组织：${doneOrgName}` : ''" />
          </template>
          <template v-else>
            <NFlex v-if="canOperate" vertical :size="12">
              <template v-if="joinType === 'member'">
                <NButton type="primary" :loading="isBusy" @click="acceptMember">
                  确认加入
                </NButton>
              </template>

              <template v-else>
                <NSpace>
                  <NButton type="primary" :loading="isBusy" @click="acceptStreamer">
                    授权
                  </NButton>
                  <NButton type="error" :loading="isBusy" @click="rejectStreamer">
                    拒绝
                  </NButton>
                </NSpace>
              </template>
            </NFlex>
          </template>
        </template>
      </template>
    </NCard>
  </div>
</template>
