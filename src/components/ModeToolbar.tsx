import { Icon } from '@ricons/utils'
import { useAppIcon } from '../icons'
import { useCanvasStore } from '../stores/canvasStore'
import { useUIStore } from '../stores/uiStore'
import { useAuthStore } from '../stores/authStore'
import { useInputStore } from '../stores/inputStore'

function ModeToolbar() {
  const interactionMode = useCanvasStore((s) => s.interactionMode)
  const setInteractionMode = useCanvasStore((s) => s.setInteractionMode)
  const darkMode = useUIStore((s) => s.darkMode)
  const toggleDarkMode = useUIStore((s) => s.toggleDarkMode)
  const setShowAIModal = useUIStore((s) => s.setShowAIModal)
  const setShowSettingsModal = useUIStore((s) => s.setShowSettingsModal)
  const setShowLoginModal = useUIStore((s) => s.setShowLoginModal)
  const setSettingsSection = useUIStore((s) => s.setSettingsSection)
  const spaceHeld = useInputStore((s) => s.spaceHeld)

  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const HandIcon = useAppIcon('hand')
  const CursorIcon = useAppIcon('cursor')
  const SparkleIcon = useAppIcon('sparkle')
  const SunIcon = useAppIcon('sun')
  const MoonIcon = useAppIcon('moon')
  const SettingsIcon = useAppIcon('settings')
  const UserIcon = useAppIcon('user')

  const handleUserClick = () => {
    if (isAuthenticated) {
      setSettingsSection('account')
      setShowSettingsModal(true)
    } else {
      setShowLoginModal(true)
    }
  }

  return (
    <div className={`mode-toolbar ${darkMode ? 'dark' : 'light'}`}>
      <button
        className={`mode-toolbar-btn ${!isAuthenticated ? 'active' : ''}`}
        onClick={handleUserClick}
        title={isAuthenticated ? `${user?.username} · 账户设置` : '登录 / 注册'}
      >
        {isAuthenticated
          ? <span style={{ fontSize: '14px', fontWeight: 600 }}>{user?.username?.charAt(0).toUpperCase()}</span>
          : <Icon size={20}><UserIcon /></Icon>
        }
      </button>
      <div className="mode-toolbar-divider" />
      <button
        className={`mode-toolbar-btn ${interactionMode === 'pan' && !spaceHeld ? 'active' : ''}`}
        onClick={() => setInteractionMode('pan')}
        title="拖拽模式（Space 切换）"
      >
        <Icon size={20}><HandIcon /></Icon>
      </button>
      <button
        className={`mode-toolbar-btn ${interactionMode === 'select' || spaceHeld ? 'active' : ''}`}
        onClick={() => setInteractionMode('select')}
        title="选择模式（Space 切换）"
      >
        <Icon size={20}><CursorIcon /></Icon>
      </button>
      <div className="mode-toolbar-divider" />
      <button
        className="mode-toolbar-btn"
        onClick={() => setShowAIModal(true)}
        title="AI 生图"
      >
        <Icon size={20}><SparkleIcon /></Icon>
      </button>
      <div className="mode-toolbar-divider" />
      <button
        className="mode-toolbar-btn"
        onClick={() => toggleDarkMode()}
        title={darkMode ? '切换到日间模式' : '切换到夜间模式'}
      >
        {darkMode ? <Icon size={20}><SunIcon /></Icon> : <Icon size={20}><MoonIcon /></Icon>}
      </button>
      <div className="mode-toolbar-divider" />
      <button
        className="mode-toolbar-btn"
        onClick={() => setShowSettingsModal(true)}
        title="设置"
      >
        <Icon size={20}><SettingsIcon /></Icon>
      </button>
    </div>
  )
}

export default ModeToolbar
