import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'

import { Button } from '@/shared/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { SimpleTooltip, TooltipProvider } from '@/shared/ui/tooltip'

function dispatchPrimaryClick(el: Element) {
  el.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
      ctrlKey: false,
    }),
  )
}

function getPopperWrapperStyle(contentTestId: string): string {
  const content = document.body.querySelector(`[data-testid="${contentTestId}"]`)
  const wrapper = content?.closest('[data-reka-popper-content-wrapper]') as HTMLElement | null
  return wrapper?.style.transform ?? ''
}

describe('SimpleTooltip composed with interactive triggers', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('reproduces off-screen unpositioned Popover when PopoverTrigger is nested inside SimpleTooltip', async () => {
    const Host = defineComponent({
      components: { TooltipProvider, Popover, PopoverTrigger, PopoverContent, SimpleTooltip, Button },
      template: `
        <TooltipProvider>
          <Popover>
            <SimpleTooltip content="提示文案">
              <PopoverTrigger as-child>
                <Button data-testid="btn">栏位</Button>
              </PopoverTrigger>
            </SimpleTooltip>
            <PopoverContent>
              <div data-testid="popover-body">面板内容</div>
            </PopoverContent>
          </Popover>
        </TooltipProvider>
      `,
    })
    const wrapper = mount(Host, { attachTo: document.body })
    await wrapper.get('[data-testid="btn"]').trigger('click')
    await nextTick()
    await new Promise((r) => setTimeout(r, 20))
    // PopoverTrigger inside SimpleTooltip registers its anchor to Tooltip's PopperRoot,
    // leaving PopoverContent permanently stuck off-screen at translate(0, -200%).
    expect(getPopperWrapperStyle('popover-body')).toBe('translate(0, -200%)')
    wrapper.unmount()
  })

  it('opens and positions Popover while preserving Tooltip when PopoverTrigger wraps SimpleTooltip in a span', async () => {
    const Host = defineComponent({
      components: { TooltipProvider, Popover, PopoverTrigger, PopoverContent, SimpleTooltip, Button },
      template: `
        <TooltipProvider :delay-duration="0">
          <Popover>
            <PopoverTrigger as-child>
              <span class="inline-flex">
                <SimpleTooltip content="提示文案">
                  <Button data-testid="btn">栏位</Button>
                </SimpleTooltip>
              </span>
            </PopoverTrigger>
            <PopoverContent>
              <div data-testid="popover-body">面板内容</div>
            </PopoverContent>
          </Popover>
        </TooltipProvider>
      `,
    })
    const wrapper = mount(Host, { attachTo: document.body })
    const btn = wrapper.get('[data-testid="btn"]')

    await btn.trigger('focus')
    await nextTick()
    expect(document.body.textContent).toContain('提示文案')

    await btn.trigger('click')
    await vi.waitFor(() => {
      expect(document.body.querySelector('[data-testid="popover-body"]')?.textContent).toContain('面板内容')
      expect(getPopperWrapperStyle('popover-body')).not.toBe('translate(0, -200%)')
    })
    wrapper.unmount()
  })

  it('opens and positions Popconfirm when trigger slot wraps SimpleTooltip in a span', async () => {
    const Host = defineComponent({
      components: { TooltipProvider, Popconfirm, SimpleTooltip, Button },
      template: `
        <TooltipProvider :delay-duration="0">
          <Popconfirm>
            <template #trigger>
              <span class="inline-flex">
                <SimpleTooltip content="删除">
                  <Button data-testid="del">删</Button>
                </SimpleTooltip>
              </span>
            </template>
            <span data-testid="confirm-body">确定删除？</span>
          </Popconfirm>
        </TooltipProvider>
      `,
    })
    const wrapper = mount(Host, { attachTo: document.body })
    await wrapper.get('[data-testid="del"]').trigger('click')
    await vi.waitFor(() => {
      expect(document.body.querySelector('[data-testid="confirm-body"]')?.textContent).toContain('确定删除？')
      expect(getPopperWrapperStyle('confirm-body')).not.toBe('translate(0, -200%)')
    })
    wrapper.unmount()
  })

  it('opens and positions DropdownMenu when DropdownMenuTrigger wraps SimpleTooltip in a span', async () => {
    const Host = defineComponent({
      components: { TooltipProvider, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, SimpleTooltip, Button },
      template: `
        <TooltipProvider :delay-duration="0">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <span class="inline-flex">
                <SimpleTooltip content="更多">
                  <Button data-testid="more">更多</Button>
                </SimpleTooltip>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem data-testid="menu-item">选项一</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      `,
    })
    const wrapper = mount(Host, { attachTo: document.body })
    dispatchPrimaryClick(wrapper.get('[data-testid="more"]').element)
    await vi.waitFor(() => {
      expect(document.body.querySelector('[data-testid="menu-item"]')?.textContent).toContain('选项一')
      expect(getPopperWrapperStyle('menu-item')).not.toBe('translate(0, -200%)')
    })
    wrapper.unmount()
  })
})
