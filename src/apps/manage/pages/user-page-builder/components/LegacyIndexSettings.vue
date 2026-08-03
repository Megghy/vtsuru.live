<script setup lang="ts">
import { computed, ref } from 'vue'

import { SaveSetting, useAccount } from '@/api/account'
import type { ResponseUserIndexModel, VideoCollectVideo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import SimpleVideoCard from '@/components/SimpleVideoCard.vue'
import { USER_INDEX_API_URL } from '@/shared/config'
const accountInfo = useAccount()
const toast = useToast()
const message = {
  success: (title: string) => toast.add({ title, color: 'success' }),
  error: (title: string) => toast.add({ title, color: 'error' }),
}

function confirmRemoveLink(name: string) {
  if (window.confirm('确定要删除这个链接吗？')) void removeLink(name)
}

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
  return order.filter((k) => map.has(k)).map((k) => [k, map.get(k)!]) as [string, string][]
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
    if (indexDisplayInfo.value) indexDisplayInfo.value.videos = indexDisplayInfo.value.videos.filter((v) => v.id !== id)
    accountInfo.value.settings.index.videos = accountInfo.value.settings.index.videos.filter((v) => v !== id)
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
    idxSetting.linkOrder = idxSetting.linkOrder.map((k) => (k === oldName ? newLinkName.value : k))
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
    accountInfo.value.settings.index.linkOrder = accountInfo.value.settings.index.linkOrder.filter((k) => k !== name)
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
  <div class="builder-stack">
    <USeparator style="margin: 0"> 常规 </USeparator>
    <UCheckbox
      v-model="accountInfo.settings.index.allowDisplayInIndex"
      label="允许显示在网站主页"
      :disabled="isLoading"
      @update:model-value="updateUserIndexSettings"
    />

    <USeparator style="margin: 0"> 通知 </USeparator>
    <UTextarea
      v-model="accountInfo.settings.index.notification"
      placeholder="可选"
    />
    <div class="builder-row">
      <UButton
        color="primary"
        size="sm"
        :loading="isLoading"
        @click="updateIndexSettings"
      >
        保存
      </UButton>
    </div>

    <USeparator style="margin: 0"> 展示视频 </USeparator>
    <UButton
      color="primary"
      size="sm"
      :disabled="isLoading"
      @click="showAddVideoModal = true"
    >
      添加视频
    </UButton>
    <UEmpty v-if="accountInfo.settings.index.videos.length === 0" />
    <div
      class="builder-row"
      v-else
    >
      <UTooltip
        v-for="item in indexDisplayInfo?.videos ?? []"
        :key="item.id"
      >
        <div>
          <SimpleVideoCard :video="item" />
          <div
            class="builder-row"
            style="margin-top: 6px"
          >
            <UButton
              size="sm"
              variant="soft"
              :disabled="isLoading"
              @click="moveVideo(item.id, 'up')"
            >
              上移
            </UButton>
            <UButton
              size="sm"
              variant="soft"
              :disabled="isLoading"
              @click="moveVideo(item.id, 'down')"
            >
              下移
            </UButton>
            <UButton
              color="warning"
              size="sm"
              :disabled="isLoading"
              @click="removeVideo(item.id)"
            >
              删除
            </UButton>
          </div>
        </div>

        <template #content>{{ item.title }}</template>
      </UTooltip>
    </div>

    <USeparator style="margin: 0"> 其他链接 </USeparator>
    <UButton
      color="primary"
      size="sm"
      :disabled="isLoading"
      @click="showAddLinkModal = true"
    >
      添加链接
    </UButton>
    <UEmpty v-if="Object.entries(indexDisplayInfo?.links ?? {}).length === 0" />
    <div
      class="builder-row"
      v-else
      :key="linkKey"
    >
      <div
        class="builder-row"
        v-for="link in orderedLinks"
        :key="link[0]"
      >
        <template v-if="editingLinkName === link[0]">
          <UInput
            v-model="newLinkName"
            size="sm"
            style="width: 120px"
          />
          <UButton
            size="xs"
            color="primary"
            variant="link"
            @click="confirmEditLink(link[0])"
          >
            保存
          </UButton>
          <UButton
            size="xs"
            variant="link"
            @click="cancelEditLink"
          >
            取消
          </UButton>
        </template>
        <template v-else>
          <UTooltip>
            <UBadge
              :bordered="false"
              size="sm"
              type="info"
            >
              {{ link[0] }}
            </UBadge>

            <template #content>{{ link[1] }}</template>
          </UTooltip>
          <div class="builder-row">
            <UTooltip>
              <UButton
                size="xs"
                variant="soft"
                aria-label="上移链接"
                @click="moveLink(link[0], 'up')"
              >
                <template #icon>
                  <UIcon name="i-lucide-arrow-up" />
                </template>
              </UButton>
              <template #content> 上移链接 </template></UTooltip
            >
            <UTooltip>
              <UButton
                size="xs"
                variant="soft"
                aria-label="下移链接"
                @click="moveLink(link[0], 'down')"
              >
                <template #icon>
                  <UIcon name="i-lucide-arrow-down" />
                </template>
              </UButton>
              <template #content> 下移链接 </template></UTooltip
            >
            <UButton
              size="xs"
              variant="link"
              @click="startEditLink(link[0])"
            >
              改名
            </UButton>
            <UTooltip>
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="link"
                size="xs"
                aria-label="删除链接"
                @click="confirmRemoveLink(link[0])"
              />
              <template #content> 删除链接 </template></UTooltip
            >
          </div>
        </template>
      </div>
    </div>
  </div>

  <UModal
    v-model:open="showAddVideoModal"
    closable
    style="width: 600px; max-width: 90vw"
    title="添加视频"
  >
    <template #body
      ><UInput
        v-model="addVideoUrl"
        placeholder="请输入视频链接"
      />
      <USeparator />
      <UButton
        color="primary"
        :loading="isLoading"
        @click="addVideo"
      >
        添加视频
      </UButton></template
    >
  </UModal>

  <UModal
    v-model:open="showAddLinkModal"
    closable
    style="width: 600px; max-width: 90vw"
    title="添加链接"
  >
    <template #body
      ><div class="builder-stack">
        <UInput
          v-model="addLinkName"
          placeholder="链接名称"
        />
        <UInput
          v-model="addLinkUrl"
          placeholder="链接地址"
        />
        <UButton
          color="primary"
          :loading="isLoading"
          @click="addLink"
        >
          添加链接
        </UButton>
      </div></template
    >
  </UModal>
</template>
