<script setup lang="ts">
import { AddOutline, ArrowForward, BusinessOutline, RefreshOutline } from '@vicons/ionicons5'
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { isLoggedIn } from '@/api/account'
import { getApiOrgMy, postApiOrgCreate } from '@/api/generated/org/org'
import { unwrapOk } from '@/api/query'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'

import '@/apps/org/styles/org-page.css'
import type { OrgInfoModel } from '../types'
import { roleLabel } from '../utils'

const router = useRouter()

const isLoading = ref(false)
const orgs = ref<OrgInfoModel[]>([])

const showCreateModal = ref(false)
const creating = ref(false)
const orgName = ref('')

async function loadMyOrgs() {
  if (!isLoggedIn.value) return
  isLoading.value = true
  try {
    orgs.value = unwrapOk(await getApiOrgMy(), '加载失败')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    isLoading.value = false
  }
}

async function createOrg() {
  if (creating.value) return
  const name = orgName.value.trim()
  if (!name) {
    toast.warning('请输入组织名称')
    return
  }
  creating.value = true
  try {
    unwrapOk(await postApiOrgCreate({ name }), '创建失败')
    toast.success('创建成功')
    orgName.value = ''
    showCreateModal.value = false
    await loadMyOrgs()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '创建失败')
  } finally {
    creating.value = false
  }
}

function openOrg(orgId: number) {
  router.push({ name: 'org-detail', params: { orgId } })
}

function handleGoConsole() {
  router.push({ name: 'manage-index' })
}

onMounted(loadMyOrgs)

watch(
  () => isLoggedIn.value,
  async (loggedIn) => {
    if (!loggedIn) {
      orgs.value = []
      return
    }
    await loadMyOrgs()
  },
  { immediate: true },
)
</script>

<template>
  <div class="org-page org-page--index">
    <template v-if="!isLoggedIn">
      <Card class="border bg-card">
        <CardHeader class="p-4 border-b">
          <CardTitle class="text-base font-semibold">组织管理</CardTitle>
          <CardDescription class="text-xs">需要先登录才能查看/创建组织。</CardDescription>
        </CardHeader>
        <CardContent class="p-4">
          <RegisterAndLogin />
        </CardContent>
      </Card>
    </template>

    <template v-else>
      <div class="flex items-center justify-between gap-3 pb-4 border-b flex-wrap">
        <div>
          <h2 class="text-lg font-bold text-foreground">组织管理</h2>
          <p class="text-xs text-muted-foreground mt-0.5">管理我参与或创建的公会与组织</p>
        </div>

        <div class="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            class="h-8 text-xs"
            @click="handleGoConsole"
          >
            返回控制台
          </Button>
          <Button
            size="sm"
            variant="outline"
            class="h-8 text-xs gap-1.5"
            :disabled="isLoading"
            @click="loadMyOrgs"
          >
            <RefreshOutline class="size-3.5" :class="{ 'animate-spin': isLoading }" />
            刷新
          </Button>
          <Button
            size="sm"
            class="h-8 text-xs gap-1.5"
            @click="showCreateModal = true"
          >
            <AddOutline class="size-3.5" />
            创建组织
          </Button>
        </div>
      </div>

      <div class="mt-6">
        <div
          v-if="isLoading && orgs.length === 0"
          class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          <Card
            v-for="i in 4"
            :key="i"
            class="border bg-card p-4 space-y-3"
          >
            <div class="flex justify-between items-start">
              <Skeleton class="size-8 rounded" />
              <Skeleton class="w-14 h-5 rounded" />
            </div>
            <div class="space-y-1.5">
              <Skeleton class="w-3/5 h-4 rounded" />
              <Skeleton class="w-2/5 h-3 rounded" />
            </div>
            <Skeleton class="w-full h-7 rounded" />
          </Card>
        </div>

        <template v-else-if="orgs.length === 0">
          <Empty
            description="暂无组织，创建一个吧！"
            class="py-12"
          >
            <div class="mt-3">
              <Button
                size="sm"
                class="h-8 text-xs"
                @click="showCreateModal = true"
              >
                创建组织
              </Button>
            </div>
          </Empty>
        </template>

        <div
          v-else
          class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
        >
          <Card
            v-for="org in orgs"
            :key="org.id"
            class="border bg-card p-4 hover:border-primary transition-all cursor-pointer flex flex-col justify-between"
            @click="openOrg(org.id)"
          >
            <div>
              <div class="flex justify-between items-start">
                <BusinessOutline class="size-8 text-primary" />
                <Badge variant="secondary" class="text-xs">
                  {{ roleLabel(org.role) }}
                </Badge>
              </div>

              <div class="mt-3">
                <div class="font-semibold text-base text-foreground truncate">
                  {{ org.name }}
                </div>
                <div class="text-xs text-muted-foreground mt-0.5">ID: {{ org.id }}</div>
              </div>
            </div>

            <div class="mt-4 pt-2 border-t">
              <Button
                size="sm"
                variant="secondary"
                class="w-full h-7 text-xs gap-1 text-primary"
              >
                进入管理
                <ArrowForward class="size-3.5" />
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <!-- 创建组织模态框 -->
      <Dialog v-model:open="showCreateModal">
        <DialogContent class="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle class="text-base font-semibold">创建新组织</DialogTitle>
          </DialogHeader>

          <form @submit.prevent="createOrg" class="space-y-4 pt-2">
            <div class="space-y-1.5">
              <label class="text-xs font-medium text-foreground">组织名称</label>
              <Input
                v-model="orgName"
                placeholder="请输入组织名称"
                class="h-8 text-xs"
                autofocus
              />
            </div>

            <DialogFooter class="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                class="h-8 text-xs"
                @click="showCreateModal = false"
              >
                取消
              </Button>
              <Button
                type="submit"
                size="sm"
                class="h-8 text-xs"
                :disabled="creating"
              >
                {{ creating ? '创建中...' : '创建' }}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </template>
  </div>
</template>

<style scoped>
.org-page--index {
  padding: 24px;
}
</style>
