const argOrDefault = require('../src/argOrDefault')
const initOtaBooter = require('../init-ota-booter')
const esp = require("espruino")
const path = require('path')
const argv = process.argv

const port = argOrDefault(argv, '--port', '/dev/tty.SLAB_USBtoUART')
const clientBooterPath = path.join(__dirname, '../client/base')

const WIFI_USERNAME = argOrDefault(argv, '--default-wifi-username', '')
const WIFI_PASSWORD = argOrDefault(argv, '--default-wifi-password', '')
const CDN_URL = argOrDefault(argv, '--cdn-url', '')
const CDN_URL_PORT = argOrDefault(argv, '--cdn-url-port', '')


async function run(){
  const otaBoot = initOtaBooter({
    esp,
    port,
    clientBooterPath,
    WIFI_USERNAME,
    WIFI_PASSWORD,
    CDN_URL,
    CDN_URL_PORT
  })
  await otaBoot.setup()
}

run()