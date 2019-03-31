const argOrDefault = require('../src/argOrDefault')
const initDevServer = require('../dev-server')
const { exec } = require('child_process')
const esp = require("espruino")
const path = require('path')

const src = argOrDefault(process.argv, '--src', process.cwd() + '/src')

const port = argOrDefault(process.argv, '--port', '5858')

setup()

function setup(){  
  exec("ifconfig | grep 'inet 192'| awk '{ print $2}'", (err, devServerIp, stderr) => {
    if(err){
      throw err
    }
    // devServerIp = devServerIp.replace(/\r?\n|\r/, '')
    const devServer = initDevServer({port, src})

    devServer.runLocalServer()
  })
}