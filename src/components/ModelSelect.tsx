import { useState, useRef, useEffect } from 'react'
import { Icon } from '@ricons/utils'
import { useAppIcon } from '../icons'

interface ModelOption {
  value: string
  label: string
}

interface ModelSelectProps {
  options: ModelOption[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  darkMode: boolean
}

function ModelSelect({ options, value, onChange, disabled, darkMode }: ModelSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const ChevronDownIcon = useAppIcon('chevronDown')

  const selected = options.find((o) => o.value === value)

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div
      ref={containerRef}
      className={`model-select ${darkMode ? 'dark' : 'light'} ${open ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
    >
      <button
        className="model-select-trigger"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        type="button"
      >
        <span className="model-select-value">{selected?.label}</span>
        <span className={`model-select-chevron ${open ? 'rotated' : ''}`}>
          <Icon size={14}>
            <ChevronDownIcon />
          </Icon>
        </span>
      </button>

      {open && (
        <div className="model-select-dropdown">
          {options.map((opt) => (
            <button
              key={opt.value}
              className={`model-select-option ${opt.value === value ? 'active' : ''}`}
              onClick={() => {
                onChange(opt.value)
                setOpen(false)
              }}
              type="button"
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ModelSelect
