<script setup lang="ts">
import { NButton, NForm, NFormItem, NIcon, NInput, NInputNumber, NSelect, NSpace, NSwitch, NText } from 'naive-ui'
import type { BlockNode } from '@/features/user-page/block/schema'
import RichTextEditor from '@/features/user-page/editor/RichTextEditor.vue'
import ImageGalleryPropsEditor from './ImageGalleryPropsEditor.vue'
import PropsGrid from './PropsGrid.vue'
import { inject } from 'vue'
import { UserPageEditorKey } from '../context'
import { ImageOutline, PersonCircleOutline } from '@vicons/ionicons5'

const props = defineProps<{
  block: BlockNode
}>()

const editor = inject(UserPageEditorKey)
if (!editor) throw new Error('UserPageEditor context is missing')
</script>

<template>
  <div>
    <template v-if="props.block.type === 'profile'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="头像链接（可选）">
            <NInput v-model:value="editor.ensurePropsObject(props.block).avatarUrl" placeholder="https://..." />
          </NFormItem>
          <NFormItem label="显示名称">
            <NInput v-model:value="editor.ensurePropsObject(props.block).displayName" placeholder="为空则显示账号名" />
          </NFormItem>
          <NFormItem class="span-full" label="头像图片">
            <NSpace align="center">
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
                :disabled="!editor.ensurePropsObject(props.block).avatarFile"
                @click="editor.clearUploadedFile(props.block, 'avatarFile')"
              >
                清除
              </NButton>
              <NText depth="3">
                {{ editor.ensurePropsObject(props.block).avatarFile?.name || editor.ensurePropsObject(props.block).avatarFile?.path || '' }}
              </NText>
            </NSpace>
          </NFormItem>
          <NFormItem class="span-full" label="个人简介">
            <NInput v-model:value="editor.ensurePropsObject(props.block).bio" type="textarea" :autosize="{ minRows: 2, maxRows: 6 }" />
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'heading'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="标题文字">
            <NInput v-model:value="editor.ensurePropsObject(props.block).text" placeholder="请输入标题" />
          </NFormItem>
          <NFormItem label="标题级别（1/2/3）">
            <NInputNumber v-model:value="editor.ensurePropsObject(props.block).level" :min="1" :max="3" style="width: 100%" />
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'text'">
      <NForm label-placement="top" size="small">
        <NFormItem label="文本内容">
          <NInput v-model:value="editor.ensurePropsObject(props.block).text" type="textarea" :autosize="{ minRows: 6, maxRows: 14 }" />
        </NFormItem>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'richText'">
      <NForm label-placement="top" size="small">
        <NFormItem label="富文本内容">
          <RichTextEditor
            v-model:html="editor.ensureRichTextProps(props.block).html"
            v-model:images-file="editor.ensureRichTextProps(props.block).imagesFile"
          />
        </NFormItem>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'alert'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="提示类型">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).type"
              :options="[
                { label: '信息', value: 'info' },
                { label: '成功', value: 'success' },
                { label: '警告', value: 'warning' },
                { label: '错误', value: 'error' },
                { label: '默认', value: 'default' },
              ]"
            />
          </NFormItem>
          <NFormItem label="标题（可选）">
            <NInput v-model:value="editor.ensurePropsObject(props.block).title" placeholder="可选" />
          </NFormItem>
          <NFormItem class="span-full" label="内容">
            <NInput
              v-model:value="editor.ensurePropsObject(props.block).text"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 8 }"
              placeholder="请输入提示内容"
            />
          </NFormItem>
          <NFormItem label="显示图标">
            <NSpace justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).showIcon" size="small" />
            </NSpace>
          </NFormItem>
          <NFormItem label="显示边框">
            <NSpace justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).bordered" size="small" />
            </NSpace>
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'links'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem class="span-full" label="链接项">
            <NSpace vertical style="width: 100%">
              <div
                v-for="(it, idx) in editor.ensureItems(props.block)"
                :key="idx"
                style="display:flex; gap: 8px"
              >
                <NInput v-model:value="it.label" placeholder="标题" />
                <NInput v-model:value="it.url" placeholder="链接（https://...）" />
                <NButton type="error" secondary @click="editor.ensureItems(props.block).splice(idx, 1)">
                  删除
                </NButton>
              </div>
              <NButton
                type="info"
                secondary
                @click="editor.ensureItems(props.block).push({ label: '', url: 'https://' })"
              >
                添加
              </NButton>
            </NSpace>
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'buttons'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="排列方向">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).direction"
              :options="[{ label: '竖向', value: 'vertical' }, { label: '横向（自动换行）', value: 'horizontal' }]"
            />
          </NFormItem>
          <NFormItem label="对齐方式">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).align"
              :options="[
                { label: '左对齐', value: 'start' },
                { label: '居中', value: 'center' },
                { label: '右对齐', value: 'end' },
              ]"
            />
          </NFormItem>
          <NFormItem label="按钮铺满宽度">
            <NSpace justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).fullWidth" size="small" />
            </NSpace>
          </NFormItem>
          <NFormItem label="按钮类型">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).type"
              :options="[
                { label: 'primary', value: 'primary' },
                { label: 'default', value: 'default' },
                { label: 'info', value: 'info' },
                { label: 'success', value: 'success' },
                { label: 'warning', value: 'warning' },
                { label: 'error', value: 'error' },
              ]"
            />
          </NFormItem>
          <NFormItem label="样式">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).variant"
              :options="[
                { label: 'solid', value: 'solid' },
                { label: 'secondary', value: 'secondary' },
                { label: 'tertiary', value: 'tertiary' },
                { label: 'quaternary', value: 'quaternary' },
                { label: 'ghost', value: 'ghost' },
              ]"
            />
          </NFormItem>
          <NFormItem label="间距 gap（px）">
            <NInputNumber v-model:value="editor.ensurePropsObject(props.block).gap" :min="0" :max="32" style="width: 100%" />
          </NFormItem>
          <NFormItem class="span-full" label="按钮项">
            <NSpace vertical style="width: 100%">
              <div
                v-for="(it, idx) in editor.ensureItems(props.block)"
                :key="idx"
                style="display:flex; gap: 8px"
              >
                <NInput v-model:value="it.label" placeholder="标题" />
                <NInput v-model:value="it.url" placeholder="链接（https://...）" />
                <NButton type="error" secondary @click="editor.ensureItems(props.block).splice(idx, 1)">
                  删除
                </NButton>
              </div>
              <NButton
                type="info"
                secondary
                @click="editor.ensureItems(props.block).push({ label: '', url: 'https://' })"
              >
                添加
              </NButton>
            </NSpace>
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'image'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="图片链接">
            <NInput v-model:value="editor.ensurePropsObject(props.block).url" placeholder="https://...（优先级高于上传文件）" />
          </NFormItem>
          <NFormItem label="最大宽度（可选）">
            <NInput v-model:value="editor.ensurePropsObject(props.block).maxWidth" placeholder="例如 100% 或 480px" />
          </NFormItem>
          <NFormItem label="最大高度（可选）">
            <NInput v-model:value="editor.ensurePropsObject(props.block).maxHeight" placeholder="例如 100% 或 320px" />
          </NFormItem>
          <NFormItem label="图片描述 (Alt)">
            <NInput v-model:value="editor.ensurePropsObject(props.block).alt" placeholder="图片加载失败时显示的文字" />
          </NFormItem>
          <NFormItem class="span-full" label="本地图片">
            <NSpace align="center">
              <NButton
                size="small"
                :loading="editor.isUploading.value"
                @click="editor.triggerUpload(props.block, 'imageFile')"
              >
                <template #icon>
                  <NIcon><ImageOutline /></NIcon>
                </template>
                上传图片
              </NButton>
              <NButton
                size="small"
                secondary
                :disabled="!editor.ensurePropsObject(props.block).imageFile"
                @click="editor.clearUploadedFile(props.block, 'imageFile')"
              >
                清除
              </NButton>
              <img
                v-if="editor.ensurePropsObject(props.block).imageFile?.path"
                :src="editor.ensurePropsObject(props.block).imageFile.path"
                alt=""
                referrerpolicy="no-referrer"
                style="width: 36px; height: 36px; object-fit: cover; border-radius: 6px; border: 1px solid var(--n-border-color);"
              >
              <NText depth="3">
                {{ editor.ensurePropsObject(props.block).imageFile?.name || editor.ensurePropsObject(props.block).imageFile?.path || '' }}
              </NText>
            </NSpace>
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'imageGallery'">
      <ImageGalleryPropsEditor :block="props.block" :editor="editor" />
    </template>

    <template v-else-if="props.block.type === 'embed'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem class="span-full" label="嵌入链接 (支持 Bilibili / YouTube)">
            <NInput
              v-model:value="editor.ensurePropsObject(props.block).url"
              placeholder="https://www.youtube.com/watch?v=..."
            />
          </NFormItem>
          <NFormItem label="标题">
            <NInput v-model:value="editor.ensurePropsObject(props.block).title" placeholder="可选，用于无障碍访问" />
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'divider'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="文字（可选）">
            <NInput v-model:value="editor.ensurePropsObject(props.block).text" />
          </NFormItem>
          <NFormItem label="文字位置">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).titlePlacement"
              :options="[
                { label: '居左', value: 'left' },
                { label: '居中', value: 'center' },
                { label: '居右', value: 'right' },
              ]"
            />
          </NFormItem>
          <NFormItem label="上边距（px）">
            <NInputNumber v-model:value="editor.ensurePropsObject(props.block).marginTop" :min="0" :max="80" style="width: 100%" />
          </NFormItem>
          <NFormItem label="下边距（px）">
            <NInputNumber v-model:value="editor.ensurePropsObject(props.block).marginBottom" :min="0" :max="80" style="width: 100%" />
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'spacer'">
      <NForm label-placement="top" size="small">
        <NFormItem label="大小">
          <NSelect
            v-model:value="editor.ensurePropsObject(props.block).size"
            :options="[{ label: 'sm', value: 'sm' }, { label: 'md', value: 'md' }, { label: 'lg', value: 'lg' }]"
          />
        </NFormItem>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'footer'">
      <NForm label-placement="top" size="small">
        <NFormItem label="文字（可选）">
          <NInput v-model:value="editor.ensurePropsObject(props.block).text" />
        </NFormItem>
      </NForm>
    </template>

    <template v-else>
      <NText depth="3">
        未知区块类型：{{ props.block.type }}
      </NText>
    </template>
  </div>
</template>
