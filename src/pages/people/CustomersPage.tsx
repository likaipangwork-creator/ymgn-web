import { Navigate } from 'react-router-dom'
import { ContactList } from '../../components/ContactList'
import { PageToolbar } from '../../components/PageToolbar'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'

export function CustomersPage() {
  const { isAdmin } = useAuth()
  const { customers, saveCustomer, deleteCustomer } = useData()
  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div className="stack">
      <PageToolbar backTo="/people" title="客户信息" />
      <ContactList
        title="客户"
        items={customers}
        emptyText="暂无客户"
        onSave={saveCustomer}
        onDelete={deleteCustomer}
        onNew={() => ({ id: crypto.randomUUID(), name: '', phone: '', note: '' })}
      />
    </div>
  )
}
