import { useCallback, memo } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Icon } from '@ricons/utils'
import { useAppIcon } from '../icons'
import type { DocNodeType } from '../types'
import { cancelUpload } from '../utils'
import { formatFileSize } from '../utils/format'

type DocNodeProps = NodeProps<DocNodeType>

const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz']
const codeExts = [
  'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'less', 'json', 'xml',
  'yaml', 'yml', 'md', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h',
  'sh', 'bash', 'sql', 'graphql', 'vue', 'svelte',
]

/** 根据扩展名返回文件图标组件 */
function getFileIcon(
  fileName: string,
  FolderZipIcon: React.ComponentType,
  DocumentCodeIcon: React.ComponentType,
  DocumentTextIcon: React.ComponentType,
) {
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : ''

  if (archiveExts.includes(ext)) return <Icon size={28}><FolderZipIcon /></Icon>
  if (codeExts.includes(ext)) return <Icon size={28}><DocumentCodeIcon /></Icon>
  return <Icon size={28}><DocumentTextIcon /></Icon>
}

function DocNode({ data, id }: DocNodeProps) {
  const handleCancel = useCallback(() => {
    cancelUpload(id)
  }, [id])

  const DismissIcon = useAppIcon('dismiss')
  const FolderZipIcon = useAppIcon('folderZip')
  const DocumentCodeIcon = useAppIcon('documentCode')
  const DocumentTextIcon = useAppIcon('documentText')

  // 上传中 → 显示进度
  if (data.uploading) {
    const percent = Math.round(Math.max(0, Math.min(1, data.uploading.progress)) * 100)

    return (
      <div className="doc-node doc-node--uploading">
        <div className="upload-progress-content">
          <span className="upload-progress-icon">{getFileIcon(data.uploading.fileName, FolderZipIcon, DocumentCodeIcon, DocumentTextIcon)}</span>
          <span className="upload-progress-filename">{data.uploading.fileName}</span>
          <div className="upload-progress-bar-track">
            <div
              className="upload-progress-bar-fill"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="upload-progress-percent">{percent}%</span>
        </div>
        <button
          className="upload-cancel-btn"
          onClick={handleCancel}
          title="取消上传"
        >
          <Icon size={14}><DismissIcon /></Icon>
        </button>
      </div>
    )
  }

  // 正常渲染
  return (
    <div className="doc-node">
      <div className="doc-node-icon">{getFileIcon(data.fileName, FolderZipIcon, DocumentCodeIcon, DocumentTextIcon)}</div>
      <div className="doc-node-info">
        <span className="doc-node-filename">{data.fileName}</span>
        <span className="doc-node-size">{formatFileSize(data.fileSize)}</span>
      </div>
    </div>
  )
}

export default memo(DocNode)
