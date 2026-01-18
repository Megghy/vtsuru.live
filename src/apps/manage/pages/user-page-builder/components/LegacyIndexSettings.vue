<script setup lang="ts">
import type { ResponseUserIndexModel, VideoCollectVideo } from '@/api/api-models'
import { Delete24Regular } from '@vicons/fluent'
import {
  NAlert,
  NButton,
  NCheckbox,
  NDivider,
  NEmpty,
  NFlex,
  NIcon,
  NInput,
  NModal,
  NPopconfirm,
  NSpace,
  NTag,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, inject, ref } from 'vue'
import { SaveSetting, useAccount } from '@/api/account'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import SimpleVideoCard from '@/components/SimpleVideoCard.vue'
import { USER_INDEX_API_URL } from '@/shared/config'
import { UserPageEditorKey } from '../context'

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')
const accountInfo = useAccount()
const message = useMessage()

const isLoading = ref(false)

const indexDisplayInfo = ref<ResponseUserIndexModel | null>(null)

const showAddVideoModal = ref(false)
const addVideoUrl = ref('')

const showAddLinkModal = ref(false)
const addLinkName = ref('')
const addLinkUrl = ref('')

const editingLinkName = ref<string | null>(null)
const newLinkName = ref('')
const linkKey = ref(0)

const orderedLinks = computed(() => {
  const links = indexDisplayInfo.value?.links ?? {}
  const entries = Object.entries(links)
  const order = accountInfo.value?.settings.index.linkOrder
  if (!order?.length) return entries
  const map = new Map(entries)
  return order.filter(k => map.has(k)).map(k => [k, map.get(k)!]) as [string, string][]
})

async function loadIndexInfo() {
  if (!accountInfo.value?.name) return
  isLoading.value = true
  try {
    const data = await QueryGetAPI<ResponseUserIndexModel>(`${USER_INDEX_API_URL}get`, { id: accountInfo.value.name })
    if (data.code === 200) {
      indexDisplayInfo.value = data.data
      return
    }
    if (data.code === 404) {
      indexDisplayInfo.value = { links: {}, videos: [] } as any
      return
    }
    throw new Error(data.message || `无法获取数据: ${data.code}`)
  } catch (e) {
    console.error('Failed to load user index info:', e)
    message.error(`无法获取数据: ${(e as Error).message || String(e)}`)
    indexDisplayInfo.value = null
  } finally {
    isLoading.value = false
  }
}

async function updateUserIndexSettings() {
  try {
    await SaveSetting('Index', accountInfo.value.settings.index)
    message.success('已保存')
  } catch (e) {
    message.error(`保存失败: ${(e as Error).message || String(e)}`)
    throw e
  }
}

async function updateIndexSettings() {
  try {
    const response = await QueryPostAPI(`${USER_INDEX_API_URL}update-setting`, accountInfo.value.settings.index)
    if (response.code !== 200) throw new Error(response.message || `保存失败: ${response.code}`)
    message.success('已保存')
  } catch (err) {
    message.error(`保存失败: ${err}`)
    throw err
  }
}

async function addVideo() {
  if (!addVideoUrl.value) {
    message.error('请输入视频链接')
    return
  }

  isLoading.value = true
  try {
    const response = await QueryGetAPI<VideoCollectVideo>(`${USER_INDEX_API_URL}add-video`, {
      video: addVideoUrl.value,
    })

    if (response.code !== 200) throw new Error(response.message || `保存失败: ${response.code}`)
    message.success('已添加')
    indexDisplayInfo.value?.videos.push(response.data)
    accountInfo.value.settings.index.videos.push(response.data.id)
    addVideoUrl.value = ''
    showAddVideoModal.value = false
  } catch (err) {
    message.error(`保存失败: ${err}`)
  } finally {
    isLoading.value = false
  }
}

async function removeVideo(id: string) {
  isLoading.value = true
  try {
    const response = await QueryGetAPI<VideoCollectVideo>(`${USER_INDEX_API_URL}del-video`, { video: id })
    if (response.code !== 200) throw new Error(response.message || `删除失败: ${response.code}`)
    message.success('已删除')
    if (indexDisplayInfo.value) indexDisplayInfo.value.videos = indexDisplayInfo.value.videos.filter(v => v.id !== id)
    accountInfo.value.settings.index.videos = accountInfo.value.settings.index.videos.filter(v => v !== id)
  } catch (err) {
    message.error(`删除失败: ${err}`)
  } finally {
    isLoading.value = false
  }
}

