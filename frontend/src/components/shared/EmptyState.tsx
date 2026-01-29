interface Props {
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-muted text-4xl mb-4">-</div>
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-brand text-white rounded-md text-sm hover:opacity-90"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
