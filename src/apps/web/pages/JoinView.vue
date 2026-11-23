<script setup lang="ts">
import { CheckCircle2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isLoggedIn } from '@/api/account'
import type { OrgInvitePreviewModel } from '@/api/generated/model'
import {
  getApiOrgInvitePreview,
  postApiOrgInviteMemberAccept,
  postApiOrgInviteMemberReject,
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
type ExtendedPreview = OrgInvitePreviewModel & {
  orgDescription?: string | null
  allowPointManage?: boolean | null
  maxUses?: number | null
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
const doneMessage = ref('已完成')
const doneOrgName = ref<string>('')

const previewLoading = ref(false)
const preview = ref<ExtendedPreview | null>(null)
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
    const resp = await getApiOrgInvitePreview({
      type: joinType.value as any,
      token: token.value,
    })
    if (resp.code === 200) {
      preview.value = resp.data as ExtendedPreview
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
    const resp = await postApiOrgInviteMemberAccept({ token: token.value })
    if (resp.code === 200) {
      done.value = true
      doneMessage.value = '已加入组织'
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

async function rejectMember() {
  if (!isValid.value || joinType.value !== 'member') return
  isBusy.value = true
  try {
    const resp = await postApiOrgInviteMemberReject({ token: token.value })
    if (resp.code === 200) {
      done.value = true
      doneMessage.value = '已拒绝加入邀请'
      doneOrgName.value = resp.data.orgName
      toast.success(`已拒绝加入: ${resp.data.orgName}`)
    } else {
      toast.error(resp.message || '操作失败')
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '操作失败')
  } finally {
    isBusy.value = false
  }
}

async function acceptStreamer() {
  if (!isValid.value || joinType.value !== 'streamer') return
  isBusy.value = true
  try {
    const resp = await postApiOrgInviteStreamerAccept({ token: token.value })
    if (resp.code === 200) {
      done.value = true
      doneMessage.value = '已完成主播授权'
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
    const resp = await postApiOrgInviteStreamerReject({ token: token.value })
    if (resp.code === 200) {
      done.value = true
      doneMessage.value = '已拒绝授权邀请'
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
    <Card>
      <CardHeader class="p-4 border-b border-border/60">
        <CardTitle class="text-base">
          {{ joinType === 'streamer' ? '主播数据授权邀请' : '加入组织邀请' }}
        </CardTitle>
      </CardHeader>
      <CardContent class="p-4 space-y-4 text-xs">
        <template v-if="!isValid">
          <Alert variant="destructive">
            <AlertTitle>无效链接</AlertTitle>
            <AlertDescription>缺少必要参数：type / token</AlertDescription>
          </Alert>
          <div class="text-xs text-muted-foreground p-2.5 rounded bg-muted/40 font-mono">
            链接格式：/org/join?type=member|streamer&amp;token=...
          </div>
        </template>

        <template v-else>
          <Alert class="bg-primary/5 border-primary/20 text-foreground">
            <AlertDescription>
              <template v-if="joinType === 'member'"> 你正在通过邀请链接加入组织成为成员。 </template>
              <template v-else>
                你正在通过邀请链接授权组织{{
                  preview?.allowPointManage === false
                    ? '读取你的直播与分析数据（不含积分/订单代管）。'
                    : '读取你的直播数据并代管积分规则与订单。你可随时在「组织管理」页调整或撤销授权。'
                }}
              </template>
            </AlertDescription>
          </Alert>

          <Separator />

          <div
            v-if="previewLoading"
            class="py-8 flex-center"
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
              <dd class="font-medium text-foreground">
                {{ preview.orgName }} <span class="text-muted-foreground font-mono">(ID: {{ preview.orgId }})</span>
              </dd>

              <template v-if="preview.orgDescription">
                <dt class="text-muted-foreground">简介</dt>
                <dd class="text-muted-foreground">{{ preview.orgDescription }}</dd>
              </template>

              <dt class="text-muted-foreground">到期时间</dt>
              <dd class="text-foreground font-mono tabular-nums">{{ formatDate(preview.expiresAt) }}</dd>

              <dt class="text-muted-foreground">邀请人</dt>
              <dd class="text-foreground">{{ preview.createdByUserName || `UID ${preview.createdByUserId}` }}</dd>

              <template v-if="preview.type === 'member'">
                <dt class="text-muted-foreground">加入角色</dt>
                <dd>
                  <Badge
                    variant="secondary"
                    size="xs"
                  >
                    {{ roleLabel(preview.role) }}
                  </Badge>
                </dd>
              </template>

              <template v-else>
                <dt class="text-muted-foreground">授权范围</dt>
                <dd>
                  <Badge
                    variant="outline"
                    size="xs"
                    :class="
                      preview.allowPointManage === false
                        ? 'text-muted-foreground'
                        : 'text-amber-600 border-amber-500/30 bg-amber-500/10'
                    "
                  >
                    {{ preview.allowPointManage === false ? '仅读取直播数据' : '直播数据 + 积分/订单代管' }}
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
            <Alert variant="warning">
              <AlertDescription>需要先登录才能继续。</AlertDescription>
            </Alert>
            <RegisterAndLogin />
          </template>

          <template v-else>
            <template v-if="done">
              <div class="py-6 flex-col-center text-center gap-3">
                <div class="size-10 rounded-full bg-emerald-500/10 text-emerald-500 flex-center">
                  <CheckCircle2 class="size-5" />
                </div>
                <div class="space-y-1">
                  <h3 class="text-sm font-semibold m-0">{{ doneMessage }}</h3>
                  <p
                    v-if="doneOrgName"
                    class="text-xs text-muted-foreground m-0"
                  >
                    组织：{{ doneOrgName }}
                  </p>
                </div>
                <div class="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    @click="router.push({ name: 'org-index' })"
                  >
                    查看组织管理
                  </Button>
                  <Button @click="router.push({ name: 'manage-index' })"> 返回控制台 </Button>
                </div>
              </div>
            </template>
            <template v-else-if="canOperate">
              <div
                v-if="joinType === 'member'"
                class="flex gap-2.5 pt-1"
              >
                <Button
                  class="flex-1"
                  :disabled="isBusy"
                  @click="acceptMember"
                >
                  {{ isBusy ? '加入中...' : '确认加入' }}
                </Button>
                <Button
                  variant="outline"
                  class="flex-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                  :disabled="isBusy"
                  @click="rejectMember"
                >
                  {{ isBusy ? '处理中...' : '拒绝邀请' }}
                </Button>
              </div>

              <div
                v-else
                class="flex gap-2.5 pt-1"
              >
                <Button
                  class="flex-1"
                  :disabled="isBusy"
                  @click="acceptStreamer"
                >
                  {{ isBusy ? '处理中...' : '确认授权' }}
                </Button>
                <Button
                  variant="destructive"
                  class="flex-1"
                  :disabled="isBusy"
                  @click="rejectStreamer"
                >
                  {{ isBusy ? '处理中...' : '拒绝授权' }}
                </Button>
              </div>
            </template>
          </template>
        </template>
      </CardContent>
    </Card>
  </main>
</template>