function moveVideo(id: string, dir: 'up' | 'down') {
  const list = accountInfo.value.settings.index.videos
  const i = list.indexOf(id)
  if (i === -1) return
  const nextIndex = dir === 'up' ? i - 1 : i + 1
  if (nextIndex < 0 || nextIndex >= list.length) return
  ;[list[i], list[nextIndex]] = [list[nextIndex], list[i]]
  void updateIndexSettings()
}

function moveLink(name: string, dir: 'up' | 'down') {
  const order = accountInfo.value.settings.index.linkOrder
  if (!order) return
  const i = order.indexOf(name)
  const nextIndex = dir === 'up' ? i - 1 : i + 1
  if (i === -1 || nextIndex < 0 || nextIndex >= order.length) return
  ;[order[i], order[nextIndex]] = [order[nextIndex], order[i]]
  void updateIndexSettings()
  linkKey.value++
}

function startEditLink(name: string) {
  editingLinkName.value = name
  newLinkName.value = name
}

async function confirmEditLink(oldName: string) {
  const idxSetting = accountInfo.value.settings.index
  if (!newLinkName.value || newLinkName.value === oldName) {
    editingLinkName.value = null
    return
  }
  if (idxSetting.links[newLinkName.value]) {
    message.error('名称已存在')
    return
  }
  idxSetting.links[newLinkName.value] = idxSetting.links[oldName]
  delete idxSetting.links[oldName]
  if (idxSetting.linkOrder) {
    idxSetting.linkOrder = idxSetting.linkOrder.map(k => (k === oldName ? newLinkName.value : k))
  }
  await updateIndexSettings()
  editingLinkName.value = null
  linkKey.value++
}

function cancelEditLink() {
  editingLinkName.value = null
}

async function addLink() {
  if (!addLinkName.value || !addLinkUrl.value) {
    message.error('请输入名称和链接')
    return
  }

  try {
    const validatedUrl = new URL(addLinkUrl.value)
    addLinkUrl.value = validatedUrl.toString()
  } catch (e) {
    console.error(e)
    message.error('请输入正确的链接')
    return
  }

  if (Object.keys(accountInfo.value.settings.index.links).includes(addLinkName.value)) {
    message.error(`${addLinkName.value}已存在`)
    return
  }

  accountInfo.value.settings.index.links[addLinkName.value] = addLinkUrl.value
  await updateIndexSettings()
  await loadIndexInfo()

  addLinkName.value = ''
  addLinkUrl.value = ''
  showAddLinkModal.value = false
  linkKey.value++
}

async function removeLink(name: string) {
  delete accountInfo.value.settings.index.links[name]
  if (accountInfo.value.settings.index.linkOrder) {
    accountInfo.value.settings.index.linkOrder = accountInfo.value.settings.index.linkOrder.filter(k => k !== name)
  }
  await updateIndexSettings()
  await loadIndexInfo()
  linkKey.value++
}

accountInfo.value.settings.index.allowDisplayInIndex = accountInfo.value.settings.index.allowDisplayInIndex ?? true
if (!accountInfo.value.settings.index.linkOrder || accountInfo.value.settings.index.linkOrder.length === 0) {
  accountInfo.value.settings.index.linkOrder = Object.keys(accountInfo.value.settings.index.links || {})
}
await loadIndexInfo()
</script>

