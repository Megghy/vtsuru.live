import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { KeepAlive, defineComponent, h, nextTick, ref } from 'vue'

vi.mock('vue-router', () => ({
  onBeforeRouteLeave: vi.fn(),
}))

import { useUnsavedChangesGuard } from '../useUnsavedChangesGuard'

describe('useUnsavedChangesGuard', () => {
  it('KeepAlive 失活时注销 beforeunload，重新激活后恢复监听', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const GuardView = defineComponent({
      name: 'GuardView',
      setup() {
        useUnsavedChangesGuard(ref(true))
        return () => h('div', 'guard')
      },
    })

    const OtherView = defineComponent({
      name: 'OtherView',
      setup() {
        return () => h('div', 'other')
      },
    })

    const showGuard = ref(true)
    const wrapper = mount({
      setup() {
        return () => h(KeepAlive, null, () => h(showGuard.value ? GuardView : OtherView))
      },
    })

    const countEvents = (spy: typeof addSpy) =>
      spy.mock.calls.filter(([eventName]) => eventName === 'beforeunload').length

    const initialAdds = countEvents(addSpy)
    expect(initialAdds).toBe(1)
    expect(countEvents(removeSpy)).toBe(0)

    showGuard.value = false
    await nextTick()
    expect(countEvents(removeSpy)).toBe(1)

    showGuard.value = true
    await nextTick()
    expect(countEvents(addSpy)).toBe(2)

    wrapper.unmount()
    expect(countEvents(removeSpy)).toBe(2)

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
