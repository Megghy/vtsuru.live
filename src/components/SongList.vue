<script setup lang="ts">
// [导入] 依赖项和类型
import { SongFrom, SongRequestOption, SongsInfo } from '@/api/api-models'; // API 数据模型
import { QueryGetAPI, QueryPostAPI } from '@/api/query'; // API 请求方法
import { SONG_API_URL } from '@/data/constants'; // API 地址常量
import { GetPlayButton } from '@/Utils'; // 公用方法：获取播放/信息按钮
import SongPlayer from './SongPlayer.vue'; // 子组件：歌曲播放器

// [导入] UI 组件和图标
import {
  Delete24Filled,
  Info24Filled,
  NotepadEdit20Filled,
  Play24Filled
} from '@vicons/fluent';
import { useLocalStorage, refDebounced } from '@vueuse/core'; // VueUse 工具函数
import { List } from 'linqts'; // LINQ for TypeScript
import {
  DataTableBaseColumn,
  DataTableColumns,
  DataTableRowKey,
  FormInst,
  FormRules,
  NButton,
  NCard,
  NCheckbox,
  NDataTable,
  NDivider,
  NEllipsis,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTooltip,
  NSwitch,
  useMessage, // Naive UI 组件
} from 'naive-ui';
import { VNodeChild, computed, h, onMounted, ref, watch } from 'vue'; // Vue 核心 API

// --- Props 定义 ---
const props = defineProps<{
  songs: SongsInfo[] // 歌曲列表数据
  canEdit?: boolean // 是否允许编辑（通常用于区分查看模式和管理模式）
  isSelf: boolean // 是否为用户自己的歌单（控制编辑/删除权限）
  extraButton?: (song: SongsInfo) => VNodeChild[] // 允许外部传入额外的操作按钮函数
}>()

// --- 响应式状态 ---
const message = useMessage() // Naive UI 消息提示
const volume = useLocalStorage('Settings.AplayerVolume', 0.8) // 播放器音量，持久化存储
const showListenButton = useLocalStorage('SongList.ShowListenButton', true) // 是否显示试听按钮
const showLinkButton = useLocalStorage('SongList.ShowLinkButton', true) // 是否显示跳转按钮
const songsInternal = ref<SongsInfo[]>([]) // 内部维护的歌曲列表，避免直接修改 props
const playingSong = ref<SongsInfo>() // 当前正在试听的歌曲
const isLrcLoading = ref<string>() // 歌词加载状态（存储歌曲 key）
const isLoading = ref(false) // 通用加载状态 (用于 API 请求)
const pageSize = ref(25) // 每页大小

// --- 搜索与筛选状态 ---
const searchMusicKeyword = ref('') // 歌曲名称搜索关键词
const debouncedInput = refDebounced(searchMusicKeyword, 500) // 防抖处理的搜索关键词
const selectedLanguageFilter = ref<string[]>([]) // 顶部语言筛选器选中值
const selectedTagFilter = ref<string[]>([])      // 顶部标签筛选器选中值
const selectedAuthorFilter = ref<string | null>(null) // 顶部作者筛选器选中值 (直接控制列筛选)

// --- 弹窗状态 ---
const showModal = ref(false) // 单个歌曲编辑弹窗显示状态
const showBatchModal = ref(false) // 批量编辑弹窗显示状态
const updateSongModel = ref<SongsInfo>({} as SongsInfo) // 单个歌曲编辑表单数据模型
const formRef = ref<FormInst | null>(null) // 单个歌曲编辑表单实例引用

// --- 批量编辑状态 ---
const batchUpdate_Author = ref<string[]>([]) // 批量编辑 - 作者
const batchUpdate_Tag = ref<string[]>([]) // 批量编辑 - 标签
const batchUpdate_Language = ref<string[]>([]) // 批量编辑 - 语言
const batchUpdate_Option = ref<SongRequestOption | undefined>() // 批量编辑 - 点歌选项

// --- 表格状态 ---
const columns = ref<DataTableColumns<SongsInfo>>() // 表格列定义
const selectedColumn = ref<DataTableRowKey[]>([]) // 表格选中行的 Key 数组

// 分页相关
const currentPage = ref(1) // 当前页码
const handlePageChange = (page: number) => {
  currentPage.value = page
}

// 暴露分页方法
const nextPage = () => {
  const pagination = songsComputed.value.length > 0 ? Math.ceil(songsComputed.value.length / pageSize.value) : 1
  if (currentPage.value < pagination) {
    currentPage.value++
  }
}

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

// 暴露给父组件
defineExpose({
  nextPage,
  prevPage,
  currentPage
})

// --- 计算属性 ---

// 新增：计算是否需要显示试听开关
const canShowListenSwitch = computed(() => {
  const audioRegex = /\.(mp3|flac|ogg|wav|m4a)$/i;
  return songsInternal.value.some(song => song.url && audioRegex.test(song.url));
});

// 新增：计算是否需要显示链接开关
const canShowLinkSwitch = computed(() => {
  const linkSources = [SongFrom.Netease, SongFrom.FiveSing, SongFrom.Kugou]; // Corrected sources
  return songsInternal.value.some(song => song.url || (song.from != null && linkSources.includes(song.from))); // Check url OR valid from source
});

