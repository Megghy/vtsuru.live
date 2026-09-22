// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), isTauri: vi.fn(), getCurrentWindow: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke, isTauri: mocks.isTauri }))
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: mocks.getCurrentWindow }))

import { startHeartbeat, stopHeartbeat } from '../heartbeat'

describe('主窗口本地心跳', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mocks.invoke.mockResolvedValue(undefined)
    mocks.isTauri.mockReturnValue(true)
    mocks.getCurrentWindow.mockReturnValue({ label: 'main' })
  })

  afterEach(() => {
    stopHeartbeat()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.clearAllMocks()
  })

  it('启动时立即发送，重复启动只保留一个定时器', async () => {
    startHeartbeat()
    startHeartbeat()
    expect(mocks.invoke).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(6000)
    expect(mocks.invoke).toHaveBeenCalledTimes(4)
  })

  it('网页和辅助窗口不能替主窗口发送心跳', () => {
    mocks.isTauri.mockReturnValue(false)
    startHeartbeat()
    mocks.isTauri.mockReturnValue(true)
    mocks.getCurrentWindow.mockReturnValue({ label: 'danmaku-window' })
    startHeartbeat()
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('IPC 失败继续重试，成功后记录恢复', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    mocks.invoke.mockRejectedValueOnce(new Error('IPC unavailable'))
    startHeartbeat()
    await vi.advanceTimersByTimeAsync(2000)
    expect(mocks.invoke).toHaveBeenCalledTimes(2)
    expect(error).toHaveBeenCalledTimes(1)
    expect(info).toHaveBeenCalledWith('[心跳] 本地通信已恢复')
  })

  it('窗口恢复时立即发送，销毁后清理定时器和事件监听', async () => {
    startHeartbeat()
    window.dispatchEvent(new Event('focus'))
    expect(mocks.invoke).toHaveBeenCalledTimes(2)
    stopHeartbeat()
    window.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(4000)
    expect(mocks.invoke).toHaveBeenCalledTimes(2)
  })
})
