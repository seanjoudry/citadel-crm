import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchSettings, updateSetting } from '../api/settings'
import { apiUpload } from '../api/client'

export default function Settings() {
  const qc = useQueryClient()
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => fetchSettings().then((r) => r.data),
  })

  const [threshold, setThreshold] = useState('30')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importType, setImportType] = useState<'contacts' | 'interactions'>('contacts')
  const [importResult, setImportResult] = useState<any>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings?.attention_threshold_days) {
      setThreshold(settings.attention_threshold_days)
    }
  }, [settings])

  const saveSetting = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => updateSetting(key, value),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      qc.invalidateQueries({ queryKey: ['contacts'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const handleImport = async () => {
    if (!importFile) return
    const formData = new FormData()
    formData.append('file', importFile)
    try {
      const result = await apiUpload(`/api/import/${importType}`, formData)
      setImportResult(result)
      setImportFile(null)
    } catch (err: any) {
      setImportResult({ error: err.message })
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>

      {/* Attention Threshold */}
      <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Attention Threshold</h2>
        <p className="text-sm text-muted mb-3">
          Contacts with no outbound interaction in this many days will be flagged as "needs attention."
        </p>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="1"
            max="365"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm"
          />
          <span className="text-sm text-muted">days</span>
          <button
            onClick={() => saveSetting.mutate({ key: 'attention_threshold_days', value: threshold })}
            className="px-4 py-2 bg-brand text-white rounded-md text-sm hover:opacity-90"
          >
            Save
          </button>
          {saved && <span className="text-sm text-success">Saved!</span>}
        </div>
      </section>

      {/* Import */}
      <section className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Import Data</h2>
        <p className="text-sm text-muted mb-3">
          Upload a CSV or JSON file to bulk import contacts or interactions.
        </p>
        <div className="space-y-3">
          <div className="flex gap-3">
            <select
              value={importType}
              onChange={(e) => setImportType(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              <option value="contacts">Contacts</option>
              <option value="interactions">Interactions</option>
            </select>
            <input
              type="file"
              accept=".csv,.json"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="text-sm"
            />
            <button
              onClick={handleImport}
              disabled={!importFile}
              className="px-4 py-2 bg-brand text-white rounded-md text-sm hover:opacity-90 disabled:opacity-50"
            >
              Import
            </button>
          </div>
          {importResult && (
            <div className="p-3 bg-gray-50 rounded-md text-sm">
              {importResult.error ? (
                <p className="text-danger">{importResult.error}</p>
              ) : importResult.data ? (
                <>
                  <p className="text-success">Imported: {importResult.data.imported}</p>
                  {importResult.data.skipped > 0 && (
                    <p className="text-warning">Skipped: {importResult.data.skipped}</p>
                  )}
                  {importResult.data.errors?.length > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-muted">Show errors</summary>
                      <ul className="mt-1 space-y-1">
                        {importResult.data.errors.map((e: any, i: number) => (
                          <li key={i} className="text-xs text-danger">Row {e.row}: {e.message}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              ) : null}
            </div>
          )}
          <div className="text-xs text-muted">
            <p><strong>Contact CSV columns:</strong> first_name, last_name, email, phone, organization, title, location</p>
            <p><strong>Interaction CSV columns:</strong> email (to match contact), type, content, occurred_at, duration_seconds, source</p>
          </div>
        </div>
      </section>
    </div>
  )
}
