import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageToolbar } from '../../components/PageToolbar'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { formatChineseDateTime } from '../../lib/dates'
import {
  oaReportCategoryLabel,
  oaReportDetailExecutionStatusLabel,
} from '../../types/models'

export function OADetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { username, isSuperAdmin } = useAuth()
  const { oaReports, equipments, approveOAReport, rejectOAReport, confirmOAReportExecuted, deleteOAReport } =
    useData()
  const report = oaReports.find((r) => r.id === id)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!report) {
    return (
      <div className="stack">
        <PageToolbar backTo="/oa" title="提报详情" />
        <p className="muted page-center">提报不存在</p>
      </div>
    )
  }

  const runAction = async (action: () => Promise<string | null>) => {
    setBusy(true)
    setError(null)
    try {
      const err = await action()
      if (err) setError(err)
    } finally {
      setBusy(false)
    }
  }

  const execLabel = oaReportDetailExecutionStatusLabel(report)

  return (
    <div className="stack">
      <PageToolbar
        backTo="/oa"
        title="提报详情"
        actions={
          isSuperAdmin ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/oa/${id}/edit`)}>
              编辑
            </button>
          ) : null
        }
      />

      <section className="panel detail-section">
        <div className="detail-header">
          <h3>{report.title}</h3>
          <span className="badge">{report.status}</span>
        </div>
        <dl className="detail-list">
          <dt>类别</dt>
          <dd>{oaReportCategoryLabel(report)}</dd>
          <dt>提交人</dt>
          <dd>{report.submitterUsername}</dd>
          <dt>执行人</dt>
          <dd>{report.executorUsername}</dd>
          <dt>提交时间</dt>
          <dd>{formatChineseDateTime(report.createdAt)}</dd>
          {report.approvedBy ? (
            <>
              <dt>审批</dt>
              <dd>
                {report.approvedBy} · {formatChineseDateTime(report.approvedAt)}
              </dd>
            </>
          ) : null}
          {execLabel ? (
            <>
              <dt>执行状态</dt>
              <dd>{execLabel}</dd>
            </>
          ) : null}
        </dl>
        <h4>申报内容</h4>
        <p style={{ whiteSpace: 'pre-wrap' }}>{report.detail}</p>

        {report.category === '维修' && report.maintenanceEquipmentItems.length > 0 ? (
          <>
            <h4>维护器材</h4>
            <ul className="simple-list">
              {report.maintenanceEquipmentItems.map((item) => {
                const eq = equipments.find((e) => e.id === item.equipmentId)
                return (
                  <li key={item.equipmentId}>
                    {eq?.name ?? item.equipmentId} × {item.quantity}
                  </li>
                )
              })}
            </ul>
          </>
        ) : null}
      </section>

      {isSuperAdmin ? (
        <section className="panel form-stack">
          <h3>超级管理员操作</h3>
          {report.status === '审核中' ? (
            <div className="inline-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void runAction(() => approveOAReport(report.id, username))}
              >
                通过
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-danger-text"
                disabled={busy}
                onClick={() => void runAction(() => rejectOAReport(report.id, username))}
              >
                驳回
              </button>
            </div>
          ) : null}
          {report.status === '已通过' && !report.isExecuted ? (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void runAction(() => confirmOAReportExecuted(report.id, username))}
            >
              确认已执行
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost btn-danger-text"
            disabled={busy}
            onClick={() =>
              void runAction(async () => {
                const err = await deleteOAReport(report.id, username)
                if (!err) navigate('/oa')
                return err
              })
            }
          >
            删除提报
          </button>
        </section>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}
    </div>
  )
}
