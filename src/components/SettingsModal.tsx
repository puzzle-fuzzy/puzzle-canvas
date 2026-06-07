import { useState, useEffect } from 'react'
import { Icon } from '@ricons/utils'
import { useAppIcon } from '../icons'
import { useUIStore } from '../stores/uiStore'
import { useAuthStore } from '../stores/authStore'
import { logout } from '../utils/auth'
import { useFocusTrap } from '../hooks/useFocusTrap'
import IconPanel from './IconPanel'
import AppearancePanel from './AppearancePanel'

interface SettingsModalProps {
  onClose: () => void
}

const sections = [
  { id: 'account', label: '账户' },
  { id: 'appearance', label: '外观' },
  { id: 'icons', label: '图标' },
] as const

type SectionId = (typeof sections)[number]['id']

function SettingsModal({ onClose }: SettingsModalProps) {
  const darkMode = useUIStore((s) => s.darkMode)
  const initialSection = useUIStore((s) => s.settingsSection)
  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const [activeSection, setActiveSection] = useState<SectionId>(
    (sections.some((s) => s.id === initialSection) ? initialSection : 'icons') as SectionId,
  )

  const trapRef = useFocusTrap(true)

  const DismissIcon = useAppIcon('dismiss')

  // Escape 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleLogout = () => {
    logout()
    onClose()
  }

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div
        ref={trapRef}
        className={`settings-modal ${darkMode ? 'dark' : 'light'}`}
        role="dialog"
        aria-modal="true"
        aria-label="设置"
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
            {activeSection === 'account' && (
              <AccountPanel
                darkMode={darkMode}
                user={user}
                isAuthenticated={isAuthenticated}
                onLogout={handleLogout}
              />
            )}
            {activeSection === 'appearance' && (
              <AppearancePanel darkMode={darkMode} />
            )}
            {activeSection === 'icons' && <IconPanel darkMode={darkMode} />}
          </div>
        </div>
      </div>
    </div>
  )
}

// ========== 账户面板 ==========

interface AccountPanelProps {
  darkMode: boolean
  user: ReturnType<typeof useAuthStore.getState>['user']
  isAuthenticated: boolean
  onLogout: () => void
}

function AccountPanel({ darkMode, user, isAuthenticated, onLogout }: AccountPanelProps) {
  const SignOutIcon = useAppIcon('signOut')

  if (!isAuthenticated || !user) {
    return (
      <div className={`account-panel ${darkMode ? 'dark' : 'light'}`}>
        <p className="account-panel-hint">当前未登录</p>
      </div>
    )
  }

  return (
    <div className={`account-panel ${darkMode ? 'dark' : 'light'}`}>
      {/* 头像 + 用户名 */}
      <div className="account-profile">
        <div className="account-avatar">
          {user.username.charAt(0).toUpperCase()}
        </div>
        <div className="account-info">
          <div className="account-username">{user.username}</div>
          <div className="account-email">{user.email}</div>
        </div>
        <span className="account-role-badge">{user.role === 'admin' ? '管理员' : '成员'}</span>
      </div>

      {/* 退出按钮 */}
      <button className="account-logout-btn" onClick={onLogout} type="button">
        <Icon size={16}><SignOutIcon /></Icon>
        退出登录
      </button>
    </div>
  )
}

export default SettingsModal
