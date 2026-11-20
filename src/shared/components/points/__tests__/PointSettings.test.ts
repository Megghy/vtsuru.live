import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

const { getDetailMock, updateOrgSettingMock, guardShouldPromptRef, mockAccount } = vi.hoisted(() => ({
  getDetailMock: vi.fn(),
  updateOrgSettingMock: vi.fn(),
  guardShouldPromptRef: { getter: undefined as undefined | (() => boolean) },
  mockAccount: { value: null as any },
}))

vi.mock('@/api/account', () => ({
  SaveEnableFunctions: vi.fn(),
  SaveSetting: vi.fn(),
  useAccount: () => ref(mockAccount.value),
}))

vi.mock('@/api/generated/org/org', () => ({
  getApiOrgOrgIdAudit: vi.fn(async () => ({ code: 200, data: [] })),
  getApiOrgOrgIdPointsGoods: vi.fn(async () => ({ code: 200, data: [] })),
  getApiOrgOrgIdPointsStats: vi.fn(async () => ({ code: 200, data: {} })),
  getApiOrgOrgIdPointsSettingsDetail: getDetailMock,
  postApiOrgOrgIdPointsSettingsUpdate: updateOrgSettingMock,
}))

vi.mock('@/shared/composables/useUnsavedChangesGuard', () => ({
  useUnsavedChangesGuard: vi.fn((getter: () => boolean) => {
    guardShouldPromptRef.getter = getter
  }),
}))

vi.mock('@/shared/utils', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
}))

vi.mock('@/apps/org/composables/useOrgContext', () => ({
  useOrgContext: () => ({ orgId: computed(() => 1) }),
}))

vi.mock('@/apps/org/composables/useOrgStreamers', () => ({
  injectOrgStreamers: () => ({
    options: ref([
      { label: '主播10', value: 10 },
      { label: '主播20', value: 20 },
    ]),
  }),
}))

import OrgPointManage from '@/apps/org/components/OrgPointManage.vue'
import { FormField } from '@/shared/ui/form-field'
import { Select } from '@/shared/ui/select'

import PointSettings from '../PointSettings.vue'

function deferred<T>() {
  let resolve!: (val: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

const uiStubs = {
  TooltipProvider: { template: '<div><slot /></div>' },
  Tooltip: { template: '<div><slot /></div>' },
  TooltipTrigger: { template: '<div><slot /></div>' },
  TooltipContent: { template: '<div><slot /></div>' },
  Card: { template: '<div><slot /></div>' },
  CardHeader: { template: '<div><slot /></div>' },
  CardTitle: { template: '<div><slot /></div>' },
  CardContent: { template: '<div><slot /></div>' },
  Button: { template: '<button><slot /></button>' },
  Input: { props: ['modelValue'], template: '<input />' },
  NumberField: { props: ['modelValue'], template: '<input />' },
  FormField: { props: ['label', 'modelValue'], emits: ['update:modelValue'], template: '<div><slot /></div>' },
  SettingRow: { props: ['modelValue'], template: '<div><slot /></div>' },
  Separator: { template: '<hr />' },
  Checkbox: { props: ['checked'], template: '<input type="checkbox" />' },
  ToggleGroup: { props: ['modelValue'], template: '<div><slot /></div>' },
  ToggleGroupItem: { props: ['value'], template: '<div><slot /></div>' },
  Badge: { template: '<span><slot /></span>' },
  Alert: { template: '<div><slot /></div>' },
  AlertDescription: { template: '<div><slot /></div>' },
  Dialog: { template: '<div><slot /></div>' },
  DialogContent: { template: '<div><slot /></div>' },
  DialogHeader: { template: '<div><slot /></div>' },
  DialogTitle: { template: '<div><slot /></div>' },
  DialogFooter: { template: '<div><slot /></div>' },
  Popconfirm: { template: '<div><slot name="trigger" /><slot /></div>' },
  Empty: { template: '<div />' },
  Spin: { template: '<div />' },
  OrgAuditList: { template: '<div />' },
  Select: { props: ['modelValue'], emits: ['update:modelValue'], template: '<div><slot /></div>' },
  SelectTrigger: { template: '<div><slot /></div>' },
  SelectValue: { template: '<span />' },
  SelectContent: { template: '<div><slot /></div>' },
  SelectItem: { props: ['value'], template: '<div><slot /></div>' },
}

describe('PointSettings (org mode & concurrency guards)', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('组织端切换主播并发加载时丢弃晚到的旧主播响应，且 org 模式同样触发离开守卫', async () => {
    const req10 = deferred<any>()
    const req20 = deferred<any>()
    getDetailMock.mockImplementation((_orgId: number, params: { streamerId: number }) =>
      params.streamerId === 10 ? req10.promise : req20.promise,
    )
    updateOrgSettingMock.mockResolvedValue({ data: { code: 200, data: true } })

    const wrapper = mount(PointSettings, {
      props: { orgId: 1, streamerId: 10 },
      global: { stubs: uiStubs },
    })

    await wrapper.setProps({ streamerId: 20 })

    req20.resolve({ code: 200, data: { enableCheckIn: true, checkInKeyword: '主播20暗号', baseCheckInPoints: 20 } })
    await flushPromises()

    req10.resolve({ code: 200, data: { enableCheckIn: true, checkInKeyword: '陈旧主播10暗号', baseCheckInPoints: 10 } })
    await flushPromises()

    const keywordField = () => wrapper.findAllComponents(FormField).find((c) => c.props('label') === '签到关键词')
    expect(keywordField()?.props('modelValue')).toBe('主播20暗号')

    const vm = wrapper.vm as any
    expect(vm.isDirty).toBe(false)
    expect(guardShouldPromptRef.getter?.()).toBe(false)

    keywordField()!.vm.$emit('update:modelValue', '未保存草稿')
    await flushPromises()
    expect(keywordField()?.props('modelValue')).toBe('未保存草稿')
    expect(vm.isDirty).toBe(true)
    expect(guardShouldPromptRef.getter?.()).toBe(true)
  })

  it('OrgPointManage 在积分规则存在未保存修改且取消确认时不切换主播并保留草稿', async () => {
    getDetailMock.mockImplementation((_orgId: number, params: { streamerId: number }) =>
      Promise.resolve({
        code: 200,
        data: {
          enableCheckIn: true,
          checkInKeyword: `关键词_${params.streamerId}`,
          baseCheckInPoints: params.streamerId,
        },
      }),
    )

    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const wrapper = mount(OrgPointManage, {
      global: { stubs: uiStubs },
    })
    await flushPromises()

    const selectStub = wrapper.findComponent(Select)
    selectStub.vm.$emit('update:modelValue', '10')
    await flushPromises()

    const settingsWrapper = wrapper.findComponent(PointSettings)
    const keywordField = () =>
      settingsWrapper.findAllComponents(FormField).find((c) => c.props('label') === '签到关键词')
    expect(keywordField()?.props('modelValue')).toBe('关键词_10')

    keywordField()!.vm.$emit('update:modelValue', '已编辑未保存')
    await flushPromises()
    expect((settingsWrapper.vm as any).isDirty).toBe(true)

    getDetailMock.mockClear()
    selectStub.vm.$emit('update:modelValue', '20')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(getDetailMock).not.toHaveBeenCalled()
    expect(selectStub.props('modelValue')).toBe('10')
    expect(keywordField()?.props('modelValue')).toBe('已编辑未保存')
  })
})
