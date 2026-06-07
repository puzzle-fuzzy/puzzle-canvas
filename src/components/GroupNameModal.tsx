import { useState, useEffect, useRef } from 'react'
import { useUIStore } from '../stores/uiStore'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface GroupNameModalProps {
  onSubmit: (name: string) => void
  onCancel: () => void
  initialValue?: string
}

/**
 * 小组命名弹窗
 *
 * 用于创建小组和重命名小组两个场景。
 * 遵循现有 modal 模式：fixed overlay + backdrop blur。
 */
function GroupNameModal({ onSubmit, onCancel, initialValue = '' }: GroupNameModalProps) {
  const darkMode = useUIStore((s) => s.darkMode)
  const [name, setName] = useState(initialValue)
  const trapRef = useFocusTrap(true)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (trimmed) onSubmit(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
  }

  return (
    <div className="ai-modal-overlay" onClick={onCancel}>
      <div
        ref={trapRef}
        className={`ai-modal ${darkMode ? 'dark' : 'light'}`}
        role="dialog"
        aria-modal="true"
        aria-label="设置小组"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '320px' }}
      >
        <div className="ai-modal-header">
          <span className="ai-modal-title">
            设置小组
          </span>
        </div>

        <input
          ref={inputRef}
          className="group-name-input"
          type="text"
          placeholder="输入小组名称..."
          aria-label="小组名称"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={50}
        />

        <div className="group-name-actions">
          <button
            className="group-name-cancel"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className="group-name-confirm"
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}

export default GroupNameModal
