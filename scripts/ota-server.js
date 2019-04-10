const argOrDefault = require('../src/argOrDefault')
const initDevServer = require('../dev-server')
const { exec } = require('child_process')
const {promisify} = require('util')

const esp = require("espruino")
const path = require('path')

const src = argOrDefault(process.argv, '--src', process.cwd() + '/src')

const port = argOrDefault(process.argv, '--port', '5858')

const asyncExec = promisify(exec)


setup()

async function setup(){  


  try{
    let {stdout: devServerIp} = await asyncExec("ifconfig | grep 'inet 192'| awk '{ print $2}'")
    devServerIp = devServerIp.replace(/\r?\n|\r/, '')
    process.env.DEV_SERVER_IP = devServerIp
  }
  catch(e){
    console.warn('Could not provide ip address for process.env.DEV_SERVER_IP')
  }
  debugger


  // devServerIp = devServerIp.replace(/\r?\n|\r/, '')
  const devServer = initDevServer({port, src})

  devServer.runLocalServer()

}