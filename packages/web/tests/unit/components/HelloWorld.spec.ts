import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SendView from '@/views/SendView.vue'

describe('SendView', () => {
  it('renders upload zone', () => {
    const wrapper = mount(SendView)
    expect(wrapper.text()).toContain('File Share')
    expect(wrapper.text()).toContain('点击选择文件或拖拽到此处')
  })
})
