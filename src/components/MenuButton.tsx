import { Link } from 'react-router-dom'

interface MenuButtonProps {
  title: string
  icon: string
  to?: string
  onClick?: () => void
  subtitle?: string
}

export function MenuButton({ title, icon, to, onClick, subtitle }: MenuButtonProps) {
  const content = (
    <>
      <span className="menu-card__icon-wrap" aria-hidden>
        {icon}
      </span>
      <div>
        <p className="menu-card__title">{title}</p>
        {subtitle ? <p className="menu-card__subtitle">{subtitle}</p> : null}
      </div>
      <span className="menu-card__chevron" aria-hidden>
        ›
      </span>
    </>
  )

  if (onClick) {
    return (
      <button type="button" className="menu-card menu-card--button" onClick={onClick}>
        {content}
      </button>
    )
  }

  return (
    <Link to={to ?? '/'} className="menu-card">
      {content}
    </Link>
  )
}
