import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import CustomHtmlEditorModal from '../components/CustomHtmlEditorModal.vue'
import { UserPageEditorKey } from '../context'

vi.mock('@/shared/services/fileUpload', () => ({
  uploadFiles: vi.fn(),
  FileStore: { UserPage: 1 },
}))

vi.mock('../components/CustomHtmlCodeEditor.vue', () => ({
  default: {
    name: 'CustomHtmlCodeEditor',
    template: '<div class="mock-code-editor" />',
  },
}))

describe('CustomHtmlEditorModal setup and initial mount', () => {
  it('mounts without throwing ReferenceError when show is false initially', () => {
    const mockEditor = {
      message: {
        success: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
      },
      fileRefs: ref([]),
      currentProject: ref({
        version: 1,
        blocks: [],
      }),
    }

    expect(() => {
      mount(CustomHtmlEditorModal, {
        props: {
          show: false,
          block: {
            id: 'b1',
            type: 'customHtml',
            props: { html: '', css: '', assets: [] },
          },
        },
        global: {
          provide: {
            [UserPageEditorKey as symbol]: mockEditor,
          },
          stubs: {
            Dialog: { template: '<div><slot /></div>' },
            DialogContent: { template: '<div><slot /></div>' },
            DialogHeader: { template: '<div><slot /></div>' },
            DialogTitle: { template: '<div><slot /></div>' },
            DialogDescription: { template: '<div><slot /></div>' },
            DialogFooter: { template: '<div><slot /></div>' },
            Tabs: { template: '<div><slot /></div>' },
            TabsList: { template: '<div><slot /></div>' },
            TabsTrigger: { template: '<button><slot /></button>' },
            TooltipProvider: { template: '<div><slot /></div>' },
            Tooltip: { template: '<div><slot /></div>' },
            TooltipTrigger: { template: '<div><slot /></div>' },
            TooltipContent: { template: '<div><slot /></div>' },
            Button: { template: '<button><slot /></button>' },
            Input: { template: '<input />' },
            Textarea: { template: '<textarea />' },
            Tag: { template: '<span><slot /></span>' },
          },
        },
      })
    }).not.toThrow()
  })
})