// 计算操作列的预定义宽度
const actionColumnWidth = computed(() => {
  const baseSelfWidth = 80; // 基础宽度 (isSelf=true, 编辑+删除)
  const basePublicWidth = 40; // 基础宽度 (isSelf=false)
  const listenButtonWidth = 40;
  const linkButtonWidth = 50;
  const extraButtonWidth = 40; // 假设的额外按钮宽度

  let width = props.isSelf ? baseSelfWidth : basePublicWidth;

  if (showListenButton.value && canShowListenSwitch.value) {
    width += listenButtonWidth;
  }
  if (showLinkButton.value && canShowLinkSwitch.value) {
    width += linkButtonWidth;
  }
  if (props.extraButton) {
    width += extraButtonWidth;
  }

  // 返回一个合理的宽度值，例如，可以设定几个档位
  // 这里用之前的计算逻辑，但可以替换为固定档位如 80, 120, 160, 200, 240
  // 为了精确，我们还是用计算值，但它是响应式的
  return width;
});

// 筛选后的歌曲列表
const songsComputed = computed(() => {
  let filteredSongs = songsInternal.value;

  // 1. 搜索框筛选 (曲名或翻译名，防抖)
  const searchTerm = debouncedInput.value?.trim().toLowerCase();
  if (searchTerm) {
    filteredSongs = filteredSongs.filter((s) =>
      s.name.toLowerCase().includes(searchTerm) ||
      s.translateName?.toLowerCase().includes(searchTerm) // 同时搜索翻译名称
    );
  }

  // 2. 顶部语言筛选
  if (selectedLanguageFilter.value.length > 0) {
    filteredSongs = filteredSongs.filter((s) =>
      s.language?.some(lang => selectedLanguageFilter.value.includes(lang))
    );
  }

  // 3. 顶部标签筛选
  if (selectedTagFilter.value.length > 0) {
    filteredSongs = filteredSongs.filter((s) =>
      s.tags?.some(tag => selectedTagFilter.value.includes(tag))
    );
  }

  // 注意: 作者筛选主要通过列筛选器实现 (由 selectedAuthorFilter 控制)
  // 如果需要整合到这里，需要额外逻辑

  return filteredSongs;
});


// 语言下拉选项 (包含预设和歌曲数据中存在的)
const languageSelectOption = computed(() => {
  const languages = new Set<string>([ // 预设一些常用语言
    '中文', '日语', '英语', '韩语', '法语', '西语', '其他'
  ])
  songsInternal.value.forEach((s) => {
    s.language?.forEach((l) => languages.add(l))
  })
  return [...languages].sort().map((t) => ({ // 排序增加用户体验
    label: t,
    value: t,
  }))
})

// 标签下拉选项 (从歌曲数据中动态生成)
const tagsSelectOption = computed(() => {
  return new List(songsInternal.value)
    .SelectMany((s) => new List(s?.tags ?? [])) // 使用 ?? [] 避免 undefined
    .Distinct()
    .OrderBy(tag => tag) // 排序
    .ToArray()
    .map((t) => ({
      label: t,
      value: t,
    }))
})

// 作者下拉选项 (从歌曲数据中动态生成)
const authorsOptions = computed(() => {
  return new List(songsInternal.value)
    .SelectMany((s) => new List(s?.author ?? [])) // 使用 ?? [] 避免 undefined
    .Distinct()
    .OrderBy(author => author) // 排序
    .ToArray()
    .map((t) => ({
      label: t,
      value: t,
    }))
})

// 作者列定义 (包含筛选逻辑)
const authorColumn = ref<DataTableBaseColumn<SongsInfo>>({
  title: '作者',
  key: 'author', // key 应该对应数据字段，虽然这里是数组，但用于标识
  width: 200,
  resizable: true,
  // 列筛选函数：检查行的作者数组是否包含筛选值
  filter(value, row) {
    return row.author?.includes(value.toString()) ?? false;
  },
  // 列筛选选项：使用计算属性动态生成
  filterOptions: authorsOptions.value, // 初始值
  // 列筛选值：受顶部的 selectedAuthorFilter 控制
  filterOptionValue: selectedAuthorFilter.value,
  render(data) {
    // 渲染作者按钮，点击时更新列筛选状态
    return h(NSpace, { size: 5 }, () =>
      data.author?.map((a) => // 使用 ?. 防止 author 为空
        h(NButton, { size: 'tiny', type: 'info', secondary: true, onClick: () => onAuthorClick(a) }, () => a),
      ) ?? null // 如果 author 为空则不渲染
    )
  },
})

// 点击作者按钮的处理函数：更新列筛选值
const onAuthorClick = (author: string) => {
  if (authorColumn.value.filterOptionValue === author) {
    // 如果当前筛选值就是点击的作者，则清除筛选
    authorColumn.value.filterOptionValue = null;
    selectedAuthorFilter.value = null; // 同步更新顶部筛选状态
  } else {
    // 否则，设置筛选值为点击的作者
    authorColumn.value.filterOptionValue = author;
    selectedAuthorFilter.value = author; // 同步更新顶部筛选状态
  }
}

// 监听顶部作者筛选器变化，更新列筛选状态
watch(selectedAuthorFilter, (newVal) => {
  authorColumn.value.filterOptionValue = newVal;
});

