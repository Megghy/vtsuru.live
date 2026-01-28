<script setup lang="ts">
  import { NButton, NDatePicker, NDivider, NForm, NFormItem, NIcon, NInput, NInputNumber, NSelect, NFlex, NSwitch, NText } from 'naive-ui'
  import type { BlockNode } from '@/apps/user-page/block/schema';
  import RichTextEditor from '@/apps/user-page/editor/RichTextEditor.vue';
  import ImageGalleryPropsEditor from './ImageGalleryPropsEditor.vue';
  import PropsGrid from './PropsGrid.vue';
  import { computed, inject } from 'vue';
  import { UserPageEditorKey } from '../context';
  import Draggable from 'vuedraggable-es';
  import { ImageOutline, PersonCircleOutline, ReorderThreeOutline } from '@vicons/ionicons5';

  const props = defineProps<{
    block: BlockNode;
  }>();

  const editor = inject(UserPageEditorKey);
  if (!editor) throw new Error('UserPageEditor context is missing');

  function getButtonItemKey(it: any) {
    if (!it || typeof it !== 'object') return String(it ?? '')
    if (typeof (it as any)._k !== 'string') {
      const v = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`
      Object.defineProperty(it, '_k', { value: v, enumerable: false })
    }
    return (it as any)._k as string
  }

  const internalPageOptions = computed(() => {
    const pages = editor.settings.value.pages ?? {};
    const entries = Object.entries(pages).map(([slug, cfg]: any) => ({
      slug,
      navVisible: cfg?.navVisible !== false,
      navOrder: typeof cfg?.navOrder === 'number' ? cfg.navOrder : 0,
      title: typeof cfg?.title === 'string' && cfg.title.trim().length ? cfg.title.trim() : `/${slug}`,
    }))
      .sort((a, b) => (a.navOrder - b.navOrder) || a.slug.localeCompare(b.slug));

    return [
      { label: '主页', value: 'home' },
      ...entries.map(it => ({
        label: `${it.title}${it.navVisible ? '' : ' · 隐藏'}`,
        value: it.slug,
      })),
    ];
  });

  const blockNameModel = computed({
    get() {
      return typeof props.block.name === 'string' ? props.block.name : '';
    },
    set(v: string) {
      const next = String(v ?? '');
      const trimmed = next.trim();
      if (!trimmed.length) delete (props.block as any).name;
      else props.block.name = trimmed.slice(0, 50);
    },
  });

  function defaultFramedForType(type: BlockNode['type']) {
    // 保持现有默认行为：部分区块默认不带边框
    if (type === 'layout') return false;
    if (type === 'spacer') return false;
    if (type === 'footer') return false;
    if (type === 'buttons') return false;
    if (type === 'button') return false;
    if (type === 'tags') return false;
    if (type === 'countdown') return false;
    if (type === 'imageGallery') return false;
    if (type === 'richText') return false;
    if (type === 'marquee') return false;
    return true;
  }

  function defaultBackgroundedForType(type: BlockNode['type']) {
    // 背景默认策略：大部分区块保留背景，部分区块默认无背景
    if (type === 'layout') return false;
    if (type === 'spacer') return false;
    if (type === 'footer') return false;
    if (type === 'buttons') return false;
    if (type === 'button') return false;
    if (type === 'tags') return false;
    if (type === 'countdown') return false;
    if (type === 'imageGallery') return false;
    if (type === 'richText') return false;
    if (type === 'marquee') return false;
    return true;
  }

  function hideCardChromeOptionsForType(type: BlockNode['type']) {
    return type === 'imageGallery';
  }

  const blockFramedModel = computed({
    get() {
      const propsObj = editor.ensurePropsObject(props.block) as any;
      const v = propsObj.framed;
      if (typeof v === 'boolean') return v;
      return defaultFramedForType(props.block.type);
    },
    set(v: boolean) {
      const propsObj = editor.ensurePropsObject(props.block) as any;
      const next = Boolean(v);
      const defaultValue = defaultFramedForType(props.block.type);
      if (next === defaultValue) delete propsObj.framed;
      else propsObj.framed = next;
    },
  });

  const blockBackgroundedModel = computed({
    get() {
      const propsObj = editor.ensurePropsObject(props.block) as any;
      const v = propsObj.backgrounded;
      if (typeof v === 'boolean') return v;
      return defaultBackgroundedForType(props.block.type);
    },
    set(v: boolean) {
      const propsObj = editor.ensurePropsObject(props.block) as any;
      const next = Boolean(v);
      const defaultValue = defaultBackgroundedForType(props.block.type);
      if (next === defaultValue) delete propsObj.backgrounded;
      else propsObj.backgrounded = next;
    },
  });

  function ensureArrayProp<T = any>(block: BlockNode, key: string): T[] {
    const obj = editor.ensurePropsObject(block) as any;
    if (!Array.isArray(obj[key])) obj[key] = [];
    return obj[key] as T[];
  }

  function parseDateOnlyLocalMs(raw: unknown): number | null {
    if (typeof raw !== 'string') return null;
    const v = raw.trim();
    if (!v) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!m) return null;
    const year = Number(m[1]);
    const monthIndex = Number(m[2]) - 1;
    const day = Number(m[3]);
    return new Date(year, monthIndex, day, 0, 0, 0, 0).getTime();
  }

  function formatDateOnlyLocal(ms: number): string {
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function parseDateTimeMs(raw: unknown): number | null {
    if (typeof raw !== 'string') return null;
    const v = raw.trim();
    if (!v) return null;
    const ms = Date.parse(v);
    if (Number.isFinite(ms)) return ms;
    const ms2 = Date.parse(v.replace(' ', 'T'));
    if (Number.isFinite(ms2)) return ms2;
    return null;
  }

  const countdownTargetMsModel = computed<number | null>({
    get() {
      const propsObj = editor.ensurePropsObject(props.block) as any;
      return parseDateTimeMs(propsObj.target);
    },
    set(ms) {
      const propsObj = editor.ensurePropsObject(props.block) as any;
      if (ms == null) propsObj.target = '';
      else propsObj.target = new Date(ms).toISOString();
    },
  });

  const layoutProps = computed(() => editor.ensureLayoutProps(props.block) as any);

  const justifyOptionsHorizontal = [
    { label: 'start - 靠左', value: 'start' },
    { label: 'center - 居中', value: 'center' },
    { label: 'end - 靠右', value: 'end' },
    { label: 'between - 两端对齐', value: 'between' },
    { label: 'around - 环绕分布', value: 'around' },
    { label: 'evenly - 均匀分布', value: 'evenly' },
  ];

  const justifyOptionsVertical = [
    { label: 'start - 靠上', value: 'start' },
    { label: 'center - 居中', value: 'center' },
    { label: 'end - 靠下', value: 'end' },
    { label: 'between - 上下两端对齐', value: 'between' },
    { label: 'around - 上下环绕分布', value: 'around' },
    { label: 'evenly - 上下均匀分布', value: 'evenly' },
  ];

  const alignOptionsHorizontal = [
    { label: 'start - 靠左', value: 'start' },
    { label: 'center - 居中', value: 'center' },
    { label: 'end - 靠右', value: 'end' },
    { label: 'stretch - 拉伸/等高', value: 'stretch' },
  ];

  const alignOptionsVertical = [
    { label: 'start - 靠上', value: 'start' },
    { label: 'center - 居中', value: 'center' },
    { label: 'end - 靠下', value: 'end' },
    { label: 'stretch - 拉伸/等高', value: 'stretch' },
  ];

  const horizontalAlignModel = computed({
    get() {
      const p = layoutProps.value;
      return p.layout === 'column' ? p.align : p.justify;
    },
    set(v) {
      const p = layoutProps.value;
      if (p.layout === 'column') p.align = v as any;
      else p.justify = v as any;
    },
  });

  const verticalAlignModel = computed({
    get() {
      const p = layoutProps.value;
      return p.layout === 'column' ? p.justify : p.align;
    },
    set(v) {
      const p = layoutProps.value;
      if (p.layout === 'column') p.justify = v as any;
      else p.align = v as any;
    },
  });

  const horizontalAlignOptions = computed(() => (layoutProps.value.layout === 'column' ? alignOptionsHorizontal : justifyOptionsHorizontal));
  const verticalAlignOptions = computed(() => (layoutProps.value.layout === 'column' ? justifyOptionsVertical : alignOptionsVertical));
</script>

<template>
  <div>
    <NDivider style="margin: 0 0 10px" title-placement="left">
      默认属性
    </NDivider>
    <PropsGrid :row-gap="0">
      <NFormItem label="区块名称" style="justify-self: start; width: min(260px, 100%)">
        <NInput v-model:value="blockNameModel" maxlength="50" show-count placeholder="例如：直播信息 · 紧凑" />
      </NFormItem>
      <NFormItem v-if="!hideCardChromeOptionsForType(props.block.type)" label="显示边框" style="justify-self: start; width: min(180px, 100%)">
        <NSwitch v-model:value="blockFramedModel" size="small" />
      </NFormItem>
      <NFormItem v-if="!hideCardChromeOptionsForType(props.block.type)" label="显示背景" style="justify-self: start; width: min(180px, 100%)">
        <NSwitch v-model:value="blockBackgroundedModel" size="small" />
      </NFormItem>
    </PropsGrid>

    <template v-if="props.block.type === 'layout'">
      <NForm label-placement="top" size="small">
        <NText strong style="display: block; margin-bottom: 8px; font-size: 13px">
          布局设置
        </NText>

        <PropsGrid :col-gap="8" :row-gap="0">
          <NFormItem label="布局类型">
            <NSelect
              v-model:value="editor.ensureLayoutProps(props.block).layout" :options="[
                { label: 'Row - 横向', value: 'row' },
                { label: 'Column - 纵向', value: 'column' },
                { label: 'Grid - 网格', value: 'grid' },
              ]"
            />
          </NFormItem>

          <NFormItem v-if="editor.ensureLayoutProps(props.block).layout === 'row'" label="允许换行">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensureLayoutProps(props.block).wrap" size="small" />
            </NFlex>
          </NFormItem>

          <NFormItem v-if="editor.ensureLayoutProps(props.block).layout === 'grid'" label="列数">
            <NInputNumber
              v-model:value="editor.ensureLayoutProps(props.block).columns" :min="1" :max="12"
              style="width: 100%"
            />
          </NFormItem>

          <NFormItem label="间距">
            <NInputNumber
              v-model:value="editor.ensureLayoutProps(props.block).gap" :min="0" :max="80"
              style="width: 100%"
            />
          </NFormItem>

          <NFormItem label="最大宽度">
            <NInput v-model:value="editor.ensureLayoutProps(props.block).maxWidth" placeholder="如 100% / 480px" />
          </NFormItem>

          <NFormItem label="横向对齐">
            <NSelect v-model:value="horizontalAlignModel" :options="horizontalAlignOptions" />
          </NFormItem>

          <NFormItem label="纵向对齐">
            <NSelect v-model:value="verticalAlignModel" :options="verticalAlignOptions" />
          </NFormItem>
        </PropsGrid>

        <NText
          depth="3"
          style="display: block; margin-top: 12px; padding: 6px 8px; background: var(--n-color-embedded); border-radius: 4px; font-size: 12px; line-height: 1.5"
        >
          子区块请在「区块管理」中管理：选中多个区块点击「成组」按钮，或拖入已展开的组。
        </NText>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'profile'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="头像链接">
            <NInput v-model:value="editor.ensurePropsObject(props.block).avatarUrl" placeholder="https://..." />
          </NFormItem>
          <NFormItem label="显示名称">
            <NInput v-model:value="editor.ensurePropsObject(props.block).displayName" placeholder="为空则显示账号名" />
          </NFormItem>
          <NFormItem class="span-full" label="头像图片">
            <NFlex align="center">
              <NButton
                size="small" :loading="editor.isUploading.value"
                @click="editor.triggerUpload(props.block, 'avatarFile')"
              >
                <template #icon>
                  <NIcon>
                    <PersonCircleOutline />
                  </NIcon>
                </template>
                上传头像
              </NButton>
              <NButton
                size="small" secondary :disabled="!editor.ensurePropsObject(props.block).avatarFile"
                @click="editor.clearUploadedFile(props.block, 'avatarFile')"
              >
                清除
              </NButton>
              <NText depth="3">
                {{ editor.ensurePropsObject(props.block).avatarFile?.name || editor.ensurePropsObject(props.block).avatarFile?.path || '' }}
              </NText>
            </NFlex>
          </NFormItem>
          <NFormItem class="span-full" label="个人简介">
            <NInput
              v-model:value="editor.ensurePropsObject(props.block).bio" type="textarea"
              :autosize="{ minRows: 2, maxRows: 6 }"
            />
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
          <NFormItem label="标题级别 1/2/3">
            <NInputNumber
              v-model:value="editor.ensurePropsObject(props.block).level" :min="1" :max="3"
              style="width: 100%"
            />
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'text'">
      <NForm label-placement="top" size="small">
        <NFormItem label="文本内容">
          <NInput
            v-model:value="editor.ensurePropsObject(props.block).text" type="textarea"
            :autosize="{ minRows: 6, maxRows: 14 }"
          />
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
              v-model:value="editor.ensurePropsObject(props.block).type" :options="[
                { label: '信息', value: 'info' },
                { label: '成功', value: 'success' },
                { label: '警告', value: 'warning' },
                { label: '错误', value: 'error' },
                { label: '默认', value: 'default' },
              ]"
            />
          </NFormItem>
          <NFormItem label="标题">
            <NInput v-model:value="editor.ensurePropsObject(props.block).title" placeholder="可选" />
          </NFormItem>
          <NFormItem class="span-full" label="内容">
            <NInput
              v-model:value="editor.ensurePropsObject(props.block).text" type="textarea"
              :autosize="{ minRows: 3, maxRows: 8 }" placeholder="请输入提示内容"
            />
          </NFormItem>
          <NFormItem label="显示图标">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).showIcon" size="small" />
            </NFlex>
          </NFormItem>
          <NFormItem label="显示边框">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).bordered" size="small" />
            </NFlex>
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'liveStatus'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="样式">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).variant"
              :options="[{ label: '大卡片', value: 'card' }, { label: '紧凑', value: 'compact' }]"
            />
          </NFormItem>
          <NFormItem label="显示标题">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).showTitle" size="small" />
            </NFlex>
          </NFormItem>
          <NFormItem label="显示分区">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).showArea" size="small" />
            </NFlex>
          </NFormItem>
          <NFormItem label="显示封面">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).showCover" size="small" />
            </NFlex>
          </NFormItem>
          <NFormItem label="显示按钮">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).showButtons" size="small" />
            </NFlex>
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'streamSchedule'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="布局">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).layout"
              :options="[{ label: '列表', value: 'list' }, { label: '表格', value: 'table' }]"
            />
          </NFormItem>
          <NFormItem label="展示周数 1~8">
            <NInputNumber
              v-model:value="editor.ensurePropsObject(props.block).weeksCount" :min="1" :max="8"
              style="width: 100%"
            />
          </NFormItem>
          <NFormItem label="显示订阅(ICS)">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).showIcs" size="small" />
            </NFlex>
          </NFormItem>
          <NFormItem label="高亮今天">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).highlightToday" size="small" />
            </NFlex>
          </NFormItem>
          <NFormItem label="显示标签">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).showTag" size="small" />
            </NFlex>
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'biliInfo'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="样式">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).variant"
              :options="[{ label: '大卡片', value: 'card' }, { label: '紧凑', value: 'compact' }]"
            />
          </NFormItem>
          <NFormItem label="显示头像">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).showAvatar" size="small" />
            </NFlex>
          </NFormItem>
          <NFormItem label="显示昵称">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).showName" size="small" />
            </NFlex>
          </NFormItem>
          <NFormItem label="显示签名">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).showSign" size="small" />
            </NFlex>
          </NFormItem>
          <NFormItem label="显示统计">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).showStats" size="small" />
            </NFlex>
          </NFormItem>
          <NFormItem label="显示按钮">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).showButtons" size="small" />
            </NFlex>
          </NFormItem>
          <NFormItem label="显示直播间按钮">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).showLiveRoom" size="small" />
            </NFlex>
          </NFormItem>
          <NFormItem class="span-full" label="个人主页链接">
            <NInput
              v-model:value="editor.ensurePropsObject(props.block).spaceUrl"
              placeholder="https://space.bilibili.com/..."
            />
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'links'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem class="span-full" label="链接项">
            <NFlex vertical style="width: 100%">
              <div v-for="(it, idx) in editor.ensureItems(props.block)" :key="idx" style="display:flex; gap: 8px">
                <NInput v-model:value="it.label" placeholder="标题" />
                <NInput v-model:value="it.url" placeholder="链接 https://..." />
                <NButton type="error" secondary @click="editor.ensureItems(props.block).splice(idx, 1)">
                  删除
                </NButton>
              </div>
              <NButton
                type="info" secondary
                @click="editor.ensureItems(props.block).push({ label: '', url: 'https://' })"
              >
                添加
              </NButton>
            </NFlex>
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'buttons'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="边框标题">
            <NInput v-model:value="editor.ensurePropsObject(props.block).borderTitle" placeholder="例如：导航" />
          </NFormItem>
          <NFormItem label="标题对齐">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).borderTitleAlign"
              :options="[{ label: '左', value: 'left' }, { label: '中', value: 'center' }, { label: '右', value: 'right' }]"
            />
          </NFormItem>
          <NFormItem label="排列方向">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).direction"
              :options="[{ label: '竖向', value: 'vertical' }, { label: '横向 - 自动换行', value: 'horizontal' }]"
            />
          </NFormItem>
          <NFormItem label="对齐方式">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).align" :options="[
                { label: '左对齐', value: 'start' },
                { label: '居中', value: 'center' },
                { label: '右对齐', value: 'end' },
              ]"
            />
          </NFormItem>
          <NFormItem label="按钮铺满宽度">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).fullWidth" size="small" />
            </NFlex>
          </NFormItem>
          <NFormItem label="按钮类型">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).type" :options="[
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
              v-model:value="editor.ensurePropsObject(props.block).variant" :options="[
                { label: 'solid', value: 'solid' },
                { label: 'secondary', value: 'secondary' },
                { label: 'tertiary', value: 'tertiary' },
                { label: 'quaternary', value: 'quaternary' },
                { label: 'ghost', value: 'ghost' },
              ]"
            />
          </NFormItem>
          <NFormItem label="间距 px">
            <NInputNumber
              v-model:value="editor.ensurePropsObject(props.block).gap" :min="0" :max="32"
              style="width: 100%"
            />
          </NFormItem>
          <NFormItem class="span-full" label="按钮项">
            <NFlex vertical style="width: 100%; padding-right: 10px">
              <Draggable
                :list="editor.ensureItems(props.block)"
                :item-key="getButtonItemKey"
                handle=".drag-handle"
                :animation="160"
              >
                <template #item="{ element: it, index: idx }">
                  <div
                    style="width: 100%; min-width: 0; margin-bottom: 10px; padding: 10px; border-radius: 10px; border: 1px solid rgba(127, 127, 127, 0.28); background: var(--n-color-embedded); box-sizing: border-box"
                  >
                    <div style="display:flex; flex-wrap: wrap; align-items: center; gap: 8px; width: 100%; min-width: 0">
                      <NInput
                        v-model:value="it.label"
                        placeholder="标题"
                        style="flex: 1 1 160px; min-width: 120px"
                      />
                      <NSelect
                        style="width: 110px; flex: 0 0 110px"
                        :value="(it as any).back === true ? 'back' : ((it as any).page ? 'page' : 'external')"
                        :options="[{ label: '页面', value: 'page' }, { label: '外链', value: 'external' }, { label: '返回', value: 'back' }]"
                        @update:value="(v) => {
                          if (v === 'back') {
                            (it as any).back = true;
                            delete (it as any).page;
                            delete (it as any).url;
                          } else if (v === 'page') {
                            delete (it as any).back;
                            if (!(it as any).page) (it as any).page = 'home';
                            delete (it as any).url;
                          } else {
                            delete (it as any).back;
                            if (typeof (it as any).url !== 'string' || !(it as any).url.trim().length) (it as any).url = 'https://';
                            delete (it as any).page;
                          }
                        }"
                      />
                    </div>
                    <div style="margin-top: 8px; width: 100%; min-width: 0">
                      <NSelect
                        v-if="(it as any).page"
                        v-model:value="(it as any).page"
                        :options="internalPageOptions"
                        style="width: 100%"
                      />
                      <NInput
                        v-else-if="!(it as any).back"
                        v-model:value="(it as any).url"
                        placeholder="链接 https://..."
                        style="width: 100%"
                      />
                      <NText v-else depth="3" style="display:block; padding: 6px 2px">
                        点击后返回上一页
                      </NText>
                    </div>
                    <div style="margin-top: 8px; display:flex; align-items:center; justify-content: space-between; gap: 10px">
                      <NButton type="error" secondary size="small" @click="editor.ensureItems(props.block).splice(idx, 1)">
                        删除
                      </NButton>
                      <NIcon class="drag-handle" size="18" style="cursor: grab; opacity: 0.75">
                        <ReorderThreeOutline />
                      </NIcon>
                    </div>
                  </div>
                </template>
              </Draggable>
              <NButton
                type="info" secondary
                @click="editor.ensureItems(props.block).push({ label: '', url: 'https://' })"
              >
                添加
              </NButton>
            </NFlex>
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'button'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
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
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).fullWidth" size="small" />
            </NFlex>
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
          <NFormItem class="span-full" label="按钮文本">
            <NInput v-model:value="editor.ensurePropsObject(props.block).label" placeholder="例如：衣柜" />
          </NFormItem>
          <NFormItem class="span-full" label="跳转类型">
            <NSelect
              :value="(editor.ensurePropsObject(props.block) as any).back === true ? 'back' : (editor.ensurePropsObject(props.block).page ? 'page' : 'external')"
              :options="[{ label: '页面', value: 'page' }, { label: '外链', value: 'external' }, { label: '返回', value: 'back' }]"
              @update:value="(v) => {
                const obj: any = editor.ensurePropsObject(props.block);
                if (v === 'back') {
                  obj.back = true;
                  delete obj.page;
                  delete obj.url;
                } else if (v === 'page') {
                  delete obj.back;
                  if (!obj.page) obj.page = 'home';
                  delete obj.url;
                } else {
                  delete obj.back;
                  if (typeof obj.url !== 'string' || !obj.url.trim().length) obj.url = 'https://';
                  delete obj.page;
                }
              }"
            />
          </NFormItem>
          <NFormItem class="span-full" label="目标">
            <NSelect
              v-if="editor.ensurePropsObject(props.block).page"
              v-model:value="editor.ensurePropsObject(props.block).page"
              :options="internalPageOptions"
            />
            <NInput
              v-else-if="!(editor.ensurePropsObject(props.block) as any).back"
              v-model:value="editor.ensurePropsObject(props.block).url"
              placeholder="链接 https://..."
            />
            <NText v-else depth="3">
              点击后返回上一页
            </NText>
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'socialLinks'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="大小">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).size"
              :options="[{ label: 'sm', value: 'sm' }, { label: 'md', value: 'md' }, { label: 'lg', value: 'lg' }]"
            />
          </NFormItem>
          <NFormItem label="形状">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).variant"
              :options="[{ label: 'round', value: 'round' }, { label: 'square', value: 'square' }]"
            />
          </NFormItem>
          <NFormItem label="显示文字">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).showLabel" size="small" />
            </NFlex>
          </NFormItem>

          <NFormItem class="span-full" label="链接项">
            <NFlex vertical style="width: 100%">
              <div
                v-for="(it, idx) in ensureArrayProp<any>(props.block, 'items')" :key="idx"
                style="display:flex; gap: 8px"
              >
                <NSelect
                  v-model:value="it.platform" style="width: 140px" :options="[
                    { label: 'bilibili', value: 'bilibili' },
                    { label: 'youtube', value: 'youtube' },
                    { label: 'x', value: 'x' },
                    { label: 'discord', value: 'discord' },
                    { label: 'twitch', value: 'twitch' },
                    { label: 'qqgroup', value: 'qqgroup' },
                    { label: 'github', value: 'github' },
                    { label: 'website', value: 'website' },
                    { label: 'netease', value: 'netease' },
                    { label: 'spotify', value: 'spotify' },
                    { label: 'other', value: 'other' },
                  ]"
                />
                <NInput v-model:value="it.url" placeholder="https://..." />
                <NInput v-model:value="it.label" placeholder="可选显示名" />
                <NButton type="error" secondary @click="ensureArrayProp(props.block, 'items').splice(idx, 1)">
                  删除
                </NButton>
              </div>
              <NButton
                type="info" secondary
                @click="ensureArrayProp<any>(props.block, 'items').push({ platform: 'bilibili', url: 'https://', label: '' })"
              >
                添加
              </NButton>
            </NFlex>
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'videoList'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="数据源">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).source"
              :options="[{ label: '手动列表', value: 'manual' }, { label: '用户主页数据 - 近期视频', value: 'userIndex' }]"
            />
          </NFormItem>
          <NFormItem label="布局">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).layout"
              :options="[{ label: '网格', value: 'grid' }, { label: '横向滚动', value: 'row' }]"
            />
          </NFormItem>
          <NFormItem label="网格列数">
            <NInputNumber
              v-model:value="editor.ensurePropsObject(props.block).columns" :min="1" :max="6"
              style="width: 100%"
            />
          </NFormItem>
          <NFormItem label="最多数量">
            <NInputNumber
              v-model:value="editor.ensurePropsObject(props.block).maxItems" :min="1" :max="50"
              style="width: 100%"
            />
          </NFormItem>
          <NFormItem label="显示标题栏">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).showTitle" size="small" />
            </NFlex>
          </NFormItem>
          <NFormItem class="span-full" label="标题">
            <NInput v-model:value="editor.ensurePropsObject(props.block).title" placeholder="例如：最近视频" />
          </NFormItem>

          <NFormItem v-if="editor.ensurePropsObject(props.block).source === 'manual'" class="span-full" label="手动视频列表">
            <NFlex vertical style="width: 100%">
              <div
                v-for="(it, idx) in ensureArrayProp<any>(props.block, 'items')" :key="idx"
                style="display:flex; gap: 8px"
              >
                <NInput v-model:value="it.title" placeholder="标题，可选" />
                <NInput v-model:value="it.url" placeholder="视频链接 https://..." />
                <NButton type="error" secondary @click="ensureArrayProp(props.block, 'items').splice(idx, 1)">
                  删除
                </NButton>
              </div>
              <NButton
                type="info" secondary
                @click="ensureArrayProp<any>(props.block, 'items').push({ title: '', url: 'https://' })"
              >
                添加
              </NButton>
            </NFlex>
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'musicPlayer'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="平台">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).provider"
              :options="[{ label: 'netease', value: 'netease' }, { label: 'spotify', value: 'spotify' }, { label: 'custom', value: 'custom' }]"
            />
          </NFormItem>
          <NFormItem label="高度 px">
            <NInputNumber
              v-model:value="editor.ensurePropsObject(props.block).height" :min="60" :max="900"
              style="width: 100%"
            />
          </NFormItem>
          <NFormItem label="紧凑模式">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).compact" size="small" />
            </NFlex>
          </NFormItem>
          <NFormItem class="span-full" label="链接">
            <NInput v-model:value="editor.ensurePropsObject(props.block).url" placeholder="https://..." />
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'tags'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="边框标题">
            <NInput v-model:value="editor.ensurePropsObject(props.block).borderTitle" placeholder="例如：标签" />
          </NFormItem>
          <NFormItem label="标题对齐">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).borderTitleAlign"
              :options="[{ label: '左', value: 'left' }, { label: '中', value: 'center' }, { label: '右', value: 'right' }]"
            />
          </NFormItem>
          <NFormItem label="大小">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).size"
              :options="[{ label: 'small', value: 'small' }, { label: 'medium', value: 'medium' }]"
            />
          </NFormItem>
          <NFormItem label="圆角">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).rounded" size="small" />
            </NFlex>
          </NFormItem>

          <NFormItem class="span-full" label="标签项">
            <NFlex vertical style="width: 100%">
              <div
                v-for="(it, idx) in ensureArrayProp<any>(props.block, 'items')" :key="idx"
                style="display:flex; gap: 8px"
              >
                <NInput v-model:value="it.text" placeholder="#标签" />
                <NSelect
                  v-model:value="it.type" style="width: 140px" :options="[
                    { label: 'default', value: 'default' },
                    { label: 'info', value: 'info' },
                    { label: 'success', value: 'success' },
                    { label: 'warning', value: 'warning' },
                    { label: 'error', value: 'error' },
                  ]"
                />
                <NInput v-model:value="it.color" placeholder="自定义色，可选，如 #fb7299" />
                <NButton type="error" secondary @click="ensureArrayProp(props.block, 'items').splice(idx, 1)">
                  删除
                </NButton>
              </div>
              <NButton
                type="info" secondary
                @click="ensureArrayProp<any>(props.block, 'items').push({ text: '#唱见', type: 'default', color: '' })"
              >
                添加
              </NButton>
            </NFlex>
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'milestone'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="展示方式">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).mode"
              :options="[{ label: 'timeline', value: 'timeline' }, { label: 'list', value: 'list' }]"
            />
          </NFormItem>
          <NFormItem class="span-full" label="条目">
            <NFlex vertical style="width: 100%">
              <div
                v-for="(it, idx) in ensureArrayProp<any>(props.block, 'items')" :key="idx"
                style="display:grid; grid-template-columns: 160px 1fr 1.2fr auto; gap: 8px; align-items: start"
              >
                <NDatePicker
                  :value="parseDateOnlyLocalMs(it.date)"
                  type="date"
                  clearable
                  placeholder="选择日期"
                  style="width: 100%"
                  @update:value="(v) => { it.date = v == null ? '' : formatDateOnlyLocal(v) }"
                />
                <NInput v-model:value="it.title" placeholder="标题" />
                <NInput
                  v-model:value="it.description" type="textarea" :autosize="{ minRows: 1, maxRows: 4 }"
                  placeholder="描述，可选"
                />
                <NButton type="error" secondary @click="ensureArrayProp(props.block, 'items').splice(idx, 1)">
                  删除
                </NButton>
              </div>
              <NButton
                type="info" secondary
                @click="ensureArrayProp<any>(props.block, 'items').push({ date: '', title: '', description: '' })"
              >
                添加
              </NButton>
            </NFlex>
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'faq'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="手风琴模式">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).accordion" size="small" />
            </NFlex>
          </NFormItem>
          <NFormItem class="span-full" label="问答">
            <NFlex vertical style="width: 100%">
              <div
                v-for="(it, idx) in ensureArrayProp<any>(props.block, 'items')" :key="idx"
                style="display:grid; grid-template-columns: 1fr 1.2fr auto; gap: 8px; align-items: start"
              >
                <NInput v-model:value="it.q" placeholder="问题" />
                <NInput v-model:value="it.a" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" placeholder="回答" />
                <NButton type="error" secondary @click="ensureArrayProp(props.block, 'items').splice(idx, 1)">
                  删除
                </NButton>
              </div>
              <NButton type="info" secondary @click="ensureArrayProp<any>(props.block, 'items').push({ q: '', a: '' })">
                添加
              </NButton>
            </NFlex>
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'quote'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem class="span-full" label="内容">
            <NInput
              v-model:value="editor.ensurePropsObject(props.block).text" type="textarea"
              :autosize="{ minRows: 3, maxRows: 8 }"
            />
          </NFormItem>
          <NFormItem label="作者">
            <NInput v-model:value="editor.ensurePropsObject(props.block).author" />
          </NFormItem>
          <NFormItem label="对齐">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).align"
              :options="[{ label: 'left', value: 'left' }, { label: 'center', value: 'center' }, { label: 'right', value: 'right' }]"
            />
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'marquee'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem class="span-full" label="文本">
            <NInput
              v-model:value="editor.ensurePropsObject(props.block).text" type="textarea"
              :autosize="{ minRows: 2, maxRows: 6 }"
            />
          </NFormItem>
          <NFormItem label="方向">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).direction"
              :options="[{ label: 'left', value: 'left' }, { label: 'right', value: 'right' }]"
            />
          </NFormItem>
          <NFormItem label="滚动时长 秒">
            <NInputNumber
              v-model:value="editor.ensurePropsObject(props.block).durationSec" :min="4" :max="120"
              style="width: 100%"
            />
          </NFormItem>
          <NFormItem label="悬停暂停">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).pauseOnHover" size="small" />
            </NFlex>
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'countdown'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem class="span-full" label="标题">
            <NInput v-model:value="editor.ensurePropsObject(props.block).title" placeholder="例如：生日倒计时" />
          </NFormItem>
          <NFormItem class="span-full" label="目标时间">
            <NDatePicker
              v-model:value="countdownTargetMsModel"
              type="datetime"
              clearable
              placeholder="选择目标时间"
              style="width: 100%"
            />
          </NFormItem>
          <NFormItem label="展示样式">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).style"
              :options="[{ label: 'cards', value: 'cards' }, { label: 'inline', value: 'inline' }]"
            />
          </NFormItem>
          <NFormItem label="显示秒">
            <NFlex justify="end">
              <NSwitch v-model:value="editor.ensurePropsObject(props.block).showSeconds" size="small" />
            </NFlex>
          </NFormItem>
          <NFormItem class="span-full" label="到达后文案">
            <NInput v-model:value="editor.ensurePropsObject(props.block).doneText" placeholder="已到达" />
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'feedback'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="标题">
            <NInput v-model:value="editor.ensurePropsObject(props.block).title" />
          </NFormItem>
          <NFormItem label="按钮文字">
            <NInput v-model:value="editor.ensurePropsObject(props.block).buttonText" />
          </NFormItem>
          <NFormItem class="span-full" label="描述">
            <NInput
              v-model:value="editor.ensurePropsObject(props.block).description" type="textarea"
              :autosize="{ minRows: 2, maxRows: 6 }"
            />
          </NFormItem>
          <NFormItem
            v-if="!(editor.ensurePropsObject(props.block).embed && editor.ensurePropsObject(props.block).embedMode === 'questionBox')"
            class="span-full"
            label="链接 (https)"
            :required="editor.ensurePropsObject(props.block).embed && editor.ensurePropsObject(props.block).embedMode === 'iframe'"
          >
            <NInput v-model:value="editor.ensurePropsObject(props.block).url" placeholder="https://..." />
          </NFormItem>
          <NFormItem label="嵌入到页面">
            <NFlex justify="start">
              <NSwitch
                v-model:value="editor.ensurePropsObject(props.block).embed"
                size="small"
                @update:value="(v) => {
                  if (!v) return
                  const o = editor.ensurePropsObject(props.block) as any
                  if (o.embedMode !== 'questionBox' && o.embedMode !== 'iframe') o.embedMode = 'questionBox'
                }"
              />

              <NAlert
                type="info"
                :show-icon="false"
                style="font-size: 12px; padding: 6px 10px; border-radius: var(--vtsuru-page-radius)"
              >
                开启“嵌入到页面”后，可选择站内提问箱
              </NAlert>
            </NFlex>
          </NFormItem>
          <NFormItem v-if="editor.ensurePropsObject(props.block).embed" class="span-full" label="嵌入内容">
            <NFlex vertical style="width: 100%">
              <NSelect
                v-model:value="editor.ensurePropsObject(props.block).embedMode"
                :options="[
                  { label: '站内提问箱', value: 'questionBox' },
                  { label: '站外 iframe', value: 'iframe' },
                ]"
              />
            </NFlex>
          </NFormItem>

          <NFormItem
            v-if="editor.ensurePropsObject(props.block).embed && editor.ensurePropsObject(props.block).embedMode !== 'questionBox'"
            label="内嵌高度"
          >
            <NInputNumber
              v-model:value="editor.ensurePropsObject(props.block).height" :min="200" :max="1200"
              style="width: 100%"
            />
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'supporter'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="标题">
            <NInput v-model:value="editor.ensurePropsObject(props.block).title" />
          </NFormItem>
          <NFormItem class="span-full" label="描述">
            <NInput
              v-model:value="editor.ensurePropsObject(props.block).description" type="textarea"
              :autosize="{ minRows: 2, maxRows: 6 }"
            />
          </NFormItem>
          <NFormItem class="span-full" label="赞助平台">
            <NFlex vertical style="width: 100%">
              <div
                v-for="(it, idx) in ensureArrayProp<any>(props.block, 'items')" :key="idx"
                style="display:flex; gap: 8px"
              >
                <NSelect
                  v-model:value="it.platform" style="width: 140px" :options="[
                    { label: 'afdian', value: 'afdian' },
                    { label: 'kofi', value: 'kofi' },
                    { label: 'patreon', value: 'patreon' },
                    { label: 'paypal', value: 'paypal' },
                    { label: 'other', value: 'other' },
                  ]"
                  to="body"
                  :consistent-menu-width="false"
                  :menu-props="{ style: { minWidth: '180px' } }"
                />
                <NInput v-model:value="it.url" placeholder="https://..." />
                <NInput v-model:value="it.label" placeholder="显示名，可选" />
                <NButton type="error" secondary @click="ensureArrayProp(props.block, 'items').splice(idx, 1)">
                  删除
                </NButton>
              </div>
              <NButton
                type="info" secondary
                @click="ensureArrayProp<any>(props.block, 'items').push({ platform: 'afdian', url: 'https://', label: '' })"
              >
                添加
              </NButton>
            </NFlex>
          </NFormItem>
        </PropsGrid>
      </NForm>
    </template>

    <template v-else-if="props.block.type === 'image'">
      <NForm label-placement="top" size="small">
        <PropsGrid>
          <NFormItem label="最大宽度">
            <NInput v-model:value="editor.ensurePropsObject(props.block).maxWidth" placeholder="例如 100% 或 480px" />
          </NFormItem>
          <NFormItem label="最大高度">
            <NInput v-model:value="editor.ensurePropsObject(props.block).maxHeight" placeholder="例如 100% 或 320px" />
          </NFormItem>
          <NFormItem label="形状">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).shape"
              :options="[
                { label: '圆角 - Rounded', value: 'rounded' },
                { label: '直角 - Square', value: 'square' },
                { label: '圆形 - Circle', value: 'circle' },
              ]"
            />
          </NFormItem>
          <NFormItem label="图片描述 (Alt)">
            <NInput v-model:value="editor.ensurePropsObject(props.block).alt" placeholder="图片加载失败时显示的文字" />
          </NFormItem>
          <NFormItem class="span-full" label="本地图片">
            <NFlex align="center">
              <NButton
                size="small" :loading="editor.isUploading.value"
                @click="editor.triggerUpload(props.block, 'imageFile')"
              >
                <template #icon>
                  <NIcon>
                    <ImageOutline />
                  </NIcon>
                </template>
                上传图片
              </NButton>
              <NButton
                size="small" secondary :disabled="!editor.ensurePropsObject(props.block).imageFile"
                @click="editor.clearUploadedFile(props.block, 'imageFile')"
              >
                清除
              </NButton>
              <img
                v-if="editor.ensurePropsObject(props.block).imageFile?.path"
                :src="editor.ensurePropsObject(props.block).imageFile.path" alt="" referrerpolicy="no-referrer"
                style="width: 36px; height: 36px; object-fit: cover; border-radius: 6px; border: 1px solid var(--n-border-color);"
              >
              <NText depth="3">
                {{ editor.ensurePropsObject(props.block).imageFile?.name || editor.ensurePropsObject(props.block).imageFile?.path || '' }}
              </NText>
            </NFlex>
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
          <NFormItem label="文字">
            <NInput v-model:value="editor.ensurePropsObject(props.block).text" />
          </NFormItem>
          <NFormItem label="文字位置">
            <NSelect
              v-model:value="editor.ensurePropsObject(props.block).titlePlacement" :options="[
                { label: '居左', value: 'left' },
                { label: '居中', value: 'center' },
                { label: '居右', value: 'right' },
              ]"
            />
          </NFormItem>
          <NFormItem label="上边距 px">
            <NInputNumber
              v-model:value="editor.ensurePropsObject(props.block).marginTop" :min="0" :max="80"
              style="width: 100%"
            />
          </NFormItem>
          <NFormItem label="下边距 px">
            <NInputNumber
              v-model:value="editor.ensurePropsObject(props.block).marginBottom" :min="0" :max="80"
              style="width: 100%"
            />
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
        <NFormItem label="文字">
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
