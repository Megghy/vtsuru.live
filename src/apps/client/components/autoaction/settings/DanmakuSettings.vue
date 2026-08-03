<script setup lang="ts">
import { ref } from 'vue'

import { KeywordMatchType } from '@/apps/client/store/autoAction/types'
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { TriggerType } from '@/apps/client/store/useAutoAction'

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})

const toast = useToast()
const feedback = (color: 'success' | 'error' | 'warning' | 'info', title: string) => {
  toast.add({ title, color })
}

// 弹幕关键词相关
const tempKeyword = ref('')
const tempBlockword = ref('')

// 初始化匹配类型配置
if (!props.action.triggerConfig.keywordMatchType) {
  props.action.triggerConfig.keywordMatchType = KeywordMatchType.Contains
}

if (!props.action.triggerConfig.blockwordMatchType) {
  props.action.triggerConfig.blockwordMatchType = KeywordMatchType.Contains
}

// 添加关键词
function addKeyword() {
  const keyword = tempKeyword.value.trim()
  if (!keyword) return

  if (!props.action.triggerConfig.keywords) {
    props.action.triggerConfig.keywords = []
  }

  if (!props.action.triggerConfig.keywords.includes(keyword)) {
    props.action.triggerConfig.keywords.push(keyword)
    tempKeyword.value = ''
  } else {
    feedback('warning', '此关键词已存在')
  }
}

// 移除关键词
function removeKeyword(index: number) {
  if (props.action.triggerConfig.keywords) {
    props.action.triggerConfig.keywords.splice(index, 1)
  }
}

// 添加屏蔽词
function addBlockword() {
  const blockword = tempBlockword.value.trim()
  if (!blockword) return

  if (!props.action.triggerConfig.blockwords) {
    props.action.triggerConfig.blockwords = []
  }

  if (!props.action.triggerConfig.blockwords.includes(blockword)) {
    props.action.triggerConfig.blockwords.push(blockword)
    tempBlockword.value = ''
  } else {
    feedback('warning', '此屏蔽词已存在')
  }
}

// 移除屏蔽词
function removeBlockword(index: number) {
  if (props.action.triggerConfig.blockwords) {
    props.action.triggerConfig.blockwords.splice(index, 1)
  }
}
</script>

<template>
  <div
    v-if="action.triggerType === TriggerType.DANMAKU"
    class="danmaku-trigger-settings"
  >
    <div
      vertical
      :size="16"
    >
      <!-- 触发关键词 -->
      <div class="settings-group">
        <span
          strong
          class="group-title"
        >
          触发关键词
        </span>
        <div
          vertical
          :size="12"
        >
          <div :wrap="false">
            <UInput
              v-model="tempKeyword"
              placeholder="输入关键词..."
              size="small"
              @keyup.enter="addKeyword"
            />
            <UButton
              size="small"
              color="primary"
              variant="soft"
              @click="addKeyword"
            >
              添加
            </UButton>
          </div>

          <div
            align="center"
            :size="12"
          >
            <span
              depth="3"
              style="font-size: 12px"
            >
              匹配方式:
            </span>
            <URadioGroup
              v-model="action.triggerConfig.keywordMatchType"
              :items="[
                { label: '完全', value: KeywordMatchType.Full },
                { label: '包含', value: KeywordMatchType.Contains },
                { label: '正则', value: KeywordMatchType.Regex },
              ]"
              orientation="horizontal"
            />
          </div>

          <div
            :size="8"
            class="tag-container"
          >
            <template v-if="action.triggerConfig.keywords && action.triggerConfig.keywords.length > 0">
              <UBadge
                v-for="(keyword, index) in action.triggerConfig.keywords"
                :key="index"
                closable
                size="small"
                @close="removeKeyword(index)"
              >
                {{ keyword }}
              </UBadge>
            </template>
            <span
              v-else
              depth="3"
              italic
              style="font-size: 12px"
            >
              未设置关键词 (将匹配所有弹幕)
            </span>
          </div>
        </div>
      </div>

      <USeparator style="margin: 0" />

      <!-- 屏蔽词 -->
      <div class="settings-group">
        <span
          strong
          class="group-title"
        >
          屏蔽关键词
        </span>
        <div
          vertical
          :size="12"
        >
          <div :wrap="false">
            <UInput
              v-model="tempBlockword"
              placeholder="输入屏蔽词..."
              size="small"
              @keyup.enter="addBlockword"
            />
            <UButton
              size="small"
              color="warning"
              variant="soft"
              @click="addBlockword"
            >
              添加
            </UButton>
          </div>

          <div
            align="center"
            :size="12"
          >
            <span
              depth="3"
              style="font-size: 12px"
            >
              匹配方式:
            </span>
            <URadioGroup
              v-model="action.triggerConfig.blockwordMatchType"
              :items="[
                { label: '完全', value: KeywordMatchType.Full },
                { label: '包含', value: KeywordMatchType.Contains },
                { label: '正则', value: KeywordMatchType.Regex },
              ]"
              orientation="horizontal"
            />
          </div>

          <div
            :size="8"
            class="tag-container"
          >
            <template v-if="action.triggerConfig.blockwords && action.triggerConfig.blockwords.length > 0">
              <UBadge
                v-for="(blockword, index) in action.triggerConfig.blockwords"
                :key="index"
                closable
                type="warning"
                size="small"
                @close="removeBlockword(index)"
              >
                {{ blockword }}
              </UBadge>
            </template>
            <span
              v-else
              depth="3"
              italic
              style="font-size: 12px"
            >
              无屏蔽词
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.danmaku-trigger-settings {
  width: 100%;
}

.group-title {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
}

.tag-container {
  min-height: 28px;
  padding: 4px 8px;
  background-color: var(--vtsuru-bg-muted);
  border-radius: var(--vtsuru-radius);
}
</style>
