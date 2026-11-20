import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { GoodsSalePhase, GoodsStatus, GoodsTypes, GuardLevel, VirtualKeySelectionMode } from '@/api/generated/model'

const { getGoodsMock, updateStatusMock, mockAccount } = vi.hoisted(() => ({
  getGoodsMock: vi.fn(),
  updateStatusMock: vi.fn(),
  mockAccount: {
    value: {
      id: 100,
      name: '测试主播',
      settings: {
        point: {},
        enableFunctions: [],
      },
    } as any,
  },
}))

vi.mock('@vueuse/router', () => ({
  useRouteHash: () => ref('#goods'),
}))

vi.mock('@/api/account', () => ({
  useAccount: () => ref(mockAccount.value),
}))

vi.mock('@/store/useBiliAuth', () => ({
  useBiliAuth: () => ({
    GetGoods: getGoodsMock,
  }),
}))

vi.mock('@/api/generated/point/point', () => ({
  postApiPointDeleteGoods: vi.fn(),
  postApiPointToggleGoodsPin: vi.fn(),
  postApiPointUpdateGoodsStatus: updateStatusMock,
}))

vi.mock('@/api/point-orders', () => ({
  fetchOwnerOrders: vi.fn(async () => []),
}))

vi.mock('@/shared/storage/persist', () => ({
  usePersistedStorage: (_key: string, defaultVal: any) => ref(defaultVal === 'grid' ? 'table' : defaultVal),
}))

vi.mock('@/shared/utils', () => ({
  copyToClipboard: vi.fn(),
  useMessage: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}))

import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'

import PointManage from '../PointManage.vue'

function makeGoods(id: number, name: string) {
  return {
    id,
    name,
    description: `${name}_desc`,
    price: 100,
    originalPrice: 100,
    count: 10,
    tags: [],
    images: [],
    status: GoodsStatus.Normal,
    type: GoodsTypes.Virtual,
    content: 'c',
    embedCollectUrl: false,
    isPinned: false,
    isAllowRebuy: true,
    maxBuyCount: 1,
    createAt: 0,
    isOnDiscount: false,
    salePhase: GoodsSalePhase.Active,
    canFreeBuy: false,
    hasGuardFreePrivilege: false,
    allowGuardLevel: GuardLevel.None,
    setting: {
      allowGuardLevel: GuardLevel.None,
      allowGuardFreeMinLevel: GuardLevel.None,
    },
    virtualKeys: [],
    keySelectionMode: VirtualKeySelectionMode.None,
    soldCount: 0,
    purchasedCount: 0,
    hasPurchased: false,
    canPurchase: true,
  }
}

const slotStub = { template: '<div><slot /></div>' }

const stubs = {
  ManagePageHeader: { template: '<div><slot /><slot name="actions" /></div>' },
  EventFetcherStatusCard: true,
  PointGoodsItem: true,
  PointOrderManage: true,
  PointSettings: true,
  PointCheckInOverview: true,
  PointGlobalHistoryView: true,
  PointGoodsEditDialog: true,
  PointGuardDuplicateManage: true,
  PointTestPanel: true,
  PointUserManage: true,
  Empty: true,
  Dialog: true,
  DropdownMenu: true,
  Tabs: slotStub,
  TabsList: slotStub,
  TabsTrigger: slotStub,
  TabsContent: slotStub,
  Spin: slotStub,
  Separator: true,
  Badge: slotStub,
  Button: { emits: ['click'], template: '<button @click="$emit(\'click\')"><slot /></button>' },
  Input: { props: ['modelValue', 'placeholder'], emits: ['update:modelValue'], template: '<input />' },
  Select: slotStub,
  SelectTrigger: slotStub,
  SelectValue: slotStub,
  SelectContent: slotStub,
  SelectItem: slotStub,
  ToggleGroup: slotStub,
  ToggleGroupItem: slotStub,
  Table: slotStub,
  TableHeader: slotStub,
  TableRow: slotStub,
  TableHead: slotStub,
  TableBody: slotStub,
  TableCell: slotStub,
  Popconfirm: slotStub,
  Checkbox: {
    props: ['checked'],
    emits: ['update:checked'],
    template: '<input type="checkbox" :checked="checked" />',
  },
}

describe('PointManage (filtered selection scope)', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('筛选后全选与取消全选仅增删当前筛选结果，保留范围外已选礼物 ID', async () => {
    getGoodsMock.mockResolvedValue([makeGoods(1, '苹果徽章'), makeGoods(2, '香蕉立牌')])
    updateStatusMock.mockResolvedValue({ code: 200 })

    const wrapper = mount(PointManage, {
      global: { stubs },
    })
    await flushPromises()

    // filteredGoods 按 id 倒序：[0] 为表头全选，[1] 为 id=2「香蕉立牌」，[2] 为 id=1「苹果徽章」
    const checkboxesInitial = wrapper.findAllComponents(Checkbox)
    checkboxesInitial[2].vm.$emit('update:checked', true)
    await flushPromises()
    expect(wrapper.text()).toContain('已选择 1 件礼物')

    // 输入搜索词「香蕉」隐藏 id=1，仅显示 id=2
    const searchInput = wrapper.findAllComponents(Input).find((i) => i.props('placeholder')?.includes('搜索礼物'))
    expect(searchInput).toBeTruthy()
    searchInput!.vm.$emit('update:modelValue', '香蕉')
    await flushPromises()

    // 勾选表头全选（[0]=批量栏全选, [1]=表头全选, [2]=香蕉行）：应合并保留 id=1 -> 共 2 件
    const tableCheckboxesFiltered = wrapper.findAllComponents(Checkbox)
    const selectAllCheckbox = tableCheckboxesFiltered[1]
    selectAllCheckbox.vm.$emit('update:checked', true)
    await flushPromises()
    expect(wrapper.text()).toContain('已选择 2 件礼物')
    expect(selectAllCheckbox.props('checked')).toBe(true)

    // 取消全选当前筛选结果，仅取消 id=2，仍保留范围外的 id=1
    selectAllCheckbox.vm.$emit('update:checked', false)
    await flushPromises()
    expect(wrapper.text()).toContain('已选择 1 件礼物')
    expect(selectAllCheckbox.props('checked')).toBe(false)

    // 点击「批量下架」，验证实际仅下架保留下来的 [1]
    const offShelfBtn = wrapper.findAll('button').find((b) => b.text().includes('批量下架'))
    expect(offShelfBtn).toBeTruthy()
    await offShelfBtn!.trigger('click')
    await flushPromises()
    expect(updateStatusMock).toHaveBeenCalledWith({ ids: [1], status: GoodsStatus.Discontinued })
    expect(wrapper.text()).not.toContain('已选择')
  })
})
