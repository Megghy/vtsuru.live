import type { InjectionKey, Ref } from 'vue'
import { computed, inject, provide, ref } from 'vue'
import { QueryGetAPI } from '@/api/query'
import { ORG_API_URL } from '@/shared/config'
import { isLoggedIn } from '@/api/account'
import type { OrgInfoModel } from '../types'

export interface OrgContext {
  orgId: Ref<number>
  orgInfo: Ref<OrgInfoModel | null>
  orgName: Ref<string>
  loadingOrgInfo: Ref<boolean>
  myRole: Ref<number | null>
  isOrgAdmin: Ref<boolean>
  loadOrgInfo: () => Promise<void>
}

const ORG_CONTEXT_KEY: InjectionKey<OrgContext> = Symbol('org-context')

export function provideOrgContext(orgId: Ref<number>): OrgContext {
  const orgInfo = ref<OrgInfoModel | null>(null)
  const orgName = ref('')
  const loadingOrgInfo = ref(false)

  const myRole = computed(() => orgInfo.value?.role ?? null)
  const isOrgAdmin = computed(() => myRole.value === 0 || myRole.value === 1)

  async function loadOrgInfo() {
    if (!isLoggedIn.value || !orgId.value) return
    loadingOrgInfo.value = true
    try {
      const resp = await QueryGetAPI<OrgInfoModel>(`${ORG_API_URL}${orgId.value}`)
      if (resp.code === 200) {
        orgInfo.value = resp.data
        orgName.value = resp.data.name
        return
      }
      orgInfo.value = null
      orgName.value = `组织 ${orgId.value}`
    } finally {
      loadingOrgInfo.value = false
    }
  }

  const ctx: OrgContext = { orgId, orgInfo, orgName, loadingOrgInfo, myRole, isOrgAdmin, loadOrgInfo }
  provide(ORG_CONTEXT_KEY, ctx)
  return ctx
}

export function useOrgContext(): OrgContext {
  const ctx = inject(ORG_CONTEXT_KEY)
  if (!ctx) throw new Error('useOrgContext 必须在 provideOrgContext 之后调用')
  return ctx
}
