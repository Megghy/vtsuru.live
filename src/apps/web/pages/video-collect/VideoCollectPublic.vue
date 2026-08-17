<script setup lang="ts">
import { CheckmarkCircle24Regular, Clock24Regular, Person24Regular, Video24Regular } from '@vicons/fluent'
import { useNow } from '@vueuse/core'
import type { FormInst, FormRules } from 'naive-ui'
import {
  NButton,
  NCard,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NProgress,
  NResult,
  NTag,
  NTime,
  useMessage,
} from 'naive-ui'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { VideoCollectDetail, VideoCollectTable } from '@/api/api-models'
import { DuplicateVideoPolicy } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import CaptchaWidget from '@/apps/user/components/CaptchaWidget.vue'
import { VIDEO_COLLECT_API_URL } from '@/shared/config'
import { useBiliAuth } from '@/store/useBiliAuth'

import VideoCollectPageShell from './VideoCollectPageShell.vue'

interface AddVideoModel {
  id: string
  video: string
  name?: string
  uid?: number
  description?: string
}

const route = useRoute()
const router = useRouter()
const message = useMessage()
const biliAuth = useBiliAuth()
const now = useNow({ interval: 1000 })

const table = ref<VideoCollectTable | null>()
const formRef = ref<FormInst>()
const turnstile = ref<InstanceType<typeof CaptchaWidget>>()
const token = ref('')
const isLoading = ref(false)
const isPageLoading = ref(false)
const submitted = ref(false)
const addModel = ref<AddVideoModel>({ id: '', video: '' })

const isBiliAuthed = computed(() => biliAuth.isAuthed && Boolean(biliAuth.biliAuth?.userId))
const isClosed = computed(() => !table.value || table.value.isFinish || table.value.endAt <= now.value.getTime())
const isNotStarted = computed(() => Boolean(table.value && table.value.startAt > now.value.getTime()))
const isFull = computed(() => Boolean(table.value && table.value.videoCount >= table.value.maxVideoCount))
const collectionStatus = computed(() => {
  if (isClosed.value) return '已结束'
  if (isNotStarted.value) return '未开始'
  if (isFull.value) return '名额已满'
  return '进行中'
})
const capacityPercentage = computed(() => {
  if (!table.value) return 0
  return Math.min(100, Math.round((table.value.videoCount / table.value.maxVideoCount) * 100))
})
const rules: FormRules = {
  video: [
    { required: true, message: '请输入视频链接或 BV 号', trigger: ['input', 'blur'] },
    {
      message: '请输入有效的哔哩哔哩视频链接或 BV 号',
      validator: (_rule, value: string) => /BV[0-9A-Za-z]{10}/.test(value.trim()),
      trigger: ['input', 'blur'],
    },
  ],
  uid: {
    type: 'number',
    min: 1,
    message: 'UID 必须是正整数',
    trigger: ['input', 'blur'],
  },
  description: {
    message: '请填写推荐理由',
    validator: (_rule, value: string) => !table.value?.requireDescription || Boolean(value?.trim()),
    trigger: ['input', 'blur'],
  },
}

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
    table.value =
      response.code === 200
        ? { ...response.data.table, allowedPartitions: [...(response.data.table.allowedPartitions ?? [])] }
        : null
    if (response.code !== 200 && response.code !== 404) throw new Error(response.message)
  } catch (error) {
    console.error('获取视频征集失败', error)
    table.value = null
    message.error(error instanceof Error ? error.message : '获取失败')
  } finally {
    isPageLoading.value = false
  }
}

async function addVideo() {
  await formRef.value?.validate()
  if (!token.value) {
    message.warning('请完成人机验证')
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
    message.error(error instanceof Error ? error.message : '推荐失败')
    turnstile.value?.reset()
  } finally {
    isLoading.value = false
  }
}

function submitAnother() {
  submitted.value = false
  formRef.value?.restoreValidation()
}

onUnmounted(() => turnstile.value?.remove())
</script>

