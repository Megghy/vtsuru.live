import { afterEach, beforeEach, vi } from 'vitest'

// 模拟 window.matchMedia
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // 模拟 ResizeObserver
  class MockResizeObserver {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  }
  window.ResizeObserver = window.ResizeObserver || (MockResizeObserver as unknown as typeof ResizeObserver)

  // 模拟 IntersectionObserver
  class MockIntersectionObserver {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  }
  window.IntersectionObserver =
    window.IntersectionObserver || (MockIntersectionObserver as unknown as typeof IntersectionObserver)

  // 模拟 scrollTo
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = vi.fn()
  }

  // 模拟 Gamepad API
  if (typeof navigator !== 'undefined' && !navigator.getGamepads) {
    navigator.getGamepads = () => []
  }
  // 模拟全局 UI 提示
  const mockMessage = {
    info: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    create: vi.fn(),
    destroyAll: vi.fn(),
  }
  window.$message = (window.$message || mockMessage) as typeof window.$message
  window.$dialog = (window.$dialog || {}) as typeof window.$dialog
  window.$notification = (window.$notification || {}) as typeof window.$notification
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})
