<script setup lang="ts">
import { ref } from 'vue';
import { NSpace, NDivider, NInputNumber, NCard, NButton, NInput, NCollapse, NCollapseItem, NPopconfirm, NTag } from 'naive-ui';
import CommonConfigItems from './CommonConfigItems.vue';
import { AutoReplyConfig } from '@/client/store/useAutoAction';

const props = defineProps({
  config: {
    type: Object as () => AutoReplyConfig,
    required: true
  }
});

// 新增规则表单数据
const newRule = ref({
  keywords: [] as string[],
  replies: [] as string[],
  blockwords: [] as string[]
});

// 临时输入字段
const tempKeyword = ref('');
const tempReply = ref('');
const tempBlockword = ref('');

function addKeyword() {
  if (tempKeyword.value.trim() && !newRule.value.keywords.includes(tempKeyword.value.trim())) {
    newRule.value.keywords.push(tempKeyword.value.trim());
    tempKeyword.value = '';
  }
}

function addReply() {
  if (tempReply.value.trim() && !newRule.value.replies.includes(tempReply.value.trim())) {
    newRule.value.replies.push(tempReply.value.trim());
    tempReply.value = '';
  }
}

function addBlockword() {
  if (tempBlockword.value.trim() && !newRule.value.blockwords.includes(tempBlockword.value.trim())) {
    newRule.value.blockwords.push(tempBlockword.value.trim());
    tempBlockword.value = '';
  }
}

function addRule() {
  if (newRule.value.keywords.length > 0 && newRule.value.replies.length > 0) {
    props.config.rules.push({
      keywords: [...newRule.value.keywords],
      replies: [...newRule.value.replies],
      blockwords: [...newRule.value.blockwords]
    });

    // 重置表单
    newRule.value = {
      keywords: [],
      replies: [],
      blockwords: []
    };
  }
}

function removeRule(index: number) {
  props.config.rules.splice(index, 1);
}

function removeKeyword(index: number) {
  newRule.value.keywords.splice(index, 1);
}

function removeReply(index: number) {
  newRule.value.replies.splice(index, 1);
}

function removeBlockword(index: number) {
  newRule.value.blockwords.splice(index, 1);
}

function removeRuleKeyword(ruleIndex: number, keywordIndex: number) {
  props.config.rules[ruleIndex].keywords.splice(keywordIndex, 1);
}

function removeRuleReply(ruleIndex: number, replyIndex: number) {
  props.config.rules[ruleIndex].replies.splice(replyIndex, 1);
}

function removeRuleBlockword(ruleIndex: number, blockwordIndex: number) {
  props.config.rules[ruleIndex].blockwords.splice(blockwordIndex, 1);
}
</script>

