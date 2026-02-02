<script setup lang="ts">
import type {
  UploadFileInfo,
} from 'naive-ui'
import type {
  ResponsePointGoodModel,
  UploadSubPointGoodsModel,
  UploadPointGoodsModel,
} from '@/api/api-models'
import { Add24Filled, ArrowSync24Filled, Delete24Filled, Edit24Filled, Eye24Filled, Info24Filled, ShoppingBag24Filled, } from '@vicons/fluent'
import { useRouteHash } from '@vueuse/router'
import {
  NAlert,
  NButton,
  NCheckbox,
  NCollapse,
  NCollapseItem,
  NDynamicTags,
  NEmpty,
  NFlex,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NIcon,
  NInput,
  NInputGroup,
  NInputNumber,
  NModal,
  NPopconfirm,
  NProgress,
  NRadioButton,
  NRadioGroup,
  NScrollbar,
  NSelect,
  NTabPane,
  NTabs,
  NText,
  NTooltip,
  NUpload,
  useDialog,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { useAccount } from '@/api/account'
import {
  FunctionTypes,
  GoodsStatus,
  GoodsTypes,
  KeySelectionMode,
  UserFileLocation,
} from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import EventFetcherStatusCard from '@/apps/manage/components/event-fetcher/EventFetcherStatusCard.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import PointGoodsItem from '@/shared/components/points/PointGoodsItem.vue'
import { CURRENT_HOST, POINT_API_URL } from '@/shared/config'
import { uploadFiles, UploadStage } from '@/shared/services/fileUpload'
import { useBiliAuth } from '@/store/useBiliAuth'
import { copyToClipboard } from '@/shared/utils'
import PointOrderManage from '@/shared/components/points/PointOrderManage.vue'
import PointSettings from '@/shared/components/points/PointSettings.vue'
import PointUserManage from './PointUserManage.vue'
import PointTestPanel from './PointTestPanel.vue'

const message = useMessage()
const accountInfo = useAccount()
const dialog = useDialog()
const biliAuth = useBiliAuth()
const formRef = ref()
const isUpdating = ref(false)
const isAllowedPrivacyPolicy = ref(false)
const showAddGoodsModal = ref(false)
const uploadProgress = ref(0)
const isUploadingCover = ref(false)
const goodsModalTab = ref<'basic' | 'exchange' | 'subItems' | 'advanced'>('basic')
const subItemsSortMode = ref<'manual' | 'name' | 'price' | 'stock'>('manual')
let tempSubItemIdSeed = -1

// 路由哈希处理
const realHash = useRouteHash('goods', { mode: 'replace' })
const hash = computed({
  get() {
    return realHash.value?.startsWith('#') ? realHash.value.slice(1) : realHash.value || 'goods'
  },
  set(val) {
    realHash.value = `#${val}`
  },
})

// 商品数据及模型
const goods = ref<ResponsePointGoodModel[]>(await biliAuth.GetGoods(accountInfo.value?.id, message))
function sortGoods(a: ResponsePointGoodModel, b: ResponsePointGoodModel) {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
  return b.id - a.id
}
const onShelfGoods = computed(() => goods.value.filter(g => g.status !== GoodsStatus.Discontinued).slice().sort(sortGoods))
const offShelfGoods = computed(() => goods.value.filter(g => g.status === GoodsStatus.Discontinued).slice().sort(sortGoods))

function defaultGoodsModel(): { goods: UploadPointGoodsModel, fileList: UploadFileInfo[] } {
  return {
    goods: {
      type: GoodsTypes.Virtual,
      status: GoodsStatus.Normal,
      maxBuyCount: 1,
      isAllowRebuy: false,
      isPinned: false,
      setting: {
        allowGuardLevel: 0,
        allowGuardFreeMinLevel: 0,
      },
      virtualKeys: [],
      keySelectionMode: KeySelectionMode.None,
      currentKeyIndex: 0,
      subItems: [],
      name: '',
      price: 0,
      tags: [],
      description: '',
      cover: undefined,
    } as UploadPointGoodsModel,
    fileList: [],
  }
}
const currentGoodsModel = ref<{ goods: UploadPointGoodsModel, fileList: UploadFileInfo[] }>(
  defaultGoodsModel(),
)
const subItemFileLists = ref<Record<string, UploadFileInfo[]>>({})

function getSubItemKey(sub: UploadSubPointGoodsModel) {
  return String(sub.id)
}

function ensureSubItems() {
  currentGoodsModel.value.goods.subItems ??= []
}

function addSubItem() {
  ensureSubItems()
  const parent = currentGoodsModel.value.goods
  const tempId = tempSubItemIdSeed--
  const sub: UploadSubPointGoodsModel = {
    id: tempId,
    name: '',
    price: parent.price,
    stock: undefined,
    description: undefined,
    type: undefined,
    tags: undefined,
    cover: undefined,
    collectUrl: undefined,
    embedCollectUrl: undefined,
    isAllowRebuy: undefined,
    maxBuyCount: undefined,
    content: undefined,
    virtualKeys: undefined,
    keySelectionMode: undefined,
    setting: undefined,
  }
  currentGoodsModel.value.goods.subItems!.push(sub)
  subItemFileLists.value[getSubItemKey(sub)] = []
}

function removeSubItemByKey(subKey: string) {
  ensureSubItems()
  const list = currentGoodsModel.value.goods.subItems!
  const index = list.findIndex(s => getSubItemKey(s) === subKey)
  if (index < 0) return
  const sub = list[index]
  if (sub) {
    delete subItemFileLists.value[getSubItemKey(sub)]
  }
  list.splice(index, 1)
}

function updateSubItemFileList(subKey: string, list: UploadFileInfo[]) {
  subItemFileLists.value[subKey] = list
}

function moveSubItemByKey(subKey: string, direction: -1 | 1) {
  if (subItemsSortMode.value !== 'manual') return
  ensureSubItems()
  const list = currentGoodsModel.value.goods.subItems!
  const index = list.findIndex(s => getSubItemKey(s) === subKey)
  if (index < 0) return
  const nextIndex = index + direction
  if (nextIndex < 0 || nextIndex >= list.length) return
  const [item] = list.splice(index, 1)
  list.splice(nextIndex, 0, item)
}

function resolveSubType(sub: UploadSubPointGoodsModel) {
  return sub.type ?? currentGoodsModel.value.goods.type
}

// 监听 fileList 变化，确保 cover 和 fileList 同步
watch(() => currentGoodsModel.value.fileList, (newFileList, oldFileList) => {
  if (oldFileList && oldFileList.length > 0 && newFileList.length === 0) {
    if (currentGoodsModel.value.goods.id && currentGoodsModel.value.goods.cover) {
      currentGoodsModel.value.goods.cover = undefined
    }
  }
}, { deep: true })

// 计算属性
const allowedYearOptions = computed(() => {
  return Array.from({ length: new Date().getFullYear() - 2024 + 1 }, (_, i) => 2024 + i).map(item => ({
    label: `${item.toString()}年`,
    value: item,
  }))
})

const allowedMonthOptions = computed(() => {
  return Array.from({ length: 12 }, (_, i) => i + 1).map(item => ({
    label: `${item.toString()}月`,
    value: item,
  }))
})

const existTags = computed(() => {
  if (goods.value.length === 0) return []

  const tempSet = new Set<string>()
  for (const good of goods.value) {
    if (!good.tags || good.tags.length === 0) continue
    good.tags.forEach(tag => tempSet.add(tag))
  }

  return Array.from(tempSet).map(tag => ({ label: tag, value: tag }))
})

const subItemsForDisplay = computed(() => {
  const list = currentGoodsModel.value.goods.subItems ?? []
  if (subItemsSortMode.value === 'manual') return list
  const cloned = list.slice()
  if (subItemsSortMode.value === 'name') {
    cloned.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  } else if (subItemsSortMode.value === 'price') {
    cloned.sort((a, b) => (Number(a.price ?? 0) - Number(b.price ?? 0)))
  } else if (subItemsSortMode.value === 'stock') {
    const toStock = (v: number | undefined) => (v === undefined ? Number.POSITIVE_INFINITY : Number(v))
    cloned.sort((a, b) => toStock(a.stock) - toStock(b.stock))
  }
  return cloned
})

// 表单验证规则
const rules = {
  'name': {
    required: true,
    message: '请输入礼物名称',
  },
  'price': {
    required: true,
    message: '请输入礼物价格',
  },
  'type': {
    required: true,
    message: '请选择是虚拟礼物或实物',
  },
}

async function updateGoods(e: MouseEvent) {
  if (isUpdating.value || !formRef.value) return
  e.preventDefault()
  isUpdating.value = true
  isUploadingCover.value = false
  uploadProgress.value = 0

  try {
    if (currentGoodsModel.value.goods.setting?.guardFree !== undefined) {
      currentGoodsModel.value.goods.setting.guardFree = undefined
    }
    if (currentGoodsModel.value.goods.setting?.guardFreeMonths) {
      const months = currentGoodsModel.value.goods.setting.guardFreeMonths
      if (months.length > 0) {
        for (const m of months) {
          if (!m?.year || !m?.month) {
            throw new Error('请选择舰长免费兑换的年份和月份')
          }
        }
      }
    }

    if (currentGoodsModel.value.goods.setting?.guardLevelMonths) {
      const months = currentGoodsModel.value.goods.setting.guardLevelMonths
      if (months.length > 0) {
        for (const m of months) {
          if (!m?.year || !m?.month) {
            throw new Error('请选择最低兑换等级限制的年份和月份')
          }
        }
      }
    }

    await formRef.value.validate()

    // 父商品：实物且使用站外收集时，必须是合法 URL；使用本站收集时需要勾选隐私协议
    if (currentGoodsModel.value.goods.type === GoodsTypes.Physical) {
      const url = currentGoodsModel.value.goods.collectUrl
      if (url !== undefined) {
        try {
          // eslint-disable-next-line no-new
          new URL(url)
        } catch {
          throw new Error('请输入正确的收集链接')
        }
      } else if (!isAllowedPrivacyPolicy.value) {
        throw new Error('需要阅读并同意本站隐私协议')
      }
      if ((currentGoodsModel.value.goods.maxBuyCount ?? 0) < 1) {
        throw new Error('最大兑换数量必须大于 0')
      }
    } else if (currentGoodsModel.value.goods.type === GoodsTypes.Virtual) {
      if ((currentGoodsModel.value.goods.content?.length ?? 0) === 0) {
        throw new Error('请输入虚拟礼物的具体内容')
      }
    }

    // 款式校验与“默认继承父商品”归一化（尽量不下发与父商品相同的字段）
    ensureSubItems()
    const parent = currentGoodsModel.value.goods
    for (const sub of (currentGoodsModel.value.goods.subItems ?? [])) {
      const name = (sub.name ?? '').trim()
      if (!name) throw new Error('款式名称不能为空')
      sub.name = name

      if (sub.price === undefined || sub.price === null || Number(sub.price) < 0) {
        throw new Error(`款式 ${name} 的积分价格不能小于0`)
      }

      if (sub.stock !== undefined && sub.stock !== null && Number(sub.stock) < 0) {
        throw new Error(`款式 ${name} 的库存不能小于0`)
      }

      if (sub.maxBuyCount !== undefined && sub.maxBuyCount !== null && Number(sub.maxBuyCount) < 1) {
        throw new Error(`款式 ${name} 的最大兑换数量必须大于0`)
      }

      // 外部收集链接：如果启用站外收集，则必须填写链接（\"\" 表示本站收集）
      if (sub.collectUrl !== undefined && sub.collectUrl !== null && sub.collectUrl !== '' && !String(sub.collectUrl).trim()) {
        throw new Error(`款式 ${name} 的收集链接不能为空`)
      }

      if (sub.collectUrl !== undefined && sub.collectUrl !== '' && sub.collectUrl !== null) {
        try {
          // eslint-disable-next-line no-new
          new URL(String(sub.collectUrl))
        } catch {
          throw new Error(`款式 ${name} 的收集链接不合法`)
        }
      }

      // 归一化：与父商品一致则不下发，交给后端按“继承父商品”处理
      if (sub.description !== undefined && (sub.description ?? '').trim() === '') sub.description = undefined
      if (sub.description === parent.description) sub.description = undefined
      if (sub.type === parent.type) sub.type = undefined
      if (sub.isAllowRebuy === parent.isAllowRebuy) sub.isAllowRebuy = undefined
      if (sub.maxBuyCount === parent.maxBuyCount) sub.maxBuyCount = undefined
      if (sub.collectUrl === parent.collectUrl) sub.collectUrl = undefined
      if (sub.collectUrl === undefined) sub.embedCollectUrl = undefined
      if (sub.embedCollectUrl === parent.embedCollectUrl) sub.embedCollectUrl = undefined
    }

    const newFilesToUpload = currentGoodsModel.value.fileList.filter(f => f.file && f.status !== 'finished')
    if (newFilesToUpload.length > 0 && newFilesToUpload[0].file) {
      isUploadingCover.value = true
      message.info('正在上传封面...')
      const uploadResults = await uploadFiles(
        [newFilesToUpload[0].file],
        undefined,
        UserFileLocation.Local,
        (stage: string) => {
          if (stage === UploadStage.Uploading) {
            uploadProgress.value = 0
          }
        },
      )
      isUploadingCover.value = false
      if (uploadResults && uploadResults.length > 0) {
        currentGoodsModel.value.goods.cover = uploadResults[0]
        message.success('封面上传成功')
        const uploadedFileIndex = currentGoodsModel.value.fileList.findIndex(f => f.id === newFilesToUpload[0].id)
        if (uploadedFileIndex > -1) {
          currentGoodsModel.value.fileList[uploadedFileIndex] = {
            ...currentGoodsModel.value.fileList[uploadedFileIndex],
            id: uploadResults[0].id.toString(),
            status: 'finished',
            thumbnailUrl: uploadResults[0].path,
            url: uploadResults[0].path,
          }
        }
      } else {
        throw new Error('封面上传失败')
      }
    } else if (currentGoodsModel.value.fileList.length === 0 && currentGoodsModel.value.goods.id) {
      currentGoodsModel.value.goods.cover = undefined
    }

    // 上传款式封面（如有）
    ensureSubItems()
    for (const sub of (currentGoodsModel.value.goods.subItems ?? [])) {
      const key = getSubItemKey(sub)
      const fileList = subItemFileLists.value[key] ?? []
      const newFilesToUpload = fileList.filter(f => f.file && f.status !== 'finished')
      if (newFilesToUpload.length > 0 && newFilesToUpload[0].file) {
        isUploadingCover.value = true
        message.info(`正在上传款式封面: ${sub.name || '未命名'}...`)
        const uploadResults = await uploadFiles(
          [newFilesToUpload[0].file],
          undefined,
          UserFileLocation.Local,
          (stage: string) => {
            if (stage === UploadStage.Uploading) {
              uploadProgress.value = 0
            }
          },
        )
        isUploadingCover.value = false
        if (uploadResults && uploadResults.length > 0) {
          sub.cover = uploadResults[0]
          message.success(`款式封面上传成功: ${sub.name || uploadResults[0].name || '封面'}`)
          // 同步 fileList 状态
          subItemFileLists.value[key] = [
            {
              id: uploadResults[0].id.toString(),
              name: uploadResults[0].name || '封面',
              status: 'finished',
              thumbnailUrl: uploadResults[0].path,
              url: uploadResults[0].path,
            },
          ]
        } else {
          throw new Error(`款式封面上传失败: ${sub.name || '未命名'}`)
        }
      } else if (fileList.length === 0) {
        // 清空封面 => 让后端按“继承父商品”处理
        sub.cover = undefined
      }
    }

    const { code, data, message: errMsg } = await QueryPostAPI<ResponsePointGoodModel>(
      `${POINT_API_URL}update-goods`,
      currentGoodsModel.value.goods,
    )

    if (code === 200) {
      message.success('商品信息保存成功')
      showAddGoodsModal.value = false
      currentGoodsModel.value = defaultGoodsModel()

      const index = goods.value.findIndex(g => g.id === data.id)
      if (index >= 0) {
        goods.value[index] = data
      } else {
        goods.value.push(data)
      }
    } else {
      message.error(`商品信息保存失败: ${errMsg}`)
    }
  } catch (err: any) {
    console.error(currentGoodsModel.value, err)
    const errorMsg = err instanceof Error ? err.message : typeof err === 'string' ? err : '表单验证失败或上传出错'
    message.error(`失败: ${errorMsg}`)
  } finally {
    isUpdating.value = false
    isUploadingCover.value = false
  }
}

function OnFileListChange(files: UploadFileInfo[]) {
  if (files.length === 1 && (files[0].file?.size ?? 0) > 10 * 1024 * 1024) {
    message.error('文件大小不能超过10MB')
    currentGoodsModel.value.fileList = []
  } else {
    currentGoodsModel.value.fileList = files
  }
}

function onUpdateClick(item: ResponsePointGoodModel) {
  const copiedItem = JSON.parse(JSON.stringify(item))
  // 确保 setting 对象存在
  if (!copiedItem.setting) {
    copiedItem.setting = {
      allowGuardLevel: 0,
      allowGuardFreeMinLevel: 0,
    }
  }

  if (copiedItem.setting?.allowGuardFreeMinLevel === undefined) {
    copiedItem.setting.allowGuardFreeMinLevel = 0
  }

  if (copiedItem.setting?.guardFreeMonths === undefined && copiedItem.setting?.guardFree) {
    copiedItem.setting.guardFreeMonths = [copiedItem.setting.guardFree]
  }

  if (copiedItem.count === null) copiedItem.count = undefined
  if (copiedItem.collectUrl === null) copiedItem.collectUrl = undefined
  if (copiedItem.embedCollectUrl === null) copiedItem.embedCollectUrl = undefined

  const parentCoverId = item.cover?.id
  const parentCollectUrl = copiedItem.collectUrl ?? undefined
  const parentEmbedCollectUrl = copiedItem.embedCollectUrl ?? undefined
  const parentType = copiedItem.type
  const parentIsAllowRebuy = copiedItem.isAllowRebuy
  const parentMaxBuyCount = copiedItem.maxBuyCount ?? 1
  const parentDescription = copiedItem.description ?? undefined

  // 款式：响应模型使用 count 表示库存，这里映射为 stock
  if (Array.isArray(item.subItems)) {
    copiedItem.subItems = item.subItems.map((s: any) => ({
      id: s.id,
      name: s.name,
      price: s.price,
      stock: s.count ?? undefined,
      description: (s.description ?? undefined) === parentDescription ? undefined : (s.description ?? undefined),
      type: s.type === parentType ? undefined : s.type,
      tags: JSON.stringify(s.tags ?? []) === JSON.stringify(copiedItem.tags ?? []) ? undefined : s.tags,
      cover: (s.cover && parentCoverId && s.cover.id === parentCoverId) ? undefined : s.cover,
      collectUrl: ((s.collectUrl ?? undefined) === parentCollectUrl) ? undefined : (s.collectUrl ?? undefined),
      embedCollectUrl:
        ((s.collectUrl ?? undefined) === parentCollectUrl)
          ? undefined
          : ((s.embedCollectUrl ?? undefined) === parentEmbedCollectUrl ? undefined : (s.embedCollectUrl ?? undefined)),
      isAllowRebuy: s.isAllowRebuy === parentIsAllowRebuy ? undefined : s.isAllowRebuy,
      maxBuyCount: s.maxBuyCount === parentMaxBuyCount ? undefined : s.maxBuyCount,
      content: (s.content ?? undefined) === (copiedItem.content ?? undefined) ? undefined : (s.content ?? undefined),
      virtualKeys: JSON.stringify(s.virtualKeys ?? []) === JSON.stringify(copiedItem.virtualKeys ?? []) ? undefined : s.virtualKeys,
      keySelectionMode: s.keySelectionMode === copiedItem.keySelectionMode ? undefined : s.keySelectionMode,
      setting: JSON.stringify(s.setting ?? {}) === JSON.stringify(copiedItem.setting ?? {}) ? undefined : s.setting,
    })) as UploadSubPointGoodsModel[]
  } else {
    copiedItem.subItems = []
  }

  // 初始化款式封面上传列表
  subItemFileLists.value = {}
  for (const s of (copiedItem.subItems as UploadSubPointGoodsModel[])) {
    const key = getSubItemKey(s)
    subItemFileLists.value[key] = s.cover
      ? [
          {
            id: s.cover.id.toString(),
            name: s.cover.name || '封面',
            status: 'finished',
            url: s.cover.path,
            thumbnailUrl: s.cover.path,
          },
        ]
      : []
  }
  currentGoodsModel.value = {
    goods: copiedItem,
    fileList: item.cover
      ? [
          {
            id: item.cover.id.toString(),
            name: item.cover.name || '封面',
            status: 'finished',
            url: item.cover.path,
            thumbnailUrl: item.cover.path,
          },
        ]
      : [],
  }
  isAllowedPrivacyPolicy.value = true
  goodsModalTab.value = 'basic'
  subItemsSortMode.value = 'manual'
  showAddGoodsModal.value = true
}

async function onSetShelfClick(item: ResponsePointGoodModel, status: GoodsStatus) {
  const d = dialog.warning({
    title: '警告',
    content: `你确定要${status == GoodsStatus.Normal ? '重新上架' : '下架'}这个礼物吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      d.loading = true
      const originStatus = item.status

      try {
        const { code, message: errMsg } = await QueryPostAPI(`${POINT_API_URL}update-goods-status`, {
          ids: [item.id],
          status,
        })

        if (code === 200) {
          message.success('成功')
          const index = goods.value.findIndex(g => g.id === item.id)
          if (index > -1) {
            goods.value[index].status = status
          }
        } else {
          message.error(`失败: ${errMsg}`)
          item.status = originStatus
          console.error(errMsg)
        }
      } catch (err) {
        message.error(`失败: ${err}`)
        item.status = originStatus
        console.error(err)
      } finally {
        d.loading = false
      }
    },
  })
}

function onDeleteClick(item: ResponsePointGoodModel) {
  const d = dialog.warning({
    title: '警告',
    content: '你确定要删除这个礼物吗？',
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      d.loading = true

      try {
        const { code, message: errMsg } = await QueryGetAPI(`${POINT_API_URL}delete-goods`, {
          id: item.id,
        })

        if (code === 200) {
          message.success('成功')
          goods.value = goods.value.filter(g => g.id !== item.id)
        } else {
          message.error(`失败: ${errMsg}`)
          console.error(errMsg)
        }
      } catch (err) {
        message.error(`失败: ${err}`)
        console.error(err)
      } finally {
        d.loading = false
      }
    },
  })
}

function onModalOpen() {
  if (!currentGoodsModel.value.goods.id) {
    resetGoods()
  }
  goodsModalTab.value = 'basic'
  subItemsSortMode.value = 'manual'
  showAddGoodsModal.value = true
}

function resetGoods() {
  currentGoodsModel.value = defaultGoodsModel()
  subItemFileLists.value = {}
  isAllowedPrivacyPolicy.value = false
  goodsModalTab.value = 'basic'
  subItemsSortMode.value = 'manual'
}

onMounted(() => { })
</script>

<template>
  <!-- 头部 -->
  <ManagePageHeader
    title="积分管理"
    subtitle="礼物、订单、用户与配置"
    :function-type="FunctionTypes.Point"
  />

  <NCard size="small" :bordered="true" content-style="padding: 12px;">
    <NFlex justify="space-between" align="center" wrap :gap="12">
      <NAlert
        v-if="!accountInfo.eventFetcherState.online"
        :type="accountInfo.settings.enableFunctions.includes(FunctionTypes.Point) && accountInfo.eventFetcherState.online
          ? 'success'
          : 'warning'
        "
        :bordered="false"
        style="flex: 1; min-width: 300px"
      >
        <NFlex align="center" :gap="8" wrap>
          <NText>
            此功能依赖
            <NButton
              text
              type="primary"
              tag="a"
              href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
              target="_blank"
            >
              VtsuruEventFetcher
            </NButton>
            (事件监听器), 否则将无法自动记录礼物/舰长等事件
          </NText>
          <NDivider vertical />
          <NButton
            text
            type="info"
            tag="a"
            href="https://www.wolai.com/ueENtfAm9gPEqHrAVSB2Co"
            target="_blank"
          >
            积分系统说明
          </NButton>
        </NFlex>
      </NAlert>
      <EventFetcherStatusCard />
    </NFlex>
  </NCard>

  <NCard size="small" :bordered="true" content-style="padding: 12px;">
    <NText class="manage-kicker">
      礼物展示页链接
    </NText>
    <NFlex align="center" :gap="12" style="margin-top: 10px;">
      <NInputGroup style="max-width: 420px;">
        <NInput :value="`${CURRENT_HOST}@${accountInfo.name}/goods`" readonly />
        <NButton secondary @click="copyToClipboard(`${CURRENT_HOST}@${accountInfo.name}/goods`)">
          复制
        </NButton>
      </NInputGroup>
    </NFlex>
  </NCard>

  <!-- 主要内容标签页 -->
  <NTabs
    v-model:value="hash"
    animated
  >
    <!-- 礼物管理标签页 -->
    <NTabPane
      name="goods"
      tab="礼物"
    >
      <NFlex
        justify="start"
        :gap="12"
        style="margin-bottom: 16px"
      >
        <NButton
          type="primary"
          size="medium"
          @click="onModalOpen"
        >
          <template #icon>
            <NIcon :component="Add24Filled" />
          </template>
          添加礼物
        </NButton>
        <NButton
          secondary
          size="medium"
          @click="$router.push({ name: 'user-goods', params: { id: accountInfo?.name } })"
        >
          <template #icon>
            <NIcon :component="Eye24Filled" />
          </template>
          前往展示页
        </NButton>
      </NFlex>

      <!-- 上架礼物列表 -->
      <NEmpty
        v-if="onShelfGoods.length === 0"
        description="暂无礼物"
      />
      <NGrid
        v-else
        cols="1 500:2 700:3 1000:4 1200:5"
        :x-gap="16"
        :y-gap="16"
      >
        <NGridItem
          v-for="item in onShelfGoods"
          :key="item.id"
        >
          <PointGoodsItem
            :goods="item"
            :is-manage="true"
            class="point-goods-card"
          >
            <template #footer>
              <NFlex
                vertical
                :gap="8"
                style="width: 100%"
              >
                <NText style="font-size: 14px; color: var(--n-primary-color); font-weight: 500;">
                  <NIcon
                    :component="ShoppingBag24Filled"
                    style="vertical-align: -0.15em; margin-right: 4px"
                  />
                  积分: {{ item.price }}
                </NText>
                <NFlex
                  justify="space-between"
                  :gap="8"
                >
                  <NButton
                    type="info"
                    size="small"
                    style="flex: 1"
                    @click="onUpdateClick(item)"
                  >
                    <template #icon>
                      <NIcon :component="Edit24Filled" />
                    </template>
                    修改
                  </NButton>
                  <NButton
                    type="warning"
                    size="small"
                    style="flex: 1"
                    @click="onSetShelfClick(item, GoodsStatus.Discontinued)"
                  >
                    <template #icon>
                      <NIcon :component="ArrowSync24Filled" />
                    </template>
                    下架
                  </NButton>
                  <NButton
                    type="error"
                    size="small"
                    style="flex: 1"
                    @click="onDeleteClick(item)"
                  >
                    <template #icon>
                      <NIcon :component="Delete24Filled" />
                    </template>
                    删除
                  </NButton>
                </NFlex>
              </NFlex>
            </template>
          </PointGoodsItem>
        </NGridItem>
      </NGrid>

      <!-- 下架礼物列表 -->
      <NDivider style="margin: 24px 0 16px">
        已下架
      </NDivider>
      <NEmpty
        v-if="offShelfGoods.length === 0"
        description="暂无已下架的礼物"
      />
      <NGrid
        v-else
        cols="1 500:2 700:3 1000:4 1200:5"
        :x-gap="16"
        :y-gap="16"
      >
        <NGridItem
          v-for="item in offShelfGoods"
          :key="item.id"
        >
          <PointGoodsItem
            :goods="item"
            :is-manage="true"
            class="point-goods-card"
          >
            <template #footer>
              <NFlex
                vertical
                :gap="8"
                style="width: 100%"
              >
                <NText style="font-size: 14px; color: var(--n-primary-color); font-weight: 500;">
                  <NIcon
                    :component="ShoppingBag24Filled"
                    style="vertical-align: -0.15em; margin-right: 4px"
                  />
                  积分: {{ item.price }}
                </NText>
                <NFlex
                  justify="space-between"
                  :gap="8"
                >
                  <NButton
                    type="info"
                    size="small"
                    style="flex: 1"
                    @click="onUpdateClick(item)"
                  >
                    <template #icon>
                      <NIcon :component="Edit24Filled" />
                    </template>
                    修改
                  </NButton>
                  <NButton
                    type="success"
                    size="small"
                    style="flex: 1"
                    @click="onSetShelfClick(item, GoodsStatus.Normal)"
                  >
                    <template #icon>
                      <NIcon :component="ArrowSync24Filled" />
                    </template>
                    上架
                  </NButton>
                  <NButton
                    type="error"
                    size="small"
                    style="flex: 1"
                    @click="onDeleteClick(item)"
                  >
                    <template #icon>
                      <NIcon :component="Delete24Filled" />
                    </template>
                    删除
                  </NButton>
                </NFlex>
              </NFlex>
            </template>
          </PointGoodsItem>
        </NGridItem>
      </NGrid>
    </NTabPane>

    <!-- 订单管理标签页 -->
    <NTabPane
      name="orders"
      tab="订单"
      display-directive="show:lazy"
    >
      <PointOrderManage :goods="goods" />
    </NTabPane>

    <!-- 用户管理标签页 -->
    <NTabPane
      name="users"
      tab="用户"
      display-directive="show:lazy"
    >
      <PointUserManage :goods="goods" />
    </NTabPane>

    <!-- 设置标签页 -->
    <NTabPane
      name="settings"
      tab="设置"
      display-directive="show:lazy"
    >
      <PointSettings />
    </NTabPane>

    <!-- 测试标签页 -->
    <NTabPane
      name="test"
      tab="测试"
      display-directive="show:lazy"
    >
      <PointTestPanel />
    </NTabPane>
  </NTabs>

  <!-- 添加/修改礼物模态框 -->
  <NModal
    v-model:show="showAddGoodsModal"
    preset="card"
    style="width: 920px; max-width: 96vw"
    :title="currentGoodsModel.goods.id ? '编辑礼物' : '添加礼物'"
    class="goods-modal"
    :mask-closable="!isUpdating && !isUploadingCover"
    :close-on-esc="!isUpdating && !isUploadingCover"
    :segmented="{
      content: 'soft',
      footer: 'soft'
    }"
  >
    <template #header-extra>
      <NPopconfirm
        v-if="!currentGoodsModel.goods.id"
        @positive-click="resetGoods"
      >
        <template #trigger>
          <NButton
            type="warning"
            size="small"
          >
            重置
          </NButton>
        </template>
        确定要重置此页面内容?
      </NPopconfirm>
    </template>
    <div class="scrollable-container">
      <NScrollbar
        style="max-height: 70vh; padding-right: 12px;"
        class="goods-scrollbar"
      >
        <NForm
          ref="formRef"
          :model="currentGoodsModel.goods"
          :rules="rules"
          style="width: 100%"
        >
          <NTabs v-model:value="goodsModalTab" type="segment" animated>
            <NTabPane name="basic" tab="基础">
              <!-- 基本信息分组 -->
              <NDivider
                title-placement="left"
                style="margin: 8px 0 16px"
              >
                基本信息
              </NDivider>
              <NFormItem
                path="name"
                label="名称"
                required
              >
                <NInput
                  v-model:value="currentGoodsModel.goods.name"
                  placeholder="必填, 礼物名称"
                />
              </NFormItem>

              <NFormItem
                path="price"
                label="所需积分"
                required
              >
                <NInputNumber
                  v-model:value="currentGoodsModel.goods.price"
                  placeholder="必填, 兑换所需要的积分"
                  min="0"
                />
              </NFormItem>

              <NFormItem
                path="count"
                label="库存"
              >
                <NFlex
                  :gap="12"
                  align="center"
                >
                  <NCheckbox
                    :checked="currentGoodsModel.goods.count === undefined"
                    @update:checked="(v) => (currentGoodsModel.goods.count = v ? undefined : 100)"
                  >
                    不限
                  </NCheckbox>
                  <NInputNumber
                    v-if="currentGoodsModel.goods.count !== undefined"
                    v-model:value="currentGoodsModel.goods.count"
                    placeholder="礼物库存"
                    min="0"
                    style="max-width: 120px"
                  />
                </NFlex>
              </NFormItem>

              <NFormItem
                path="isPinned"
                label="置顶显示"
              >
                <NCheckbox v-model:checked="currentGoodsModel.goods.isPinned">
                  在礼物列表中置顶显示
                </NCheckbox>
              </NFormItem>

              <!-- 详细描述分组 -->
              <NDivider
                title-placement="left"
                style="margin-top: 0;"
              >
                详细描述
              </NDivider>
              <NFormItem
                path="description"
                label="描述"
              >
                <NInput
                  v-model:value="currentGoodsModel.goods.description"
                  placeholder="可选, 礼物描述"
                  maxlength="500"
                  type="textarea"
                />
              </NFormItem>

              <NFormItem
                path="tags"
                label="标签"
              >
                <NSelect
                  v-model:value="currentGoodsModel.goods.tags"
                  filterable
                  multiple
                  clearable
                  tag
                  placeholder="可选，输入后按回车添加"
                  :options="existTags"
                />
              </NFormItem>

              <NFormItem
                path="cover"
                label="封面"
                style="margin-bottom: 16px;"
              >
                <NFlex
                  vertical
                  :gap="8"
                >
                  <NUpload
                    v-model:file-list="currentGoodsModel.fileList"
                    :max="1"
                    accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.ico,.bmp,.tif,.tiff,.jfif,.jpe,.jp,.psd,."
                    list-type="image-card"
                    :default-upload="false"
                    :disabled="isUploadingCover"
                    @update:file-list="OnFileListChange"
                  >
                    <NFlex
                      vertical
                      align="center"
                      justify="center"
                      style="width: 100%; height: 100%;"
                    >
                      <NIcon
                        size="24"
                        :depth="3"
                      />
                      <span>{{ currentGoodsModel.goods.cover ? '更换' : '上传' }}封面</span>
                      <span style="font-size: 12px; color: grey">(小于10MB)</span>
                    </NFlex>
                  </NUpload>
                  <NProgress
                    v-if="isUploadingCover"
                    type="line"
                    :percentage="uploadProgress"
                    indicator-placement="inside"
                    processing
                  />
                </NFlex>
              </NFormItem>
            </NTabPane>
            <NTabPane name="subItems" tab="款式配置">
              <!-- 款式/规格 -->
              <NDivider
                title-placement="left"
                style="margin: 16px 0"
              >
                款式 / 规格
              </NDivider>

              <NAlert type="info" :bordered="false" style="margin-bottom: 12px;">
                前台兑换时可多选款式；款式价格为最终价；库存按款式独立计算。未上传款式封面时默认沿用父商品封面。
              </NAlert>

              <NFormItem label="最多可选款式数" style="margin-bottom: 16px;">
                <NFlex align="center" :gap="12">
                  <NInputNumber
                    v-model:value="currentGoodsModel.goods.maxSubItemSelections"
                    :min="0"
                    placeholder="0表示不限制"
                    style="width: 200px"
                  >
                    <template #suffix>
                      种
                    </template>
                  </NInputNumber>
                  <NText depth="3" style="font-size: 12px;">
                    限制用户最多可以选择多少种不同的款式，0或留空表示不限制
                  </NText>
                </NFlex>
              </NFormItem>

              <NFlex justify="space-between" align="center" style="margin-bottom: 8px;">
                <NText depth="2">
                  已配置 {{ (currentGoodsModel.goods.subItems ?? []).length }} 个款式
                </NText>
                <NFlex align="center" :gap="12" wrap>
                  <NSelect
                    v-model:value="subItemsSortMode"
                    size="small"
                    style="min-width: 160px"
                    :options="[
                      { label: '手动排序', value: 'manual' },
                      { label: '按名称', value: 'name' },
                      { label: '按价格', value: 'price' },
                      { label: '按库存', value: 'stock' },
                    ]"
                  />
                  <NButton type="primary" secondary size="small" @click="addSubItem">
                    <template #icon>
                      <NIcon :component="Add24Filled" />
                    </template>
                    添加款式
                  </NButton>
                </NFlex>
              </NFlex>

              <NEmpty
                v-if="!(currentGoodsModel.goods.subItems ?? []).length"
                description="暂无款式（不影响父商品直接兑换）"
                style="margin-bottom: 12px;"
              />

              <template v-else>
                <div
                  v-for="(sub, idx) in subItemsForDisplay"
                  :key="getSubItemKey(sub)"
                  class="manage-sub-item-card"
                >
                  <NFlex justify="space-between" align="center" style="margin-bottom: 8px;">
                    <NText strong>
                      款式 #{{ idx + 1 }}
                    </NText>
                    <NFlex :gap="8" align="center">
                      <NButton
                        quaternary
                        size="small"
                        :disabled="subItemsSortMode !== 'manual'"
                        @click="moveSubItemByKey(getSubItemKey(sub), -1)"
                      >
                        上移
                      </NButton>
                      <NButton
                        quaternary
                        size="small"
                        :disabled="subItemsSortMode !== 'manual'"
                        @click="moveSubItemByKey(getSubItemKey(sub), 1)"
                      >
                        下移
                      </NButton>
                      <NButton type="error" secondary size="small" @click="removeSubItemByKey(getSubItemKey(sub))">
                        <template #icon>
                          <NIcon :component="Delete24Filled" />
                        </template>
                        删除
                      </NButton>
                    </NFlex>
                  </NFlex>

                  <NFormItem label="名称" required style="margin-bottom: 10px;">
                    <NInput v-model:value="sub.name" placeholder="如：吧唧 / 立牌 / 抱枕套" />
                  </NFormItem>

                  <NFlex :gap="12" align="center" style="margin-bottom: 10px;">
                    <NFormItem label="所需积分" required style="flex: 1; margin-bottom: 0;">
                      <NInputNumber v-model:value="sub.price" min="0" placeholder="款式最终价" style="width: 100%;" />
                    </NFormItem>
                    <NFormItem label="库存" style="flex: 1; margin-bottom: 0;">
                      <NFlex :gap="12" align="center">
                        <NCheckbox
                          :checked="sub.stock === undefined"
                          @update:checked="(v) => (sub.stock = v ? undefined : 100)"
                        >
                          不限
                        </NCheckbox>
                        <NInputNumber
                          v-if="sub.stock !== undefined"
                          v-model:value="sub.stock"
                          min="0"
                          placeholder="库存"
                          style="max-width: 120px"
                        />
                      </NFlex>
                    </NFormItem>
                  </NFlex>

                  <NFlex :gap="12" align="center" style="margin-bottom: 10px;">
                    <NFormItem label="允许重购" style="flex: 1; margin-bottom: 0;">
                      <NFlex vertical :gap="6">
                        <NCheckbox
                          :checked="sub.isAllowRebuy === undefined"
                          @update:checked="(v) => (sub.isAllowRebuy = v ? undefined : (currentGoodsModel.goods.isAllowRebuy ?? false))"
                        >
                          沿用父商品（父：{{ currentGoodsModel.goods.isAllowRebuy ? '允许' : '不允许' }}）
                        </NCheckbox>
                        <NCheckbox
                          :checked="sub.isAllowRebuy ?? currentGoodsModel.goods.isAllowRebuy"
                          :disabled="sub.isAllowRebuy === undefined"
                          @update:checked="(v) => (sub.isAllowRebuy = v)"
                        >
                          允许重复兑换
                        </NCheckbox>
                      </NFlex>
                    </NFormItem>
                    <NFormItem label="最大兑换数量" style="flex: 1; margin-bottom: 0;">
                      <NFlex vertical :gap="6" style="width: 100%">
                        <NCheckbox
                          :checked="sub.maxBuyCount === undefined"
                          @update:checked="(v) => (sub.maxBuyCount = v ? undefined : (currentGoodsModel.goods.maxBuyCount ?? 1))"
                        >
                          沿用父商品（父：{{ currentGoodsModel.goods.maxBuyCount ?? 1 }}）
                        </NCheckbox>
                        <NInputNumber
                          :value="sub.maxBuyCount ?? (currentGoodsModel.goods.maxBuyCount ?? 1)"
                          :disabled="sub.maxBuyCount === undefined"
                          min="1"
                          style="width: 100%;"
                          @update:value="(v) => (sub.maxBuyCount = v)"
                        />
                      </NFlex>
                    </NFormItem>
                  </NFlex>

                  <NFlex :gap="12" align="center" style="margin-bottom: 10px;">
                    <NFormItem label="类型" style="flex: 1; margin-bottom: 0;">
                      <NFlex vertical :gap="6" style="width: 100%">
                        <NCheckbox
                          :checked="sub.type === undefined"
                          @update:checked="(v) => (sub.type = v ? undefined : currentGoodsModel.goods.type)"
                        >
                          沿用父商品（父：{{ currentGoodsModel.goods.type === GoodsTypes.Physical ? '实物' : '虚拟' }}）
                        </NCheckbox>
                        <NRadioGroup
                          :value="sub.type ?? currentGoodsModel.goods.type"
                          :disabled="sub.type === undefined"
                          @update:value="(v) => (sub.type = v)"
                        >
                          <NRadioButton :value="GoodsTypes.Virtual">
                            虚拟
                          </NRadioButton>
                          <NRadioButton :value="GoodsTypes.Physical">
                            实物
                          </NRadioButton>
                        </NRadioGroup>
                      </NFlex>
                    </NFormItem>
                    <NFormItem label="封面" style="flex: 1; margin-bottom: 0;">
                      <NUpload
                        :file-list="subItemFileLists[getSubItemKey(sub)] || []"
                        :max="1"
                        accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.ico,.bmp,.tif,.tiff,.jfif,.jpe,.jp,.psd,."
                        list-type="image-card"
                        :default-upload="false"
                        :disabled="isUploadingCover"
                        @update:file-list="(list) => updateSubItemFileList(getSubItemKey(sub), list)"
                      />
                    </NFormItem>
                  </NFlex>

                  <NFormItem label="描述(可选)" style="margin-bottom: 10px;">
                    <NInput v-model:value="sub.description" type="textarea" placeholder="留空则沿用父商品描述" maxlength="500" />
                  </NFormItem>

                  <template v-if="resolveSubType(sub) === GoodsTypes.Physical">
                    <NFormItem label="收货地址(可选)" style="margin-bottom: 0;">
                      <NRadioGroup
                        :value="sub.collectUrl === undefined ? 0 : (sub.collectUrl === '' ? 1 : 2)"
                        @update:value="(v) => { if (v === 0) sub.collectUrl = undefined; else if (v === 1) sub.collectUrl = ''; else sub.collectUrl = (sub.collectUrl && sub.collectUrl !== '') ? sub.collectUrl : 'https://'; }"
                      >
                        <NRadioButton :value="0">
                          沿用父商品
                        </NRadioButton>
                        <NRadioButton :value="1">
                          本站收集
                        </NRadioButton>
                        <NRadioButton :value="2">
                          站外收集
                        </NRadioButton>
                      </NRadioGroup>
                    </NFormItem>

                    <template v-if="sub.collectUrl !== undefined && sub.collectUrl !== ''">
                      <NFormItem label="收集链接" style="margin-top: 8px;">
                        <NFlex vertical :gap="8" style="width: 100%">
                          <NInput v-model:value="sub.collectUrl" placeholder="用于给用户填写收货地址的表单分享链接" maxlength="300" />
                          <NCheckbox v-model:checked="sub.embedCollectUrl">
                            尝试将收集链接嵌入到网页中
                          </NCheckbox>
                        </NFlex>
                      </NFormItem>
                    </template>
                  </template>
                </div>
              </template>
            </NTabPane>
            <NTabPane name="exchange" tab="兑换">
              <!-- 兑换规则分组 -->
              <NDivider
                title-placement="left"
                style="margin: 16px 0"
              >
                兑换规则
              </NDivider>
              <NFormItem
                path="type"
                label="礼物类型"
              >
                <NRadioGroup v-model:value="currentGoodsModel.goods.type">
                  <NRadioButton :value="GoodsTypes.Virtual">
                    虚拟礼物
                  </NRadioButton>
                  <NRadioButton :value="GoodsTypes.Physical">
                    实体礼物
                  </NRadioButton>
                </NRadioGroup>
              </NFormItem>

              <NFormItem
                path="settings"
                label="选项"
              >
                <NCheckbox v-model:checked="currentGoodsModel.goods.isAllowRebuy">
                  允许重复兑换
                </NCheckbox>
              </NFormItem>

              <NFormItem
                label="特殊权限"
                style="margin-bottom: 16px;"
              >
                <NCollapse>
                  <NCollapseItem title="展开配置" name="guard">
                    <NFlex
                      vertical
                      :gap="8"
                    >
                      <NCheckbox
                        :checked="currentGoodsModel.goods.setting?.guardFreeMonths !== undefined"
                        @update:checked="
                          (v) => {
                            if (!currentGoodsModel.goods.setting) {
                              currentGoodsModel.goods.setting = { allowGuardLevel: 0 };
                            }
                            currentGoodsModel.goods.setting.guardFreeMonths = v
                              ? [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }]
                              : undefined;
                          }
                        "
                      >
                        允许舰长免费兑换
                        <NTooltip>
                          <template #trigger>
                            <NIcon :component="Info24Filled" />
                          </template>
                          仅当
                          <NButton
                            type="info"
                            text
                            tag="a"
                            href="/manage/event"
                            target="_blank"
                          >
                            舰长和SC
                          </NButton>
                          中存在对应记录时才能生效
                        </NTooltip>
                      </NCheckbox>

                      <NFlex
                        v-if="currentGoodsModel.goods.setting?.guardFreeMonths"
                        vertical
                        :gap="8"
                      >
                        <NText>
                          免费兑换最低舰长等级
                        </NText>
                        <NRadioGroup
                          :value="currentGoodsModel.goods.setting?.allowGuardFreeMinLevel ?? 0"
                          @update:value="(v) => {
                            if (!currentGoodsModel.goods.setting) {
                              currentGoodsModel.goods.setting = { allowGuardLevel: 0 };
                            }
                            currentGoodsModel.goods.setting.allowGuardFreeMinLevel = v;
                          }"
                        >
                          <NRadioButton :value="0">
                            不限
                          </NRadioButton>
                          <NRadioButton :value="1">
                            总督
                          </NRadioButton>
                          <NRadioButton :value="2">
                            提督
                          </NRadioButton>
                          <NRadioButton :value="3">
                            舰长
                          </NRadioButton>
                        </NRadioGroup>

                        <NCheckbox
                          :checked="currentGoodsModel.goods.setting?.guardFreeMonths?.length === 0"
                          @update:checked="(v) => {
                            if (!currentGoodsModel.goods.setting) {
                              currentGoodsModel.goods.setting = { allowGuardLevel: 0 };
                            }
                            if (!currentGoodsModel.goods.setting.guardFreeMonths) {
                              currentGoodsModel.goods.setting.guardFreeMonths = [];
                            }
                            currentGoodsModel.goods.setting.guardFreeMonths = v ? [] : [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }];
                          }"
                        >
                          当前在舰即可
                        </NCheckbox>

                        <NFlex
                          v-if="currentGoodsModel.goods.setting.guardFreeMonths.length > 0"
                          vertical
                          :gap="8"
                        >
                          <NFlex
                            v-for="(m, idx) in currentGoodsModel.goods.setting.guardFreeMonths"
                            :key="`${m.year}-${m.month}-${idx}`"
                            :gap="8"
                            align="center"
                          >
                            <NSelect
                              style="flex: 1"
                              :value="m.year"
                              :options="allowedYearOptions"
                              placeholder="请选择年份"
                              @update:value="(v) => {
                                if (currentGoodsModel.goods.setting?.guardFreeMonths) {
                                  currentGoodsModel.goods.setting.guardFreeMonths[idx].year = v;
                                }
                              }"
                            />
                            <NSelect
                              style="flex: 1"
                              :value="m.month"
                              :options="allowedMonthOptions"
                              placeholder="请选择月份"
                              @update:value="(v) => {
                                if (currentGoodsModel.goods.setting?.guardFreeMonths) {
                                  currentGoodsModel.goods.setting.guardFreeMonths[idx].month = v;
                                }
                              }"
                            />
                            <NButton
                              type="error"
                              secondary
                              @click="() => {
                                if (!currentGoodsModel.goods.setting?.guardFreeMonths) return;
                                currentGoodsModel.goods.setting.guardFreeMonths.splice(idx, 1);
                                if (currentGoodsModel.goods.setting.guardFreeMonths.length === 0) {
                                  currentGoodsModel.goods.setting.guardFreeMonths = [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }];
                                }
                              }"
                            >
                              删除
                            </NButton>
                          </NFlex>
                        </NFlex>

                        <NButton
                          v-if="currentGoodsModel.goods.setting.guardFreeMonths.length > 0"
                          secondary
                          @click="() => {
                            if (!currentGoodsModel.goods.setting?.guardFreeMonths) return;
                            currentGoodsModel.goods.setting.guardFreeMonths.push({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
                          }"
                        >
                          添加月份
                        </NButton>
                      </NFlex>

                      <NText>
                        最低兑换等级
                        <NTooltip>
                          <template #trigger>
                            <NIcon :component="Info24Filled" />
                          </template>
                          仅当
                          <NButton
                            type="info"
                            text
                            tag="a"
                            href="/manage/event"
                            target="_blank"
                          >
                            舰长和SC
                          </NButton>
                          中存在对应记录时才能生效
                        </NTooltip>
                      </NText>

                      <NCheckbox
                        :checked="currentGoodsModel.goods.setting?.guardLevelMonths !== undefined"
                        @update:checked="
                          (v) => {
                            if (!currentGoodsModel.goods.setting) {
                              currentGoodsModel.goods.setting = { allowGuardLevel: 0 };
                            }
                            currentGoodsModel.goods.setting.guardLevelMonths = v
                              ? [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }]
                              : undefined;
                          }
                        "
                      >
                        限制最低兑换等级的上舰月份
                      </NCheckbox>

                      <NFlex
                        v-if="currentGoodsModel.goods.setting?.guardLevelMonths"
                        vertical
                        :gap="8"
                      >
                        <NCheckbox
                          :checked="currentGoodsModel.goods.setting?.guardLevelMonths?.length === 0"
                          @update:checked="(v) => {
                            if (!currentGoodsModel.goods.setting) {
                              currentGoodsModel.goods.setting = { allowGuardLevel: 0 };
                            }
                            if (!currentGoodsModel.goods.setting.guardLevelMonths) {
                              currentGoodsModel.goods.setting.guardLevelMonths = [];
                            }
                            currentGoodsModel.goods.setting.guardLevelMonths = v ? [] : [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }];
                          }"
                        >
                          当前在舰即可
                        </NCheckbox>

                        <NFlex
                          v-if="currentGoodsModel.goods.setting.guardLevelMonths.length > 0"
                          vertical
                          :gap="8"
                        >
                          <NFlex
                            v-for="(m, idx) in currentGoodsModel.goods.setting.guardLevelMonths"
                            :key="`${m.year}-${m.month}-${idx}`"
                            :gap="8"
                            align="center"
                          >
                            <NSelect
                              style="flex: 1"
                              :value="m.year"
                              :options="allowedYearOptions"
                              placeholder="请选择年份"
                              @update:value="(v) => {
                                if (currentGoodsModel.goods.setting?.guardLevelMonths) {
                                  currentGoodsModel.goods.setting.guardLevelMonths[idx].year = v;
                                }
                              }"
                            />
                            <NSelect
                              style="flex: 1"
                              :value="m.month"
                              :options="allowedMonthOptions"
                              placeholder="请选择月份"
                              @update:value="(v) => {
                                if (currentGoodsModel.goods.setting?.guardLevelMonths) {
                                  currentGoodsModel.goods.setting.guardLevelMonths[idx].month = v;
                                }
                              }"
                            />
                            <NButton
                              type="error"
                              secondary
                              @click="() => {
                                if (!currentGoodsModel.goods.setting?.guardLevelMonths) return;
                                currentGoodsModel.goods.setting.guardLevelMonths.splice(idx, 1);
                                if (currentGoodsModel.goods.setting.guardLevelMonths.length === 0) {
                                  currentGoodsModel.goods.setting.guardLevelMonths = [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }];
                                }
                              }"
                            >
                              删除
                            </NButton>
                          </NFlex>
                        </NFlex>

                        <NButton
                          v-if="currentGoodsModel.goods.setting.guardLevelMonths.length > 0"
                          secondary
                          @click="() => {
                            if (!currentGoodsModel.goods.setting?.guardLevelMonths) return;
                            currentGoodsModel.goods.setting.guardLevelMonths.push({ year: new Date().getFullYear(), month: new Date().getMonth() + 1 });
                          }"
                        >
                          添加月份
                        </NButton>
                      </NFlex>

                      <NRadioGroup
                        :value="currentGoodsModel.goods.setting?.allowGuardLevel ?? 0"
                        @update:value="(v) => {
                          if (!currentGoodsModel.goods.setting) {
                            currentGoodsModel.goods.setting = { allowGuardLevel: 0 };
                          }
                          currentGoodsModel.goods.setting.allowGuardLevel = v;
                        }"
                      >
                        <NRadioButton :value="0">
                          不限
                        </NRadioButton>
                        <NRadioButton :value="1">
                          总督
                        </NRadioButton>
                        <NRadioButton :value="2">
                          提督
                        </NRadioButton>
                        <NRadioButton :value="3">
                          舰长
                        </NRadioButton>
                      </NRadioGroup>
                    </NFlex>
                  </NCollapseItem>
                </NCollapse>
              </NFormItem>

              <!-- 礼物类型特定配置 -->
              <template v-if="currentGoodsModel.goods.type === GoodsTypes.Physical">
                <NDivider
                  title-placement="left"
                  style="margin: 16px 0"
                >
                  实物礼物配置
                </NDivider>
                <NFormItem
                  path="maxBuyCount"
                  label="最大兑换数量"
                >
                  <NInputNumber
                    v-model:value="currentGoodsModel.goods.maxBuyCount"
                    placeholder="必填, 最大兑换数量"
                    min="1"
                  />
                </NFormItem>

                <NFormItem
                  path="address"
                  label="收货地址"
                  style="margin-bottom: 16px;"
                >
                  <NFlex
                    vertical
                    :gap="8"
                  >
                    <NRadioGroup
                      :value="currentGoodsModel.goods.collectUrl === undefined ? 0 : 1"
                      @update:value="(v) => {
                        if (v === 0) currentGoodsModel.goods.collectUrl = undefined;
                        else currentGoodsModel.goods.collectUrl = (currentGoodsModel.goods.collectUrl && currentGoodsModel.goods.collectUrl !== '') ? currentGoodsModel.goods.collectUrl : 'https://';
                      }"
                    >
                      <NRadioButton :value="0">
                        通过本站收集收货地址
                      </NRadioButton>
                      <NRadioButton :value="1">
                        使用站外链接收集地址
                        <NTooltip>
                          <template #trigger>
                            <NIcon :component="Info24Filled" />
                          </template>
                          用腾讯文档等工具收集收货地址
                        </NTooltip>
                      </NRadioButton>
                    </NRadioGroup>
                  </NFlex>
                </NFormItem>

                <template v-if="currentGoodsModel.goods.collectUrl !== undefined">
                  <NFormItem
                    path="collectUrl"
                    label="收集链接"
                  >
                    <NFlex
                      vertical
                      :gap="8"
                      style="width: 100%"
                    >
                      <NInput
                        v-model:value="currentGoodsModel.goods.collectUrl"
                        placeholder="用于给用户填写自己收货地址的表格的分享链接"
                        maxlength="300"
                      />
                      <NCheckbox v-model:checked="currentGoodsModel.goods.embedCollectUrl">
                        尝试将收集链接嵌入到网页中
                      </NCheckbox>
                    </NFlex>
                  </NFormItem>
                </template>
                <template v-else>
                  <NFormItem
                    path="privacy"
                    label="隐私协议"
                    required
                  >
                    <NCheckbox v-model:checked="isAllowedPrivacyPolicy">
                      同意本站隐私协议
                    </NCheckbox>
                  </NFormItem>
                </template>
              </template>
              <template v-else>
                <NDivider
                  title-placement="left"
                  style="margin: 16px 0"
                >
                  虚拟礼物配置
                </NDivider>
                <NFormItem
                  path="keySelectionMode"
                  label="密钥选择模式"
                >
                  <NRadioGroup v-model:value="currentGoodsModel.goods.keySelectionMode">
                    <NRadioButton :value="KeySelectionMode.None">
                      不使用
                    </NRadioButton>
                    <NRadioButton :value="KeySelectionMode.Random">
                      随机选择
                    </NRadioButton>
                    <NRadioButton :value="KeySelectionMode.Sequential">
                      顺序选择
                    </NRadioButton>
                  </NRadioGroup>
                </NFormItem>
                <!-- 添加多Key支持配置 -->
                <NFormItem
                  v-if="currentGoodsModel.goods.keySelectionMode !== KeySelectionMode.None"
                  path="virtualKeys"
                  label="礼物密钥列表 (可选)"
                >
                  <template #label>
                    礼物密钥列表
                    <NTooltip>
                      <template #trigger>
                        <NIcon :component="Info24Filled" />
                      </template>
                      添加多个密钥，用户购买时会根据选择模式分配一个密钥. 可以留空
                    </NTooltip>
                  </template>
                  <NFlex
                    vertical
                    :gap="8"
                  >
                    <NDynamicTags
                      v-model:value="currentGoodsModel.goods.virtualKeys"
                      placeholder="输入密钥后按Enter添加"
                    />
                    <NText
                      depth="3"
                      style="margin-top: 4px; display: block"
                    >
                      已添加 {{ (currentGoodsModel.goods.virtualKeys || []).length }} 个密钥
                    </NText>
                  </NFlex>
                </NFormItem>

                <NFormItem
                  path="content"
                  required
                  style="margin-bottom: 16px;"
                >
                  <template #label>
                    礼物内容
                    <NTooltip>
                      <template #trigger>
                        <NIcon :component="Info24Filled" />
                      </template>
                      虚拟礼物的具体内容，可使用 {key} 作为占位符
                    </NTooltip>
                  </template>
                  <NInput
                    v-model:value="currentGoodsModel.goods.content"
                    type="textarea"
                    placeholder="写这里咯，可使用 {key} 作为占位符，购买时会自动替换为上面密钥列表中的一个"
                    maxlength="10000"
                    show-count
                    clearable
                  />
                </NFormItem>
              </template>
            </NTabPane>
          </NTabs>
        </NForm>
        <!-- 添加一个底部间距，让滚动更自然 -->
        <div style="height: 16px;" />
      </NScrollbar>
    </div>
    <template #footer>
      <NFlex justify="end" :gap="12">
        <NButton
          secondary
          size="large"
          :disabled="isUpdating || isUploadingCover"
          @click="showAddGoodsModal = false"
        >
          取消
        </NButton>
        <NButton
          type="primary"
          size="large"
          :loading="isUpdating || isUploadingCover"
          :disabled="isUploadingCover"
          @click="updateGoods"
        >
          <span v-if="isUploadingCover">正在上传封面...</span>
          <span v-else>{{ currentGoodsModel.goods.id ? '修改' : '创建' }}</span>
        </NButton>
      </NFlex>
    </template>
  </NModal>
</template>

<style scoped>
  .point-goods-card {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .point-goods-card :deep(.n-card-header) {
    padding: 16px;
  }

  .point-goods-card :deep(.n-card-content) {
    padding: 16px;
    flex-grow: 1;
  }

  .point-goods-card :deep(.n-card-footer) {
    padding: 12px 16px;
  }

  .goods-modal :deep(.n-card-header) {
    padding: 16px 20px;
  }

  .goods-modal :deep(.n-card-content) {
    padding: 0 20px 8px;
  }

  .goods-modal :deep(.n-card-footer) {
    padding: 12px 20px 16px;
    border-top: 1px solid var(--n-border-color);
    background-color: var(--n-color-embedded);
  }

  .scrollable-container {
    position: relative;
    background-color: transparent;
    border: none;
    border-radius: var(--n-border-radius);
    margin: 0;
  }

  .goods-scrollbar {
    padding: 0;
    border-radius: 0;
    background-color: transparent;
  }

  .goods-scrollbar :deep(.n-scrollbar-rail) {
    right: 0;
  }

  .goods-scrollbar :deep(.n-scrollbar-content) {
    padding: 12px 0 8px;
  }

  .goods-modal :deep(.n-upload-trigger.n-upload-trigger--image-card) {
    width: 104px;
    height: 104px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .manage-sub-item-card {
    margin-bottom: 12px;
    padding: 16px;
    border: 1px solid var(--n-border-color);
    border-radius: var(--n-border-radius);
    background-color: var(--n-card-color);
    transition: all 0.3s var(--n-bezier);
  }

  .manage-sub-item-card:hover {
    border-color: var(--n-primary-color);
    box-shadow: 0 0 0 1px var(--n-primary-color) inset;
  }

</style>
