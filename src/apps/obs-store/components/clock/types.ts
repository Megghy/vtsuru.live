export type ClockMode = 'clock' | 'countdown' | 'stopwatch'

export type ClockTheme =
  | 'casio' // 复古电子表 / 卡西欧 LCD
  | 'flip' // 拟物机械翻页钟
  | 'swiss' // 瑞士现代杂志版式
  | 'tactical' // 赛博战术 HUD 仪表
  | 'pill' // 灵动悬浮胶囊条
  | 'minimal' // 极简纯字无框
  | 'cute' // 萌系猫耳 / 治愈气泡
  | 'vintage' // 纯透连笔花体字 (Script / Cursive)
  | 'fresh' // 清新自然 / 日系微风
  | 'pixel' // 8-Bit 复古街机像素
  | 'dotmatrix' // 工业 LED 点阵屏
  | 'calculator' // 太阳能学生科学计算器
  | 'nixie' // 辉光管 / 命运石之门世界线变动率

export interface ClockState {
  mode: ClockMode
  theme: ClockTheme

  // 自定义颜色与外观控制
  accentColor: string // 强调色（指针/发光/高亮）
  textColor: string // 自定义文字色（空字符串表示遵循主题默认）
  bgColor: string // 自定义背景底色（空字符串表示遵循主题默认）
  bgOpacity: number // 背景不透明度 0 ~ 100

  // 文本内容
  title: string
  subtitle: string

  // 格式开关
  is24Hour: boolean
  showSeconds: boolean
  showMilliseconds: boolean
  showDate: boolean
  showDayOfWeek: boolean
  showProgress: boolean

  // 倒计时与计时器数据
  countdownDuration: number // 倒计时总秒数 (例如 300 = 5分钟)
  targetTimestamp: number // 绝对目标截止时间戳
  timerRunning: boolean // 计时器是否运行中
  timerStartTime: number // 启动时间戳
  timerElapsed: number // 已耗费毫秒数
  timerEndText: string // 倒计时归零文案
}

export type ClockAction =
  | { type: 'START_TIMER'; timestamp?: number }
  | { type: 'PAUSE_TIMER'; elapsed?: number }
  | { type: 'RESET_TIMER'; duration?: number }
  | { type: 'SET_COUNTDOWN'; seconds: number }
  | { type: 'QUICK_ADD_TIME'; seconds: number }

export const DEFAULT_CLOCK_STATE: ClockState = {
  mode: 'clock',
  theme: 'casio',
  accentColor: '#38bdf8',
  textColor: '',
  bgColor: '',
  bgOpacity: 90,
  title: '',
  subtitle: '',

  is24Hour: true,
  showSeconds: true,
  showMilliseconds: false,
  showDate: true,
  showDayOfWeek: true,
  showProgress: true,

  countdownDuration: 300,
  targetTimestamp: 0,
  timerRunning: false,
  timerStartTime: 0,
  timerElapsed: 0,
  timerEndText: 'LIVE NOW',
}

export interface ClockPresetOption {
  id: ClockTheme
  name: string
  archetype: string
  description: string
  tag: string
}

export const CLOCK_THEME_PRESETS: ClockPresetOption[] = [
  {
    id: 'casio',
    name: '复古电子表 (Casio)',
    archetype: 'Digital LCD Watch',
    description: '真实卡西欧液晶电子表结构：双层液晶屏、点阵星期框、7段数码管暗底发光与斜切防水表壳',
    tag: '经典 / 电子表',
  },
  {
    id: 'flip',
    name: '机械翻页钟 (Flip)',
    archetype: 'Split-Flap 3D',
    description: '拟物折叠翻牌时钟：每个时间数字均为独立物理卡片，带中央切割凹槽与复古工业质感',
    tag: '拟物 / 机械',
  },
  {
    id: 'swiss',
    name: '瑞士现代版式 (Swiss)',
    archetype: 'Editorial Grid',
    description: '严谨的平面设计杂志感：超大无衬线时间，通过细线与紧凑双行排版呈现日期与星期',
    tag: '极简 / 设计感',
  },
  {
    id: 'vintage',
    name: '纯透连笔花体 (Calligraphy)',
    archetype: 'Pure Script Cursive',
    description: '完全透明无背景、优雅流线的连笔花体手写字（Great Vibes），适合深夜电台、绘画与读书自习',
    tag: '文艺 / 花体字',
  },
  {
    id: 'dotmatrix',
    name: 'LED 点阵屏 (Dot Matrix)',
    archetype: 'Industrial Dot LED',
    description: '工业仪器与车站 LED 点阵发光显示屏：真实发光小圆点阵列、暗点矩阵底纹与工业金属外框',
    tag: '点阵 / 工业',
  },
  {
    id: 'calculator',
    name: '太阳能计算器 (Calculator)',
    archetype: 'Solar Scientific LCD',
    description: '便携科学计算器外壳：4格太阳能硅晶板、黄灰反射 LCD 液晶、DEG/M 指示符与 7 段倾斜数码管',
    tag: '复古 / 计算器',
  },
  {
    id: 'nixie',
    name: '真空辉光管 (Nixie)',
    archetype: 'Steampunk Divergence',
    description: '复古真空玻璃辉光管与命运石之门世界线风格：高透圆柱玻璃罩、阳极金属丝网、暖橙氖气放电灯丝与金属底座',
    tag: '复古 / 辉光管',
  },
  {
    id: 'tactical',
    name: '赛博战术 HUD (Tactical)',
    archetype: 'Cyber Interface',
    description: '科幻战术终端仪表：战术括号瞄准角标、微型动态扫描线、系统坐标码与科技发光',
    tag: '电竞 / 战术',
  },
  {
    id: 'pill',
    name: '灵动悬浮胶囊 (Pill)',
    archetype: 'Floating Island',
    description: '精致圆角胶囊挂件：开播呼吸状态灯、流式水平排版，极适合挂在摄像头边缘或画面顶栏',
    tag: '挂件 / 灵动',
  },
  {
    id: 'minimal',
    name: '纯字极简无框 (Minimal)',
    archetype: 'Pure Typo',
    description: '零边框、零背景色：纯粹等宽字体加细腻文字投影，无缝融入 OBS 任意复杂场景',
    tag: '纯净 / 透明',
  },
  {
    id: 'cute',
    name: '软萌猫耳气泡 (Cute)',
    archetype: 'Kawaii Pastel Neko',
    description: '治愈软萌猫耳轮廓、马卡龙奶油圆角气泡底、心形状态灯与手绘可爱字体',
    tag: '萌系 / 治愈',
  },
  {
    id: 'fresh',
    name: '清新日系微风 (Fresh)',
    archetype: 'Botanical Zen',
    description: '日系淡雅水绿微风、圆润轻盈字体、呼吸小叶片微动效与清新生活感',
    tag: '清新 / 日系',
  },
  {
    id: 'pixel',
    name: '8-Bit 像素街机 (Pixel)',
    archetype: 'Retro 8-Bit Arcade',
    description: '硬核 8-bit 像素描边与阶梯阴影、复古街机点阵字体、跳动像素红心生命值',
    tag: '复古 / 像素',
  },
]
