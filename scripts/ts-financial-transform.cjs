const ts = require('typescript')
module.exports = {
  process(source, filename) {
    return { code: ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
        esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    }).outputText }
  },
}
