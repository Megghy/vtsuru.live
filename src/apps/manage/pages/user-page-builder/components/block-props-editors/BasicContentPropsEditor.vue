<script setup lang="ts">
import { PersonCircleOutline } from '@vicons/ionicons5'
import { NButton, NFlex, NForm, NFormItem, NIcon, NInput, NInputNumber, NSelect, NSwitch, NText } from 'naive-ui'

import type { BlockNode } from '@/apps/user-page/block/schema'
import RichTextEditor from '@/apps/user-page/editor/RichTextEditor.vue'

import PropsGrid from '../PropsGrid.vue'
import TextAppearanceFields from './TextAppearanceFields.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { editor, blockProps } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <NForm
    v-if="props.block.type === 'profile'"
    label-placement="top"
    size="small"
  >
    <PropsGrid>
      <NFormItem label="显示名称">
        <NInput
          v-model:value="blockProps.displayName"
          placeholder="为空则显示账号名"
        />
      </NFormItem>
      <NFormItem
        class="span-full"
        label="头像图片"
      >
        <NFlex align="center">
          <NButton
            size="small"
            :loading="editor.isUploading.value"
            @click="editor.triggerUpload(props.block, 'avatarFile')"
          >
            <template #icon>
              <NIcon><PersonCircleOutline /></NIcon>
            </template>
            上传头像
          </NButton>
          <NButton
            size="small"
            secondary
            :disabled="!blockProps.avatarFile"
            @click="editor.clearUploadedFile(props.block, 'avatarFile')"
          >
            清除
          </NButton>
          <NText depth="3">
            {{ blockProps.avatarFile?.name || blockProps.avatarFile?.path || '' }}
          </NText>
        </NFlex>
      </NFormItem>
      <NFormItem
        class="span-full"
        label="个人简介"
      >
        <NInput
          v-model:value="blockProps.bio"
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 6 }"
        />
      </NFormItem>
    </PropsGrid>
  </NForm>

  <NForm
    v-else-if="props.block.type === 'heading'"
    label-placement="top"
    size="small"
  >
    <PropsGrid>
      <NFormItem label="标题文字">
        <NInput
          v-model:value="blockProps.text"
          placeholder="请输入标题"
        />
      </NFormItem>
      <NFormItem label="标题级别 1/2/3">
        <NInputNumber
          v-model:value="blockProps.level"
          :min="1"
          :max="3"
          style="width: 100%"
        />
      </NFormItem>
      <TextAppearanceFields :block="props.block" />
    </PropsGrid>
  </NForm>

  <NForm
    v-else-if="props.block.type === 'text'"
    label-placement="top"
    size="small"
  >
    <PropsGrid>
      <NFormItem
        class="span-full"
        label="文本内容"
      >
        <NInput
          v-model:value="blockProps.text"
          type="textarea"
          :autosize="{ minRows: 6, maxRows: 14 }"
        />
      </NFormItem>
      <TextAppearanceFields :block="props.block" />
    </PropsGrid>
  </NForm>

  <NForm
    v-else-if="props.block.type === 'richText'"
    label-placement="top"
    size="small"
  >
    <NFormItem label="富文本内容">
      <RichTextEditor
        v-model:html="editor.ensureRichTextProps(props.block).html"
        v-model:images-file="editor.ensureRichTextProps(props.block).imagesFile"
      />
    </NFormItem>
  </NForm>

  <NForm
    v-else-if="props.block.type === 'alert'"
    label-placement="top"
    size="small"
  >
    <PropsGrid>
      <NFormItem label="提示类型">
        <NSelect
          v-model:value="blockProps.type"
          :options="[
            { label: '信息', value: 'info' },
            { label: '成功', value: 'success' },
            { label: '警告', value: 'warning' },
            { label: '错误', value: 'error' },
            { label: '默认', value: 'default' },
          ]"
        />
      </NFormItem>
      <NFormItem label="标题">
        <NInput
          v-model:value="blockProps.title"
          placeholder="可选"
        />
      </NFormItem>
      <NFormItem
        class="span-full"
        label="内容"
      >
        <NInput
          v-model:value="blockProps.text"
          type="textarea"
          :autosize="{ minRows: 3, maxRows: 8 }"
          placeholder="请输入提示内容"
        />
      </NFormItem>
      <NFormItem label="显示图标">
        <NFlex justify="end">
          <NSwitch
            v-model:value="blockProps.showIcon"
            size="small"
          />
        </NFlex>
      </NFormItem>
      <NFormItem label="显示边框">
        <NFlex justify="end">
          <NSwitch
            v-model:value="blockProps.bordered"
            size="small"
          />
        </NFlex>
      </NFormItem>
    </PropsGrid>
  </NForm>
</template>