<template>
  <div class="auto-reply-config">
    <CommonConfigItems
      :config="config"
      :show-live-only="true"
      :show-delay="false"
      :show-user-filter="true"
      :show-tian-xuan="false"
    />

    <NDivider title-placement="left">
      自动回复设置
    </NDivider>

    <NSpace
      vertical
      size="medium"
    >
      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>冷却时间 (秒):</span>
        <NInputNumber
          v-model:value="config.cooldownSeconds"
          :min="0"
          :max="300"
          style="width: 120px"
        />
      </NSpace>

      <NCard
        title="规则列表"
        size="small"
      >
        <NCollapse>
          <NCollapseItem
            v-for="(rule, ruleIndex) in config.rules"
            :key="ruleIndex"
            :title="`规则 ${ruleIndex + 1}: ${rule.keywords.join(', ')}`"
          >
            <NSpace vertical>
              <NSpace vertical>
                <div class="rule-section-title">
                  触发关键词:
                </div>
                <NSpace>
                  <NTag
                    v-for="(keyword, keywordIndex) in rule.keywords"
                    :key="keywordIndex"
                    closable
                    @close="removeRuleKeyword(ruleIndex, keywordIndex)"
                  >
                    {{ keyword }}
                  </NTag>
                </NSpace>
              </NSpace>

              <NSpace vertical>
                <div class="rule-section-title">
                  回复内容:
                </div>
                <NSpace>
                  <NTag
                    v-for="(reply, replyIndex) in rule.replies"
                    :key="replyIndex"
                    closable
                    @close="removeRuleReply(ruleIndex, replyIndex)"
                  >
                    {{ reply }}
                  </NTag>
                </NSpace>
              </NSpace>

              <NSpace
                v-if="rule.blockwords.length > 0"
                vertical
              >
                <div class="rule-section-title">
                  屏蔽词:
                </div>
                <NSpace>
                  <NTag
                    v-for="(blockword, blockwordIndex) in rule.blockwords"
                    :key="blockwordIndex"
                    closable
                    type="warning"
                    @close="removeRuleBlockword(ruleIndex, blockwordIndex)"
                  >
                    {{ blockword }}
                  </NTag>
                </NSpace>
              </NSpace>

              <NPopconfirm @positive-click="removeRule(ruleIndex)">
                <template #trigger>
                  <NButton
                    size="small"
                    type="error"
                  >
                    删除规则
                  </NButton>
                </template>
                确定要删除此规则吗？
              </NPopconfirm>
            </NSpace>
          </NCollapseItem>
        </NCollapse>
      </NCard>

      <NCard
        title="添加新规则"
        size="small"
      >
        <NSpace vertical>
          <NSpace vertical>
            <div class="rule-section-title">
              触发关键词:
            </div>
            <NSpace align="center">
              <NInput
                v-model:value="tempKeyword"
                placeholder="输入关键词"
                @keyup.enter="addKeyword"
              />
              <NButton @click="addKeyword">
                添加
              </NButton>
            </NSpace>
            <NSpace>
              <NTag
                v-for="(keyword, index) in newRule.keywords"
                :key="index"
                closable
                @close="removeKeyword(index)"
              >
                {{ keyword }}
              </NTag>
            </NSpace>
          </NSpace>

          <NSpace vertical>
            <div class="rule-section-title">
              回复内容: <span class="hint">(可以使用 {{ '\{\{ user.name \}\}' }} 作为用户名变量)</span>
            </div>
            <NSpace align="center">
              <NInput
                v-model:value="tempReply"
                placeholder="输入回复内容"
                @keyup.enter="addReply"
              />
              <NButton @click="addReply">
                添加
              </NButton>
            </NSpace>
            <NSpace>
              <NTag
                v-for="(reply, index) in newRule.replies"
                :key="index"
                closable
                @close="removeReply(index)"
              >
                {{ reply }}
              </NTag>
            </NSpace>
          </NSpace>

          <NSpace vertical>
            <div class="rule-section-title">
              屏蔽词: <span class="hint">(可选，当弹幕中包含屏蔽词时不触发)</span>
            </div>
            <NSpace align="center">
              <NInput
                v-model:value="tempBlockword"
                placeholder="输入屏蔽词"
                @keyup.enter="addBlockword"
              />
              <NButton @click="addBlockword">
                添加
              </NButton>
            </NSpace>
            <NSpace>
              <NTag
                v-for="(blockword, index) in newRule.blockwords"
                :key="index"
                closable
                type="warning"
                @close="removeBlockword(index)"
              >
                {{ blockword }}
              </NTag>
            </NSpace>
          </NSpace>

          <NButton
            type="primary"
            block
            :disabled="newRule.keywords.length === 0 || newRule.replies.length === 0"
            @click="addRule"
          >
            保存规则
          </NButton>
        </NSpace>
      </NCard>
    </NSpace>
  </div>
</template>

<style scoped>
.rule-section-title {
  font-weight: bold;
  margin-bottom: 8px;
}

.hint {
  font-weight: normal;
  font-size: 12px;
  color: #999;
}
</style>
