<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isLoggedIn } from '@/api/account'
import {
  getApiOrgInvitePreview,
  postApiOrgInviteMemberAccept,
  postApiOrgInviteStreamerAccept,
  postApiOrgInviteStreamerReject,
} from '@/api/generated/org/org'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Separator } from '@/shared/ui/separator'
import { Spin } from '@/shared/ui/spin'
import { toast } from '@/shared/utils'

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

function formatDate(ts: number) {
  try {
    const d = new Date(ts > 1e11 ? ts : ts * 1000)
    return d.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(ts)
  }
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
    const resp = (await getApiOrgInvitePreview({
      type: joinType.value as any,
      token: token.value,
    })) as unknown as {
      code: number
      message?: string
      data: OrgInvitePreviewModel
    }
    if (resp.code === 200) {
      preview.value = resp.data
      return
    }

    preview.value = null
    previewError.value = resp.message || '加载邀请信息失败'
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
    const resp = (await postApiOrgInviteMemberAccept({
      token: token.value,
    })) as unknown as {
      code: number
      message?: string
      data: OrgJoinResponseModel
    }
    if (resp.code === 200) {
      done.value = true
      doneOrgName.value = resp.data.orgName
      toast.success(`已加入组织: ${resp.data.orgName}`)
      router.replace({ name: 'org-detail', params: { orgId: resp.data.orgId } })
    } else {
      toast.error(resp.message || '加入失败')
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '加入失败')
  } finally {
    isBusy.value = false
  }
}

async function acceptStreamer() {
  if (!isValid.value || joinType.value !== 'streamer') return
  isBusy.value = true
  try {
    const resp = (await postApiOrgInviteStreamerAccept({
      token: token.value,
    })) as unknown as {
      code: number
      message?: string
      data: OrgJoinResponseModel
    }
    if (resp.code === 200) {
      done.value = true
      doneOrgName.value = resp.data.orgName
      toast.success(`已授权组织: ${resp.data.orgName}`)
    } else {
      toast.error(resp.message || '授权失败')
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '授权失败')
  } finally {
    isBusy.value = false
  }
}

async function rejectStreamer() {
  if (!isValid.value || joinType.value !== 'streamer') return
  isBusy.value = true
  try {
    const resp = (await postApiOrgInviteStreamerReject({
      token: token.value,
    })) as unknown as {
      code: number
      message?: string
      data: OrgJoinResponseModel
    }
    if (resp.code === 200) {
      done.value = true
      doneOrgName.value = resp.data.orgName
      toast.success(`已拒绝授权: ${resp.data.orgName}`)
    } else {
      toast.error(resp.message || '操作失败')
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '操作失败')
  } finally {
    isBusy.value = false
  }
}
</script>

<template>
  <main class="web-page web-page--md py-10 px-4 max-w-lg mx-auto">
    <Card class="shadow-sm">
      <CardHeader class="pb-3 border-b border-border/50">
        <CardTitle class="text-lg">加入 / 授权</CardTitle>
      </CardHeader>
      <CardContent class="pt-5 space-y-4 text-sm">
        <template v-if="!isValid">
          <Alert variant="destructive">
            <AlertTitle>无效链接</AlertTitle>
            <AlertDescription>缺少必要参数：type / token</AlertDescription>
          </Alert>
          <div class="text-xs text-muted-foreground p-2.5 rounded bg-muted/40 font-mono">
            链接格式：/join?type=member|streamer&token=...
          </div>
        </template>

        <template v-else>
          <Alert class="bg-primary/5 border-primary/20 text-foreground">
            <AlertDescription>
              <template v-if="joinType === 'member'"> 你正在通过邀请链接加入组织成为成员。 </template>
              <template v-else> 你正在通过邀请链接授权组织读取你的直播数据。 </template>
            </AlertDescription>
          </Alert>

          <Separator />

          <div
            v-if="previewLoading"
            class="py-8 flex justify-center items-center"
          >
            <Spin />
          </div>
          <template v-else-if="previewError">
            <Alert variant="destructive">
              <AlertTitle>邀请不可用</AlertTitle>
              <AlertDescription>{{ previewError }}</AlertDescription>
            </Alert>
          </template>
          <template v-else-if="preview">
            <dl class="grid grid-cols-[80px_1fr] gap-y-2 text-xs">
              <dt class="text-muted-foreground">组织</dt>
              <dd class="font-medium text-foreground">{{ preview.orgName }} (ID: {{ preview.orgId }})</dd>

              <dt class="text-muted-foreground">到期时间</dt>
              <dd class="text-foreground">{{ formatDate(preview.expiresAt) }}</dd>

              <dt class="text-muted-foreground">邀请人</dt>
              <dd class="text-foreground">{{ preview.createdByUserName || `User ${preview.createdByUserId}` }}</dd>

              <template v-if="preview.type === 'member'">
                <dt class="text-muted-foreground">加入角色</dt>
                <dd>
                  <Badge
                    variant="secondary"
                    class="h-5 text-[11px] font-normal"
                  >
                    {{ roleLabel(preview.role) }}
                  </Badge>
                </dd>
              </template>

              <template v-if="preview.targetUserId">
                <dt class="text-muted-foreground">限制</dt>
                <dd class="text-amber-500 font-medium">仅限指定用户接受</dd>
              </template>

              <template v-if="preview.targetStreamerUserId">
                <dt class="text-muted-foreground">限制</dt>
                <dd class="text-amber-500 font-medium">仅限指定主播账号接受</dd>
              </template>
            </dl>
          </template>

          <Separator />

          <template v-if="!isLoggedIn">
            <Alert class="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
              <AlertDescription>需要先登录才能继续。</AlertDescription>
            </Alert>
            <RegisterAndLogin />
          </template>

          <template v-else>
            <template v-if="done">
              <div class="py-6 flex flex-col items-center justify-center text-center gap-2">
                <div
                  class="size-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-lg font-bold"
                >
                  ✓
                </div>
                <h3 class="text-base font-semibold">已完成</h3>
                <p
                  v-if="doneOrgName"
                  class="text-xs text-muted-foreground"
                >
                  组织：{{ doneOrgName }}
                </p>
              </div>
            </template>
            <template v-else-if="canOperate">
              <div
                v-if="joinType === 'member'"
                class="pt-2"
              >
                <Button
                  class="w-full"
                  :disabled="isBusy"
                  @click="acceptMember"
                >
                  {{ isBusy ? '加入中...' : '确认加入' }}
                </Button>
              </div>

              <div
                v-else
                class="flex gap-3 pt-2"
              >
                <Button
                  class="flex-1"
                  :disabled="isBusy"
                  @click="acceptStreamer"
                >
                  {{ isBusy ? '处理中...' : '授权' }}
                </Button>
                <Button
                  variant="destructive"
                  class="flex-1"
                  :disabled="isBusy"
                  @click="rejectStreamer"
                >
                  {{ isBusy ? '处理中...' : '拒绝' }}
                </Button>
              </div>
            </template>
          </template>
        </template>
      </CardContent>
    </Card>
  </main>
</template>