// 创建表格列配置的函数
function createColumns(): DataTableColumns<SongsInfo> {
  // 更新作者列的筛选选项和当前筛选值 (确保响应性)
  authorColumn.value.filterOptions = authorsOptions.value
  authorColumn.value.filterOptionValue = selectedAuthorFilter.value

  return [
    {
      type: 'selection', // 复选框列
      disabled: () => !props.isSelf, // 只有自己的歌单才允许选择 (用于批量操作)
    },
    {
      key: 'name', // 对应 SongsInfo 的 name 字段
      title: '曲名',
      resizable: true,
      minWidth: 150, // 增加最小宽度
      width: 300,
      sorter: 'default', // 启用默认排序
      render(data) {
        // 同时显示原名和翻译名 (如果存在)
        return h(NSpace, { vertical: true, size: 0, wrap: false }, () => [
          h(NText, { style: { color: data.options?.scMinPrice ? '#c36767' : '' } }, () => data.name), // SC 歌曲标红
          data.translateName ? h(NText, { depth: '3', style: { fontSize: '12px' } }, () => data.translateName) : null, // 显示翻译名
        ])
      },
    },
    authorColumn.value, // 作者列 (已包含筛选)
    {
      title: '语言',
      key: 'language',
      width: 150,
      resizable: true,
      // 列筛选选项 (使用预设 + 动态生成)
      filterOptions: languageSelectOption.value,
      // 列筛选函数
      filter(value, row) {
        return row.language?.includes(value.toString()) ?? false;
      },
      render(data) {
        // 使用 NTag 显示语言
        return data.language?.length // 使用 ?.length 检查
          ? h(NSpace, { size: 5 }, () =>
            data.language?.map((a) => h(NTag, { bordered: false, size: 'small' }, () => a)),
          )
          : null
      },
    },
    {
      title: '描述',
      key: 'description',
      minWidth: 100, // 增加最小宽度
      resizable: true,
      ellipsis: { // 使用 Naive UI 的省略配置
        tooltip: true // 鼠标悬浮显示完整内容
      }
      // render(data) { // 使用 ellipsis 配置后，不再需要手动渲染 NEllipsis
      //   return h(NEllipsis, { tooltip: { placement: 'top'} }, () => data.description)
      // },
    },
    {
      title: '点歌要求', // 标题修改，更清晰
      key: 'options',
      width: 180, // 调整宽度
      resizable: true,
      render(data) {
        // 渲染点歌要求的标签
        const tags: VNodeChild[] = []
        if (!data.options) return null; // 没有选项直接返回

        if (data.options.needJianzhang) {
          tags.push(h(NTag, { color: { textColor: 'white', color: GetGuardColor(3), borderColor: 'white' }, size: 'small' }, () => '舰长'))
        }
        if (data.options.needTidu) {
          tags.push(h(NTag, { color: { textColor: 'white', color: GetGuardColor(2), borderColor: 'white' }, size: 'small' }, () => '提督'))
        }
        if (data.options.needZongdu) {
          tags.push(h(NTag, { color: { textColor: 'white', color: GetGuardColor(1), borderColor: 'white' }, size: 'small' }, () => '总督'))
        }
        if (data.options.scMinPrice) {
          tags.push(h(NTag, { color: { textColor: 'white', color: GetSCColor(data.options.scMinPrice), borderColor: 'white' }, size: 'small' }, () => `SC ≥ ${data.options?.scMinPrice}`)) // 优化显示
        }
        if (data.options.fanMedalMinLevel) {
          tags.push(h(NTag, { type: 'info', size: 'small' }, () => `粉丝牌 ≥ ${data.options?.fanMedalMinLevel}`)) // 优化显示
        }
        return tags.length > 0 ? h(NSpace, { size: 5 }, () => tags) : null;
      },
    },
    {
      title: '标签',
      key: 'tags',
      minWidth: 100,
      resizable: true,
      // 列筛选选项
      filterOptions: tagsSelectOption.value,
      // 列筛选函数
      filter(value, row) {
        return row.tags?.includes(value.toString()) ?? false;
      },
      render(data) {
        // 使用 NTag 显示标签
        return data.tags?.length
          ? h(NSpace, { size: 5 }, () => data.tags?.map((a) => h(NTag, { bordered: false, size: 'small' }, () => a)))
          : null
      },
    },
    {
      title: '操作',
      key: 'manage',
      fixed: 'right', // 固定操作列在右侧
      render(data) {
        const buttons: VNodeChild[] = [];

        // 1. 获取播放/信息按钮 (来自 Utils)
        if (showLinkButton.value) { // 添加条件
          const playButton = GetPlayButton(data);
          if (playButton) buttons.push(playButton);
        }

        // 2. 试听按钮 (仅对音频文件显示)
        const isAudio = /\.(mp3|flac|ogg|wav|m4a)$/i.test(data.url ?? ''); // 正则判断音频后缀
        if (showListenButton.value && isAudio) { // 添加条件
          buttons.push(
            h(NTooltip, null, {
              trigger: () =>
                h(
                  NButton,
                  {
                    type: 'primary',
                    size: 'small',
                    circle: true,
                    loading: isLrcLoading.value === data.key, // 绑定加载状态
                    onClick: () => { playingSong.value = data }, // 点击播放
                  },
                  { icon: () => h(NIcon, { component: Play24Filled }) }
                ),
              default: () => '试听',
            })
          );
        }

        // 3. 编辑和删除按钮 (仅自己的歌单显示)
        if (props.isSelf) {
          buttons.push(
            h(NTooltip, null, {
              trigger: () =>
                h(
                  NButton,
                  {
                    size: 'small',
                    circle: true,
                    secondary: true, // 次要按钮样式
                    onClick: () => {
                      // 深拷贝防止修改影响原数据
                      updateSongModel.value = JSON.parse(JSON.stringify(data));
                      showModal.value = true; // 打开编辑弹窗
                    },
                  },
                  { icon: () => h(NIcon, { component: NotepadEdit20Filled }) }
                ),
              default: () => '修改',
            })
          );
          buttons.push(
            h(NTooltip, null, {
              trigger: () =>
                h( // 使用 NPopconfirm 包裹删除按钮
                  NPopconfirm,
                  { onPositiveClick: () => delSong(data) }, // 确认删除时调用 delSong
                  {
                    trigger: () =>
                      h(
                        NButton,
                        { type: 'error', size: 'small', circle: true },
                        { icon: () => h(NIcon, { component: Delete24Filled }) }
                      ),
                    default: () => `确认删除歌曲《${data.name}》？`, // 确认提示语
                  }
                ),
              default: () => '删除',
            })
          );
        }

        // 4. 额外的按钮 (通过 props 传入)
        if (props.extraButton) {
          buttons.push(...props.extraButton(data));
        }

        // 使用 NSpace 渲染所有按钮
        return h(NSpace, { justify: 'end', size: 8, wrap: false }, () => buttons); // 增加间距，禁止换行
      },
      width: actionColumnWidth.value, // 使用计算属性
    },
  ]
}

