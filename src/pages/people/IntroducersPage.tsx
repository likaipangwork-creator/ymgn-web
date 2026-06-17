import { Navigate } from 'react-router-dom'
import { ContactList } from '../../components/ContactList'
import { PageToolbar } from '../../components/PageToolbar'
import { useAuth } from '../../context/AuthContext'
import { useData } from '../../context/DataContext'

export function IntroducersPage() {
  const { isAdmin } = useAuth()
  const { introducers, saveIntroducer, deleteIntroducer } = useData()
  if (!isAdmin) return <Navigate to="/" replace />

  return (
    <div className="stack">
      <PageToolbar backTo="/people" title="介绍人信息" />
      <ContactList
        title="介绍人"
        items={introducers}
        emptyText="暂无介绍人"
        onSave={saveIntroducer}
        onDelete={deleteIntroducer}
        onNew={() => ({ id: crypto.randomUUID(), name: '', phone: '', note: '' })}
      />
    </div>
  )
}
