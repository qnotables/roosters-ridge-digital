const fs = require('node:fs')
const fsp = require('node:fs/promises')
const path = require('node:path')
const net = require('node:net')
const tls = require('node:tls')

// Verification processes must use a scrubbed environment as well as this preloader.
function isEnvironmentFile(file) {
  const value = file instanceof URL ? file.pathname : String(file)
  return path.basename(value).startsWith('.env') || value === '/vercel/share/.env.project'
}
function protectRead(original) {
  return function (file, ...args) {
    if (isEnvironmentFile(file)) {
      const error = new Error('Offline verification: environment file unavailable')
      error.code = 'ENOENT'
      throw error
    }
    return original.call(this, file, ...args)
  }
}
fs.readFileSync = protectRead(fs.readFileSync)
fsp.readFile = protectRead(fsp.readFile)
fs.readFile = protectRead(fs.readFile)
function blockNetwork() { throw new Error('Offline verification: network access forbidden') }
globalThis.fetch = blockNetwork
net.Socket.prototype.connect = blockNetwork
tls.connect = blockNetwork
for (const name of ['node:http', 'node:https']) {
  const transport = require(name)
  transport.request = blockNetwork
  transport.get = blockNetwork
}
