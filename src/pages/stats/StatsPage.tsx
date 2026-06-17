import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { PageToolbar } from '../../components/PageToolbar'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'
import { buildOrdersCSV, buildOrdersTXT, downloadTextFile } from '../../lib/export'

export function StatsPage() {
  const { isAdmin } = useAuth()
  const { orders, equipments, customers, crews, introducers } = useData()
  const [exporting, setExporting] = useState<'txt' | 'csv' | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!isAdmin) return <Navigate to="/" replace />

  const totalIncome = orders.reduce((sum, o) => sum + o.totalPrice, 0)
  const unpaidCount = orders.filter((o) => o.payStatus === '待付款').length
  const paidCount = orders.filter((o) => o.payStatus === '已付款').length

  const handleExport = async (type: 'txt' | 'csv') => {
    if (orders.length === 0) {
      setError('没有订单数据可导出')
      return
    }
    setExporting(type)
    setError(null)
    try {
      const ts = Math.floor(Date.now() / 1000)
      if (type === 'txt') {
        downloadTextFile(buildOrdersTXT(orders), `租赁订单_${ts}.txt`, 'text/plain;charset=utf-8')
      } else {
        downloadTextFile(buildOrdersCSV(orders), `租赁订单_${ts}.csv`, 'text/csv;charset=utf-8')
      }
    } finally {
      setExporting(null)
    }
  }

  return (
    <div className="stack">
      <PageToolbar title="营业统计" />

      <section className="panel">
        <h3>营收统计</h3>
        <ul className="simple-list">
          <li>总营业额：¥{Math.round(totalIncome)}</li>
          <li>总订单数：{orders.length}</li>
          <li>已归还订单：{orders.filter((o) => o.isReturned).length}</li>
        </ul>
      </section>

      <section className="panel">
        <h3>付款统计</h3>
        <ul className="simple-list">
          <li>待付款订单：{unpaidCount} 单</li>
          <li>已付款订单：{paidCount} 单</li>
        </ul>
      </section>

      <section className="panel">
        <h3>资料统计</h3>
        <ul className="simple-list">
          <li>器材总数：{equipments.length}</li>
          <li>客户总数：{customers.length}</li>
          <li>跟机员总数：{crews.length}</li>
          <li>介绍人总数：{introducers.length}</li>
        </ul>
      </section>

      <section className="panel form-stack">
        <h3>导出存档</h3>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="button" className="btn btn-primary" disabled={exporting != null} onClick={() => void handleExport('txt')}>
          {exporting === 'txt' ? '导出中…' : '导出 TXT'}
        </button>
        <button type="button" className="btn btn-primary" disabled={exporting != null} onClick={() => void handleExport('csv')}>
          {exporting === 'csv' ? '导出中…' : '导出 Excel (CSV)'}
        </button>
      </section>
    </div>
  )
}
