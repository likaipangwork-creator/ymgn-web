import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageToolbar } from '../../components/PageToolbar'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import type { OAMaintenanceEquipmentItem, OAReportCategory, OAProcurementSubType } from '../../types/models'

export function NewOAPage() {
  const navigate = useNavigate()
  const { username, isSuperAdmin } = useAuth()
  const { equipments, submitOAReport, rentableStock } = useData()

  const [category, setCategory] = useState<OAReportCategory>('维修')
  const [procurementSubType, setProcurementSubType] = useState<OAProcurementSubType>('愿望单')
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [executorUsername, setExecutorUsername] = useState(username)
  const [maintenanceItems, setMaintenanceItems] = useState<OAMaintenanceEquipmentItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const maintenanceEquipments = useMemo(
    () => equipments.filter((eq) => rentableStock(eq) > 0 || maintenanceItems.some((i) => i.equipmentId === eq.id)),
    [equipments, rentableStock, maintenanceItems]
  )

  const getQty = (equipmentId: string) =>
    maintenanceItems.find((i) => i.equipmentId === equipmentId)?.quantity ?? 0

  const setQty = (equipmentId: string, quantity: number) => {
    setMaintenanceItems((prev) => {
      const rest = prev.filter((i) => i.equipmentId !== equipmentId)
      if (quantity <= 0) return rest
      return [...rest, { equipmentId, quantity }]
    })
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      const err = await submitOAReport({
        category,
        procurementSubType: category === '采购' ? procurementSubType : null,
        title,
        detail,
        submitterUsername: username,
        executorUsername,
        maintenanceEquipmentItems: maintenanceItems,
        autoApproveIfSuperAdmin: isSuperAdmin,
      })
      if (err) {
        setError(err)
        return
      }
      navigate('/oa')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stack">
      <PageToolbar backTo="/oa" title="新建提报" />

      <section className="panel form-stack">
        <label>
          类别
          <select
            className="form-input"
            value={category}
            onChange={(e) => setCategory(e.target.value as OAReportCategory)}
          >
            <option value="维修">维修</option>
            <option value="采购">采购</option>
          </select>
        </label>

        {category === '采购' ? (
          <label>
            采购类型
            <select
              className="form-input"
              value={procurementSubType}
              onChange={(e) => setProcurementSubType(e.target.value as OAProcurementSubType)}
            >
              <option value="愿望单">愿望单</option>
              <option value="耗材采购">耗材采购</option>
            </select>
          </label>
        ) : null}

        <label>
          标题
          <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label>
          申报内容
          <textarea className="form-input" rows={4} value={detail} onChange={(e) => setDetail(e.target.value)} />
        </label>

        <label>
          执行人
          <input className="form-input" value={executorUsername} onChange={(e) => setExecutorUsername(e.target.value)} />
        </label>

        {category === '维修' ? (
          <div>
            <h3>维护器材</h3>
            <p className="muted">选择需要送修/维护的器材及数量</p>
            <div className="card-list">
              {maintenanceEquipments.map((eq) => {
                const qty = getQty(eq.id)
                const max = rentableStock(eq) + qty
                return (
                  <div key={eq.id} className="equipment-picker-row">
                    <div>
                      <p>{eq.name}</p>
                      <p className="muted">可送修 {max} 件</p>
                    </div>
                    <div className="qty-control">
                      <button type="button" className="qty-btn" disabled={qty <= 0} onClick={() => setQty(eq.id, qty - 1)}>
                        −
                      </button>
                      <span className="qty-value">{qty}</span>
                      <button
                        type="button"
                        className="qty-btn"
                        disabled={qty >= max}
                        onClick={() => setQty(eq.id, qty + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {error ? <p className="error-text">{error}</p> : null}

        <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void handleSubmit()}>
          {saving ? '提交中…' : '提交'}
        </button>
      </section>
    </div>
  )
}
