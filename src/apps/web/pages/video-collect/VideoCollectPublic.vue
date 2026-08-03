<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import VueTurnstile from 'vue-turnstile'

import type { VideoCollectDetail, VideoCollectTable } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { TURNSTILE_KEY, VIDEO_COLLECT_API_URL } from '@/shared/config'
import { showErrorToast, showWarningToast } from '@/shared/services/toast'
import { useBiliAuth } from '@/store/useBiliAuth'

import VideoCollectPageShell from './VideoCollectPageShell.vue'

interface AddVideoModel {
  id: string
  video: string
  name?: string
  uid?: number
  description?: string
}

interface TurnstileInstance {
  remove: () => void
  reset: () => void
}

const route = useRoute()
const router = useRouter()
const biliAuth = useBiliAuth()

const table = ref<VideoCollectTable | null>()
const turnstile = ref<TurnstileInstance>()
const token = ref('')
const isLoading = ref(false)
const isPageLoading = ref(false)
const submitted = ref(false)
const addModel = ref<AddVideoModel>({ id: '', video: '' })

const isBiliAuthed = computed(() => biliAuth.isAuthed && Boolean(biliAuth.biliAuth?.userId))
const isClosed = computed(() => !table.value || table.value.isFinish || table.value.endAt <= Date.now())
const capacityPercentage = computed(() => {
  if (!table.value) return 0
  return Math.min(100, Math.round((table.value.videoCount / table.value.maxVideoCount) * 100))
})

await loadTable()
watch(() => route.params.id, loadTable)
watch(
  () => biliAuth.biliAuth,
  (auth) => {
    if (!auth?.userId) return
    addModel.value.name = auth.name
    addModel.value.uid = Number(auth.userId)
  },
  { immediate: true },
)

function currentId() {
  const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  if (!id) throw new Error('缺少征集 ID')
  return id
}

async function loadTable() {
  isPageLoading.value = true
  try {
    const response = await QueryGetAPI<VideoCollectDetail>(`${VIDEO_COLLECT_API_URL}get`, { id: currentId() })
    table.value = response.code === 200 ? response.data.table : null
    if (response.code !== 200 && response.code !== 404) throw new Error(response.message)
  } catch (error) {
    console.error('获取视频征集失败', error)
    table.value = null
    showErrorToast(error instanceof Error ? error.message : '获取失败')
  } finally {
    isPageLoading.value = false
  }
}

async function addVideo() {
  if (!/BV[0-9A-Za-z]{10}/.test(addModel.value.video.trim())) {
    showWarningToast('请输入有效的哔哩哔哩视频链接或 BV 号')
    return
  }
  if (!token.value) {
    showWarningToast('请完成人机验证')
    return
  }

  isLoading.value = true
  const payload = { ...addModel.value, id: table.value?.id ?? currentId() }
  const headers: [string, string][] = [['Turnstile', token.value]]

  try {
    const response = await (isBiliAuthed.value
      ? biliAuth.QueryBiliAuthPostAPI(`${VIDEO_COLLECT_API_URL}add`, payload, headers)
      : QueryPostAPI(`${VIDEO_COLLECT_API_URL}add`, payload, headers))
    if (response.code !== 200) throw new Error(response.message)

    submitted.value = true
    addModel.value.video = ''
    addModel.value.description = ''
    token.value = ''
    turnstile.value?.reset()
    await loadTable()
  } catch (error) {
    console.error('推荐视频失败', error)
    showErrorToast(error instanceof Error ? error.message : '推荐失败')
    turnstile.value?.reset()
  } finally {
    isLoading.value = false
  }
}

function submitAnother() {
  submitted.value = false
}

onUnmounted(() => turnstile.value?.remove())
</script>

