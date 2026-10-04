import { describe, expect, it } from 'vitest'
import { getElectionStatus } from './calendar'

const at = (iso: string) => new Date(`${iso}-03:00`)

describe('getElectionStatus', () => {
  it('conta os dias até o 1º turno', () => {
    const status = getElectionStatus(at('2026-09-13T10:00:00'))
    expect(status).toMatchObject({ phase: 'upcoming', daysLeft: 21, round: { number: 1 } })
  })

  it('conta dias de calendário em Brasília, não blocos de 24h', () => {
    // 23h59 do dia 3 já está a um dia do domingo de eleição.
    expect(getElectionStatus(at('2026-10-03T23:59:00'))).toMatchObject({ phase: 'upcoming', daysLeft: 1 })
  })

  it('indica votação em andamento durante o horário das seções', () => {
    expect(getElectionStatus(at('2026-10-04T08:00:00'))).toMatchObject({ phase: 'voting', round: { number: 1 } })
    expect(getElectionStatus(at('2026-10-04T16:59:00'))).toMatchObject({ phase: 'voting' })
  })

  it('após o fechamento, aponta o 2º turno da mesma eleição', () => {
    const status = getElectionStatus(at('2026-10-04T19:00:00'))
    expect(status).toMatchObject({ phase: 'counting', round: { number: 1 }, next: { daysLeft: 21, round: { number: 2 } } })
  })

  it('a janela de apuração dura até o fim do dia seguinte', () => {
    expect(getElectionStatus(at('2026-10-05T23:00:00'))).toMatchObject({ phase: 'counting' })
    expect(getElectionStatus(at('2026-10-06T09:00:00'))).toMatchObject({ phase: 'upcoming', round: { number: 2 }, daysLeft: 19 })
  })

  it('depois do último turno não inventa um próximo turno de outra eleição', () => {
    const status = getElectionStatus(at('2026-10-25T18:00:00'))
    expect(status).toMatchObject({ phase: 'counting', round: { number: 2 } })
    expect(status && 'next' in status ? status.next : undefined).toBeUndefined()
  })

  it('segue para a eleição seguinte quando o calendário anterior termina', () => {
    expect(getElectionStatus(at('2026-11-10T12:00:00'))).toMatchObject({
      phase: 'upcoming',
      election: { name: 'Eleições Municipais 2028' },
    })
  })

  it('retorna null quando não há eleição futura cadastrada', () => {
    expect(getElectionStatus(at('2030-01-01T00:00:00'))).toBeNull()
  })
})
