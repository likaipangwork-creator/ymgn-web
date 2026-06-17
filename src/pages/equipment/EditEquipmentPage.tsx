import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageToolbar } from '../../components/PageToolbar'
import { QRCodeDisplay } from '../../components/QRCodeDisplay'
import { useData } from '../../context/DataContext'
import type { EquCategory } from '../../types/models'
import { EQU_CATEGORIES } from '../../types/models'

export function EditEquipmentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { equipments, updateEquipment, equipmentGroups } = useData()
  const existing = equipments.find((e) => e.id === id)

  const [name, setName] = useState(existing?.name ?? '')
  const [stock, setStock] = useState(existing?.stock ?? 0)
  const [category, setCategory] = useState<EquCategory>(existing?.category ?? '摄影器材')
  const [barcode, setBarcode] = useState(existing?.barcode ?? '')
  const [groupId, setGroupId] = useState(existing?.groupId ?? '')
  const [saving, setSaving] = useState(false)

  if (!existing) {
    return (
      <div className="stack">
        <PageToolbar backTo="/equipment" title="编辑器材" />
        <p className="muted page-center">器材不存在</p>
      </div>
    )
  }

  const groupsForCategory = equipmentGroups.filter((g) => g.category === category)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await updateEquipment({
        ...existing,
        name: name.trim(),
        stock: Math.max(existing.usedCount, stock),
        category,
        barcode: barcode.trim(),
        groupId: groupId || null,
      })
      navigate('/equipment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stack">
      <PageToolbar backTo="/equipment" title="编辑器材" />

      <section className="panel form-stack">
        <label>
          名称
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          类别
          <select className="form-input" value={category} onChange={(e) => setCategory(e.target.value as EquCategory)}>
            {EQU_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label>
          库存数量（已租 {existing.usedCount} 件）
          <input type="number" min={existing.usedCount} className="form-input" value={stock} onChange={(e) => setStock(Number.parseInt(e.target.value, 10) || 0)} />
        </label>
        <label>
          条码
          <input className="form-input" value={barcode} onChange={(e) => setBarcode(e.target.value)} />
        </label>
        {barcode ? <QRCodeDisplay value={barcode} label="条码二维码" /> : null}
        <label>
          所属分组
          <select className="form-input" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            <option value="">未分组</option>
            {groupsForCategory.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void handleSave()}>
          {saving ? '保存中…' : '保存'}
        </button>
      </section>
    </div>
  )
}
