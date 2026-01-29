interface Props {
  firstName: string
  lastName: string
  photoUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
}

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
}

export default function InitialsAvatar({ firstName, lastName, photoUrl, size = 'md' }: Props) {
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase()

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`${firstName} ${lastName}`}
        className={`${sizes[size]} rounded-full object-cover`}
        onError={(e) => {
          ;(e.target as HTMLImageElement).style.display = 'none'
          ;(e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden')
        }}
      />
    )
  }

  return (
    <div
      className={`${sizes[size]} rounded-full bg-brand flex items-center justify-center text-white font-semibold shrink-0`}
    >
      {initials}
    </div>
  )
}
