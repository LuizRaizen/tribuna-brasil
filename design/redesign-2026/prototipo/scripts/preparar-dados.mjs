// Prepara os dados do protótipo a partir de fontes REAIS (somente leitura):
//   - malha das UFs do IBGE (API de malhas v3), projetada em SVG com d3-geo;
//   - apurações e perfil de demonstração da API local do Tribuna (rodar-local.ps1 precisa estar no ar);
//   - fotos oficiais do TSE das candidaturas do recorte, reduzidas para WebP.
// Rode a partir de design/redesign-2026/prototipo:  npm run dados
import { mkdir, readFile, writeFile, access } from 'node:fs/promises'
import { geoArea, geoConicEqualArea, geoPath } from 'd3-geo'
import sharp from 'sharp'

const API = process.env.API ?? 'http://127.0.0.1:8000/api/v1'
const DATA = new URL('../src/data/', import.meta.url)
const PHOTOS = new URL('../cache/fotos/', import.meta.url)

const UF_BY_IBGE = {
  11: 'ro', 12: 'ac', 13: 'am', 14: 'rr', 15: 'pa', 16: 'ap', 17: 'to', 21: 'ma', 22: 'pi', 23: 'ce',
  24: 'rn', 25: 'pb', 26: 'pe', 27: 'al', 28: 'se', 29: 'ba', 31: 'mg', 32: 'es', 33: 'rj', 35: 'sp',
  41: 'pr', 42: 'sc', 43: 'rs', 50: 'ms', 51: 'mt', 52: 'go', 53: 'df',
}
const REGION_BY_DIGIT = { 1: 'Norte', 2: 'Nordeste', 3: 'Sudeste', 4: 'Sul', 5: 'Centro-Oeste' }

const getJson = async (url) => {
  const res = await fetch(url, { headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

// ---------------------------------------------------------------- mapa (IBGE)
async function mapa() {
  const url =
    'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=intermediaria&intrarregiao=UF'
  const fc = await getJson(url)
  // GeoJSON (RFC 7946) usa anel externo anti-horário; o d3 espera horário. Inverte quando a área
  // esférica passa de meio globo (sinal de enrolamento trocado).
  for (const f of fc.features) {
    if (geoArea(f) > 2 * Math.PI) {
      const g = f.geometry
      const rings = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
      for (const poly of rings) for (const ring of poly) ring.reverse()
    }
  }
  const W = 1000
  const H = 1000
  const projection = geoConicEqualArea().parallels([-2, -22]).rotate([54, 0]).fitSize([W, H], fc)
  const path = geoPath(projection).digits(1)
  const ufs = fc.features.map((f) => {
    const code = Number(f.properties.codarea)
    const [cx, cy] = path.centroid(f)
    return {
      uf: UF_BY_IBGE[code],
      ibge: code,
      region: REGION_BY_DIGIT[String(code)[0]],
      d: path(f),
      cx: Math.round(cx),
      cy: Math.round(cy),
    }
  })
  await writeFile(
    new URL('brasil-ufs.json', DATA),
    JSON.stringify({ source: 'IBGE, API de malhas territoriais v3 (qualidade intermediária)', url, viewBox: `0 0 ${W} ${H}`, ufs }),
  )
  console.log('mapa:', ufs.length, 'UFs')
}

// ---------------------------------------------------------------- apuração
const slimSnapshot = (s) => ({
  office: s.office,
  region: s.region,
  status: s.status,
  generated_at: s.generated_at,
  sections: s.sections,
  electorate: s.electorate,
  votes: s.votes,
  candidates: s.candidates.map((c) => ({
    tse_id: c.tse_id,
    ballot_number: c.ballot_number,
    ballot_name: c.ballot_name,
    party: c.party,
    votes: c.votes,
    pct_valid: c.pct_valid,
    elected: c.elected,
    situation: c.situation,
  })),
  provenance: s.provenance,
})

async function apuracao() {
  const feeds = await getJson(`${API}/results/eleicoes-gerais-2026/1/`)
  const out = { presidente: {}, governador: {} }
  for (const f of feeds.filter((x) => x.has_data)) {
    if (!(f.office.slug in out)) continue
    const s = await getJson(`${API}/results/eleicoes-gerais-2026/1/${f.office.slug}/${f.region.code}/`)
    out[f.office.slug][f.region.code] = slimSnapshot(s)
  }
  await writeFile(new URL('apuracao.json', DATA), JSON.stringify(out))
  console.log('apuração:', Object.keys(out.presidente).length, 'presidente,', Object.keys(out.governador).length, 'governador')
  return out
}

// ---------------------------------------------------------------- perfil de demonstração
async function pessoa(id) {
  const person = await getJson(`${API}/people/${id}/`)
  const years = person.parliament?.expense_years ?? []
  const expenses = {}
  for (const y of years) expenses[y] = await getJson(`${API}/people/${id}/expenses/?ano=${y}`)
  const votes = await getJson(`${API}/people/${id}/votes/?page=1`)
  const propositions = await getJson(`${API}/people/${id}/propositions/?page=1`)
  const current = person.candidacies[0]
  const candidacy = current ? await getJson(`${API}/candidates/${current.tse_id}/`) : null
  await writeFile(new URL('pessoa-demo.json', DATA), JSON.stringify({ person, expenses, votes, propositions, candidacy }))
  console.log('pessoa:', person.ballot_name, '| despesas', years.join(','))
  return { person, candidacy }
}

// ---------------------------------------------------------------- fotos
async function fotos(entries) {
  await mkdir(PHOTOS, { recursive: true })
  let ok = 0
  let missing = 0
  const queue = [...entries]
  async function worker() {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const file = new URL(`${item.tse_id}.webp`, PHOTOS)
      try {
        await access(file)
        ok++
        continue
      } catch {}
      try {
        const res = await fetch(item.url)
        if (!res.ok) throw new Error(String(res.status))
        const buf = Buffer.from(await res.arrayBuffer())
        // 3:4, rosto no terço superior; 240 px de largura atende ao maior avatar em tela 2x.
        await sharp(buf).resize(240, 320, { fit: 'cover', position: 'top' }).webp({ quality: 72 }).toFile(file.pathname.slice(1))
        ok++
      } catch {
        missing++
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  console.log('fotos:', ok, 'ok,', missing, 'indisponíveis (o protótipo mostra o substituto)')
  return missing
}

const recorte = JSON.parse(await readFile(new URL('recorte.json', DATA), 'utf8'))
await mapa()
const results = await apuracao()
const { candidacy } = await pessoa(recorte.demo_person.person_id)

const wanted = new Map()
for (const c of recorte.candidates) if (c.photo_url) wanted.set(c.tse_id, c.photo_url)
if (candidacy?.photo_url) wanted.set(candidacy.tse_id, candidacy.photo_url)
const missing = await fotos([...wanted].map(([tse_id, url]) => ({ tse_id, url })))

// Marca no recorte quais fotos existem localmente.
const present = new Set()
for (const [id] of wanted) {
  try {
    await access(new URL(`${id}.webp`, PHOTOS))
    present.add(id)
  } catch {}
}
for (const c of recorte.candidates) c.photo = present.has(c.tse_id)
recorte.photos_missing = missing
await writeFile(new URL('recorte.json', DATA), JSON.stringify(recorte))
console.log('pronto. resultados com', Object.keys(results.governador).length, 'disputas de governador')

