/** Descrição curta e legível de um User-Agent ("Chrome no Android"). Heurística, sem dependências. */
export function describeUserAgent(ua: string): string {
  const browser =
    (/Edg\//.test(ua) && 'Edge') ||
    (/OPR\//.test(ua) && 'Opera') ||
    (/SamsungBrowser\//.test(ua) && 'Samsung Internet') ||
    (/Firefox\//.test(ua) && 'Firefox') ||
    (/Chrome\//.test(ua) && 'Chrome') ||
    (/Safari\//.test(ua) && 'Safari') ||
    'Navegador'
  const os =
    (/Android/.test(ua) && 'Android') ||
    (/iPhone|iPad|iPod/.test(ua) && 'iOS') ||
    (/Windows/.test(ua) && 'Windows') ||
    (/Mac OS X/.test(ua) && 'macOS') ||
    (/Linux/.test(ua) && 'Linux') ||
    undefined
  return os ? `${browser} no ${os}` : browser
}
