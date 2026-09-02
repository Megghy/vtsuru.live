<script setup lang="ts">
import {
  Add24Filled,
  ArrowSync24Filled,
  Delete24Filled,
  Edit24Filled,
  Eye24Filled,
  Info24Filled,
  ShoppingBag24Filled,
} from '@vicons/fluent'
import { useRouteHash } from '@vueuse/router'
import type { UploadFileInfo } from 'naive-ui'
import {
  NAlert,
  NButton,
  NCheckbox,
  NCollapse,
  NCollapseItem,
  NDivider,
  NDynamicTags,
  NEmpty,
  NFlex,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NIcon,
  NInput,
  NInputNumber,
  NModal,
  NPopconfirm,
  NProgress,
  NRadioButton,
  NRadioGroup,
  NScrollbar,
  NSelect,
  NSwitch,
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
import type { ResponsePointGoodModel, UploadSubPointGoodsModel, UploadPointGoodsModel } from '@/api/api-models'
import { FunctionTypes, GoodsStatus, GoodsTypes, KeySelectionMode, UserFileLocation } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import EventFetcherStatusCard from '@/apps/manage/components/event-fetcher/EventFetcherStatusCard.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import PointGoodsItem from '@/shared/components/points/PointGoodsItem.vue'
import PointOrderManage from '@/shared/components/points/PointOrderManage.vue'
import PointSettings from '@/shared/components/points/PointSettings.vue'
import { CURRENT_HOST, POINT_API_URL } from '@/shared/config'
import { uploadFiles, UploadStage } from '@/shared/services/fileUpload'
import { addVtsuruLiveWatermark } from '@/shared/utils/imageWatermark'
import { useBiliAuth } from '@/store/useBiliAuth'

import PointGuardDuplicateManage from './PointGuardDuplicateManage.vue'
import PointTestPanel from './PointTestPanel.vue'
import PointUserManage from './PointUserManage.vue'

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
const shouldWatermarkCover = ref(true)
const goodsModalTab = ref<'basic' | 'subItems' | 'rules'>('basic')
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
const currentPointSetting = computed(() => accountInfo.value?.settings.point)
const goodsPageUrl = computed(() => (accountInfo.value?.name ? `${CURRENT_HOST}@${accountInfo.value.name}/goods` : ''))

function openPointSourceSettings() {
  hash.value = 'settings'
  window.setTimeout(() => {
    document.getElementById('point-source-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 0)
}

// 商品数据及模型
const goods = ref<ResponsePointGoodModel[]>(await biliAuth.GetGoods(accountInfo.value?.id, message))
function sortGoods(a: ResponsePointGoodModel, b: ResponsePointGoodModel) {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
  return b.id - a.id
}
const onShelfGoods = computed(() =>
  goods.value
    .filter((g) => g.status !== GoodsStatus.Discontinued)
    .slice()
    .sort(sortGoods),
)
const offShelfGoods = computed(() =>
  goods.value
    .filter((g) => g.status === GoodsStatus.Discontinued)
    .slice()
    .sort(sortGoods),
)

function defaultGoodsModel(): { goods: UploadPointGoodsModel; fileList: UploadFileInfo[] } {
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
const currentGoodsModel = ref<{ goods: UploadPointGoodsModel; fileList: UploadFileInfo[] }>(defaultGoodsModel())
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
  const index = list.findIndex((s) => getSubItemKey(s) === subKey)
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
  const index = list.findIndex((s) => getSubItemKey(s) === subKey)
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
watch(
  () => currentGoodsModel.value.fileList,
  (newFileList, oldFileList) => {
    if (oldFileList && oldFileList.length > 0 && newFileList.length === 0) {
      if (currentGoodsModel.value.goods.id && currentGoodsModel.value.goods.cover) {
        currentGoodsModel.value.goods.cover = undefined
      }
    }
  },
  { deep: true },
)

// 计算属性
const allowedYearOptions = computed(() => {
  return Array.from({ length: new Date().getFullYear() - 2024 + 1 }, (_, i) => 2024 + i).map((item) => ({
    label: `${item.toString()}年`,
    value: item,
  }))
})

const allowedMonthOptions = computed(() => {
  return Array.from({ length: 12 }, (_, i) => i + 1).map((item) => ({
    label: `${item.toString()}月`,
    value: item,
  }))
})

const existTags = computed(() => {
  if (goods.value.length === 0) return []

  const tempSet = new Set<string>()
  for (const good of goods.value) {
    if (!good.tags || good.tags.length === 0) continue
    good.tags.forEach((tag) => tempSet.add(tag))
  }

  return Array.from(tempSet).map((tag) => ({ label: tag, value: tag }))
})

const subItemsForDisplay = computed(() => {
  const list = currentGoodsModel.value.goods.subItems ?? []
  if (subItemsSortMode.value === 'manual') return list
  const cloned = list.slice()
  if (subItemsSortMode.value === 'name') {
    cloned.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  } else if (subItemsSortMode.value === 'price') {
    cloned.sort((a, b) => Number(a.price ?? 0) - Number(b.price ?? 0))
  } else if (subItemsSortMode.value === 'stock') {
    const toStock = (v: number | undefined) => (v === undefined ? Number.POSITIVE_INFINITY : Number(v))
    cloned.sort((a, b) => toStock(a.stock) - toStock(b.stock))
  }
  return cloned
})

// 表单验证规则
const rules = {
  name: {
    required: true,
    message: '请输入礼物名称',
  },
  price: {
    required: true,
    message: '请输入礼物价格',
  },
  type: {
    required: true,
    message: '请选择是虚拟礼物或实物',
  },
}

async function uploadCover(file: File) {
  const uploadFile = shouldWatermarkCover.value ? await addVtsuruLiveWatermark(file) : file
  return uploadFiles([uploadFile], undefined, UserFileLocation.Local, (stage: string) => {
    if (stage === UploadStage.Uploading) {
      uploadProgress.value = 0
    }
  })
}

async function updateGoods(e: MouseEvent) {
  if (isUpdating.value || !formRef.value) return
  e.preventDefault()
  isUpdating.value = true
  isUploadingCover.value = false
  uploadProgress.value = 0

  try {
    // 1. 舰长高级规则校验
    if (currentGoodsModel.value.goods.setting?.guardFree !== undefined) {
      currentGoodsModel.value.goods.setting.guardFree = undefined
    }
    if (currentGoodsModel.value.goods.setting?.guardFreeMonths) {
      const months = currentGoodsModel.value.goods.setting.guardFreeMonths
      if (months.length > 0) {
        for (const m of months) {
          if (!m?.year || !m?.month) {
            goodsModalTab.value = 'rules'
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
            goodsModalTab.value = 'rules'
            throw new Error('请选择最低兑换等级限制的年份和月份')
          }
        }
      }
    }

    // 2. 基础表单项校验
    try {
      await formRef.value.validate()
    } catch {
      goodsModalTab.value = 'basic'
      throw new Error('请填写必要的基础信息')
    }

    // 3. 交付方式与内容校验
    if (currentGoodsModel.value.goods.type === GoodsTypes.Physical) {
      const url = currentGoodsModel.value.goods.collectUrl
      if (url !== undefined) {
        try {
          void new URL(url)
        } catch {
          goodsModalTab.value = 'basic'
          throw new Error('请输入正确的站外收集链接')
        }
      } else if (!isAllowedPrivacyPolicy.value) {
        goodsModalTab.value = 'basic'
        throw new Error('需要阅读并同意本站隐私协议')
      }
      if ((currentGoodsModel.value.goods.maxBuyCount ?? 0) < 1) {
        goodsModalTab.value = 'rules'
        throw new Error('最大兑换数量必须大于 0')
      }
    } else if (currentGoodsModel.value.goods.type === GoodsTypes.Virtual) {
      if ((currentGoodsModel.value.goods.content?.trim().length ?? 0) === 0) {
        goodsModalTab.value = 'basic'
        throw new Error('请输入虚拟礼物的交付内容')
      }
    }

    // 4. 款式校验与“默认继承父商品”归一化
    ensureSubItems()
    const parent = currentGoodsModel.value.goods
    for (const sub of currentGoodsModel.value.goods.subItems ?? []) {
      const name = (sub.name ?? '').trim()
      if (!name) {
        goodsModalTab.value = 'subItems'
        throw new Error('款式名称不能为空')
      }
      sub.name = name

      if (sub.price === undefined || sub.price === null || Number(sub.price) < 0) {
        goodsModalTab.value = 'subItems'
        throw new Error(`款式 ${name} 的积分价格不能小于0`)
      }

      if (sub.stock !== undefined && sub.stock !== null && Number(sub.stock) < 0) {
        goodsModalTab.value = 'subItems'
        throw new Error(`款式 ${name} 的库存不能小于0`)
      }

      if (sub.maxBuyCount !== undefined && sub.maxBuyCount !== null && Number(sub.maxBuyCount) < 1) {
        goodsModalTab.value = 'subItems'
        throw new Error(`款式 ${name} 的最大兑换数量必须大于0`)
      }

      if (
        sub.collectUrl !== undefined &&
        sub.collectUrl !== null &&
        sub.collectUrl !== '' &&
        !String(sub.collectUrl).trim()
      ) {
        goodsModalTab.value = 'subItems'
        throw new Error(`款式 ${name} 的收集链接不能为空`)
      }

      if (sub.collectUrl !== undefined && sub.collectUrl !== '' && sub.collectUrl !== null) {
        try {
          void new URL(String(sub.collectUrl))
        } catch {
          goodsModalTab.value = 'subItems'
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

    const newFilesToUpload = currentGoodsModel.value.fileList.filter((f) => f.file && f.status !== 'finished')
    if (newFilesToUpload.length > 0 && newFilesToUpload[0].file) {
      isUploadingCover.value = true
      message.info(shouldWatermarkCover.value ? '正在添加封面水印并上传...' : '正在上传封面...')
      const uploadResults = await uploadCover(newFilesToUpload[0].file)
      isUploadingCover.value = false
      if (uploadResults && uploadResults.length > 0) {
        currentGoodsModel.value.goods.cover = uploadResults[0]
        message.success('封面上传成功')
        const uploadedFileIndex = currentGoodsModel.value.fileList.findIndex((f) => f.id === newFilesToUpload[0].id)
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
    for (const sub of currentGoodsModel.value.goods.subItems ?? []) {
      const key = getSubItemKey(sub)
      const fileList = subItemFileLists.value[key] ?? []
      const subFilesToUpload = fileList.filter((f) => f.file && f.status !== 'finished')
      if (subFilesToUpload.length > 0 && subFilesToUpload[0].file) {
        isUploadingCover.value = true
        const uploadAction = shouldWatermarkCover.value ? '添加水印并上传' : '上传'
        message.info(`正在${uploadAction}款式封面: ${sub.name || '未命名'}...`)
        const uploadResults = await uploadCover(subFilesToUpload[0].file)
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

    const {
      code,
      data,
      message: errMsg,
    } = await QueryPostAPI<ResponsePointGoodModel>(`${POINT_API_URL}update-goods`, currentGoodsModel.value.goods)

    if (code === 200) {
      message.success('商品信息保存成功')
      showAddGoodsModal.value = false
      currentGoodsModel.value = defaultGoodsModel()

      const index = goods.value.findIndex((g) => g.id === data.id)
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
      cover: s.cover && parentCoverId && s.cover.id === parentCoverId ? undefined : s.cover,
      collectUrl: (s.collectUrl ?? undefined) === parentCollectUrl ? undefined : (s.collectUrl ?? undefined),
      embedCollectUrl:
        (s.collectUrl ?? undefined) === parentCollectUrl
          ? undefined
          : (s.embedCollectUrl ?? undefined) === parentEmbedCollectUrl
            ? undefined
            : (s.embedCollectUrl ?? undefined),
      isAllowRebuy: s.isAllowRebuy === parentIsAllowRebuy ? undefined : s.isAllowRebuy,
      maxBuyCount: s.maxBuyCount === parentMaxBuyCount ? undefined : s.maxBuyCount,
      content: (s.content ?? undefined) === (copiedItem.content ?? undefined) ? undefined : (s.content ?? undefined),
      virtualKeys:
        JSON.stringify(s.virtualKeys ?? []) === JSON.stringify(copiedItem.virtualKeys ?? [])
          ? undefined
          : s.virtualKeys,
      keySelectionMode: s.keySelectionMode === copiedItem.keySelectionMode ? undefined : s.keySelectionMode,
      setting: JSON.stringify(s.setting ?? {}) === JSON.stringify(copiedItem.setting ?? {}) ? undefined : s.setting,
    })) as UploadSubPointGoodsModel[]
  } else {
    copiedItem.subItems = []
  }

  // 初始化款式封面上传列表
  subItemFileLists.value = {}
  for (const s of copiedItem.subItems as UploadSubPointGoodsModel[]) {
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
  shouldWatermarkCover.value = true
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
          const index = goods.value.findIndex((g) => g.id === item.id)
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
          goods.value = goods.value.filter((g) => g.id !== item.id)
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
  shouldWatermarkCover.value = true
  goodsModalTab.value = 'basic'
  subItemsSortMode.value = 'manual'
}

onMounted(() => {})
</script>

<template>
  <!-- 头部 -->
  <ManagePageHeader
    title="积分管理"
    subtitle="礼物、订单、用户与配置"
    :function-type="FunctionTypes.Point"
    :links="[{ label: '礼物展示页链接', value: goodsPageUrl }]"
  />

  <NCard
    size="small"
    :bordered="true"
    content-style="padding: 12px;"
    style="max-width: 800px"
  >
    <NFlex
      justify="space-between"
      align="center"
      wrap
      :gap="12"
    >
      <NAlert
        v-if="!accountInfo.eventFetcherState.online"
        :type="
          accountInfo.settings.enableFunctions.includes(FunctionTypes.Point) && accountInfo.eventFetcherState.online
            ? 'success'
            : 'warning'
        "
        :bordered="false"
        style="flex: 1; min-width: 300px"
      >
        <NFlex
          align="center"
          :gap="8"
          wrap
        >
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
                <NText style="font-size: 14px; color: var(--vtsuru-primary); font-weight: 500">
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
      <NDivider style="margin: 24px 0 16px"> 已下架 </NDivider>
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
                <NText style="font-size: 14px; color: var(--vtsuru-primary); font-weight: 500">
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
      <PointUserManage
        :goods="goods"
        :point-setting="currentPointSetting"
        @open-source-settings="openPointSourceSettings"
      />
    </NTabPane>

    <NTabPane
      name="guard-duplicates"
      tab="重复上舰"
      display-directive="show:lazy"
    >
      <PointGuardDuplicateManage />
    </NTabPane>

    <!-- 设置标签页 -->
    <NTabPane
      name="settings"
      tab="设置"
      display-directive="show:lazy"
    >
      <PointSettings source-anchor-id="point-source-settings" />
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
  <!-- 添加/修改礼物模态框 -->
  <NModal
    v-model:show="showAddGoodsModal"
    preset="card"
    style="width: 860px; max-width: 96vw"
    :title="currentGoodsModel.goods.id ? '编辑礼物' : '添加礼物'"
    class="goods-modal"
    :mask-closable="!isUpdating && !isUploadingCover"
    :close-on-esc="!isUpdating && !isUploadingCover"
    :segmented="{
      content: 'soft',
      footer: 'soft',
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
            quaternary
          >
            重置
          </NButton>
        </template>
        确定要重置此页面内容?
      </NPopconfirm>
    </template>
    <div class="scrollable-container">
      <NScrollbar
        style="max-height: 72vh; padding-right: 12px"
        class="goods-scrollbar"
      >
        <NForm
          ref="formRef"
          :model="currentGoodsModel.goods"
          :rules="rules"
          label-placement="top"
          style="width: 100%"
        >
          <NTabs
            v-model:value="goodsModalTab"
            type="segment"
            animated
            style="margin-bottom: 16px"
          >
            <!-- Tab 1: 核心信息与交付 (所有必填项) -->
            <NTabPane
              name="basic"
              tab="商品与交付"
            >
              <!-- 1. 基本信息 -->
              <div class="form-section-title">基本信息</div>
              <NGrid
                cols="1 s:2"
                :x-gap="16"
                :y-gap="0"
              >
                <NGridItem>
                  <NFormItem
                    path="name"
                    label="礼物名称"
                    required
                  >
                    <NInput
                      v-model:value="currentGoodsModel.goods.name"
                      placeholder="如：舰长专属定制抱枕"
                      maxlength="200"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem>
                  <NFormItem
                    path="price"
                    label="所需积分"
                    required
                  >
                    <NInputNumber
                      v-model:value="currentGoodsModel.goods.price"
                      placeholder="兑换所需的积分数"
                      :min="0"
                      style="width: 100%"
                    />
                  </NFormItem>
                </NGridItem>
                <NGridItem>
                  <NFormItem
                    path="count"
                    label="库存设置"
                  >
                    <NFlex
                      align="center"
                      :gap="12"
                      style="width: 100%"
                    >
                      <NCheckbox
                        :checked="currentGoodsModel.goods.count === undefined"
                        @update:checked="(v) => (currentGoodsModel.goods.count = v ? undefined : 100)"
                      >
                        不限制库存
                      </NCheckbox>
                      <NInputNumber
                        v-if="currentGoodsModel.goods.count !== undefined"
                        v-model:value="currentGoodsModel.goods.count"
                        placeholder="礼物库存"
                        :min="0"
                        style="flex: 1"
                      />
                    </NFlex>
                  </NFormItem>
                </NGridItem>
                <NGridItem>
                  <NFormItem
                    path="isPinned"
                    label="展示设置"
                  >
                    <div style="padding-top: 4px">
                      <NCheckbox v-model:checked="currentGoodsModel.goods.isPinned">
                        在礼物列表顶部置顶显示
                      </NCheckbox>
                    </div>
                  </NFormItem>
                </NGridItem>
              </NGrid>

              <!-- 2. 交付与内容配置 -->
              <div class="form-section-title">交付与内容配置</div>

              <NFormItem
                path="type"
                label="礼物类型"
                required
              >
                <NRadioGroup v-model:value="currentGoodsModel.goods.type">
                  <NRadioButton :value="GoodsTypes.Virtual"> 虚拟礼物 (卡密/网盘/文本) </NRadioButton>
                  <NRadioButton :value="GoodsTypes.Physical"> 实体礼物 (实物邮寄) </NRadioButton>
                </NRadioGroup>
              </NFormItem>

              <!-- 虚拟礼物专用 -->
              <template v-if="currentGoodsModel.goods.type === GoodsTypes.Virtual">
                <NFormItem
                  path="content"
                  label="交付内容"
                  required
                >
                  <template #label>
                    <NFlex
                      align="center"
                      :gap="4"
                    >
                      <span>交付内容</span>
                      <NTooltip>
                        <template #trigger>
                          <NIcon
                            :component="Info24Filled"
                            style="cursor: pointer; color: var(--vtsuru-fg-muted)"
                          />
                        </template>
                        兑换成功后展示给用户的具体内容。若启用了卡密发放，可在文本中使用 {key} 占位符自动替换。
                      </NTooltip>
                    </NFlex>
                  </template>
                  <NInput
                    v-model:value="currentGoodsModel.goods.content"
                    type="textarea"
                    placeholder="请输入兑换成功后展示给用户的文本、下载链接或提取码（支持 {key} 占位符）"
                    :rows="3"
                    maxlength="10000"
                    show-count
                    clearable
                  />
                </NFormItem>

                <NGrid
                  cols="1 s:2"
                  :x-gap="16"
                  :y-gap="0"
                >
                  <NGridItem :span="currentGoodsModel.goods.keySelectionMode !== KeySelectionMode.None ? 1 : 2">
                    <NFormItem
                      path="keySelectionMode"
                      label="卡密 / 密钥自动发放"
                    >
                      <NRadioGroup v-model:value="currentGoodsModel.goods.keySelectionMode">
                        <NRadioButton :value="KeySelectionMode.None"> 不使用 </NRadioButton>
                        <NRadioButton :value="KeySelectionMode.Random"> 随机分配 </NRadioButton>
                        <NRadioButton :value="KeySelectionMode.Sequential"> 顺序分配 </NRadioButton>
                      </NRadioGroup>
                    </NFormItem>
                  </NGridItem>
                  <NGridItem v-if="currentGoodsModel.goods.keySelectionMode !== KeySelectionMode.None">
                    <NFormItem
                      path="virtualKeys"
                      label="卡密库"
                    >
                      <NFlex
                        vertical
                        :gap="6"
                        style="width: 100%"
                      >
                        <NDynamicTags
                          v-model:value="currentGoodsModel.goods.virtualKeys"
                          placeholder="输入卡密后回车"
                        />
                        <NText
                          depth="3"
                          style="font-size: 12px"
                        >
                          已添加 {{ (currentGoodsModel.goods.virtualKeys || []).length }} 个密钥
                        </NText>
                      </NFlex>
                    </NFormItem>
                  </NGridItem>
                </NGrid>
              </template>

              <!-- 实体礼物专用 -->
              <template v-else>
                <NGrid
                  cols="1 s:2"
                  :x-gap="16"
                  :y-gap="0"
                >
                  <NGridItem>
                    <NFormItem
                      path="address"
                      label="收货地址收集方式"
                      required
                    >
                      <NRadioGroup
                        :value="currentGoodsModel.goods.collectUrl === undefined ? 0 : 1"
                        @update:value="
                          (v) => {
                            if (v === 0) currentGoodsModel.goods.collectUrl = undefined
                            else
                              currentGoodsModel.goods.collectUrl =
                                currentGoodsModel.goods.collectUrl && currentGoodsModel.goods.collectUrl !== ''
                                  ? currentGoodsModel.goods.collectUrl
                                  : 'https://'
                          }
                        "
                      >
                        <NRadioButton :value="0"> 通过本站直接收集 </NRadioButton>
                        <NRadioButton :value="1"> 使用站外链接收集 </NRadioButton>
                      </NRadioGroup>
                    </NFormItem>
                  </NGridItem>
                  <NGridItem v-if="currentGoodsModel.goods.collectUrl === undefined">
                    <NFormItem
                      path="privacy"
                      label="隐私协议"
                      required
                    >
                      <div style="padding-top: 6px">
                        <NCheckbox v-model:checked="isAllowedPrivacyPolicy"> 我已阅读并同意本站收货隐私协议 </NCheckbox>
                      </div>
                    </NFormItem>
                  </NGridItem>
                  <NGridItem
                    v-else
                    :span="2"
                  >
                    <NFormItem
                      path="collectUrl"
                      label="站外收集链接"
                      required
                    >
                      <NFlex
                        vertical
                        :gap="8"
                        style="width: 100%"
                      >
                        <NInput
                          v-model:value="currentGoodsModel.goods.collectUrl"
                          placeholder="请输入用于收集地址的表单链接（如问卷星、腾讯文档等）"
                          maxlength="300"
                        />
                        <NCheckbox v-model:checked="currentGoodsModel.goods.embedCollectUrl">
                          尝试将外部收集表单直接内嵌到网页中展示
                        </NCheckbox>
                      </NFlex>
                    </NFormItem>
                  </NGridItem>
                </NGrid>
              </template>

              <!-- 3. 外观与介绍 -->
              <div class="form-section-title">外观与介绍</div>
              <NGrid
                cols="1 s:12"
                :x-gap="16"
                :y-gap="0"
              >
                <NGridItem :span="4">
                  <NFormItem
                    path="cover"
                    label="封面图片"
                  >
                    <NFlex
                      vertical
                      :gap="8"
                      style="width: 100%"
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
                          style="width: 100%; height: 100%"
                        >
                          <NIcon
                            size="24"
                            :depth="3"
                          />
                          <span>{{ currentGoodsModel.goods.cover ? '更换封面' : '上传封面' }}</span>
                          <span style="font-size: 11px; color: var(--vtsuru-fg-muted)">&lt; 10MB</span>
                        </NFlex>
                      </NUpload>
                      <NFlex
                        align="center"
                        :gap="6"
                      >
                        <NSwitch
                          v-model:value="shouldWatermarkCover"
                          size="small"
                        />
                        <NText
                          depth="3"
                          style="font-size: 12px"
                        >
                          添加 vtsuru.live 水印
                        </NText>
                      </NFlex>
                      <NProgress
                        v-if="isUploadingCover"
                        type="line"
                        :percentage="uploadProgress"
                        indicator-placement="inside"
                        processing
                      />
                    </NFlex>
                  </NFormItem>
                </NGridItem>
                <NGridItem :span="8">
                  <NFormItem
                    path="description"
                    label="礼物详细描述"
                  >
                    <NInput
                      v-model:value="currentGoodsModel.goods.description"
                      placeholder="可选，输入关于礼物的详细介绍与说明"
                      maxlength="500"
                      type="textarea"
                      :rows="3"
                    />
                  </NFormItem>
                  <NFormItem
                    path="tags"
                    label="分类标签"
                  >
                    <NSelect
                      v-model:value="currentGoodsModel.goods.tags"
                      filterable
                      multiple
                      clearable
                      tag
                      placeholder="可选，输入标签后回车添加"
                      :options="existTags"
                    />
                  </NFormItem>
                </NGridItem>
              </NGrid>
            </NTabPane>

            <!-- Tab 2: 多规格/款式配置 -->
            <NTabPane
              name="subItems"
              :tab="`款式规格 (${(currentGoodsModel.goods.subItems ?? []).length})`"
            >
              <NAlert
                type="info"
                :bordered="false"
                style="margin-bottom: 16px"
              >
                前台兑换时用户可选择具体款式；款式价格为最终兑换价，库存按款式独立计算。未单独配置的属性默认沿用商品主属性。
              </NAlert>

              <NFlex
                justify="space-between"
                align="center"
                style="margin-bottom: 16px"
              >
                <NFlex
                  align="center"
                  :gap="8"
                >
                  <NText
                    depth="2"
                    style="font-size: 13px"
                  >
                    最多可选款式数：
                  </NText>
                  <NInputNumber
                    v-model:value="currentGoodsModel.goods.maxSubItemSelections"
                    :min="0"
                    size="small"
                    placeholder="0 为不限制"
                    style="width: 140px"
                  >
                    <template #suffix> 种 </template>
                  </NInputNumber>
                </NFlex>
                <NFlex
                  align="center"
                  :gap="12"
                >
                  <NSelect
                    v-model:value="subItemsSortMode"
                    size="small"
                    style="width: 130px"
                    :options="[
                      { label: '手动排序', value: 'manual' },
                      { label: '按名称', value: 'name' },
                      { label: '按价格', value: 'price' },
                      { label: '按库存', value: 'stock' },
                    ]"
                  />
                  <NButton
                    type="primary"
                    secondary
                    size="small"
                    @click="addSubItem"
                  >
                    <template #icon>
                      <NIcon :component="Add24Filled" />
                    </template>
                    添加款式
                  </NButton>
                </NFlex>
              </NFlex>

              <NEmpty
                v-if="!(currentGoodsModel.goods.subItems ?? []).length"
                description="暂未添加款式（单规格礼物无需配置）"
                style="margin: 32px 0"
              />

              <template v-else>
                <div
                  v-for="(sub, idx) in subItemsForDisplay"
                  :key="getSubItemKey(sub)"
                  class="manage-sub-item-card"
                >
                  <NFlex
                    justify="space-between"
                    align="center"
                    style="margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--vtsuru-border)"
                  >
                    <NText strong> 款式 #{{ idx + 1 }} </NText>
                    <NFlex
                      :gap="8"
                      align="center"
                    >
                      <NButton
                        quaternary
                        size="tiny"
                        :disabled="subItemsSortMode !== 'manual'"
                        @click="moveSubItemByKey(getSubItemKey(sub), -1)"
                      >
                        上移
                      </NButton>
                      <NButton
                        quaternary
                        size="tiny"
                        :disabled="subItemsSortMode !== 'manual'"
                        @click="moveSubItemByKey(getSubItemKey(sub), 1)"
                      >
                        下移
                      </NButton>
                      <NButton
                        type="error"
                        secondary
                        size="tiny"
                        @click="removeSubItemByKey(getSubItemKey(sub))"
                      >
                        <template #icon>
                          <NIcon :component="Delete24Filled" />
                        </template>
                        删除
                      </NButton>
                    </NFlex>
                  </NFlex>

                  <NGrid
                    cols="1 s:3"
                    :x-gap="12"
                    :y-gap="8"
                    style="margin-bottom: 8px"
                  >
                    <NGridItem>
                      <NFormItem
                        label="款式名称"
                        required
                        style="margin-bottom: 0"
                      >
                        <NInput
                          v-model:value="sub.name"
                          placeholder="如：款式A / 立牌"
                          maxlength="200"
                        />
                      </NFormItem>
                    </NGridItem>
                    <NGridItem>
                      <NFormItem
                        label="所需积分"
                        required
                        style="margin-bottom: 0"
                      >
                        <NInputNumber
                          v-model:value="sub.price"
                          :min="0"
                          placeholder="款式积分价"
                          style="width: 100%"
                        />
                      </NFormItem>
                    </NGridItem>
                    <NGridItem>
                      <NFormItem
                        label="款式库存"
                        style="margin-bottom: 0"
                      >
                        <NFlex
                          :gap="8"
                          align="center"
                        >
                          <NCheckbox
                            :checked="sub.stock === undefined"
                            @update:checked="(v) => (sub.stock = v ? undefined : 100)"
                          >
                            不限
                          </NCheckbox>
                          <NInputNumber
                            v-if="sub.stock !== undefined"
                            v-model:value="sub.stock"
                            :min="0"
                            placeholder="库存"
                            style="flex: 1"
                          />
                        </NFlex>
                      </NFormItem>
                    </NGridItem>
                  </NGrid>

                  <!-- 款式高级独立覆盖（折叠或网格） -->
                  <NCollapse style="margin-top: 8px">
                    <NCollapseItem
                      title="独立属性覆盖 (可选，默认沿用商品配置)"
                      name="sub-override"
                    >
                      <NGrid
                        cols="1 s:2"
                        :x-gap="16"
                        :y-gap="12"
                      >
                        <NGridItem>
                          <NFormItem label="款式封面">
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
                        </NGridItem>
                        <NGridItem>
                          <NFormItem label="款式描述">
                            <NInput
                              v-model:value="sub.description"
                              type="textarea"
                              placeholder="留空则沿用主商品描述"
                              maxlength="500"
                              :rows="3"
                            />
                          </NFormItem>
                        </NGridItem>
                        <NGridItem>
                          <NFormItem label="允许重购">
                            <NFlex
                              vertical
                              :gap="6"
                            >
                              <NCheckbox
                                :checked="sub.isAllowRebuy === undefined"
                                @update:checked="
                                  (v) =>
                                    (sub.isAllowRebuy = v ? undefined : (currentGoodsModel.goods.isAllowRebuy ?? false))
                                "
                              >
                                沿用主商品（{{ currentGoodsModel.goods.isAllowRebuy ? '允许' : '不允许' }}）
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
                        </NGridItem>
                        <NGridItem>
                          <NFormItem label="单人限购数">
                            <NFlex
                              vertical
                              :gap="6"
                              style="width: 100%"
                            >
                              <NCheckbox
                                :checked="sub.maxBuyCount === undefined"
                                @update:checked="
                                  (v) => (sub.maxBuyCount = v ? undefined : (currentGoodsModel.goods.maxBuyCount ?? 1))
                                "
                              >
                                沿用主商品（{{ currentGoodsModel.goods.maxBuyCount ?? 1 }} 件）
                              </NCheckbox>
                              <NInputNumber
                                :value="sub.maxBuyCount ?? currentGoodsModel.goods.maxBuyCount ?? 1"
                                :disabled="sub.maxBuyCount === undefined"
                                :min="1"
                                style="width: 100%"
                                @update:value="(v) => (sub.maxBuyCount = v)"
                              />
                            </NFlex>
                          </NFormItem>
                        </NGridItem>
                      </NGrid>
                    </NCollapseItem>
                  </NCollapse>
                </div>
              </template>
            </NTabPane>

            <!-- Tab 3: 兑换规则与高级特权 -->
            <NTabPane
              name="rules"
              tab="规则与特权"
            >
              <div class="form-section-title">常规兑换限制</div>
              <NGrid
                cols="1 s:2"
                :x-gap="16"
                :y-gap="12"
              >
                <NGridItem>
                  <NFormItem label="重复兑换限制">
                    <div style="padding-top: 4px">
                      <NCheckbox v-model:checked="currentGoodsModel.goods.isAllowRebuy">
                        允许同一用户多次重复兑换
                      </NCheckbox>
                    </div>
                  </NFormItem>
                </NGridItem>
                <NGridItem>
                  <NFormItem
                    path="maxBuyCount"
                    label="单人最大兑换数量"
                  >
                    <NInputNumber
                      v-model:value="currentGoodsModel.goods.maxBuyCount"
                      placeholder="每个用户最大可兑换数量"
                      :min="1"
                      style="width: 100%"
                    />
                  </NFormItem>
                </NGridItem>
              </NGrid>

              <div class="form-section-title">舰长 (大航海) 特权配置</div>
              <div class="privilege-card">
                <NFlex
                  vertical
                  :gap="16"
                >
                  <!-- 舰长免费兑换 -->
                  <div>
                    <NFlex
                      align="center"
                      :gap="8"
                      style="margin-bottom: 10px"
                    >
                      <NCheckbox
                        :checked="Array.isArray(currentGoodsModel.goods.setting?.guardFreeMonths)"
                        @update:checked="
                          (v) => {
                            if (!currentGoodsModel.goods.setting) {
                              currentGoodsModel.goods.setting = { allowGuardLevel: 0 }
                            }
                            currentGoodsModel.goods.setting.guardFreeMonths = v
                              ? [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }]
                              : undefined
                          }
                        "
                      >
                        <span style="font-weight: 600">允许舰长免费兑换</span>
                      </NCheckbox>
                      <NTooltip>
                        <template #trigger>
                          <NIcon
                            :component="Info24Filled"
                            style="color: var(--vtsuru-fg-muted)"
                          />
                        </template>
                        需在舰长和SC事件记录中存在有效航海记录
                      </NTooltip>
                    </NFlex>

                    <div
                      v-if="currentGoodsModel.goods.setting?.guardFreeMonths"
                      class="privilege-sub-block"
                    >
                      <NFlex
                        vertical
                        :gap="12"
                      >
                        <NFlex
                          align="center"
                          :gap="12"
                        >
                          <NText depth="2">最低舰长身份：</NText>
                          <NRadioGroup
                            :value="currentGoodsModel.goods.setting?.allowGuardFreeMinLevel ?? 0"
                            @update:value="
                              (v) => {
                                if (!currentGoodsModel.goods.setting) {
                                  currentGoodsModel.goods.setting = { allowGuardLevel: 0 }
                                }
                                currentGoodsModel.goods.setting.allowGuardFreeMinLevel = v
                              }
                            "
                          >
                            <NRadioButton :value="0"> 不限 </NRadioButton>
                            <NRadioButton :value="3"> 舰长 </NRadioButton>
                            <NRadioButton :value="2"> 提督 </NRadioButton>
                            <NRadioButton :value="1"> 总督 </NRadioButton>
                          </NRadioGroup>
                        </NFlex>

                        <NFlex
                          align="center"
                          :gap="12"
                        >
                          <NCheckbox
                            :checked="currentGoodsModel.goods.setting?.guardFreeMonths?.length === 0"
                            @update:checked="
                              (v) => {
                                if (!currentGoodsModel.goods.setting) {
                                  currentGoodsModel.goods.setting = { allowGuardLevel: 0 }
                                }
                                if (!currentGoodsModel.goods.setting.guardFreeMonths) {
                                  currentGoodsModel.goods.setting.guardFreeMonths = []
                                }
                                currentGoodsModel.goods.setting.guardFreeMonths = v
                                  ? []
                                  : [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }]
                              }
                            "
                          >
                            当前在舰即可生效 (不限特定历史月份)
                          </NCheckbox>
                        </NFlex>

                        <NFlex
                          v-if="currentGoodsModel.goods.setting.guardFreeMonths.length > 0"
                          vertical
                          :gap="8"
                        >
                          <NText
                            depth="3"
                            style="font-size: 12px"
                          >
                            限定必须在以下指定月份上舰：
                          </NText>
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
                              placeholder="年份"
                              @update:value="
                                (v) => {
                                  if (currentGoodsModel.goods.setting?.guardFreeMonths) {
                                    currentGoodsModel.goods.setting.guardFreeMonths[idx].year = v
                                  }
                                }
                              "
                            />
                            <NSelect
                              style="flex: 1"
                              :value="m.month"
                              :options="allowedMonthOptions"
                              placeholder="月份"
                              @update:value="
                                (v) => {
                                  if (currentGoodsModel.goods.setting?.guardFreeMonths) {
                                    currentGoodsModel.goods.setting.guardFreeMonths[idx].month = v
                                  }
                                }
                              "
                            />
                            <NButton
                              type="error"
                              secondary
                              size="small"
                              @click="
                                () => {
                                  if (!currentGoodsModel.goods.setting?.guardFreeMonths) return
                                  currentGoodsModel.goods.setting.guardFreeMonths.splice(idx, 1)
                                  if (currentGoodsModel.goods.setting.guardFreeMonths.length === 0) {
                                    currentGoodsModel.goods.setting.guardFreeMonths = [
                                      { year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
                                    ]
                                  }
                                }
                              "
                            >
                              删除
                            </NButton>
                          </NFlex>
                          <NButton
                            secondary
                            size="small"
                            style="width: 120px"
                            @click="
                              () => {
                                if (!currentGoodsModel.goods.setting?.guardFreeMonths) return
                                currentGoodsModel.goods.setting.guardFreeMonths.push({
                                  year: new Date().getFullYear(),
                                  month: new Date().getMonth() + 1,
                                })
                              }
                            "
                          >
                            + 添加月份
                          </NButton>
                        </NFlex>
                      </NFlex>
                    </div>
                  </div>

                  <NDivider style="margin: 0" />

                  <!-- 限制最低兑换舰长等级 -->
                  <div>
                    <NFlex
                      align="center"
                      :gap="8"
                      style="margin-bottom: 10px"
                    >
                      <NText strong> 兑换门槛 (最低舰长等级限制) </NText>
                      <NTooltip>
                        <template #trigger>
                          <NIcon
                            :component="Info24Filled"
                            style="color: var(--vtsuru-fg-muted)"
                          />
                        </template>
                        限制只有达到指定舰长身份的用户才能使用积分兑换
                      </NTooltip>
                    </NFlex>

                    <NFlex
                      vertical
                      :gap="12"
                      class="privilege-sub-block"
                    >
                      <NFlex
                        align="center"
                        :gap="12"
                      >
                        <NText depth="2">要求身份：</NText>
                        <NRadioGroup
                          :value="currentGoodsModel.goods.setting?.allowGuardLevel ?? 0"
                          @update:value="
                            (v) => {
                              if (!currentGoodsModel.goods.setting) {
                                currentGoodsModel.goods.setting = { allowGuardLevel: 0 }
                              }
                              currentGoodsModel.goods.setting.allowGuardLevel = v
                            }
                          "
                        >
                          <NRadioButton :value="0"> 不限 (普通用户均可) </NRadioButton>
                          <NRadioButton :value="3"> 舰长及以上 </NRadioButton>
                          <NRadioButton :value="2"> 提督及以上 </NRadioButton>
                          <NRadioButton :value="1"> 仅总督 </NRadioButton>
                        </NRadioGroup>
                      </NFlex>

                      <template v-if="(currentGoodsModel.goods.setting?.allowGuardLevel ?? 0) > 0">
                        <NCheckbox
                          :checked="Array.isArray(currentGoodsModel.goods.setting?.guardLevelMonths)"
                          @update:checked="
                            (v) => {
                              if (!currentGoodsModel.goods.setting) {
                                currentGoodsModel.goods.setting = { allowGuardLevel: 0 }
                              }
                              currentGoodsModel.goods.setting.guardLevelMonths = v
                                ? [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }]
                                : undefined
                            }
                          "
                        >
                          限定特定上舰月份
                        </NCheckbox>

                        <div
                          v-if="currentGoodsModel.goods.setting?.guardLevelMonths"
                          style="padding-left: 8px"
                        >
                          <NFlex
                            vertical
                            :gap="8"
                          >
                            <NCheckbox
                              :checked="currentGoodsModel.goods.setting?.guardLevelMonths?.length === 0"
                              @update:checked="
                                (v) => {
                                  if (!currentGoodsModel.goods.setting) {
                                    currentGoodsModel.goods.setting = { allowGuardLevel: 0 }
                                  }
                                  if (!currentGoodsModel.goods.setting.guardLevelMonths) {
                                    currentGoodsModel.goods.setting.guardLevelMonths = []
                                  }
                                  currentGoodsModel.goods.setting.guardLevelMonths = v
                                    ? []
                                    : [{ year: new Date().getFullYear(), month: new Date().getMonth() + 1 }]
                                }
                              "
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
                                  placeholder="年份"
                                  @update:value="
                                    (v) => {
                                      if (currentGoodsModel.goods.setting?.guardLevelMonths) {
                                        currentGoodsModel.goods.setting.guardLevelMonths[idx].year = v
                                      }
                                    }
                                  "
                                />
                                <NSelect
                                  style="flex: 1"
                                  :value="m.month"
                                  :options="allowedMonthOptions"
                                  placeholder="月份"
                                  @update:value="
                                    (v) => {
                                      if (currentGoodsModel.goods.setting?.guardLevelMonths) {
                                        currentGoodsModel.goods.setting.guardLevelMonths[idx].month = v
                                      }
                                    }
                                  "
                                />
                                <NButton
                                  type="error"
                                  secondary
                                  size="small"
                                  @click="
                                    () => {
                                      if (!currentGoodsModel.goods.setting?.guardLevelMonths) return
                                      currentGoodsModel.goods.setting.guardLevelMonths.splice(idx, 1)
                                      if (currentGoodsModel.goods.setting.guardLevelMonths.length === 0) {
                                        currentGoodsModel.goods.setting.guardLevelMonths = [
                                          { year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
                                        ]
                                      }
                                    }
                                  "
                                >
                                  删除
                                </NButton>
                              </NFlex>
                              <NButton
                                secondary
                                size="small"
                                style="width: 120px"
                                @click="
                                  () => {
                                    if (!currentGoodsModel.goods.setting?.guardLevelMonths) return
                                    currentGoodsModel.goods.setting.guardLevelMonths.push({
                                      year: new Date().getFullYear(),
                                      month: new Date().getMonth() + 1,
                                    })
                                  }
                                "
                              >
                                + 添加月份
                              </NButton>
                            </NFlex>
                          </NFlex>
                        </div>
                      </template>
                    </NFlex>
                  </div>
                </NFlex>
              </div>
            </NTabPane>
          </NTabs>
        </NForm>
        <div style="height: 12px" />
      </NScrollbar>
    </div>
    <template #footer>
      <NFlex
        justify="end"
        :gap="12"
      >
        <NButton
          secondary
          size="medium"
          :disabled="isUpdating || isUploadingCover"
          @click="showAddGoodsModal = false"
        >
          取消
        </NButton>
        <NButton
          type="primary"
          size="medium"
          :loading="isUpdating || isUploadingCover"
          :disabled="isUploadingCover"
          @click="updateGoods"
        >
          <span v-if="isUploadingCover">正在上传封面...</span>
          <span v-else>{{ currentGoodsModel.goods.id ? '保存修改' : '立即创建' }}</span>
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
  border-top: 1px solid var(--vtsuru-border);
  background-color: var(--vtsuru-bg-inset);
}

.scrollable-container {
  position: relative;
  background-color: transparent;
  border: none;
  border-radius: var(--vtsuru-radius);
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
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background-color: var(--vtsuru-bg-surface);
  transition: all 0.3s var(--vtsuru-bezier);
}

.manage-sub-item-card:hover {
  border-color: var(--vtsuru-primary);
  box-shadow: 0 0 0 1px var(--vtsuru-primary) inset;
}

.form-section-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--vtsuru-fg-muted);
  margin: 16px 0 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.form-section-title:first-of-type {
  margin-top: 4px;
}

.privilege-card {
  padding: 16px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background-color: var(--vtsuru-bg-surface);
}

.privilege-sub-block {
  padding: 12px;
  border-radius: var(--vtsuru-radius);
  background-color: var(--vtsuru-bg-inset);
  margin-top: 8px;
}
</style>
