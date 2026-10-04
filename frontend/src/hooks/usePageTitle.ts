import { useEffect } from 'react'

const SITE = 'Tribuna Brasil'

export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE}` : SITE
  }, [title])
}
