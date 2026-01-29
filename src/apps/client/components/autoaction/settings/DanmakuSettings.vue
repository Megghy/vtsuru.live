<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/useAutoAction'
import { NButton, NDivider, NInput, NRadioButton, NRadioGroup, NFlex, NTag, useMessage, NText } from 'naive-ui';
import { ref } from 'vue'
import { KeywordMatchType } from '@/apps/client/store/autoAction/types'
import { TriggerType } from '@/apps/client/store/useAutoAction'

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true,
  },
})

const message = useMessage()

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
    message.warning('此关键词已存在')
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
    message.warning('此屏蔽词已存在')
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
  <div v-if="action.triggerType === TriggerType.DANMAKU" class="danmaku-trigger-settings">
    <NFlex vertical :size="16">
      <!-- 触发关键词 -->
      <div class="settings-group">
        <NText strong class="group-title">触发关键词</NText>
        <NFlex vertical :size="12">
          <NFlex :wrap="false">
            <NInput
              v-model:value="tempKeyword"
              placeholder="输入关键词..."
              size="small"
              @keyup.enter="addKeyword"
            />
            <NButton size="small" type="primary" secondary @click="addKeyword">
              添加
            </NButton>
          </NFlex>

          <NFlex align="center" :size="12">
            <NText depth="3" style="font-size: 12px;">匹配方式:</NText>
            <NRadioGroup
              v-model:value="action.triggerConfig.keywordMatchType"
              size="small"
            >
              <NRadioButton :value="KeywordMatchType.Full">完全</NRadioButton>
              <NRadioButton :value="KeywordMatchType.Contains">包含</NRadioButton>
              <NRadioButton :value="KeywordMatchType.Regex">正则</NRadioButton>
            </NRadioGroup>
          </NFlex>

          <NFlex :size="8" class="tag-container">
            <template v-if="action.triggerConfig.keywords && action.triggerConfig.keywords.length > 0">
              <NTag
                v-for="(keyword, index) in action.triggerConfig.keywords"
                :key="index"
                closable
                size="small"
                @close="removeKeyword(index)"
              >
                {{ keyword }}
              </NTag>
            </template>
            <NText v-else depth="3" italic style="font-size: 12px;">未设置关键词 (将匹配所有弹幕)</NText>
          </NFlex>
        </NFlex>
      </div>

      <NDivider style="margin: 0;" />

      <!-- 屏蔽词 -->
      <div class="settings-group">
        <NText strong class="group-title">屏蔽关键词</NText>
        <NFlex vertical :size="12">
          <NFlex :wrap="false">
            <NInput
              v-model:value="tempBlockword"
              placeholder="输入屏蔽词..."
              size="small"
              @keyup.enter="addBlockword"
            />
            <NButton size="small" type="warning" secondary @click="addBlockword">
              添加
            </NButton>
          </NFlex>

          <NFlex align="center" :size="12">
            <NText depth="3" style="font-size: 12px;">匹配方式:</NText>
            <NRadioGroup
              v-model:value="action.triggerConfig.blockwordMatchType"
              size="small"
            >
              <NRadioButton :value="KeywordMatchType.Full">完全</NRadioButton>
              <NRadioButton :value="KeywordMatchType.Contains">包含</NRadioButton>
              <NRadioButton :value="KeywordMatchType.Regex">正则</NRadioButton>
            </NRadioGroup>
          </NFlex>

          <NFlex :size="8" class="tag-container">
            <template v-if="action.triggerConfig.blockwords && action.triggerConfig.blockwords.length > 0">
              <NTag
                v-for="(blockword, index) in action.triggerConfig.blockwords"
                :key="index"
                closable
                type="warning"
                size="small"
                @close="removeBlockword(index)"
              >
                {{ blockword }}
              </NTag>
            </template>
            <NText v-else depth="3" italic style="font-size: 12px;">无屏蔽词</NText>
          </NFlex>
        </NFlex>
      </div>
    </NFlex>
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
  background-color: var(--n-color-modal);
  border-radius: var(--n-border-radius);
  border: 1px dashed var(--n-divider-color);
}
</style>
