const ts = require('typescript')
const babel = require('@babel/core')
const jestHoist = require('babel-plugin-jest-hoist')

module.exports = {
  process(source, filename) {
    const compiled = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText

    const result = babel.transformSync(compiled, {
      filename,
      babelrc: false,
      configFile: false,
      plugins: [jestHoist],
      sourceType: 'script',
    })

    if (!result || !result.code) {
      throw new Error('R449: transformação vazia')
    }

    return { code: result.code }
  },
}
