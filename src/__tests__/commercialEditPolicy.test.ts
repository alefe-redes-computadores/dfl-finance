import { prepareOrganizationEdit, prepareStoreEdit, preparePlatformReference } from '@/lib/commercialEditPolicy'

describe('R455: edição comercial preserva relacionamentos e modos OFF', () => {
  it('normaliza edição da organização sem alterar propriedade ou vínculos', () => {
    expect(prepareOrganizationEdit({ name: '  Da Família Lanches  ', legalName: '  Razão Social  ', taxId: '04.252.011/0001-10' }))
      .toEqual({ name: 'Da Família Lanches', legal_name: 'Razão Social', tax_id: '04252011000110' })
    expect(prepareOrganizationEdit({ name: 'DFL', legalName: '', taxId: '' }))
      .toEqual({ name: 'DFL', legal_name: null, tax_id: null })
    expect(() => prepareOrganizationEdit({ name: ' ', legalName: '', taxId: '' })).toThrow()
    expect(() => prepareOrganizationEdit({ name: 'DFL', legalName: '', taxId: '11.111.111/1111-11' })).toThrow()
  })

  it('valida loja e recusa URL não HTTPS e credenciais', () => {
    expect(prepareStoreEdit({ name: '  Loja Centro ', acronym: 'dfl1', logoUrl: '' }))
      .toEqual({ name: 'Loja Centro', acronym: 'DFL1', logo_url: null })
    expect(() => prepareStoreEdit({ name: 'DFL', acronym: 'DFL', logoUrl: 'http://example.com/logo.png' })).toThrow()
    expect(() => prepareStoreEdit({ name: 'DFL', acronym: 'DFL', logoUrl: 'https://user:pass@example.com/' })).toThrow()
    expect(() => prepareStoreEdit({ name: 'DFL', acronym: '!!', logoUrl: '' })).toThrow()
  })

  it('edita só referência da plataforma, preservando modo OFF e fornecedor', () => {
    expect(preparePlatformReference('  LOJA-123  ')).toEqual({ external_merchant_ref: 'LOJA-123' })
    expect(preparePlatformReference('')).toEqual({ external_merchant_ref: null })
    expect(() => preparePlatformReference('x'.repeat(161))).toThrow()
  })
})
