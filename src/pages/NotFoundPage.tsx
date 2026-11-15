import { Link } from 'react-router-dom'
import { Button, EmptyState } from '../components/ui'

export function NotFoundPage() {
  return (
    <div className="py-10">
      <EmptyState
        icon="alert"
        title="Página no encontrada"
        description="El enlace no existe o cambió de lugar."
        action={
          <Link to="/">
            <Button>Volver al recetario</Button>
          </Link>
        }
      />
    </div>
  )
}
