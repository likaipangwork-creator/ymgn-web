import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageToolbar } from '../../components/PageToolbar'
import { useData } from '../../context/DataContext'
import { formatChineseDateTime } from '../../lib/dates'
import type { OAReportCategory } from '../../types/models'
import {
  oaReportCardExecutionStatusLabel,
  oaReportCardStatusBadgeText,
  oaReportCategoryLabel,
} from '../../types/models'

export function OAListPage() {
  const navigate = useNavigate()
  const { oaReports } = useData()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<'全部' | OAReportCategory>('全部')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return oaReports.filter((r) => {
      if (categoryFilter !== '全部' && r.category !== categoryFilter) return false
      if (!q) return true
      return (
        r.title.toLowerCase().includes(q) ||
        r.detail.toLowerCase().includes(q) ||
        r.submitterUsername.toLowerCase().includes(q) ||
        r.executorUsername.toLowerCase().includes(q)
      )
    })
  }, [oaReports, search, categoryFilter])

  return (
    <div className="stack">
      <PageToolbar
        title="OA 提报"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => navigate('/oa/new')}>
            新建提报
          </button>
        }
      />

      <input
        className="search-input"
        placeholder="搜索标题、内容、提交人…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="filter-row">
        {(['全部', '维修', '采购'] as const).map((c) => (
          <button
            key={c}
            type="button"
            className={`chip ${categoryFilter === c ? 'chip--active' : ''}`}
            onClick={() => setCategoryFilter(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="card-list">
        {filtered.map((report) => {
          const execLabel = oaReportCardExecutionStatusLabel(report)
          return (
            <Link key={report.id} to={`/oa/${report.id}`} className="data-card menu-card">
              <div className="data-card__header">
                <h3>{report.title}</h3>
                <span className="badge">{oaReportCardStatusBadgeText(report)}</span>
              </div>
              <p className="muted">{oaReportCategoryLabel(report)}</p>
              <p className="muted">
                {report.submitterUsername} · {formatChineseDateTime(report.createdAt)}
              </p>
              {execLabel ? <span className="badge badge--warn">{execLabel}</span> : null}
            </Link>
          )
        })}
        {filtered.length === 0 ? <p className="muted page-center">暂无提报</p> : null}
      </div>
    </div>
  )
}
