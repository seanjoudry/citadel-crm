interface Props {
  name: string
  color: string
  onRemove?: () => void
}

export default function TagBadge({ name, color, onRemove }: Props) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {name}
      {onRemove && (
        <button onClick={onRemove} className="hover:opacity-75 ml-0.5" aria-label={`Remove ${name}`}>
          x
        </button>
      )}
    </span>
  )
}
