/**
 * 开发期"测试程序"管理对话框
 *
 * 由 TopRightBar 上"+"按钮触发，仅 dev 模式可见（main.ts 用 import.meta.env.DEV 守门）。
 *
 * UI：
 * - 上半：表单（显示名 + URL + 添加 / 保存 按钮）。编辑时按钮变"保存"。
 * - 下半：已添加列表，每条带"编辑"和"删除"
 *
 * 数据：通过 testAppSource 单例增删改，AppRegistry 通过 subscribe 自动 refresh。
 *
 * @author MountCloud <mountcloud@outlook.com>
 */

import { createEl, removeEl } from '../helpers/dom'
import { testAppSource, type TestAppRecord } from '../apps/TestAppSource'

export class TestAppDialog {
  private static _instance: TestAppDialog | null = null
  static get instance(): TestAppDialog {
    if (!TestAppDialog._instance) TestAppDialog._instance = new TestAppDialog()
    return TestAppDialog._instance
  }

  private _root: HTMLElement | null = null
  private _nameInput: HTMLInputElement | null = null
  private _urlInput: HTMLInputElement | null = null
  private _submitBtn: HTMLButtonElement | null = null
  private _listEl: HTMLElement | null = null
  private _editingId: string | null = null

  open(): void {
    if (this._root) {
      // 已打开就抢焦点
      this._nameInput?.focus()
      return
    }
    this._mount()
  }

  close(): void {
    if (!this._root) return
    this._root.classList.remove('webos-test-app--shown')
    const root = this._root
    this._root = null
    setTimeout(() => removeEl(root), 200)
    this._nameInput = null
    this._urlInput = null
    this._submitBtn = null
    this._listEl = null
    this._editingId = null
  }