// --- 表单验证规则 ---
const updateSongRules: FormRules = {
  name: [{ required: true, message: '请输入歌曲名称', trigger: ['input', 'blur'] }], // 增加 blur 触发
  // password 规则似乎未使用，注释掉
  // password: [{ required: true, message: '请输入密码' }],
}

// --- 方法 ---

// 监听 props.songs 变化，更新内部列表和列定义
watch(
  () => props.songs,
  (newV) => {
    console.log('Props songs updated, refreshing internal list and columns.'); // 调试信息
    songsInternal.value = [...newV]; // 使用扩展运算符创建新数组，确保响应性
    // 重新生成列定义 (确保筛选选项等是最新的)
    // 使用 nextTick 替代 setTimeout，确保 DOM 更新后再操作
    // nextTick(() => {
    //   columns.value = createColumns();
    // });
    // 实测 watch 触发时直接更新列定义即可，NaiveUI 会处理
    columns.value = createColumns();
  },
  { deep: true } // 深度监听，如果 songs 数组内部对象变化也触发
)

// 监听按钮显示状态变化，重新计算列定义以更新宽度
watch([showListenButton, showLinkButton], () => {
  console.log('Button visibility changed, recalculating columns.');
  columns.value = createColumns();
});

// 更新单首歌曲信息
async function updateSong() {
  try {
    await formRef.value?.validate(); // 触发表单验证
    // 检查是否存在同名歌曲 (排除当前正在编辑的歌曲)
    if (songsInternal.value.some(s => s.name === updateSongModel.value.name && s.key !== updateSongModel.value.key)) {
      message.error('已存在相同名称的歌曲');
      return;
    }
    isLoading.value = true; // 开始加载
    const { code, data, message: errMsg } = await QueryPostAPI<SongsInfo>(SONG_API_URL + 'update', {
      key: updateSongModel.value.key,
      song: updateSongModel.value,
    });
    if (code === 200 && data) {
      const index = songsInternal.value.findIndex((s) => s.key === data.key);
      if (index !== -1) {
        songsInternal.value.splice(index, 1, data); // 更新内部列表数据
      }
      message.success('已更新歌曲信息');
      showModal.value = false; // 关闭弹窗
    } else {
      message.error(`未能更新歌曲信息: ${errMsg || '未知错误'}`);
    }
  } catch (errors) {
    // 表单验证失败
    console.error('Form validation failed:', errors);
    message.warning('请检查表单填写是否正确');
  } finally {
    isLoading.value = false; // 结束加载
  }
}

// 删除单首歌曲
async function delSong(song: SongsInfo) {
  isLoading.value = true; // 开始加载 (虽然删除很快，但保持一致性)
  try {
    const { code, message: errMsg } = await QueryGetAPI<SongsInfo>(SONG_API_URL + 'del', { key: song.key });
    if (code === 200) {
      // 从内部列表中移除
      songsInternal.value = songsInternal.value.filter((s) => s.key !== song.key);
      message.success(`已删除歌曲《${song.name}》`);
      // 如果删除的是正在播放的歌曲，停止播放
      if (playingSong.value?.key === song.key) {
        playingSong.value = undefined;
      }
      // 如果删除的是选中的歌曲，也从选中列表中移除
      selectedColumn.value = selectedColumn.value.filter(key => key !== song.key);
    } else {
      message.error(`未能删除歌曲: ${errMsg || '未知错误'}`);
    }
  } catch (error: any) {
    message.error(`删除歌曲时出错: ${error.message || error}`);
  } finally {
    isLoading.value = false; // 结束加载
  }
}

// 批量删除歌曲
async function delBatchSong() {
  if (selectedColumn.value.length === 0) {
    message.warning('请先选择要删除的歌曲');
    return;
  }
  const ids = selectedColumn.value.map((s) => s.toString());
  isLoading.value = true;
  try {
    const { code, message: errMsg } = await QueryPostAPI<SongsInfo>(SONG_API_URL + 'del-batch', ids);
    if (code === 200) {
      songsInternal.value = songsInternal.value.filter((s) => !ids.includes(s.key));
      message.success(`已删除 ${ids.length} 首歌曲`);
      showBatchModal.value = false; // 关闭批量编辑弹窗
      selectedColumn.value = []; // 清空选择
      // 如果删除的歌曲包含正在播放的歌曲，停止播放
      if (playingSong.value && ids.includes(playingSong.value.key)) {
          playingSong.value = undefined;
      }
    } else {
      message.error(`未能批量删除歌曲: ${errMsg || '未知错误'}`);
    }
  } catch (error: any) {
    message.error(`批量删除歌曲时出错: ${error.message || error}`);
  } finally {
    isLoading.value = false;
  }
}

