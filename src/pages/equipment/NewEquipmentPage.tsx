import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageToolbar } from '../../components/PageToolbar'
import { QRCodeDisplay } from '../../components/QRCodeDisplay'
import { useData } from '../../context/DataContext'
import type { EquCategory, Equipment } from '../../types/models'
import { EQU_CATEGORIES } from '../../types/models'

export function NewEquipmentPage() {
  const navigate = useNavigate()
  const { addEquipment, equipmentGroups } = useData()
  const [name, setName] = useState('')
  const [stock, setStock] = useState(1)
  const [category, setCategory] = useState<EquCategory>('摄影器材')
  const [barcode, setBarcode] = useState('')
  const [groupId, setGroupId] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const groupsForCategory = equipmentGroups.filter((g) => g.category === category)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const equipment: Equipment = {
        id: crypto.randomUUID(),
        name: name.trim(),
        stock: Math.max(0, stock),
        usedCount: 0,
        category,
        barcode: barcode.trim(),
        groupId: groupId || null,
        sortOrder: 0,
        photoShareCode: null,
      }
      await addEquipment(equipment)
      navigate('/equipment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stack">
      <PageToolbar backTo="/equipment" title="新建器材" />

      <section className="panel form-stack">
        <label>
          名称
          <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} required />
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
          库存数量
          <input type="number" min={0} className="form-input" value={stock} onChange={(e) => setStock(Number.parseInt(e.target.value, 10) || 0)} />
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
