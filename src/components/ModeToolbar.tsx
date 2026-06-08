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
  const setShowImportModal = useUIStore((s) => s.setShowImportModal)
  const iconSize = useUIStore((s) => s.toolbarIconSize)
  const spaceHeld = useInputStore((s) => s.spaceHeld)

  const user = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const HandIcon = useAppIcon('hand')
  const CursorIcon = useAppIcon('cursor')
  const SparkleIcon = useAppIcon('sparkle')
  const SunIcon = useAppIcon('sun')
  const MoonIcon = useAppIcon('moon')
  const SettingsIcon = useAppIcon('settings')
  const ImportIcon = useAppIcon('arrowDownload')

  return (
    <div className={`mode-toolbar ${darkMode ? 'dark' : 'light'}`}>
      <div
        className={`mode-toolbar-avatar ${isAuthenticated ? '' : 'placeholder'}`}
        title={isAuthenticated ? user?.username ?? '' : ''}
      >
        {isAuthenticated
          ? <span style={{ fontSize: '14px', fontWeight: 600 }}>{user?.username?.charAt(0).toUpperCase()}</span>
          : <span style={{ fontSize: '11px', fontWeight: 500 }}>?</span>
        }
      </div>
      <div className="mode-toolbar-divider" />
      <button
        className={`mode-toolbar-btn ${interactionMode === 'pan' && !spaceHeld ? 'active' : ''}`}
        onClick={() => setInteractionMode('pan')}
        title="拖拽模式（Space 切换）"
      >
        <Icon size={iconSize}><HandIcon /></Icon>
      </button>
      <button
        className={`mode-toolbar-btn ${interactionMode === 'select' || spaceHeld ? 'active' : ''}`}
        onClick={() => setInteractionMode('select')}
        title="选择模式（Space 切换）"
      >
        <Icon size={iconSize}><CursorIcon /></Icon>
      </button>
      <div className="mode-toolbar-divider" />
      <button
        className="mode-toolbar-btn"
        onClick={() => setShowAIModal(true)}
        title="AI 生图"
      >
        <Icon size={iconSize}><SparkleIcon /></Icon>
      </button>
      <div className="mode-toolbar-divider" />
      <button
        className="mode-toolbar-btn"
        onClick={() => toggleDarkMode()}
        title={darkMode ? '切换到日间模式' : '切换到夜间模式'}
      >
        {darkMode ? <Icon size={iconSize}><SunIcon /></Icon> : <Icon size={iconSize}><MoonIcon /></Icon>}
      </button>
      <div className="mode-toolbar-divider" />
      <button
        className="mode-toolbar-btn"
        onClick={() => setShowImportModal(true)}
        title="导入节点"
      >
        <Icon size={iconSize}><ImportIcon /></Icon>
      </button>
      <div className="mode-toolbar-divider" />
      <button
        className="mode-toolbar-btn"
        onClick={() => setShowSettingsModal(true)}
        title="设置"
      >
        <Icon size={iconSize}><SettingsIcon /></Icon>
      </button>
    </div>
  )
}

export default ModeToolbar