<template>
  <VideoCollectPageShell :table="table">
    <template #default="{ effectiveIsDark }">
      <main class="collect-submit-page">
        <UEmpty
          v-if="table === null && !isPageLoading"
          icon="i-lucide-file-question"
          title="视频征集不存在"
          description="链接可能有误，或该征集已被删除。"
        />

        <div
          v-else-if="table"
          class="collect-submit-layout"
        >
          <section class="collect-intro">
            <button
              type="button"
              class="owner-link"
              @click="router.push({ name: 'user-index', params: { id: table.owner.name } })"
            >
              <UIcon name="i-lucide-user-round" />
              {{ table.owner.name }} 的视频征集
            </button>
            <div class="collect-title-row">
              <h1>{{ table.name }}</h1>
              <UBadge
                :color="isClosed ? 'neutral' : 'success'"
                variant="soft"
              >
                {{ isClosed ? '已结束' : '进行中' }}
              </UBadge>
            </div>
            <p class="collect-description">
              {{ table.description || '未填写征集说明' }}
            </p>

            <div class="collect-meta">
              <div>
                <UIcon name="i-lucide-clock-3" />
                <span>截止时间</span>
                <strong>{{ new Date(table.endAt).toLocaleString('zh-CN') }}</strong>
              </div>
              <div>
                <UIcon name="i-lucide-video" />
                <span>已收集</span>
                <strong>{{ table.videoCount }} / {{ table.maxVideoCount }}</strong>
              </div>
            </div>
            <UProgress :model-value="capacityPercentage" />
          </section>

          <section class="submit-panel">
            <UEmpty
              v-if="submitted"
              icon="i-lucide-circle-check"
              title="推荐成功"
              description="这个视频已经加入征集。"
            >
              <template #footer>
                <UButton @click="submitAnother"> 再推荐一个 </UButton>
              </template>
            </UEmpty>

            <template v-else-if="isClosed">
              <UEmpty
                icon="i-lucide-calendar-x"
                title="征集已结束"
                description="当前不再接收新的视频推荐。"
              />
            </template>

            <template v-else>
              <div class="submit-panel__heading">
                <UIcon name="i-lucide-circle-check" />
                <div>
                  <h2>推荐视频</h2>
                  <p>填写哔哩哔哩视频信息</p>
                </div>
              </div>

              <form
                class="submit-form"
                @submit.prevent="addVideo"
              >
                <UFormField label="视频链接或 BV 号">
                  <UInput
                    v-model="addModel.video"
                    placeholder="https://www.bilibili.com/video/BV..."
                    clearable
                  />
                </UFormField>

                <div
                  v-if="isBiliAuthed"
                  class="authenticated-user"
                >
                  <UIcon name="i-lucide-circle-check" />
                  <span>以 {{ addModel.name }}（UID {{ addModel.uid }}）推荐</span>
                </div>
                <div
                  v-else
                  class="identity-fields"
                >
                  <UFormField label="推荐人">
                    <UInput
                      v-model="addModel.name"
                      placeholder="选填"
                    />
                  </UFormField>
                  <UFormField label="哔哩哔哩 UID">
                    <UInputNumber
                      v-model="addModel.uid"
                      placeholder="选填"
                      :min="1"
                      class="uid-input"
                    />
                  </UFormField>
                </div>

                <UFormField label="推荐理由">
                  <UTextarea
                    v-model="addModel.description"
                    type="textarea"
                    placeholder="选填"
                    maxlength="200"
                    :rows="4"
                  />
                </UFormField>

                <VueTurnstile
                  ref="turnstile"
                  v-model="token"
                  :site-key="TURNSTILE_KEY"
                  :theme="effectiveIsDark ? 'dark' : 'light'"
                  size="flexible"
                  class="turnstile"
                />
                <UButton
                  type="submit"
                  block
                  :loading="isLoading"
                  :disabled="!token"
                >
                  提交推荐
                </UButton>
              </form>
            </template>
          </section>
        </div>
      </main>
    </template>
  </VideoCollectPageShell>
</template>