// --- 批量更新函数 (通用逻辑提取) ---
async function executeBatchUpdate<T>(
    endpoint: string,
    payload: { ids: string[]; data: T },
    updateField: keyof SongsInfo,
    successMessage: string
) {
  if (selectedColumn.value.length === 0) {
    message.warning('请先选择要更新的歌曲');
    return false; // 返回 false 表示未执行
  }
  isLoading.value = true;
  try {
    const { code, message: errMsg } = await QueryPostAPI<SongsInfo[]>(`${SONG_API_URL}${endpoint}`, payload);
    if (code === 200) {
      message.success(successMessage);
      // 更新本地数据
      songsInternal.value.forEach((song, index) => {
        if (payload.ids.includes(song.key)) {
          // 直接修改会破坏响应性，需要创建新对象或使用 Vue.set (或直接修改 ref 的 value)
          // songsInternal.value[index][updateField] = payload.data; // 这种方式可能不触发视图更新
          const updatedSong = { ...songsInternal.value[index], [updateField]: payload.data };
          songsInternal.value.splice(index, 1, updatedSong);
        }
      });
      // 可能需要清空批量编辑表单的值
      return true; // 返回 true 表示成功
    } else {
      message.error(`未能更新歌曲: ${errMsg || '未知错误'}`);
      return false;
    }
  } catch (err: any) {
    message.error(`未能更新歌曲: ${err.message || err}`);
    return false;
  } finally {
    isLoading.value = false;
  }
}

// 批量更新作者
async function batchUpdateAuthor() {
  const success = await executeBatchUpdate(
    'update-batch-author',
    { ids: selectedColumn.value.map(String), data: batchUpdate_Author.value },
    'author',
    `已为 ${selectedColumn.value.length} 首歌曲更新作者`
  );
  if (success) batchUpdate_Author.value = []; // 成功后清空输入
}

// 批量更新标签
async function batchUpdateTag() {
  const success = await executeBatchUpdate(
    'update-batch-tag',
    { ids: selectedColumn.value.map(String), data: batchUpdate_Tag.value },
    'tags',
    `已为 ${selectedColumn.value.length} 首歌曲更新标签`
  );
  if (success) batchUpdate_Tag.value = []; // 成功后清空输入
}

// 批量更新语言
async function batchUpdateLanguage() {
  const success = await executeBatchUpdate(
    'update-batch-language',
    { ids: selectedColumn.value.map(String), data: batchUpdate_Language.value },
    'language',
    `已为 ${selectedColumn.value.length} 首歌曲更新语言`
  );
  if (success) batchUpdate_Language.value = []; // 成功后清空输入
}

// 批量更新点歌选项
async function batchUpdateOption() {
  const success = await executeBatchUpdate(
    'update-batch-option',
    { ids: selectedColumn.value.map(String), data: batchUpdate_Option.value ?? null }, // 如果为 undefined 发送 null
    'options',
    `已为 ${selectedColumn.value.length} 首歌曲更新点歌选项`
  );
   if (success) batchUpdate_Option.value = undefined; // 成功后清空输入
}

// --- 辅助函数 ---

// 根据 SC 价格获取颜色
function GetSCColor(price: number): string {
  if (price <= 0) return `#2a60b2`; // 默认蓝色 (或根据实际需要调整)
  if (price < 30) return `#2a60b2`; // 蓝色
  if (price < 50) return `#2a60b2`; // 蓝色 (合并)
  if (price < 100) return `#427d9e`; // 青色
  if (price < 500) return `#c99801`; // 黄色
  if (price < 1000) return `#e09443`; // 橙色
  if (price < 2000) return `#e54d4d`; // 红色
  return `#ab1a32`; // 深红色 (>= 2000)
}

// 根据大航海等级获取颜色
function GetGuardColor(level: number | null | undefined): string {
  switch (level) {
    case 1: return 'rgb(122, 4, 35)'; // 总督
    case 2: return 'rgb(157, 155, 255)'; // 提督
    case 3: return 'rgb(104, 136, 241)'; // 舰长
    default: return ''; // 默认或无效值
  }
}

// --- 生命周期钩子 ---
onMounted(() => {
  //console.log('Component mounted, initializing...'); // 调试信息
  songsInternal.value = [...props.songs]; // 初始化时复制 props 数据
  // 初始加载列定义
  columns.value = createColumns();
});

</script>

