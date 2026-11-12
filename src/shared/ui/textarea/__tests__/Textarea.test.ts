import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import Textarea from '../Textarea.vue'

describe('Textarea', () => {
  it('暴露的 focus 落到原生 textarea', async () => {
    const wrapper = mount(Textarea)
    const focus = vi.spyOn(wrapper.get('textarea').element, 'focus')

    ;(wrapper.vm as { focus: () => void }).focus()

    expect(focus).toHaveBeenCalledOnce()
  })
})