<style scoped>
.collect-submit-page {
  display: grid;
  min-height: 100vh;
  min-height: 100svh;
  padding: 40px 16px;
  box-sizing: border-box;
  place-items: center;
}

.collect-submit-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(340px, 0.9fr);
  gap: clamp(28px, 6vw, 72px);
  align-items: center;
  width: min(100%, 1040px);
  max-width: var(--vtsuru-page-max-width, 1040px);
  min-width: 0;
}

.collect-intro,
.submit-panel {
  min-width: 0;
}

.collect-intro {
  animation: submit-enter 0.52s cubic-bezier(0.2, 0.75, 0.25, 1) both;
}

.submit-panel {
  animation: submit-enter 0.52s 90ms cubic-bezier(0.2, 0.75, 0.25, 1) both;
}

.owner-link {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  padding: 0;
  color: var(--collect-muted);
  font: inherit;
  font-size: 13px;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.owner-link:hover {
  color: var(--collect-accent);
}

.collect-title-row {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 14px;
}

.collect-title-row h1 {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 34px;
  line-height: 1.22;
  letter-spacing: 0;
}

.collect-description {
  margin: 18px 0 28px;
  color: var(--collect-muted);
  font-size: 15px;
  line-height: 1.75;
  white-space: pre-wrap;
}

.collect-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-bottom: 14px;
  border-block: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--collect-border);
}

.collect-meta > div {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 3px 8px;
  padding: 14px 0;
}

.collect-meta > div + div {
  padding-left: 20px;
  border-left: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--collect-border);
}

.collect-meta .iconify {
  grid-row: 1 / 3;
  align-self: center;
  color: var(--collect-accent);
}

.collect-meta span {
  color: var(--collect-muted);
  font-size: 12px;
}

.collect-meta strong {
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.submit-panel {
  padding: 24px;
  background: var(--collect-card);
  border: var(--vtsuru-page-border);
  border-color: var(--collect-border);
  border-radius: var(--vtsuru-page-radius, 8px);
  box-shadow: var(--vtsuru-page-shadow);
}

.submit-panel__heading {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 22px;
}

.submit-panel__heading > .iconify {
  color: var(--collect-accent);
  font-size: 28px;
}

.submit-panel__heading h2,
.submit-panel__heading p {
  margin: 0;
}

.submit-panel__heading h2 {
  font-size: 18px;
}

.submit-panel__heading p {
  margin-top: 2px;
  color: var(--collect-muted);
  font-size: 12px;
}

.identity-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.submit-form {
  display: grid;
  gap: 16px;
}

.uid-input {
  width: 100%;
}

.authenticated-user {
  display: flex;
  gap: 7px;
  align-items: center;
  margin-bottom: 18px;
  padding: 10px 12px;
  color: var(--collect-muted);
  font-size: 13px;
  background: var(--vtsuru-page-primary-soft);
  border-radius: var(--vtsuru-page-radius, 6px);
}

.authenticated-user .iconify {
  flex: 0 0 auto;
  color: var(--collect-accent);
}

.turnstile {
  max-width: 100%;
  margin: 2px 0 14px;
  overflow: hidden;
}

.turnstile :deep(iframe) {
  max-width: 100%;
}

@keyframes submit-enter {
  from {
    opacity: 0;
    transform: translateY(14px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 760px) {
  .collect-submit-page {
    align-items: start;
    padding-block: 28px;
  }

  .collect-submit-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 28px;
  }

  .collect-title-row h1 {
    font-size: 28px;
  }
}

@media (max-width: 420px) {
  .collect-submit-page {
    padding: 20px 12px;
  }

  .collect-title-row {
    align-items: flex-start;
  }

  .collect-title-row h1 {
    font-size: 25px;
  }

  .collect-meta,
  .identity-fields {
    grid-template-columns: minmax(0, 1fr);
  }

  .collect-meta > div + div {
    padding-left: 0;
    border-top: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--collect-border);
    border-left: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .collect-intro,
  .submit-panel {
    animation: none;
  }
}
</style>
