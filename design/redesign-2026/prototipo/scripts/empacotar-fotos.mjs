// Junta as fotos oficiais (cache/fotos/*.webp) num único arquivo public/fotos.json, em data URIs.
// Motivo: a página publicada aceita no máximo 511 arquivos, e o recorte tem mais de mil fotos.
// Tamanho de lista: 144x192 (cobre o avatar de 72 px em tela 2x). A pessoa de demonstração ganha
// também uma versão grande (chave "<id>@g"), para o retrato do perfil.
import { readdir, readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const dir = new URL('../cache/fotos/', import.meta.url)
const recorte = JSON.parse(await readFile(new URL('../src/data/recorte.json', import.meta.url), 'utf8'))
const demo = JSON.parse(await readFile(new URL('../src/data/pessoa-demo.json', import.meta.url), 'utf8'))
const big = new Set([demo.candidacy?.tse_id].filter(Boolean))

const out = {}
for (const name of await readdir(dir)) {
  const id = name.replace('.webp', '')
  const buf = await readFile(new URL(name, dir))
  const small = await sharp(buf).resize(144, 192).webp({ quality: 68 }).toBuffer()
  out[id] = `data:image/webp;base64,${small.toString('base64')}`
  if (big.has(id)) out[`${id}@g`] = `data:image/webp;base64,${buf.toString('base64')}`
}
await writeFile(new URL('../public/fotos.json', import.meta.url), JSON.stringify(out))
const kb = Math.round(Buffer.byteLength(JSON.stringify(out)) / 1024)
console.log('fotos.json:', Object.keys(out).length, 'entradas,', kb, 'KB; recorte com', recorte.candidates.length)
