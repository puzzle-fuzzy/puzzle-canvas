import { Icon } from '@ricons/utils'
import { useIconSet, type IconSet, type IconName } from '../icons'
import { fluentRegistry } from '../icons/fluent'
import { lucideRegistry } from '../icons/lucide'
import { antdRegistry } from '../icons/antd'

interface IconPanelProps {
  darkMode: boolean
}

const iconSets: { id: IconSet; name: string; description: string }[] = [
  { id: 'fluent', name: 'Fluent', description: 'Microsoft Fluent UI 风格，圆润柔和' },
  { id: 'lucide', name: 'Lucide', description: '简洁线条风格，轻量现代' },
  { id: 'antd', name: 'Ant Design', description: 'Ant Design 风格，方正专业' },
]

const previewIcons: IconName[] = ['hand', 'sparkle', 'image', 'globe', 'sun']

const registries: Record<IconSet, typeof fluentRegistry> = {
  fluent: fluentRegistry,
  lucide: lucideRegistry,
  antd: antdRegistry,
}

function IconPanel({ darkMode }: IconPanelProps) {
  const { iconSet, setIconSet } = useIconSet()

  return (
    <div className="icon-panel">
      <p className="icon-panel-desc">选择应用中使用的图标风格，切换后即时生效。</p>
      <div className="icon-set-list">
        {iconSets.map((set) => (
          <button
            key={set.id}
            className={`icon-set-card ${iconSet === set.id ? 'selected' : ''} ${darkMode ? 'dark' : 'light'}`}
            onClick={() => setIconSet(set.id)}
            type="button"
          >
            <div className="icon-set-card-header">
              <span className="icon-set-card-name">{set.name}</span>
              {iconSet === set.id && (
                <span className="icon-set-card-badge">使用中</span>
              )}
            </div>
            <p className="icon-set-card-desc">{set.description}</p>
            <div className="icon-set-card-preview">
              {previewIcons.map((name) => {
                const IconComp = registries[set.id][name]
                return (
                  <span key={name} className="icon-set-preview-item">
                    <Icon size={20}><IconComp /></Icon>
                  </span>
                )
              })}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default IconPanel
