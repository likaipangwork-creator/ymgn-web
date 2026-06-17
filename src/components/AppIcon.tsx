interface AppIconProps {
  size?: number
  className?: string
  alt?: string
}

export function AppIcon({ size = 40, className = 'app-icon', alt = '驿马光年' }: AppIconProps) {
  return (
    <img
      src="/app-icon.png"
      alt={alt}
      width={size}
      height={size}
      className={className}
      draggable={false}
    />
  )
}
