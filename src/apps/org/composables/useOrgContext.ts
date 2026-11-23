import type { InjectionKey, Ref } from 'vue'
import { computed, inject, provide, ref } from 'vue'

import { isLoggedIn } from '@/api/account'
import { getApiOrgOrgId } from '@/api/generated/org/org'

import type { OrgInfoModel } from '../types'

export interface OrgContext {
  orgId: Ref<number>
  orgInfo: Ref<OrgInfoModel | null>
  orgName: Ref<string>
  loadingOrgInfo: Ref<boolean>
  orgError: Ref<string | null>
  myRole: Ref<number | null>
  isOrgAdmin: Ref<boolean>
  canViewRevenue: Ref<boolean>
  refreshTick: Ref<number>
  loadOrgInfo: () => Promise<boolean>
  bumpRefresh: () => void
}

const ORG_CONTEXT_KEY: InjectionKey<OrgContext> = Symbol('org-context')

export function provideOrgContext(orgId: Ref<number>): OrgContext {
  const orgInfo = ref<OrgInfoModel | null>(null)
  const orgName = ref('')
  const loadingOrgInfo = ref(false)
  const orgError = ref<string | null>(null)
  const refreshTick = ref(0)

  const myRole = computed(() => orgInfo.value?.role ?? null)
  const isOrgAdmin = computed(() => myRole.value === 0 || myRole.value === 1)
  const canViewRevenue = computed(() => isOrgAdmin.value || orgInfo.value?.canViewRevenue === true)

  async function loadOrgInfo(): Promise<boolean> {
    if (!isLoggedIn.value) return false
    if (!Number.isInteger(orgId.value) || orgId.value <= 0) {
      orgInfo.value = null
      orgName.value = ''
      orgError.value = '无效的组织 ID'
      return false
    }
    loadingOrgInfo.value = true
    orgError.value = null
    try {
      const resp = await getApiOrgOrgId(orgId.value)
      if (resp.code === 200 && resp.data) {
        orgInfo.value = resp.data as OrgInfoModel
        orgName.value = resp.data.name
        return true
      }
      orgInfo.value = null
      orgName.value = ''
      orgError.value = resp.message || '无法加载组织信息或你不是该组织成员'
      return false
    } catch (err) {
      orgInfo.value = null
      orgName.value = ''
      orgError.value = err instanceof Error ? err.message : '加载组织信息失败'
      return false
    } finally {
      loadingOrgInfo.value = false
    }
  }

  function bumpRefresh() {
    refreshTick.value += 1
  }

  const ctx: OrgContext = {
    orgId,
    orgInfo,
    orgName,
    loadingOrgInfo,
    orgError,
    myRole,
    isOrgAdmin,
    canViewRevenue,
    refreshTick,
    loadOrgInfo,
    bumpRefresh,
  }
  provide(ORG_CONTEXT_KEY, ctx)
  return ctx
}

export function useOrgContext(): OrgContext {
  const ctx = inject(ORG_CONTEXT_KEY)
  if (!ctx) throw new Error('useOrgContext 必须在 provideOrgContext 之后调用')
  return ctx
}
