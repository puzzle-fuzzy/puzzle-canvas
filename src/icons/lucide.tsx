import {
  LayoutGrid,
  Download,
  Trash2,
  Hand,
  MousePointer2,
  Sparkles,
  X,
  Loader2,
  Sun,
  Moon,
  ChevronDown,
  FileText,
  FileCode,
  FileArchive,
  Film,
  ImageIcon,
  Globe,
  Settings,
  User,
  LogOut,
  Maximize2,
} from 'lucide-react'
import type { IconRegistry } from './index'

// Lucide 图标使用 size="1em" 以遵循父级 fontSize（与 @ricons/utils Icon 包装器兼容）
const wrap = (Comp: React.ComponentType<{ size?: number | string }>) => {
  const Wrapped = () => <Comp size="1em" />
  Wrapped.displayName = Comp.displayName || 'LucideIcon'
  return Wrapped
}

export const lucideRegistry: IconRegistry = {
  board: wrap(LayoutGrid),
  download: wrap(Download),
  delete: wrap(Trash2),
  hand: wrap(Hand),
  cursor: wrap(MousePointer2),
  sparkle: wrap(Sparkles),
  dismiss: wrap(X),
  spinner: wrap(Loader2),
  sun: wrap(Sun),
  moon: wrap(Moon),
  chevronDown: wrap(ChevronDown),
  documentText: wrap(FileText),
  documentCode: wrap(FileCode),
  folderZip: wrap(FileArchive),
  video: wrap(Film),
  image: wrap(ImageIcon),
  globe: wrap(Globe),
  settings: wrap(Settings),
  user: wrap(User),
  signOut: wrap(LogOut),
  fullscreen: wrap(Maximize2),
}
