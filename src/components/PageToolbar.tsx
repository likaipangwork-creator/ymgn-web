import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface PageToolbarProps {
  backTo?: string
  backLabel?: string
  title: string
  actions?: ReactNode
}

export function PageToolbar({
  backTo,
  backLabel = '返回',
  title,
  actions,
}: PageToolbarProps) {
  return (
    <div className="page-toolbar">
      <div className="page-toolbar__left">
        {backTo ? (
          <Link to={backTo} className="page-toolbar__back">
            ‹ {backLabel}
          </Link>
        ) : null}
        <h2 className="page-toolbar__title">{title}</h2>
      </div>
      {actions ? <div className="page-toolbar__actions">{actions}</div> : null}
    </div>
  )
}
