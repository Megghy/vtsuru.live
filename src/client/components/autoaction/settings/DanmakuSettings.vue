<script setup lang="ts">
import { ref } from 'vue';
import { NSpace, NInput, NButton, NTag, NDivider, NCollapseItem, useMessage, NRadioGroup, NRadioButton } from 'naive-ui';
import { AutoActionItem, TriggerType } from '@/client/store/useAutoAction';
import { KeywordMatchType } from '@/client/store/autoAction/types';
import SingleTemplateEditor from '../SingleTemplateEditor.vue';

const props = defineProps({
  action: {
    type: Object as () => AutoActionItem,
    required: true
  }
});

const message = useMessage();

// 弹幕关键词相关
const tempKeyword = ref('');
const tempBlockword = ref('');

// 初始化匹配类型配置
if (!props.action.triggerConfig.keywordMatchType) {
  props.action.triggerConfig.keywordMatchType = KeywordMatchType.Contains;
}

if (!props.action.triggerConfig.blockwordMatchType) {
  props.action.triggerConfig.blockwordMatchType = KeywordMatchType.Contains;
}

// 添加关键词
function addKeyword() {
  if (!tempKeyword.value.trim()) return;

  if (!props.action.triggerConfig.keywords) {
    props.action.triggerConfig.keywords = [];
  }

  if (!props.action.triggerConfig.keywords.includes(tempKeyword.value.trim())) {
    props.action.triggerConfig.keywords.push(tempKeyword.value.trim());
    tempKeyword.value = '';
  } else {
    message.warning('此关键词已存在');
  }
}

// 移除关键词
function removeKeyword(index: number) {
  if (props.action.triggerConfig.keywords) {
    props.action.triggerConfig.keywords.splice(index, 1);
  }
}

// 添加屏蔽词
function addBlockword() {
  if (!tempBlockword.value.trim()) return;

  if (!props.action.triggerConfig.blockwords) {
    props.action.triggerConfig.blockwords = [];
  }

  if (!props.action.triggerConfig.blockwords.includes(tempBlockword.value.trim())) {
    props.action.triggerConfig.blockwords.push(tempBlockword.value.trim());
    tempBlockword.value = '';
  } else {
    message.warning('此屏蔽词已存在');
  }
}

// 移除屏蔽词
function removeBlockword(index: number) {
  if (props.action.triggerConfig.blockwords) {
    props.action.triggerConfig.blockwords.splice(index, 1);
  }
}

// 定义弹幕相关的模板占位符
const danmakuPlaceholders = [
  { name: '{{user.name}}', description: '发送弹幕的用户名' },
  { name: '{{user.uid}}', description: '用户UID' },
  { name: '{{user.guardLevel}}', description: '用户舰长等级(0-3)' },
  { name: '{{user.medalLevel}}', description: '粉丝勋章等级' },
  { name: '{{user.medalName}}', description: '粉丝勋章名称' },
  { name: '{{message}}', description: '弹幕内容' },
  { name: '{{js: message.substring(0, 10)}}', description: '弹幕内容的前10个字符' },
];
</script>

<template>
  <NCollapseItem
    v-if="action.triggerType === TriggerType.DANMAKU"
    title="自动回复设置"
  >
    <NSpace vertical>
      <div class="section-title">
        触发关键词:
      </div>
      <NSpace>
        <NInput
          v-model:value="tempKeyword"
          placeholder="输入关键词"
          @keyup.enter="addKeyword"
        />
        <NButton @click="addKeyword">
          添加
        </NButton>
      </NSpace>

      <NSpace align="center">
        <span>匹配方式:</span>
        <NRadioGroup
          v-model:value="action.triggerConfig.keywordMatchType"
          size="small"
        >
          <NRadioButton :value="KeywordMatchType.Full">
            完全
          </NRadioButton>
          <NRadioButton :value="KeywordMatchType.Contains">
            包含
          </NRadioButton>
          <NRadioButton :value="KeywordMatchType.Regex">
            正则
          </NRadioButton>
        </NRadioGroup>
      </NSpace>

      <NSpace>
        <template v-if="action.triggerConfig.keywords">
          <NTag
            v-for="(keyword, index) in action.triggerConfig.keywords"
            :key="index"
            closable
            @close="removeKeyword(index)"
          >
            {{ keyword }}
          </NTag>
        </template>
      </NSpace>

      <NDivider />

      <div class="section-title">
        屏蔽词:
      </div>
      <NSpace>
        <NInput
          v-model:value="tempBlockword"
          placeholder="输入屏蔽词"
          @keyup.enter="addBlockword"
        />
        <NButton @click="addBlockword">
          添加
        </NButton>
      </NSpace>

      <NSpace align="center">
        <span>匹配方式:</span>
        <NRadioGroup
          v-model:value="action.triggerConfig.blockwordMatchType"
          size="small"
        >
          <NRadioButton :value="KeywordMatchType.Full">
            完全
          </NRadioButton>
          <NRadioButton :value="KeywordMatchType.Contains">
            包含
          </NRadioButton>
          <NRadioButton :value="KeywordMatchType.Regex">
            正则
          </NRadioButton>
        </NRadioGroup>
      </NSpace>

      <NSpace>
        <template v-if="action.triggerConfig.blockwords">
          <NTag
            v-for="(blockword, index) in action.triggerConfig.blockwords"
            :key="index"
            closable
            type="warning"
            @close="removeBlockword(index)"
          >
            {{ blockword }}
          </NTag>
        </template>
      </NSpace>
    </NSpace>
  </NCollapseItem>
</template>

<style scoped>
.section-title {
  font-weight: bold;
  margin: 8px 0;
}
</style>
