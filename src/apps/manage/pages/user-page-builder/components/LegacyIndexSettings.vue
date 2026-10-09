<script setup lang="ts">
import { Delete24Regular } from '@vicons/fluent'
import { ArrowDownOutline, ArrowUpOutline } from '@vicons/ionicons5'
import {
  NButton,
  NCheckbox,
  NDivider,
  NEmpty,
  NFlex,
  NIcon,
  NInput,
  NModal,
  NPopconfirm,
  NSelect,
  NTag,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, ref } from 'vue'

import { SaveAccountSettings, SaveSetting, useAccount } from '@/api/account'
import type { ResponseUserIndexModel, VideoCollectVideo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import SimpleVideoCard from '@/components/SimpleVideoCard.vue'
import { USER_INDEX_API_URL } from '@/shared/config'
import { IndexTemplateMap } from '@/shared/config/templates'

const accountInfo = useAccount()
const message = useMessage()

const selectedIndexTemplateKey = computed({
  get: () => accountInfo.value.settings.indexTemplate || 'default',
  set: (val: string) => {
    accountInfo.value.settings.indexTemplate = val
  },
})

const selectedIndexTemplate = computed(
  () => IndexTemplateMap[selectedIndexTemplateKey.value] || IndexTemplateMap.default,
)
const indexTemplateOptions = Object.entries(IndexTemplateMap).map(([key, item]) => ({
  label: item.name,
  value: key,
}))
const showTemplatePreview = ref(false)

const showAddVideoModal = ref(false)
const addVideoUrl = ref('')

const showAddLinkModal = ref(false)
const addLinkName = ref('')
const addLinkUrl = ref('')

const linkKey = ref(0)
const editingLinkName = ref<string | null>(null)
const newLinkName = ref('')

const isLoading = ref(false)
const indexDisplayInfo = ref<ResponseUserIndexModel | null>(null)

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
      indexDisplayInfo.value = { notification: '', links: {}, videos: [] }
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
  }
}

async function updateIndexSettings() {
  isLoading.value = true
  try {
    const response = await QueryPostAPI(`${USER_INDEX_API_URL}update-setting`, accountInfo.value.settings.index)
    if (response.code !== 200) throw new Error(response.message || `保存失败: ${response.code}`)
    message.success('已保存')
  } catch (err) {
    message.error(`保存失败: ${(err as Error).message || String(err)}`)
  } finally {
    isLoading.value = false
  }
}

async function saveIndexTemplate(templateKey: string) {
  accountInfo.value.settings.indexTemplate = templateKey
  try {
    const response = await SaveAccountSettings()
    if (response.code !== 200) throw new Error(response.message || '保存失败')
    message.success('已切换主页模板')
  } catch (err) {
    message.error((err as Error).message || String(err))
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
    message.success('添加成功')
    if (indexDisplayInfo.value) {
      indexDisplayInfo.value.videos.push(response.data)
    }
    accountInfo.value.settings.index.videos.push(response.data.id)
    showAddVideoModal.value = false
    addVideoUrl.value = ''
  } catch (err) {
    message.error((err as Error).message || String(err))
  } finally {
    isLoading.value = false
  }
}

async function removeVideo(id: string) {
  isLoading.value = true
  try {
    const response = await QueryGetAPI<VideoCollectVideo>(`${USER_INDEX_API_URL}del-video`, { video: id })
    if (response.code !== 200) throw new Error(response.message || `删除失败: ${response.code}`)
    message.success('删除成功')
    if (indexDisplayInfo.value) {
      indexDisplayInfo.value.videos = indexDisplayInfo.value.videos.filter((v) => v.id !== id)
    }
    accountInfo.value.settings.index.videos = accountInfo.value.settings.index.videos.filter((v) => v !== id)
  } catch (err) {
    message.error((err as Error).message || String(err))
  } finally {
    isLoading.value = false
  }
}

