import { Navigate } from 'react-router-dom'
import { ContactList } from '../../components/ContactList'
import { PageToolbar } from '../../components/PageToolbar'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'

export function CrewsPage() {
  const { isAdmin } = useAuth()
  const { crews, saveCrew, deleteCrew } = useData()
  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div className="stack">
      <PageToolbar backTo="/people" title="跟机员信息" />
      <ContactList
        title="跟机员"
        items={crews}
        emptyText="暂无跟机员"
        onSave={saveCrew}
        onDelete={deleteCrew}
        onNew={() => ({ id: crypto.randomUUID(), name: '', phone: '', note: '' })}
      />
    </div>
  )
}
