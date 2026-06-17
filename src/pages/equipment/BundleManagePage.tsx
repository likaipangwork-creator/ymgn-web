import { useState } from 'react'
import { PageToolbar } from '../../components/PageToolbar'
import { QRCodeDisplay } from '../../components/QRCodeDisplay'
import { useData } from '../../context/DataContext'

export function BundleManagePage() {
  const { equipmentBundles, equipments, createEquipmentBundle, updateEquipmentBundle, deleteEquipmentBundle } =
    useData()
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)

  const toggleEquipment = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const startEdit = (bundleId: string) => {
    const bundle = equipmentBundles.find((b) => b.id === bundleId)
    if (!bundle) return
    setEditingId(bundleId)
    setName(bundle.name)
    setNote(bundle.note)
    setSelectedIds([...bundle.equipmentIds])
  }

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setNote('')
    setSelectedIds([])
  }

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (editingId) {
      const existing = equipmentBundles.find((b) => b.id === editingId)
      if (!existing) return
      await updateEquipmentBundle({
        ...existing,
        name: trimmed,
        note: note.trim(),
        equipmentIds: selectedIds,
      })
    } else {
      await createEquipmentBundle(trimmed, note.trim(), selectedIds)
    }
    resetForm()
  }

  return (
    <div className="stack">
      <PageToolbar backTo="/equipment" title="套餐管理" />

      <section className="panel form-stack">
        <h3>{editingId ? '编辑套餐' : '新建套餐'}</h3>
        <label>
          套餐名称
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          备注
          <textarea className="form-input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <div>
          <p className="muted">选择包含器材（{selectedIds.length} 件）</p>
          <div className="checkbox-list">
            {equipments.map((eq) => (
              <label key={eq.id} className="checkbox-row">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(eq.id)}
                  onChange={() => toggleEquipment(eq.id)}
                />
                {eq.name}（{eq.category}）
              </label>
            ))}
          </div>
        </div>
        <div className="inline-actions">
          <button type="button" className="btn btn-primary" onClick={() => void handleSave()}>
            {editingId ? '保存修改' : '创建套餐'}
          </button>
          {editingId ? (
            <button type="button" className="btn btn-ghost" onClick={resetForm}>
              取消编辑
            </button>
          ) : null}
        </div>
      </section>

      <div className="card-list">
        {equipmentBundles.map((bundle) => (
          <article key={bundle.id} className="data-card">
            <div className="data-card__header">
              <h3>{bundle.name}</h3>
              <div className="inline-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => startEdit(bundle.id)}>
                  编辑
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-danger-text"
                  onClick={() => void deleteEquipmentBundle(bundle.id)}
                >
                  删除
                </button>
              </div>
            </div>
            {bundle.note ? <p>{bundle.note}</p> : null}
            <p className="muted">套餐码：{bundle.packageCode}</p>
            <QRCodeDisplay value={bundle.packageCode} size={120} />
            <p className="muted">
              包含：
              {bundle.equipmentIds
                .map((id) => equipments.find((e) => e.id === id)?.name ?? id)
                .join('、') || '—'}
            </p>
          </article>
        ))}
        {equipmentBundles.length === 0 ? <p className="muted page-center">暂无套餐</p> : null}
      </div>
    </div>
  )
}
