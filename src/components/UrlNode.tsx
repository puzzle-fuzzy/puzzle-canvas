import { useState } from 'react'
import type { NodeProps } from '@xyflow/react'
import { Icon } from '@ricons/utils'
import { useAppIcon } from '../icons'
import type { UrlNodeType } from '../types'
import { getDomain } from '../utils'

function UrlNode({ data }: NodeProps<UrlNodeType>) {
  const { url, title, description, image, favicon } = data
  const domain = getDomain(url)
  const GlobeIcon = useAppIcon('globe')

  const [faviconError, setFaviconError] = useState(false)
  const [imageError, setImageError] = useState(false)

  return (
    <div className="url-node">
      {/* 头部：favicon + 域名 */}
      <div className="node-header">
        {favicon && !faviconError ? (
          <img
            className="node-favicon"
            src={favicon}
            alt=""
            onError={() => setFaviconError(true)}
          />
        ) : (
          <span className="node-favicon-fallback">
            <Icon size={16}><GlobeIcon /></Icon>
          </span>
        )}
        <span className="node-domain">{domain}</span>
      </div>

      {/* 图片 */}
      {image && !imageError && (
        <div className="node-image-wrapper">
          <img
            className="node-image"
            src={image}
            alt={title}
            onError={() => setImageError(true)}
          />
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
