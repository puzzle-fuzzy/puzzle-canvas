import { createContext, useContext, useState, useCallback, type ComponentType } from 'react'
import { fluentRegistry } from './fluent'
import { lucideRegistry } from './lucide'
import { antdRegistry } from './antd'

export type IconName =
  | 'board'
  | 'download'
  | 'delete'
  | 'hand'
  | 'cursor'
  | 'sparkle'
  | 'dismiss'
  | 'spinner'
  | 'sun'
  | 'moon'
  | 'chevronDown'
  | 'documentText'
  | 'documentCode'
  | 'folderZip'
  | 'video'
  | 'image'
  | 'globe'
  | 'settings'

export type IconSet = 'fluent' | 'lucide' | 'antd'
export type IconRegistry = Record<IconName, ComponentType>

const registries: Record<IconSet, IconRegistry> = {
  fluent: fluentRegistry,
  lucide: lucideRegistry,
  antd: antdRegistry,
}

interface IconContextValue {
  iconSet: IconSet
  setIconSet: (set: IconSet) => void
  getIcon: (name: IconName) => ComponentType
}

const IconContext = createContext<IconContextValue | null>(null)

const STORAGE_KEY = 'iconSet'
const DEFAULT_SET: IconSet = 'fluent'

export function IconProvider({ children }: { children: React.ReactNode }) {
  const [iconSet, setIconSetState] = useState<IconSet>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && saved in registries) return saved as IconSet
    return DEFAULT_SET
  })

  const setIconSet = useCallback((set: IconSet) => {
    setIconSetState(set)
    localStorage.setItem(STORAGE_KEY, set)
  }, [])

  const getIcon = useCallback(
    (name: IconName) => registries[iconSet][name],
    [iconSet],
  )

  return (
    <IconContext.Provider value={{ iconSet, setIconSet, getIcon }}>
      {children}
    </IconContext.Provider>
  )
}

export function useIconSet() {
  const ctx = useContext(IconContext)
  if (!ctx) throw new Error('useIconSet must be used within IconProvider')
  return ctx
}

export function useAppIcon(name: IconName): ComponentType {
  return useIconSet().getIcon(name)
}
