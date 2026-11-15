import { useEffect } from 'react'

const APP_NAME = 'DoeSangue'

/** Título da aba do navegador para a página atual (ex.: "Meu perfil | DoeSangue"). */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} | ${APP_NAME}`
  }, [title])
}
