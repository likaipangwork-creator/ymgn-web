import { formatChineseDateTime } from './dates'
import type { RentalOrder } from '../types/models'
import { orderEquipmentLineItemDisplayName } from '../types/models'

export function buildOrdersTXT(orders: RentalOrder[]): string {
  let text = '==================== 器材租赁订单存档 ====================\n\n'
  orders.forEach((order, i) => {
    text += `【第 ${i + 1} 单】\n`
    text += `客户：${order.customer.name}\n电话：${order.customer.phone}\n`
    text += `跟机员：${order.cameraCrewName}\n介绍人：${order.introducerName}\n`
    text += `开始：${formatChineseDateTime(order.rentDate)}\n结束：${formatChineseDateTime(order.endDate)}\n`
    text += `天数：${order.rentalDays} 天\n总金额：¥${Math.round(order.totalPrice)}\n押金：¥${Math.round(order.deposit)}\n`
    text += `状态：${order.isReturned ? '已归还' : '未归还'}\n付款状态：${order.payStatus}\n`
    if (order.modifyUser && order.modifyDate) {
      text += `修改记录：${order.modifyUser} ${formatChineseDateTime(order.modifyDate)}\n`
    }
    if (order.orderNote) text += `订单备注：${order.orderNote}\n`
    text += '器材：\n'
    order.equipmentItems.forEach((item) => {
      text += `  • ${orderEquipmentLineItemDisplayName(item)}\n`
    })
    text += '\n------------------------------------------------\n\n'
  })
  text += '==================== 导出完成 ====================\n'
  return text
}

export function buildOrdersCSV(orders: RentalOrder[]): string {
  let csv =
    '订单号,客户,电话,跟机员,介绍人,开始,结束,天数,金额,押金,租赁状态,付款状态,修改人,修改时间,订单备注,器材\n'
  orders.forEach((order, i) => {
    const status = order.isReturned ? '已归还' : '未归还'
    const eqStr = order.equipmentItems.map(orderEquipmentLineItemDisplayName).join('、')
    const mUser = order.modifyUser ?? ''
    const mDate = order.modifyDate ? formatChineseDateTime(order.modifyDate) : ''
    const note = order.orderNote.replace(/"/g, '""')
    csv += `${i + 1},${order.customer.name},${order.customer.phone},${order.cameraCrewName},${order.introducerName},${formatChineseDateTime(order.rentDate)},${formatChineseDateTime(order.endDate)},${order.rentalDays},${Math.round(order.totalPrice)},${Math.round(order.deposit)},${status},${order.payStatus},${mUser},${mDate},"${note}",${eqStr}\n`
  })
  return csv
}

export function downloadTextFile(content: string, filename: string, mime: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
