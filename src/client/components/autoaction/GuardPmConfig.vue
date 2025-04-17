<script setup lang="ts">
import { ref } from 'vue';
import { NCard, NSpace, NDivider, NInput, NSwitch, NButton, NSelect, NPopconfirm } from 'naive-ui';
import CommonConfigItems from './CommonConfigItems.vue';
import { GuardPmConfig, GuardLevel } from '@/client/store/useAutoAction';

const props = defineProps({
  config: {
    type: Object as () => GuardPmConfig,
    required: true
  }
});

const newCode = ref('');
const selectedLevel = ref(GuardLevel.Jianzhang);

const levelOptions = [
  { label: '通用', value: GuardLevel.None },
  { label: '舰长', value: GuardLevel.Jianzhang },
  { label: '提督', value: GuardLevel.Tidu },
  { label: '总督', value: GuardLevel.Zongdu }
];

function getLevelName(level: GuardLevel): string {
  const opt = levelOptions.find(o => o.value === level);
  return opt ? opt.label : '未知';
}

function addGiftCode() {
  if (!newCode.value.trim()) return;

  const level = selectedLevel.value;
  const levelCodes = props.config.giftCodes.find(gc => gc.level === level);

  if (levelCodes) {
    levelCodes.codes.push(newCode.value.trim());
  } else {
    props.config.giftCodes.push({
      level: level,
      codes: [newCode.value.trim()]
    });
  }

  newCode.value = '';
}

function removeCode(level: GuardLevel, index: number) {
  const levelCodes = props.config.giftCodes.find(gc => gc.level === level);
  if (levelCodes) {
    levelCodes.codes.splice(index, 1);
  }
}

const placeholders = [
  { name: '{{user.name}}', description: '用户名称' },
  { name: '{{guard.levelName}}', description: '舰长等级名称' },
  { name: '{{guard.giftCode}}', description: '礼品码（礼品码模式下可用）' }
];
</script>

<template>
  <div class="guard-pm-config">
    <CommonConfigItems
      :config="config"
      :show-live-only="true"
      :show-delay="false"
      :show-user-filter="false"
      :show-tian-xuan="false"
    />

    <NDivider title-placement="left">
      私信设置
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
        <span>私信模板:</span>
        <NInput
          v-model:value="config.template"
          placeholder="例如: 感谢 {{user.name}} 成为 {{guard.levelName}}！"
          style="width: 350px"
        >
          <template #prefix>
            <NPopconfirm placement="bottom">
              <template #trigger>
                <NButton
                  quaternary
                  circle
                  size="small"
                >
                  ?
                </NButton>
              </template>
              <div>
                <div
                  v-for="ph in placeholders"
                  :key="ph.name"
                >
                  <strong>{{ ph.name }}</strong>: {{ ph.description }}
                </div>
              </div>
            </NPopconfirm>
          </template>
        </NInput>
      </NSpace>

      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>发送弹幕确认:</span>
        <NSwitch v-model:value="config.sendDanmakuConfirm" />
      </NSpace>

      <NSpace
        v-if="config.sendDanmakuConfirm"
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>弹幕确认模板:</span>
        <NInput
          v-model:value="config.danmakuTemplate"
          placeholder="例如: 已私信 {{user.name}} 舰长福利！"
          style="width: 350px"
        />
      </NSpace>

      <NSpace
        align="center"
        justify="space-between"
        style="width: 100%"
      >
        <span>防止重复发送:</span>
        <NSwitch v-model:value="config.preventRepeat" />
      </NSpace>
    </NSpace>

    <NDivider title-placement="left">
      礼品码模式
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
        <span>启用礼品码模式:</span>
        <NSwitch v-model:value="config.giftCodeMode" />
      </NSpace>

      <div v-if="config.giftCodeMode">
        <NCard
          title="添加礼品码"
          size="small"
        >
          <NSpace vertical>
            <NSpace justify="space-between">
              <NSelect
                v-model:value="selectedLevel"
                :options="levelOptions"
                style="width: 120px"
              />
              <NInput
                v-model:value="newCode"
                placeholder="输入礼品码"
                style="flex: 1"
              />
              <NButton
                type="primary"
                @click="addGiftCode"
              >
                添加
              </NButton>
            </NSpace>

            <NDivider />

            <div
              v-for="levelData in config.giftCodes"
              :key="levelData.level"
            >
              <NCard
                v-if="levelData.codes.length > 0"
                :title="getLevelName(levelData.level) + ' 礼品码'"
                size="small"
              >
                <NSpace
                  v-for="(code, index) in levelData.codes"
                  :key="index"
                  justify="space-between"
                  style="width: 100%"
                >
                  <span>{{ code }}</span>
                  <NButton
                    size="small"
                    type="error"
                    quaternary
                    @click="removeCode(levelData.level, index)"
                  >
                    删除
                  </NButton>
                </NSpace>
              </NCard>
            </div>
          </NSpace>
        </NCard>
      </div>
    </NSpace>
  </div>
</template>
