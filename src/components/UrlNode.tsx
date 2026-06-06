import type { NodeProps } from '@xyflow/react'
import type { UrlNodeType } from '../types'
import { getDomain } from '../utils'

function UrlNode({ data }: NodeProps<UrlNodeType>) {
  const { url, title, description, image, favicon } = data
  const domain = getDomain(url)

  return (
    <div className="url-node">
      {/* 头部：favicon + 域名 */}
      <div className="node-header">
        {favicon ? (
          <img className="node-favicon" src={favicon} alt="" />
        ) : (
          <span className="node-favicon-fallback">🌐</span>
        )}
        <span className="node-domain">{domain}</span>
      </div>

      {/* 图片 */}
      {image && (
        <div className="node-image-wrapper">
          <img className="node-image" src={image} alt={title} />
        </div>
      )}

      {/* 内容 */}
      <div className="node-body">
        <h3 className="node-title">{title}</h3>
        {description && <p className="node-description">{description}</p>}
        <a
          className="node-url"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >{url}</a>
      </div>
    </div>
  )
}

export default UrlNode
