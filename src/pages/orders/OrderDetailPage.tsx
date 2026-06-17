import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { PageToolbar } from '../../components/PageToolbar'
import { useData } from '../../context/DataContext'
import { formatChineseDateTime } from '../../lib/dates'
import { groupedOrderEquipmentItemsLikeManagement } from '../../lib/inventory'
import {
  orderEquipmentLineItemDisplayName,
  rentalOrderTotalEquipmentUnitCount,
} from '../../types/models'

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { orders, totalPaidAmount, resolvedPayStatus, equipmentGroups, equipments } = useData()
  const order = orders.find((o) => o.id === id)

  const equipmentSections = useMemo(() => {
    if (!order) return []
    return groupedOrderEquipmentItemsLikeManagement(
      order.equipmentItems,
      equipmentGroups,
      equipments
    )
  }, [order, equipmentGroups, equipments])

  if (!order) {
    return (
      <div className="stack">
        <PageToolbar backTo="/orders" title="订单详情" />
        <p className="muted page-center">订单不存在</p>
      </div>
    )
  }

  const paid = totalPaidAmount(order.id)
  const payStatus = resolvedPayStatus(order, paid)

  return (
    <div className="stack">
      <PageToolbar
        backTo="/orders"
        title="订单详情"
        actions={
          !order.isReturned ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => navigate(`/orders/${order.id}/edit`)}>
                编辑
              </button>
              <button type="button" className="btn btn-primary" onClick={() => navigate(`/orders/${order.id}/return`)}>
                归还
              </button>
            </>
          ) : null
        }
      />

      <section className="panel detail-section">
        <div className="detail-header">
          <h3>{order.customer.name}</h3>
          <span className={`badge ${order.isReturned ? 'badge--ok' : 'badge--warn'}`}>
            {order.isReturned ? '已归还' : '租赁中'}
          </span>
        </div>

        <dl className="detail-list">
          <dt>客户电话</dt>
          <dd>{order.customer.phone || '—'}</dd>
          <dt>跟机员</dt>
          <dd>{order.cameraCrewName || '—'}</dd>
          <dt>介绍人</dt>
          <dd>{order.introducerName || '—'}</dd>
          <dt>租期</dt>
          <dd>
            {formatChineseDateTime(order.rentDate)} — {formatChineseDateTime(order.endDate)}（{order.rentalDays} 天）
          </dd>
          <dt>总金额</dt>
          <dd>¥{Math.round(order.totalPrice)}</dd>
          <dt>押金</dt>
          <dd>¥{Math.round(order.deposit)}</dd>
          <dt>付款状态</dt>
          <dd>{payStatus}（已付 ¥{Math.round(paid)}）</dd>
          <dt>确认人</dt>
          <dd>{order.confirmBy || '—'}</dd>
          {order.isReturned ? (
            <>
              <dt>归还时间</dt>
              <dd>{formatChineseDateTime(order.returnDate)}</dd>
              <dt>归还备注</dt>
              <dd>{order.returnNote || '—'}</dd>
            </>
          ) : null}
          {order.modifyUser ? (
            <>
              <dt>最后修改</dt>
              <dd>
                {order.modifyUser} · {formatChineseDateTime(order.modifyDate)}
              </dd>
            </>
          ) : null}
          {order.orderNote ? (
            <>
              <dt>订单备注</dt>
              <dd>{order.orderNote}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <section className="panel">
        <h3>器材（{rentalOrderTotalEquipmentUnitCount(order)} 件）</h3>
        {equipmentSections.map((section, sectionIndex) => (
          <div key={section.id} className="order-equipment-section">
            {sectionIndex > 0 ? <hr className="order-equipment-divider" /> : null}
            <h4 className="order-equipment-category">{section.categoryTitle}</h4>
            {section.folderBatches.map((batch) => (
              <div key={batch.id} className="order-equipment-batch">
                {batch.folderLabel !== '未分组' ? (
                  <p className="order-equipment-folder">{batch.folderLabel}</p>
                ) : null}
                <ul className="simple-list">
                  {batch.items.map((item) => (
                    <li key={item.equipment.id}>{orderEquipmentLineItemDisplayName(item)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </section>

      <Link to="/orders" className="btn btn-ghost">
        返回列表
      </Link>
    </div>
  )
}
