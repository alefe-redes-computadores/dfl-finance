import fs from 'node:fs'
import assert from 'node:assert/strict'
import ts from 'typescript'

const specs = [
  {
    path:'src/app/(app)/accounts/page.tsx',
    labels:[
      'Pesquisar contas',
      'Adicionar conta',
      'Limpar pesquisa',
      'Abrir filtros e ordenação',
      'Mostrar todas as contas',
      'Mover conta para cima',
      'Mover conta para baixo',
      'Excluir conta selecionada',
      'Fechar filtros e ordenação'
    ]
  },
  {
    path:'src/app/(app)/cards/page.tsx',
    labels:[
      'Fechar personalização',
      'Salvar personalização',
      'Adicionar cartão',
      'Personalizar cartões',
      'Ver mês anterior',
      'Ver próximo mês'
    ]
  }
]

let total=0

for(const spec of specs){
  const source=fs.readFileSync(spec.path,'utf8')
  const sf=ts.createSourceFile(
    spec.path,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )

  assert.equal(sf.parseDiagnostics.length,0)

  const buttons=[]

  function visit(node){
    if(ts.isJsxElement(node) &&
       node.openingElement.tagName.getText(sf)==='button'){
      buttons.push(node.openingElement)
    }
    ts.forEachChild(node,visit)
  }

  visit(sf)

  for(const label of spec.labels){
    const matches=buttons.filter(button=>
      button.attributes.properties.some(attribute=>
        ts.isJsxAttribute(attribute) &&
        attribute.name.getText(sf)==='aria-label' &&
        attribute.initializer &&
        ts.isStringLiteral(attribute.initializer) &&
        attribute.initializer.text===label
      )
    )

    // Controles com identificacao dinamica preservam
    // o nome da conta no aria-label.
    if(matches.length===0 && spec.path.includes('accounts')){
      const dynamic={
        'Mover conta para cima':{
          action:"moveAccount(",
          detail:"'up'"
        },
        'Mover conta para baixo':{
          action:"moveAccount(",
          detail:"'down'"
        },
        'Excluir conta selecionada':{
          action:"setDeleteModal(account.id)",
          detail:""
        },
        'Fechar filtros e ordenação':{
          action:"setShowViewOptions(false)",
          detail:"<X"
        }
      }[label]

      if(dynamic){
        const semantic=buttons.filter(button=>{
          const full=button.parent.getText(sf)
          const props=button.attributes.properties

          const hasAction=full.includes(dynamic.action)
          const hasDetail=!dynamic.detail ||
            full.includes(dynamic.detail)

          return hasAction && hasDetail &&
            props.some(p=>
              ts.isJsxAttribute(p) &&
              p.name.getText(sf)==='aria-label'
            )
        })

        matches.push(...semantic)
      }
    }

    assert.equal(matches.length,1,
      `Controle ausente ou duplicado: ${label}`)

    const props=matches[0].attributes.properties

    for(const required of ['type','title','className']){
      assert(
        props.some(p=>
          ts.isJsxAttribute(p) &&
          p.name.getText(sf)===required
        ),
        `${label}: ${required} ausente`
      )
    }

    total++
    console.log('OK:',label)
  }
}

assert.equal(total,15)
console.log('R384:',total,'contratos JSX aprovados')