  private _mount(): void {
    const root = createEl('div', { className: 'webos-test-app-overlay' })
    const card = createEl('div', { className: 'webos-test-app-card' })

    // 头部
    const head = createEl('div', { className: 'webos-test-app-head' })
    head.appendChild(createEl('div', { className: 'webos-test-app-title', text: '测试程序' }))
    const subtitle = createEl('div', {
      className: 'webos-test-app-subtitle',
      text: '仅开发期可见（pnpm dev）。添加任意 URL 作为桌面图标，方便联调你的业务前端。',
    })
    head.appendChild(subtitle)
    const closeBtn = createEl('button', {
      className: 'webos-test-app-close',
      attrs: { type: 'button', 'aria-label': '关闭' },
      text: '×',
    })
    closeBtn.addEventListener('click', () => this.close())
    head.appendChild(closeBtn)
    card.appendChild(head)

    // 表单
    const form = createEl('div', { className: 'webos-test-app-form' })

    const nameRow = createEl('div', { className: 'webos-test-app-row' })
    nameRow.appendChild(createEl('label', { className: 'webos-test-app-label', text: '显示名' }))
    const nameInput = createEl('input', {
      className: 'webos-test-app-input',
      attrs: { type: 'text', placeholder: '测试程序' },
    })
    nameInput.value = '测试程序'
    nameRow.appendChild(nameInput)
    form.appendChild(nameRow)
    this._nameInput = nameInput

    const urlRow = createEl('div', { className: 'webos-test-app-row' })
    urlRow.appendChild(createEl('label', { className: 'webos-test-app-label', text: 'URL' }))
    const urlInput = createEl('input', {
      className: 'webos-test-app-input',
      attrs: { type: 'url', placeholder: 'http://localhost:5173/s/test/ 或任意可访问 URL' },
    })
    urlRow.appendChild(urlInput)
    form.appendChild(urlRow)
    this._urlInput = urlInput

    const actions = createEl('div', { className: 'webos-test-app-actions' })
    const submit = createEl('button', {
      className: 'webos-test-app-btn webos-test-app-btn--primary',
      attrs: { type: 'button' },
      text: '添加',
    })
    submit.addEventListener('click', () => this._handleSubmit())
    const cancelEditBtn = createEl('button', {
      className: 'webos-test-app-btn webos-test-app-btn--secondary',
      attrs: { type: 'button' },
      text: '取消编辑',
    })
    cancelEditBtn.style.display = 'none'
    cancelEditBtn.addEventListener('click', () => this._exitEditMode())
    actions.appendChild(cancelEditBtn)
    actions.appendChild(submit)
    form.appendChild(actions)
    card.appendChild(form)
    this._submitBtn = submit as HTMLButtonElement

    // Enter 触发提交
    const onKeydown = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') {
        e.preventDefault()
        this._handleSubmit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        this.close()
      }
    }
    nameInput.addEventListener('keydown', onKeydown)
    urlInput.addEventListener('keydown', onKeydown)

    // 列表
    const listWrap = createEl('div', { className: 'webos-test-app-list-wrap' })
    listWrap.appendChild(createEl('div', { className: 'webos-test-app-list-title', text: '已添加' }))
    const list = createEl('div', { className: 'webos-test-app-list' })
    listWrap.appendChild(list)
    card.appendChild(listWrap)
    this._listEl = list

    // 点遮罩关闭
    root.addEventListener('mousedown', (e) => {
      if (e.target === root) this.close()
    })

    root.appendChild(card)
    document.body.appendChild(root)
    this._root = root

    this._renderList()
    requestAnimationFrame(() => {
      root.classList.add('webos-test-app--shown')
      nameInput.select()
    })
  }

  // ===== 提交（添加 / 保存编辑） =====

  private _handleSubmit(): void {
    const name = this._nameInput?.value.trim() || ''
    const url = this._urlInput?.value.trim() || ''
    if (!url) {
      this._urlInput?.focus()
      return
    }
    if (this._editingId) {
      testAppSource.update(this._editingId, { name, url })
      this._exitEditMode()
    } else {
      testAppSource.add(name, url)
      // 添加成功 → 表单复位
      this._nameInput!.value = '测试程序'
      this._urlInput!.value = ''
      this._nameInput!.focus()
      this._nameInput!.select()
    }
    this._renderList()
  }

  // ===== 列表渲染 =====

  private _renderList(): void {
    if (!this._listEl) return
    this._listEl.innerHTML = ''
    const records = testAppSource.readRecords()
    if (records.length === 0) {
      this._listEl.appendChild(
        createEl('div', { className: 'webos-test-app-empty', text: '还没添加任何测试程序' }),
      )
      return
    }
    for (const r of records) {
      this._listEl.appendChild(this._renderRecordItem(r))
    }
  }

  private _renderRecordItem(r: TestAppRecord): HTMLElement {
    const item = createEl('div', { className: 'webos-test-app-item' })
    const info = createEl('div', { className: 'webos-test-app-info' })
    info.appendChild(createEl('div', { className: 'webos-test-app-name', text: r.name }))
    info.appendChild(createEl('div', { className: 'webos-test-app-url', text: r.url }))
    item.appendChild(info)

    const opts = createEl('div', { className: 'webos-test-app-opts' })
    const editBtn = createEl('button', {
      className: 'webos-test-app-link',
      attrs: { type: 'button' },
      text: '编辑',
    })
    editBtn.addEventListener('click', () => this._enterEditMode(r))
    opts.appendChild(editBtn)

    const delBtn = createEl('button', {
      className: 'webos-test-app-link webos-test-app-link--danger',
      attrs: { type: 'button' },
      text: '删除',
    })
    delBtn.addEventListener('click', () => {
      testAppSource.remove(r.id)
      // 如果删的正好是当前编辑项，退出编辑态
      if (this._editingId === r.id) this._exitEditMode()
      this._renderList()
    })
    opts.appendChild(delBtn)

    item.appendChild(opts)
    return item
  }

  // ===== 编辑态切换 =====

  private _enterEditMode(r: TestAppRecord): void {
    this._editingId = r.id
    if (this._nameInput) this._nameInput.value = r.name
    if (this._urlInput) this._urlInput.value = r.url
    if (this._submitBtn) this._submitBtn.textContent = '保存'
    const cancelBtn = this._submitBtn?.parentElement?.querySelector(
      '.webos-test-app-btn--secondary',
    ) as HTMLElement | null
    if (cancelBtn) cancelBtn.style.display = ''
    this._nameInput?.focus()
    this._nameInput?.select()
  }

  private _exitEditMode(): void {
    this._editingId = null
    if (this._nameInput) this._nameInput.value = '测试程序'
    if (this._urlInput) this._urlInput.value = ''
    if (this._submitBtn) this._submitBtn.textContent = '添加'
    const cancelBtn = this._submitBtn?.parentElement?.querySelector(
      '.webos-test-app-btn--secondary',
    ) as HTMLElement | null
    if (cancelBtn) cancelBtn.style.display = 'none'
  }
}