<template>
  <VideoCollectPageShell :table="table">
    <template #default>
      <main class="collect-submit-page">
        <NResult
          v-if="table === null && !isPageLoading"
          status="404"
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
              <NIcon :component="Person24Regular" />
              {{ table.owner.name }} 的视频征集
            </button>
            <div class="collect-title-row">
              <h1>{{ table.name }}</h1>
              <NTag
                :type="collectionStatus === '进行中' ? 'success' : collectionStatus === '未开始' ? 'info' : 'default'"
                :bordered="false"
              >
                {{ collectionStatus }}
              </NTag>
            </div>
            <p class="collect-description">
              {{ table.description || '未填写征集说明' }}
            </p>

            <div class="collect-meta">
              <div>
                <NIcon :component="Clock24Regular" />
                <span>开放时间</span>
                <strong
                  ><NTime
                    :time="table.startAt"
                    format="yyyy-MM-dd HH:mm"
                /></strong>
              </div>
              <div>
                <NIcon :component="Clock24Regular" />
                <span>截止时间</span>
                <strong
                  ><NTime
                    :time="table.endAt"
                    format="yyyy-MM-dd HH:mm"
                /></strong>
              </div>
              <div>
                <NIcon :component="Video24Regular" />
                <span>已收集</span>
                <strong>{{ table.videoCount }} / {{ table.maxVideoCount }}</strong>
              </div>
            </div>
            <NProgress
              type="line"
              :percentage="capacityPercentage"
              :height="7"
              :show-indicator="false"
            />
            <div class="collect-rules">
              <NTag
                size="small"
                :bordered="false"
              >
                待审核 + 已通过占名额，拒绝后释放
              </NTag>
              <NTag
                size="small"
                :bordered="false"
              >
                {{ table.allowUnregisteredUser ? '允许游客投稿' : '需要绑定 B 站账号' }}
              </NTag>
              <NTag
                v-if="table.minVideoDuration"
                size="small"
                :bordered="false"
              >
                至少 {{ Math.ceil(table.minVideoDuration / 60) }} 分钟
              </NTag>
              <NTag
                v-if="table.maxVideoDuration"
                size="small"
                :bordered="false"
              >
                最长 {{ Math.ceil(table.maxVideoDuration / 60) }} 分钟
              </NTag>
              <NTag
                v-if="table.maxVideoPerUser"
                size="small"
                :bordered="false"
              >
                每人最多 {{ table.maxVideoPerUser }} 个
              </NTag>
              <NTag
                v-if="table.requireDescription"
                size="small"
                :bordered="false"
              >
                推荐理由必填
              </NTag>
              <NTag
                size="small"
                :bordered="false"
              >
                {{ table.duplicatePolicy === DuplicateVideoPolicy.Reject ? '不接受重复视频' : '重复推荐会合并记录' }}
              </NTag>
              <NTag
                v-for="partition in table.allowedPartitions"
                :key="partition"
                size="small"
                :bordered="false"
              >
                {{ partition }}分区
              </NTag>
            </div>
          </section>

          <NCard
            class="submit-panel"
            :bordered="true"
          >
            <NResult
              v-if="submitted"
              status="success"
              title="推荐成功"
              description="已提交，主播审核通过后会进入结果页。"
            >
              <template #footer>
                <NButton
                  type="primary"
                  @click="submitAnother"
                >
                  再推荐一个
                </NButton>
              </template>
            </NResult>

            <template v-else-if="isClosed">
              <NResult
                status="info"
                title="征集已结束"
                description="当前不再接收新的视频推荐。"
              />
            </template>

            <template v-else-if="isNotStarted">
              <NResult
                status="info"
                title="征集尚未开始"
                :description="`开放时间：${new Date(table.startAt).toLocaleString('zh-CN', { hour12: false })}`"
              />
            </template>

            <template v-else-if="isFull">
              <NResult
                status="info"
                title="投稿名额已满"
                description="待审核和已通过的视频已达到数量上限；被拒绝的视频会释放名额。"
              />
            </template>

            <template v-else-if="!table.allowUnregisteredUser && !isBiliAuthed">
              <NResult
                status="info"
                title="需要绑定 B 站账号"
                description="完成身份绑定后即可参与本次视频征集。"
              >
                <template #footer>
                  <NButton
                    type="primary"
                    @click="router.push({ name: 'bili-auth' })"
                  >
                    前往绑定
                  </NButton>
                </template>
              </NResult>
            </template>

            <template v-else>
              <div class="submit-panel__heading">
                <NIcon :component="CheckmarkCircle24Regular" />
                <div>
                  <h2>推荐视频</h2>
                  <p>填写哔哩哔哩视频信息</p>
                </div>
              </div>

              <NForm
                ref="formRef"
                :model="addModel"
                :rules="rules"
                label-placement="top"
                @submit.prevent="addVideo"
              >
                <NFormItem
                  label="视频链接或 BV 号"
                  path="video"
                >
                  <NInput
                    v-model:value="addModel.video"
                    placeholder="https://www.bilibili.com/video/BV..."
                    clearable
                  />
                </NFormItem>

                <div
                  v-if="isBiliAuthed"
                  class="authenticated-user"
                >
                  <NIcon :component="CheckmarkCircle24Regular" />
                  <span>以 {{ addModel.name }}（UID {{ addModel.uid }}）推荐</span>
                </div>
                <div
                  v-else
                  class="identity-fields"
                >
                  <NFormItem label="推荐人">
                    <NInput
                      v-model:value="addModel.name"
                      placeholder="选填"
                      maxlength="50"
                    />
                  </NFormItem>
                  <NFormItem
                    label="哔哩哔哩 UID"
                    path="uid"
                  >
                    <NInputNumber
                      v-model:value="addModel.uid"
                      placeholder="选填"
                      :show-button="false"
                      :precision="0"
                      style="width: 100%"
                    />
                  </NFormItem>
                </div>

                <NFormItem
                  :label="table.requireDescription ? '推荐理由' : '推荐理由（选填）'"
                  path="description"
                >
                  <NInput
                    v-model:value="addModel.description"
                    type="textarea"
                    :placeholder="table.requireDescription ? '请说明推荐这个视频的原因' : '可补充推荐原因或看点'"
                    maxlength="200"
                    show-count
                    :autosize="{ minRows: 3, maxRows: 5 }"
                  />
                </NFormItem>

                <CaptchaWidget
                  ref="turnstile"
                  v-model="token"
                  class="turnstile"
                />
                <NButton
                  type="primary"
                  attr-type="submit"
                  block
                  :loading="isLoading"
                  :disabled="!token"
                >
                  提交推荐
                </NButton>
              </NForm>
            </template>
          </NCard>
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

.collect-meta > div:nth-child(3) {
  grid-column: 1 / -1;
  padding-left: 0;
  border-top: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--collect-border);
  border-left: 0;
}

.collect-meta .n-icon {
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

.collect-rules {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.submit-panel {
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

.submit-panel__heading > .n-icon {
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

.authenticated-user .n-icon {
  flex: 0 0 auto;
  color: var(--collect-accent);
}

.turnstile {
  max-width: 100%;
  margin: 2px 0 8px;
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
