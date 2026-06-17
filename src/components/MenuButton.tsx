import { Link } from 'react-router-dom'

interface MenuButtonProps {
  title: string
  icon: string
  to: string
  subtitle?: string
}

export function MenuButton({ title, icon, to, subtitle }: MenuButtonProps) {
  return (
    <Link to={to} className="menu-card">
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
    </Link>
  )
}
