const fs = require('fs'), vm = require('vm'), assert = require('assert/strict')
let pwa
const sandbox = { process: { env: { NODE_ENV: 'production' } }, module: { exports: {} }, require: name => {
  assert.equal(name, 'next-pwa')
  return options => { pwa = options; return config => config }
}, self: { location: { origin: 'https://dfl-finance.vercel.app' } } }
vm.runInNewContext(fs.readFileSync('next.config.js', 'utf8'), sandbox)
const rule = pwa.runtimeCaching.find(r => r.options.cacheName === 'others')
assert.ok(rule, 'HTML navigation must read the frontend navigation cache')
const matches = (path, overrides = {}) => rule.urlPattern({url: new URL(path, sandbox.self.location.origin), request: {mode: 'navigate', destination: 'document', headers: new Headers(), ...overrides}})
assert.equal(matches('/home'), true)
assert.equal(matches('/transactions'), true)
assert.equal(matches('/api/private'), false)
assert.equal(matches('/auth/callback'), false)
assert.equal(matches('https://example.com/home'), false)
assert.equal(matches('/home?_rsc=abc'), false)
assert.equal(matches('/home', { headers: new Headers({ RSC: '1' }) }), false)
assert.equal(matches('/home', { mode: 'cors', destination: '' }), false)
assert.equal(rule.handler, 'NetworkFirst')
assert.equal(pwa.cacheOnFrontEndNav, true)
assert.equal(pwa.reloadOnOnline, false)
assert.ok(fs.readFileSync('src/app/page.tsx', 'utf8').includes("window.location.replace('/home')"))
console.log('OFFLINE: HTML cache conectado; API/Auth/RSC isolados; abertura raiz preservada.')
