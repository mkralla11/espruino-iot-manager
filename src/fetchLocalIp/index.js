const { exec } = require('child_process')
const {promisify} = require('util')

const asyncExec = promisify(exec)


module.exports = async function fetchLocalIp(){
  try{
    let {stdout: ip} = await asyncExec("ifconfig | grep 'inet 192'| awk '{ print $2}'")
    ip = ip.replace(/\r?\n|\r/, '')
    console.log('the ip', ip)
    return ip
  }
  catch(e){
    console.log("Error computing local ip...")
    throw e
  }
}