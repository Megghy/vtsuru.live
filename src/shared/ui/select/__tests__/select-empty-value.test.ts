import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../index'

describe('Select with empty string value', () => {
  it('should render and select item with empty string value without crashing', async () => {
    const TestComponent = {
      components: { Select, SelectContent, SelectItem, SelectTrigger, SelectValue },
      setup() {
        const val = ref('')
        return { val }
      },
      template: `
        <Select v-model="val">
          <SelectTrigger>
            <SelectValue placeholder="请选择" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">全部</SelectItem>
            <SelectItem value="a">A</SelectItem>
          </SelectContent>
        </Select>
      `,
    }

    const wrapper = mount(TestComponent)
    expect(wrapper.exists()).toBe(true)
    expect((wrapper.vm as any).val).toBe('')

    await nextTick()
    expect(wrapper.html()).toContain('全部')

    // 更新 modelValue 为 'a'
    ;(wrapper.vm as any).val = 'a'
    await nextTick()
    expect(wrapper.html()).toContain('A')

    // 切回 ''
    ;(wrapper.vm as any).val = ''
    await nextTick()
    expect(wrapper.html()).toContain('全部')
  })
})
