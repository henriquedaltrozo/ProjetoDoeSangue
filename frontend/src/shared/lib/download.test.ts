import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadJson } from './download'

describe('downloadJson', () => {
  afterEach(() => vi.restoreAllMocks())

  it('cria um link com o nome do arquivo, clica e libera a URL depois', async () => {
    vi.useFakeTimers()
    const createObjectURL = vi.fn(() => 'blob:fake')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadJson({ a: 1 }, 'dados.json')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0]
    expect(JSON.parse(await blob.text())).toEqual({ a: 1 })
    expect(click).toHaveBeenCalledTimes(1)
    // Não libera na hora (o navegador pode ainda não ter começado o download)...
    expect(revokeObjectURL).not.toHaveBeenCalled()
    // ...só depois de um tempo.
    vi.advanceTimersByTime(1_000)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake')
    vi.useRealTimers()
  })
})