async function moveVideo(id: string, direction: 'up' | 'down') {
  const videos = accountInfo.value.settings.index.videos
  const currentIndex = videos.indexOf(id)
  if (currentIndex === -1) return
  if (direction === 'up' && currentIndex > 0) {
    ;[videos[currentIndex], videos[currentIndex - 1]] = [videos[currentIndex - 1], videos[currentIndex]]
  } else if (direction === 'down' && currentIndex < videos.length - 1) {
    ;[videos[currentIndex], videos[currentIndex + 1]] = [videos[currentIndex + 1], videos[currentIndex]]
  } else {
    return
  }
  isLoading.value = true
  try {
    await updateIndexSettings()
    await loadIndexInfo()
  } catch (err) {
    message.error((err as Error).message || String(err))
  } finally {
    isLoading.value = false
  }
}

async function addLink() {
  if (!addLinkName.value || !addLinkUrl.value) {
    message.error('请输入链接名称和地址')
    return
  }
  try {
    const validatedUrl = new URL(addLinkUrl.value)
    addLinkUrl.value = validatedUrl.toString()
  } catch {
    message.error('请输入正确的链接')
    return
  }
  if (!accountInfo.value.settings.index.links) {
    accountInfo.value.settings.index.links = {}
  }
  if (accountInfo.value.settings.index.links[addLinkName.value]) {
    message.error('链接名称已存在')
    return
  }
  accountInfo.value.settings.index.links[addLinkName.value] = addLinkUrl.value
  if (!accountInfo.value.settings.index.linkOrder) {
    accountInfo.value.settings.index.linkOrder = []
  }
  accountInfo.value.settings.index.linkOrder.push(addLinkName.value)
  try {
    await updateIndexSettings()
    await loadIndexInfo()
    message.success('添加成功')
    showAddLinkModal.value = false
    addLinkName.value = ''
    addLinkUrl.value = ''
    linkKey.value++
  } catch (err) {
    message.error((err as Error).message || String(err))
  }
}

async function removeLink(name: string) {
  delete accountInfo.value.settings.index.links[name]
  accountInfo.value.settings.index.linkOrder = (accountInfo.value.settings.index.linkOrder || []).filter(
    (item) => item !== name,
  )
  try {
    await updateIndexSettings()
    await loadIndexInfo()
    message.success('删除成功')
    linkKey.value++
  } catch (err) {
    message.error((err as Error).message || String(err))
  }
}

function startEditLink(name: string) {
  editingLinkName.value = name
  newLinkName.value = name
}

function cancelEditLink() {
  editingLinkName.value = null
  newLinkName.value = ''
}

async function confirmEditLink(oldName: string) {
  if (!newLinkName.value || newLinkName.value === oldName) {
    cancelEditLink()
    return
  }
  const links = accountInfo.value.settings.index.links || {}
  const linkOrder = accountInfo.value.settings.index.linkOrder || []
  if (links[newLinkName.value]) {
    message.error('新链接名称已存在')
    return
  }
  links[newLinkName.value] = links[oldName]
  delete links[oldName]
  const index = linkOrder.indexOf(oldName)
  if (index !== -1) {
    linkOrder[index] = newLinkName.value
  }
  try {
    await updateIndexSettings()
    message.success('改名成功')
    cancelEditLink()
    linkKey.value++
  } catch (err) {
    message.error((err as Error).message || String(err))
  }
}

async function moveLink(name: string, direction: 'up' | 'down') {
  const linkOrder = accountInfo.value.settings.index.linkOrder || []
  const currentIndex = linkOrder.indexOf(name)
  if (currentIndex === -1) return
  if (direction === 'up' && currentIndex > 0) {
    ;[linkOrder[currentIndex], linkOrder[currentIndex - 1]] = [linkOrder[currentIndex - 1], linkOrder[currentIndex]]
  } else if (direction === 'down' && currentIndex < linkOrder.length - 1) {
    ;[linkOrder[currentIndex], linkOrder[currentIndex + 1]] = [linkOrder[currentIndex + 1], linkOrder[currentIndex]]
  } else {
    return
  }
  accountInfo.value.settings.index.linkOrder = linkOrder
  try {
    await updateIndexSettings()
    linkKey.value++
  } catch (err) {
    message.error((err as Error).message || String(err))
  }
}