<template>
  <NAlert
    v-if="editor.currentKey.value !== 'home'"
    type="warning"
    :show-icon="true"
  >
    传统模式设置仅支持主页 home。
  </NAlert>

  <template v-else>
    <NFlex vertical :size="12">
      <NDivider style="margin: 0;">
        常规
      </NDivider>
      <NCheckbox
        v-model:checked="accountInfo.settings.index.allowDisplayInIndex"
        :disabled="isLoading"
        @update:checked="updateUserIndexSettings"
      >
        允许显示在网站主页
      </NCheckbox>

      <NDivider style="margin: 0;">
        通知
      </NDivider>
      <NInput
        v-model:value="accountInfo.settings.index.notification"
        type="textarea"
        placeholder="可选"
      />
      <NFlex justify="end">
        <NButton
          type="primary"
          size="small"
          :loading="isLoading"
          @click="updateIndexSettings"
        >
          保存
        </NButton>
      </NFlex>

      <NDivider style="margin: 0;">
        展示视频
      </NDivider>
      <NButton
        type="primary"
        size="small"
        :disabled="isLoading"
        @click="showAddVideoModal = true"
      >
        添加视频
      </NButton>
      <NEmpty v-if="accountInfo.settings.index.videos.length === 0" />
      <NFlex v-else wrap :size="12">
        <NTooltip v-for="item in (indexDisplayInfo?.videos ?? [])" :key="item.id">
          <template #trigger>
            <div>
              <SimpleVideoCard :video="item" />
              <NSpace style="margin-top: 6px">
                <NButton size="small" secondary :disabled="isLoading" @click="moveVideo(item.id, 'up')">
                  上移
                </NButton>
                <NButton size="small" secondary :disabled="isLoading" @click="moveVideo(item.id, 'down')">
                  下移
                </NButton>
                <NButton type="warning" size="small" :disabled="isLoading" @click="removeVideo(item.id)">
                  删除
                </NButton>
              </NSpace>
            </div>
          </template>
          {{ item.title }}
        </NTooltip>
      </NFlex>

      <NDivider style="margin: 0;">
        其他链接
      </NDivider>
      <NButton
        type="primary"
        size="small"
        :disabled="isLoading"
        @click="showAddLinkModal = true"
      >
        添加链接
      </NButton>
      <NEmpty v-if="Object.entries(indexDisplayInfo?.links ?? {}).length === 0" />
      <NFlex
        v-else
        :key="linkKey"
        wrap
        :size="8"
      >
        <NFlex v-for="link in orderedLinks" :key="link[0]" align="center">
          <template v-if="editingLinkName === link[0]">
            <NInput v-model:value="newLinkName" size="small" style="width: 120px" />
            <NButton size="tiny" type="primary" text @click="confirmEditLink(link[0])">
              保存
            </NButton>
            <NButton size="tiny" text @click="cancelEditLink">
              取消
            </NButton>
          </template>
          <template v-else>
            <NTooltip>
              <template #trigger>
                <NTag
                  :bordered="false"
                  size="small"
                  type="info"
                >
                  {{ link[0] }}
                </NTag>
              </template>
              {{ link[1] }}
            </NTooltip>
            <NSpace>
              <NButton size="tiny" secondary text @click="moveLink(link[0], 'up')">
                ↑
              </NButton>
              <NButton size="tiny" secondary text @click="moveLink(link[0], 'down')">
                ↓
              </NButton>
              <NButton size="tiny" text @click="startEditLink(link[0])">
                改名
              </NButton>
              <NPopconfirm @positive-click="removeLink(link[0])">
                <template #trigger>
                  <NButton type="error" text size="tiny">
                    <template #icon>
                      <NIcon :component="Delete24Regular" />
                    </template>
                  </NButton>
                </template>
                确定要删除这个链接吗?
              </NPopconfirm>
            </NSpace>
          </template>
        </NFlex>
      </NFlex>
    </NFlex>

    <NModal
      v-model:show="showAddVideoModal"
      preset="card"
      closable
      style="width: 600px; max-width: 90vw"
      title="添加视频"
    >
      <NInput v-model:value="addVideoUrl" placeholder="请输入视频链接" />
      <NDivider />
      <NButton type="primary" :loading="isLoading" @click="addVideo">
        添加视频
      </NButton>
    </NModal>

    <NModal
      v-model:show="showAddLinkModal"
      preset="card"
      closable
      style="width: 600px; max-width: 90vw"
      title="添加链接"
    >
      <NFlex vertical>
        <NInput v-model:value="addLinkName" placeholder="链接名称" />
        <NInput v-model:value="addLinkUrl" placeholder="链接地址" />
        <NButton type="primary" :loading="isLoading" @click="addLink">
          添加链接
        </NButton>
      </NFlex>
    </NModal>
  </template>
</template>