<template>
  <!-- 顶部筛选区域 -->
  <NCard
    embedded
    size="small"
    :bordered="false"
    style="margin-bottom: 10px;"
  >
    <NSpace
      align="center"
      wrap
      item-style="margin-bottom: 5px;"
    >
      <!-- 歌曲名搜索 -->
      <NInput
        v-model:value="searchMusicKeyword"
        placeholder="搜索曲名/译名"
        size="small"
        clearable
        style="min-width: 150px; flex-grow: 1;"
      />
      <!-- 作者筛选 (控制列筛选) -->
      <NSelect
        v-model:value="selectedAuthorFilter"
        placeholder="筛选歌手"
        :options="authorsOptions"
        clearable
        filterable
        size="small"
        style="min-width: 150px; flex-grow: 1;"
      />
      <!-- 语言筛选 (控制 computed 属性) -->
      <NSelect
        v-model:value="selectedLanguageFilter"
        placeholder="筛选语言"
        :options="languageSelectOption"
        multiple
        clearable
        filterable
        size="small"
        style="min-width: 180px; flex-grow: 1;"
        max-tag-count="responsive"
      />
      <!-- 标签筛选 (控制 computed 属性) -->
      <NSelect
        v-model:value="selectedTagFilter"
        placeholder="筛选标签"
        :options="tagsSelectOption"
        multiple
        clearable
        filterable
        size="small"
        style="min-width: 180px; flex-grow: 1;"
        max-tag-count="responsive"
      />
      <!-- 显示控制开关 -->
      <NSpace
        item-style="display: flex; align-items: center;"
        size="small"
      >
        <template v-if="canShowListenSwitch">
          <NSwitch
            v-model:value="showListenButton"
            size="small"
          />
          <NText style="font-size: 12px;">
            试听
          </NText>
        </template>
        <template v-if="canShowLinkSwitch">
          <NSwitch
            v-model:value="showLinkButton"
            size="small"
          />
          <NText style="font-size: 12px;">
            链接
          </NText>
        </template>
      </NSpace>
    </NSpace>
  </NCard>

  <!-- 歌曲数量与批量编辑按钮 -->
  <NSpace
    justify="space-between"
    align="center"
    style="margin-bottom: 5px;"
  >
    <NText depth="3">
      共 {{ songsComputed.length }} / {{ songsInternal.length }} 首
    </NText>
    <!-- 批量编辑按钮 (仅自己的歌单且选中超过1项时显示) -->
    <NButton
      v-if="isSelf"
      :disabled="selectedColumn.length === 0"
      type="primary"
      size="small"
      ghost
      @click="showBatchModal = true"
    >
      批量操作 ({{ selectedColumn.length }})
    </NButton>
  </NSpace>
  <!-- <NDivider style="margin-top: 5px; margin-bottom: 10px;" /> -->

  <!-- 试听播放器区域 -->
  <Transition name="fade">
    <div
      v-if="playingSong"
      style="margin-bottom: 15px;"
    >
      <SongPlayer
        v-model:is-lrc-loading="isLrcLoading"
        :song="playingSong"
        :volume="volume"
        @update:volume="newVol => volume = newVol"
        @close="playingSong = undefined"
      />
      <!-- <NDivider style="margin: 15px 0 0 0;" /> -->
    </div>
  </Transition>

  <!-- 歌曲数据表格 -->
  <NDataTable
    v-model:checked-row-keys="selectedColumn"
    :columns="columns"
    :data="songsComputed"
    size="small"
    :scroll-x="800"
    :pagination="{
      itemCount: songsInternal.length,
      defaultPageSize: pageSize,
      pageSizes: [10, 25, 50, 100, 200],
      showSizePicker: true,
      showQuickJumper: true,
      page: currentPage,
      onUpdatePage: handlePageChange
    }"
    :loading="isLoading && songsComputed.length === 0"
    striped
  />

  <!-- 单个歌曲编辑弹窗 -->
  <NModal
    v-model:show="showModal"
    preset="card"
    style="max-width: 600px;"
    :title="`修改歌曲信息 - ${updateSongModel.name}`"
    :mask-closable="false"
    :closable="true"
  >
    <NForm
      ref="formRef"
      :rules="updateSongRules"
      :model="updateSongModel"
      label-placement="left"
      label-width="auto"
      require-mark-placement="right-hanging"
    >
      <!-- 名称 -->
      <NFormItem
        path="name"
        label="名称"
      >
        <NInput
          v-model:value="updateSongModel.name"
          placeholder="歌曲名称"
          clearable
        />
      </NFormItem>
      <!-- 作者 -->
      <NFormItem
        path="author"
        label="作者"
      >
        <NSelect
          v-model:value="updateSongModel.author"
          :options="authorsOptions"
          placeholder="选择或输入新作者，按回车确认"
          filterable
          multiple
          tag
          clearable
        />
      </NFormItem>
      <!-- 备注 -->
      <NFormItem
        path="description"
        label="备注"
      >
        <NInput
          v-model:value="updateSongModel.description"
          type="textarea"
          placeholder="可选，如歌曲来源、特殊说明等"
          :maxlength="250"
          show-count
          clearable
          autosize
          style="min-width: 300px;"
        />
      </NFormItem>
      <!-- 语言 -->
      <NFormItem
        path="language"
        label="语言"
      >
        <NSelect
          v-model:value="updateSongModel.language"
          :options="languageSelectOption"
          placeholder="选择或输入新语言，按回车确认"
          filterable
          multiple
          tag
          clearable
        />
      </NFormItem>
      <!-- 标签 -->
      <NFormItem
        path="tags"
        label="标签"
      >
        <NSelect
          v-model:value="updateSongModel.tags"
          :options="tagsSelectOption"
          placeholder="选择或输入新标签，按回车确认"
          filterable
          multiple
          tag
          clearable
        />
      </NFormItem>
      <!-- 点歌设置 -->
      <NFormItem path="options">
        <template #label>
          点歌要求
          <NTooltip trigger="hover">
            <template #trigger>
              <NIcon
                :component="Info24Filled"
                style="margin-left: 4px; vertical-align: middle; cursor: help;"
              />
            </template>
            启用后将覆盖全局点歌设置，用于单独设置歌曲要求。不启用则遵循全局设置。
          </NTooltip>
        </template>
        <NSpace vertical>
          <!-- 启用开关 -->
          <NCheckbox
            :checked="updateSongModel.options != null"
            @update:checked="(checked: boolean) => {
              updateSongModel.options = checked ? {
                needJianzhang: false,
                needTidu: false,
                needZongdu: false,
                scMinPrice: undefined,
                fanMedalMinLevel: undefined,
              } : undefined; // 使用 undefined 表示禁用
            }"
          >
            启用独立要求
          </NCheckbox>
          <!-- 详细设置 -->
          <template v-if="updateSongModel.options != null">
            <NSpace>
              <NCheckbox v-model:checked="updateSongModel.options!.needJianzhang">
                舰长
              </NCheckbox>
              <NCheckbox v-model:checked="updateSongModel.options!.needTidu">
                提督
              </NCheckbox>
              <NCheckbox v-model:checked="updateSongModel.options!.needZongdu">
                总督
              </NCheckbox>
            </NSpace>
            <NSpace align="center">
              <NCheckbox
                :checked="updateSongModel.options!.scMinPrice != null"
                @update:checked="(checked: boolean) => updateSongModel.options!.scMinPrice = checked ? 30 : undefined"
              >
                SC点歌
              </NCheckbox>
              <NInputGroup
                v-if="updateSongModel.options!.scMinPrice != null"
                style="width: auto;"
              >
                <NInputGroupLabel size="small">
                  最低
                </NInputGroupLabel>
                <NInputNumber
                  v-model:value="updateSongModel.options!.scMinPrice"
                  :min="1"
                  size="small"
                  style="width: 80px;"
                />
                <NInputGroupLabel size="small">
                  元
                </NInputGroupLabel>
              </NInputGroup>
            </NSpace>
            <NSpace align="center">
              <NCheckbox
                :checked="updateSongModel.options?.fanMedalMinLevel != null"
                @update:checked="(checked: boolean) => {
                  if (updateSongModel.options) {
                    updateSongModel.options.fanMedalMinLevel = checked ? 1 : undefined;
                  }
                }"
              >
                粉丝牌
                <NTooltip trigger="hover">
                  <template #trigger>
                    <NIcon
                      :component="Info24Filled"
                      style="margin-left: 4px; vertical-align: middle; cursor: help;"
                    />
                  </template>
                  启用此项会覆盖全局粉丝牌等级要求。
                </NTooltip>
              </NCheckbox>
              <NInputGroup
                v-if="updateSongModel.options?.fanMedalMinLevel != null"
                style="width: auto;"
              >
                <NInputGroupLabel size="small">
                  最低
                </NInputGroupLabel>
                <NInputNumber
                  v-model:value="updateSongModel.options.fanMedalMinLevel"
                  :min="1"
                  size="small"
                  style="width: 80px;"
                />
                <NInputGroupLabel size="small">
                  级
                </NInputGroupLabel>
              </NInputGroup>
            </NSpace>
          </template>
        </NSpace>
      </NFormItem>
      <!-- 链接 -->
      <NFormItem
        path="url"
        label="链接"
      >
        <NInput
          v-model:value="updateSongModel.url"
          placeholder="可选, 音频链接(mp3/wav/ogg/m4a/flac)可试听"
          clearable
          :disabled="updateSongModel.from !== SongFrom.Custom"
        />
        <NTooltip
          v-if="updateSongModel.from !== SongFrom.Custom"
          trigger="hover"
        >
          <template #trigger>
            <NIcon
              :component="Info24Filled"
              style="margin-left: 8px; cursor: help;"
            />
          </template>
          非自定义来源的歌曲链接通常无法修改。
        </NTooltip>
      </NFormItem>
    </NForm>
    <!-- 底部按钮 -->
    <template #footer>
      <NSpace justify="end">
        <NButton @click="showModal = false">
          取消
        </NButton>
        <NButton
          type="primary"
          :loading="isLoading"
          @click="updateSong"
        >
          确认更新
        </NButton>
      </NSpace>
    </template>
  </NModal>

  <!-- 批量编辑弹窗 -->
  <NModal
    v-model:show="showBatchModal"
    preset="card"
    :title="`批量操作 | 已选择: ${selectedColumn.length} 首`"
    style="max-width: 600px;"
    :mask-closable="false"
  >
    <NTabs
      type="line"
      animated
    >
      <!-- 批量删除 -->
      <NTabPane
        name="delete"
        tab="删除"
      >
        <NText>确定要删除选中的 {{ selectedColumn.length }} 首歌曲吗？此操作不可恢复。</NText>
        <NDivider />
        <NPopconfirm
          :show-icon="false"
          @positive-click="delBatchSong"
        >
          <template #trigger>
            <NButton
              type="error"
              :loading="isLoading"
              :disabled="selectedColumn.length === 0"
            >
              执行删除
            </NButton>
          </template>
          确认执行批量删除操作？
        </NPopconfirm>
      </NTabPane>
      <!-- 批量修改作者 -->
      <NTabPane
        name="author"
        tab="作者"
      >
        <NSelect
          v-model:value="batchUpdate_Author"
          :options="authorsOptions"
          placeholder="选择或输入新作者（将覆盖原有作者）"
          filterable
          multiple
          tag
          clearable
        />
        <NDivider />
        <NButton
          type="primary"
          :loading="isLoading"
          :disabled="selectedColumn.length === 0"
          @click="batchUpdateAuthor"
        >
          更新选中歌曲作者
        </NButton>
      </NTabPane>
      <!-- 批量修改标签 -->
      <NTabPane
        name="tag"
        tab="标签"
      >
        <NSelect
          v-model:value="batchUpdate_Tag"
          :options="tagsSelectOption"
          placeholder="选择或输入新标签（将覆盖原有标签）"
          filterable
          multiple
          tag
          clearable
        />
        <NDivider />
        <NButton
          type="primary"
          :loading="isLoading"
          :disabled="selectedColumn.length === 0"
          @click="batchUpdateTag"
        >
          更新选中歌曲标签
        </NButton>
      </NTabPane>
      <!-- 批量修改语言 -->
      <NTabPane
        name="language"
        tab="语言"
      >
        <NSelect
          v-model:value="batchUpdate_Language"
          :options="languageSelectOption"
          placeholder="选择或输入新语言（将覆盖原有语言）"
          filterable
          multiple
          tag
          clearable
        />
        <NDivider />
        <NButton
          type="primary"
          :loading="isLoading"
          :disabled="selectedColumn.length === 0"
          @click="batchUpdateLanguage"
        >
          更新选中歌曲语言
        </NButton>
      </NTabPane>
      <!-- 批量修改点歌选项 -->
      <NTabPane
        name="option"
        tab="点歌要求"
      >
        <NSpace vertical>
          <NCheckbox
            :checked="batchUpdate_Option != null"
            @update:checked="(checked: boolean) => {
              batchUpdate_Option = checked ? {
                needJianzhang: false,
                needTidu: false,
                needZongdu: false,
                scMinPrice: undefined,
                fanMedalMinLevel: undefined,
              } : undefined;
            }"
          >
            启用/禁用独立要求 (将覆盖原有设置)
          </NCheckbox>
          <template v-if="batchUpdate_Option != null">
            <NSpace>
              <NCheckbox v-model:checked="batchUpdate_Option!.needJianzhang">
                舰长
              </NCheckbox>
              <NCheckbox v-model:checked="batchUpdate_Option!.needTidu">
                提督
              </NCheckbox>
              <NCheckbox v-model:checked="batchUpdate_Option!.needZongdu">
                总督
              </NCheckbox>
            </NSpace>
            <NSpace align="center">
              <NCheckbox
                :checked="batchUpdate_Option!.scMinPrice != null"
                @update:checked="(checked: boolean) => batchUpdate_Option!.scMinPrice = checked ? 30 : undefined"
              >
                SC点歌
              </NCheckbox>
              <NInputGroup
                v-if="batchUpdate_Option!.scMinPrice != null"
                style="width: auto;"
              >
                <NInputGroupLabel size="small">
                  最低
                </NInputGroupLabel>
                <NInputNumber
                  v-model:value="batchUpdate_Option!.scMinPrice"
                  :min="1"
                  size="small"
                  style="width: 80px;"
                />
                <NInputGroupLabel size="small">
                  元
                </NInputGroupLabel>
              </NInputGroup>
            </NSpace>
            <NSpace align="center">
              <NCheckbox
                :checked="batchUpdate_Option!.fanMedalMinLevel != null"
                @update:checked="(checked: boolean) => batchUpdate_Option!.fanMedalMinLevel = checked ? 1 : undefined"
              >
                粉丝牌
              </NCheckbox>
              <NInputGroup
                v-if="batchUpdate_Option!.fanMedalMinLevel != null"
                style="width: auto;"
              >
                <NInputGroupLabel size="small">
                  最低
                </NInputGroupLabel>
                <NInputNumber
                  v-model:value="batchUpdate_Option!.fanMedalMinLevel"
                  :min="1"
                  size="small"
                  style="width: 80px;"
                />
                <NInputGroupLabel size="small">
                  级
                </NInputGroupLabel>
              </NInputGroup>
            </NSpace>
          </template>
        </NSpace>
        <NDivider />
        <NButton
          type="primary"
          :loading="isLoading"
          :disabled="selectedColumn.length === 0"
          @click="batchUpdateOption"
        >
          更新选中歌曲要求
        </NButton>
      </NTabPane>
    </NTabs>
  </NModal>
</template>

<style scoped>
/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 优化 NDataTable 高度适应 */
/* :deep(.n-data-table .n-data-table-base-table) { */
  /* display: flex; */
  /* flex-direction: column; */
/* } */
/* :deep(.n-data-table .n-data-table-base-table-body) { */
  /* flex: 1; */
/* } */

/* Naive UI 默认样式可能已足够，若需要强制滚动条可取消注释 */
/* :deep(.n-data-table-wrapper) {
    overflow: auto;
} */

/* 移除NCard默认边框，如果全局设置了 */
.n-card {
  border: none !important;
}
</style>

<style>
/* 全局样式 (如果需要影响 GetPlayButton 内部的 SVG) */
.netease path:nth-child(2) {
  fill: #c20c0c; /* 网易云红色 */
}

.fivesing path:first-child { /* 调整选择器以匹配 GetPlayButton 生成的 SVG 结构 */
  fill: #00bbb3; /* 5sing 绿色 */
}
.bilibili path {
    fill: #00a1d6; /* B站蓝色 */
}
/* 可以为其他来源添加类似样式 */
</style>