const orderedLinks = computed<[string, string][]>(() => {
  const links = indexDisplayInfo.value?.links || {}
  const order = accountInfo.value.settings.index.linkOrder || []
  const ordered: [string, string][] = []
  order.forEach((key) => {
    if (links[key]) {
      ordered.push([key, links[key]])
    }
  })
  Object.entries(links).forEach(([key, value]) => {
    if (!order.includes(key)) {
      ordered.push([key, value])
    }
  })
  return ordered
})

accountInfo.value.settings.index ??= {
  allowDisplayInIndex: true,
  videos: [],
  notification: '',
  links: {},
  linkOrder: [],
}
accountInfo.value.settings.index.videos ??= []
accountInfo.value.settings.index.links ??= {}
if (!accountInfo.value.settings.index.linkOrder || accountInfo.value.settings.index.linkOrder.length === 0) {
  accountInfo.value.settings.index.linkOrder = Object.keys(accountInfo.value.settings.index.links || {})
}
await loadIndexInfo()
</script>

<template>
  <NFlex
    vertical
    :size="12"
  >
    <NDivider style="margin: 0"> 主页模板 </NDivider>
    <div class="index-template-picker">
      <div class="index-template-picker__copy">
        <div class="index-template-picker__title">
          {{ selectedIndexTemplate.name }}
        </div>
        <div class="index-template-picker__desc">支持头图、头像框、荣誉、直播状态和精选内容。</div>
      </div>
      <NFlex
        :size="8"
        align="center"
        style="width: 100%"
        :wrap="false"
      >
        <NSelect
          v-model:value="selectedIndexTemplateKey"
          size="small"
          :options="indexTemplateOptions"
          style="flex: 1; min-width: 0"
          @update:value="saveIndexTemplate"
        />
        <NButton
          size="small"
          secondary
          @click="showTemplatePreview = true"
        >
          浏览预览
        </NButton>
      </NFlex>
    </div>

    <NDivider style="margin: 0"> 常规 </NDivider>
    <NCheckbox
      v-model:checked="accountInfo.settings.index.allowDisplayInIndex"
      :disabled="isLoading"
      @update:checked="updateUserIndexSettings"
    >
      允许显示在网站主页与直播列表
    </NCheckbox>

    <NDivider style="margin: 0"> 通知 </NDivider>
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

    <NDivider style="margin: 0"> 展示视频 </NDivider>
    <NButton
      type="primary"
      size="small"
      :disabled="isLoading"
      @click="showAddVideoModal = true"
    >
      添加视频
    </NButton>
    <NEmpty v-if="accountInfo.settings.index.videos.length === 0" />
    <NFlex
      v-else
      wrap
      :size="12"
      style="width: 100%"
    >
      <div
        v-for="item in indexDisplayInfo?.videos ?? []"
        :key="item.id"
        style="width: 100%"
      >
        <SimpleVideoCard :video="item" />
        <NFlex
          style="margin-top: 6px"
          :size="6"
        >
          <NButton
            size="tiny"
            secondary
            :disabled="isLoading"
            @click="moveVideo(item.id, 'up')"
          >
            上移
          </NButton>
          <NButton
            size="tiny"
            secondary
            :disabled="isLoading"
            @click="moveVideo(item.id, 'down')"
          >
            下移
          </NButton>
          <NButton
            type="warning"
            size="tiny"
            secondary
            :disabled="isLoading"
            @click="removeVideo(item.id)"
          >
            删除
          </NButton>
        </NFlex>
      </div>
    </NFlex>

    <NDivider style="margin: 0"> 其他链接 </NDivider>
    <NButton
      type="primary"
      size="small"
      :disabled="isLoading"
      @click="showAddLinkModal = true"
    >
      添加链接
    </NButton>
    <NEmpty v-if="Object.entries(indexDisplayInfo?.links ?? {}).length === 0" />
    <div
      v-else
      :key="linkKey"
      class="links-list"
    >
      <div
        v-for="link in orderedLinks"
        :key="link[0]"
        class="link-item-row"
      >
        <template v-if="editingLinkName === link[0]">
          <NFlex
            :size="6"
            align="center"
            style="width: 100%"
            :wrap="false"
          >
            <NInput
              v-model:value="newLinkName"
              size="small"
              style="flex: 1; min-width: 0"
            />
            <NButton
              size="tiny"
              type="primary"
              @click="confirmEditLink(link[0])"
            >
              保存
            </NButton>
            <NButton
              size="tiny"
              secondary
              @click="cancelEditLink"
            >
              取消
            </NButton>
          </NFlex>
        </template>
        <template v-else>
          <NTooltip>
            <template #trigger>
              <NTag
                :bordered="false"
                size="small"
                type="info"
                class="link-tag"
              >
                {{ link[0] }}
              </NTag>
            </template>
            {{ link[1] }}
          </NTooltip>
          <NFlex
            :size="4"
            align="center"
            :wrap="false"
          >
            <NTooltip>
              <template #trigger>
                <NButton
                  size="tiny"
                  quaternary
                  circle
                  aria-label="上移链接"
                  @click="moveLink(link[0], 'up')"
                >
                  <template #icon>
                    <NIcon><ArrowUpOutline /></NIcon>
                  </template>
                </NButton>
              </template>
              上移链接
            </NTooltip>
            <NTooltip>
              <template #trigger>
                <NButton
                  size="tiny"
                  quaternary
                  circle
                  aria-label="下移链接"
                  @click="moveLink(link[0], 'down')"
                >
                  <template #icon>
                    <NIcon><ArrowDownOutline /></NIcon>
                  </template>
                </NButton>
              </template>
              下移链接
            </NTooltip>
            <NButton
              size="tiny"
              secondary
              @click="startEditLink(link[0])"
            >
              改名
            </NButton>
            <NTooltip>
              <template #trigger>
                <NPopconfirm @positive-click="removeLink(link[0])">
                  <template #trigger>
                    <NButton
                      type="error"
                      secondary
                      size="tiny"
                      aria-label="删除链接"
                    >
                      <template #icon>
                        <NIcon :component="Delete24Regular" />
                      </template>
                    </NButton>
                  </template>
                  确定要删除这个链接吗?
                </NPopconfirm>
              </template>
              删除链接
            </NTooltip>
          </NFlex>
        </template>
      </div>
    </div>
  </NFlex>

  <NModal
    v-model:show="showAddVideoModal"
    preset="card"
    closable
    style="width: 600px; max-width: 90vw"
    title="添加视频"
  >
    <NInput
      v-model:value="addVideoUrl"
      placeholder="请输入视频链接"
    />
    <NDivider />
    <NButton
      type="primary"
      :loading="isLoading"
      @click="addVideo"
    >
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
      <NInput
        v-model:value="addLinkName"
        placeholder="链接名称"
      />
      <NInput
        v-model:value="addLinkUrl"
        placeholder="链接地址"
      />
      <NButton
        type="primary"
        :loading="isLoading"
        @click="addLink"
      >
        添加链接
      </NButton>
    </NFlex>
  </NModal>

  <NModal
    v-model:show="showTemplatePreview"
    preset="card"
    title="主页模板预览"
    style="width: min(960px, 94vw)"
    :bordered="false"
  >
    <div class="index-template-preview">
      <component
        :is="selectedIndexTemplate.component"
        :user-info="accountInfo"
        :bili-info="undefined"
      />
    </div>
  </NModal>
</template>

<style scoped>
.index-template-picker {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  background: var(--vtsuru-bg-muted);
}
.index-template-picker__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}
.index-template-picker__title {
  color: var(--vtsuru-fg);
  font-size: 14px;
  font-weight: 600;
}
.index-template-picker__desc {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  line-height: 1.5;
}
.links-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 100%;
}
.link-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 6px;
  background: var(--vtsuru-bg-inset, rgba(127, 127, 127, 0.06));
  box-sizing: border-box;
}
.link-tag {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.index-template-preview {
  max-height: min(72vh, 760px);
  overflow: auto;
  margin: -12px;
  background: var(--vtsuru-bg);
}
</style>
