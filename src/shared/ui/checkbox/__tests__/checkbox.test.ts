import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import Checkbox from '@/shared/ui/checkbox/Checkbox.vue'
import Switch from '@/shared/ui/switch/Switch.vue'

describe('Checkbox and Switch compatibility', () => {
  it('supports v-model with boolean value on Checkbox', async () => {
    const checked = ref(false)
    const wrapper = mount({
      components: { Checkbox },
      setup() {
        return { checked }
      },
      template: '<Checkbox v-model="checked" />',
    })

    const button = wrapper.find('button')
    await button.trigger('click')
    expect(checked.value).toBe(true)

    await button.trigger('click')
    expect(checked.value).toBe(false)
  })

  it('supports v-model:checked with boolean value on Checkbox', async () => {
    const checked = ref(false)
    const wrapper = mount({
      components: { Checkbox },
      setup() {
        return { checked }
      },
      template: '<Checkbox v-model:checked="checked" />',
    })

    const button = wrapper.find('button')
    await button.trigger('click')
    expect(checked.value).toBe(true)

    await button.trigger('click')
    expect(checked.value).toBe(false)
  })

  it('supports :checked and @update:checked on Checkbox', async () => {
    const checked = ref(false)
    let emitted = false
    const wrapper = mount({
      components: { Checkbox },
      setup() {
        return {
          checked,
          onChange: (val: boolean) => {
            emitted = true
            checked.value = val
          },
        }
      },
      template: '<Checkbox :checked="checked" @update:checked="onChange" />',
    })

    const button = wrapper.find('button')
    await button.trigger('click')
    expect(emitted).toBe(true)
    expect(checked.value).toBe(true)
  })

  it('supports v-model with boolean value on Switch', async () => {
    const active = ref(false)
    const wrapper = mount({
      components: { Switch },
      setup() {
        return { active }
      },
      template: '<Switch v-model="active" />',
    })

    const button = wrapper.find('button')
    await button.trigger('click')
    expect(active.value).toBe(true)

    await button.trigger('click')
    expect(active.value).toBe(false)
  })

  it('supports v-model:checked on Switch', async () => {
    const active = ref(false)
    const wrapper = mount({
      components: { Switch },
      setup() {
        return { active }
      },
      template: '<Switch v-model:checked="active" />',
    })

    const button = wrapper.find('button')
    await button.trigger('click')
    expect(active.value).toBe(true)

    await button.trigger('click')
    expect(active.value).toBe(false)
  })

  it('supports :checked and @update:checked on Switch', async () => {
    const active = ref(false)
    let emitted = false
    const wrapper = mount({
      components: { Switch },
      setup() {
        return {
          active,
          onChange: (val: boolean) => {
            emitted = true
            active.value = val
          },
        }
      },
      template: '<Switch :checked="active" @update:checked="onChange" />',
    })

    const button = wrapper.find('button')
    await button.trigger('click')
    expect(emitted).toBe(true)
    expect(active.value).toBe(true)
  })
})
