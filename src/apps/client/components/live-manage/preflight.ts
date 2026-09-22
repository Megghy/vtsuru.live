export type CheckStatus = 'success' | 'error' | 'warning' | 'info'
export type CheckTarget = 'fetcher' | 'control' | 'obs' | 'account'
export interface PreflightCheck {
  id: string
  title: string
  status: CheckStatus
  detail: string
  target: CheckTarget
}
export interface PreflightState {
  cookieValid: boolean
  roomId: number
  areaId: number
  title: string
  hasStreamKey: boolean
  fetcherEnabled: boolean
  fetcherConnected: boolean
  danmakuConnected: boolean
  obsEnabled: boolean
  obsConnected: boolean
  obsStreamReady: boolean | undefined
  autoSwitch: boolean
  startScene: string | undefined
  scenes: string[] | undefined
}

function basicChecks(s: PreflightState): PreflightCheck[] {
  return [
    {
      id: 'login',
      title: 'B 站登录',
      status: s.cookieValid ? 'success' : 'error',
      detail: s.cookieValid ? '登录验证通过' : '登录尚未通过验证，请到连接与凭据重新登录或检查网络',
      target: 'fetcher',
    },
    {
      id: 'room',
      title: '直播间',
      status: s.roomId > 0 ? 'success' : 'error',
      detail: s.roomId > 0 ? `直播间 ${s.roomId}` : '账号尚未绑定直播间，请到网页面板完成绑定',
      target: 'account',
    },
    {
      id: 'area',
      title: '直播分区',
      status: s.areaId > 0 ? 'success' : 'error',
      detail: s.areaId > 0 ? '已选择直播分区' : '请选择本次直播分区',
      target: 'control',
    },
    {
      id: 'title',
      title: '直播标题',
      status: s.title.trim() ? 'success' : 'warning',
      detail: s.title.trim() || '尚未填写或读取到直播标题',
      target: 'control',
    },
    {
      id: 'key',
      title: '推流信息',
      status: 'info',
      detail: s.hasStreamKey ? '已有本地推流信息；开播后请确认使用本场推流码' : '开播成功后会获取推流地址与推流码',
      target: 'control',
    },
  ]
}

function fetcherChecks(s: PreflightState): PreflightCheck[] {
  if (s.fetcherEnabled)
    return [
      {
        id: 'fetcher',
        title: '采集服务',
        status: s.fetcherConnected ? 'success' : 'warning',
        detail: s.fetcherConnected ? '采集服务已连接' : '采集服务未连接，事件无法上传',
        target: 'fetcher',
      },
      {
        id: 'danmaku',
        title: '弹幕连接',
        status: s.danmakuConnected ? 'success' : 'warning',
        detail: s.danmakuConnected ? '弹幕源已连接' : '弹幕源未连接，依赖弹幕的互动功能暂不可用',
        target: 'fetcher',
      },
    ]
  return [{ id: 'fetcher', title: '事件采集', status: 'info', detail: '未启用，跳过连接检查', target: 'fetcher' }]
}

function obsChecks(s: PreflightState): PreflightCheck[] {
  const checks: PreflightCheck[] = []
  if (!s.obsEnabled) {
    checks.push({
      id: 'obs',
      title: 'OBS 联动',
      status: 'info',
      detail: '未启用连接，使用外部推流软件时可忽略',
      target: 'obs',
    })
    return checks
  }
  checks.push({
    id: 'obs',
    title: 'OBS 连接',
    status: s.obsConnected ? 'success' : 'warning',
    detail: s.obsConnected ? 'WebSocket 已连接' : 'OBS 未连接，推流与场景联动暂不可用',
    target: 'obs',
  })
  if (!s.obsConnected) return checks
  checks.push({
    id: 'obs-stream',
    title: 'OBS 推流设置',
    status: s.obsStreamReady === undefined ? 'info' : s.obsStreamReady ? 'success' : 'warning',
    detail:
      s.obsStreamReady === undefined
        ? '待读取，请刷新检查'
        : s.obsStreamReady
          ? '服务器与推流码已填写；未验证平台接收情况'
          : 'OBS 尚未填写完整的服务器与推流码',
    target: 'obs',
  })
  if (s.autoSwitch)
    checks.push({
      id: 'scene',
      title: '开播场景',
      status: !s.startScene
        ? 'warning'
        : s.scenes === undefined
          ? 'info'
          : s.scenes.includes(s.startScene)
            ? 'success'
            : 'warning',
      detail: !s.startScene
        ? '已启用自动切换，请选择开播场景'
        : s.scenes === undefined
          ? '场景列表待读取，请刷新检查'
          : s.scenes.includes(s.startScene)
            ? `开播时切换到「${s.startScene}」`
            : `OBS 中找不到「${s.startScene}」，请重新选择`,
      target: 'obs',
    })
  return checks
}

export function buildPreflightChecks(s: PreflightState): PreflightCheck[] {
  return [...basicChecks(s), ...fetcherChecks(s), ...obsChecks(s)]
}
