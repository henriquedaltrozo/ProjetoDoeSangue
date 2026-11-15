import { describe, expect, it } from 'vitest'
import { extractErrorMessage } from './http'

function fakeAxiosError(data: unknown, status = 400) {
  return { isAxiosError: true, response: { status, data } }
}

describe('extractErrorMessage', () => {
  it('retorna a mensagem quando é uma string', () => {
    const error = fakeAxiosError({ message: 'CPF já cadastrado.' })
    expect(extractErrorMessage(error)).toBe('CPF já cadastrado.')
  })

  it('junta as mensagens quando é um array (erros de validação do class-validator)', () => {
    const error = fakeAxiosError({ message: ['Campo obrigatório.', 'CPF inválido.'] })
    expect(extractErrorMessage(error)).toBe('Campo obrigatório. CPF inválido.')
  })

  it('retorna o fallback quando não é um erro do axios', () => {
    expect(extractErrorMessage(new Error('erro genérico'))).toBe('Algo deu errado. Tente novamente.')
  })

  it('aceita um fallback customizado', () => {
    expect(extractErrorMessage(new Error('x'), 'Não foi possível salvar.')).toBe('Não foi possível salvar.')
  })

  it('retorna o fallback quando a resposta não tem uma mensagem utilizável', () => {
    const error = fakeAxiosError({})
    expect(extractErrorMessage(error)).toBe('Algo deu errado. Tente novamente.')
  })

  it('erro interno (5xx) nunca mostra o texto do servidor', () => {
    const error = fakeAxiosError({ message: 'Internal server error' }, 500)
    expect(extractErrorMessage(error, 'Não foi possível agendar.')).toBe('Não foi possível agendar.')
  })

  it('excesso de tentativas (429) vira uma mensagem em português', () => {
    const error = fakeAxiosError({ message: 'ThrottlerException: Too Many Requests' }, 429)
    expect(extractErrorMessage(error)).toMatch(/Muitas tentativas/)
  })

  it('sem resposta do servidor, avisa sobre a conexão', () => {
    expect(extractErrorMessage({ isAxiosError: true })).toMatch(/conectar ao servidor/)
  })

  it('mensagens padrão do framework (em inglês) não chegam ao usuário', () => {
    expect(extractErrorMessage(fakeAxiosError({ message: 'Unauthorized' }, 401))).toBe(
      'Sua sessão expirou. Entre de novo.',
    )
    expect(extractErrorMessage(fakeAxiosError({ message: 'Forbidden resource' }, 403))).toBe(
      'Você não tem permissão para fazer isso.',
    )
    expect(extractErrorMessage(fakeAxiosError({ message: ['property x should not exist'] }), 'Dados inválidos.')).toBe(
      'Dados inválidos.',
    )
  })
})
