import { useState, useEffect } from 'react'
import { Icon } from '@ricons/utils'
import { useAppIcon } from '../icons'
import { useUIStore } from '../stores/uiStore'
import IconPanel from './IconPanel'

interface SettingsModalProps {
  onClose: () => void
}

const sections = [
  { id: 'icons', label: '图标' },
] as const

type SectionId = (typeof sections)[number]['id']

function SettingsModal({ onClose }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SectionId>('icons')
  const darkMode = useUIStore((s) => s.darkMode)
  const DismissIcon = useAppIcon('dismiss')

  // Escape 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div
        className={`settings-modal ${darkMode ? 'dark' : 'light'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左侧菜单 */}
        <div className="settings-sidebar">
          <div className="settings-sidebar-title">设置</div>
          {sections.map((s) => (
            <button
              key={s.id}
              className={`settings-sidebar-item ${activeSection === s.id ? 'active' : ''}`}
              onClick={() => setActiveSection(s.id)}
              type="button"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* 右侧内容 */}
        <div className="settings-content">
          <div className="settings-content-header">
            <span className="settings-content-title">
              {sections.find((s) => s.id === activeSection)?.label}
            </span>
            <button className="settings-close-btn" onClick={onClose} type="button">
              <Icon size={18}><DismissIcon /></Icon>
            </button>
          </div>
          <div className="settings-content-body">
            {activeSection === 'icons' && <IconPanel darkMode={darkMode} />}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
