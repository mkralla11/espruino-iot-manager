// OLD UNUSED!

const argOrDefault = require('../src/argOrDefault')
const initDevBabelPusher = require('../dev-babel-pusher')
const chokidar = require('chokidar')
const { exec } = require('child_process')
const esp = require("espruino")
const path = require('path')
const fs = require('fs')
const UglifyJS = require("uglify-js")
const watchSrc = argOrDefault(process.argv, '--watch-src', process.cwd() + '/src')

const port = argOrDefault(process.argv, '--port', '/dev/tty.SLAB_USBtoUART')
const devServerPort = argOrDefault(process.argv, '--dev-server-port', '5858')

const watcher = chokidar.watch(watchSrc)


const src = argOrDefault(process.argv, '--src', path.join(process.cwd(), 'src/index.js'))

esp.init(setup)

function setup(){  
  debugger
  Espruino.Config.BAUD_RATE = "115200";
  Espruino.Config.SAVE_ON_SEND = true;
  Espruino.Config.MINIFICATION_LEVEL = "ESPRIMA";
  Espruino.Config.MODULE_AS_FUNCTION = true;
  Espruino.Config.MODULE_MINIFICATION_LEVEL = "ESPRIMA";
  Espruino.Config.BLUETOOTH_LOW_ENERGY = false;

  

  exec("ifconfig | grep 'inet 192'| awk '{ print $2}'", (err, devServerIp, stderr) => {
    if(err){
      throw err
    }
    devServerIp = devServerIp.replace(/\r?\n|\r/, '')
    const devBabelPusher = initDevBabelPusher({port, Espruino, esp, src: watchSrc, devServerIp})

    console.log('the devServerIp', devServerIp)
    // Espruino.addProcessor("getModule", function({moduleName, moduleCode}, callback){
      
    //   let newModuleName = moduleName
    //   if(/^\./.test(newModuleName)){
    //     if(!/\.js$/.test(newModuleName)){
    //       newModuleName = newModuleName + '/index.js'
    //     }
    //     console.log('final name', newModuleName)

    //     fs.readFile(newModuleName, (err, data) => {
    //       if (err){
    //         throw err
    //       } 
    //       data = data.toString()
    //       console.log(data)

    //       callback({
    //         moduleName,
    //         moduleCode: data
    //       })
    //     })
    //   }
    //   else{
    //     callback({
    //       moduleName,
    //       moduleCode
    //     })
    //   }
    // })

    // Espruino.addProcessor("transformModuleForEspruino", function ({code, name},callback) {
    //   code = code.replace(/process.env.DEV_SERVER_IP/, devServerIp)
    //   callback({code, name})
    // })

    // watcher.on('ready', function(){
    //   watcher.on('all', function(){
    //     compileAndPush()
    //   })
    // })

    // compileAndPush()


    // function compileAndPush(){
    //   devBabelPusher.pushCode({dir: watchSrc, src})
    // }
    devBabelPusher.watch()
  })
}