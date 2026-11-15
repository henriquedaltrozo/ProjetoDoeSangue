import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Alert } from '@/shared/ui/Alert'
import { Button } from '@/shared/ui/Button'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

/** Última barreira da interface: um erro de renderização mostra um aviso em vez de tela em branco. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Erro de renderização', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) {
      return this.props.children
    }
    return (
      <div className="mx-auto mt-16 max-w-md">
        <Alert variant="error" title="Algo deu errado ao exibir esta página.">
          <div className="mt-2">
            <Button onClick={() => window.location.reload()}>Recarregar</Button>
          </div>
        </Alert>
      </div>
    )
  }
}
