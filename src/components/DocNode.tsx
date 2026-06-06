import { useCallback } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Icon } from '@ricons/utils'
import { Dismiss20Regular, DocumentText20Regular, DocumentJavascript20Regular, FolderZip20Regular } from '@ricons/fluent'
import type { DocNodeType } from '../types'
import { cancelUpload } from '../utils'

type DocNodeProps = NodeProps<DocNodeType>

/** 根据扩展名返回文件图标 */
function getFileIcon(fileName: string) {
  const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : ''
  const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'tgz']
  const codeExts = [
    'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'scss', 'less', 'json', 'xml',
    'yaml', 'yml', 'md', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h',
    'sh', 'bash', 'sql', 'graphql', 'vue', 'svelte',
  ]

  if (archiveExts.includes(ext)) return <Icon size={28}><FolderZip20Regular /></Icon>
  if (codeExts.includes(ext)) return <Icon size={28}><DocumentJavascript20Regular /></Icon>
  return <Icon size={28}><DocumentText20Regular /></Icon>
}

/** 格式化文件大小 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function DocNode({ data, id }: DocNodeProps) {
  const handleCancel = useCallback(() => {
    cancelUpload(id)
  }, [id])

  // 上传中 → 显示进度
  if (data.uploading) {
    const percent = Math.round(data.uploading.progress * 100)

    return (
      <div className="doc-node doc-node--uploading">
        <div className="upload-progress-content">
          <span className="upload-progress-icon">{getFileIcon(data.uploading.fileName)}</span>
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
          <Icon size={14}><Dismiss20Regular /></Icon>
        </button>
      </div>
    )
  }

  // 正常渲染
  return (
    <div className="doc-node">
      <div className="doc-node-icon">{getFileIcon(data.fileName)}</div>
      <div className="doc-node-info">
        <span className="doc-node-filename">{data.fileName}</span>
        <span className="doc-node-size">{formatFileSize(data.fileSize)}</span>
      </div>
    </div>
  )
}

export default DocNode
