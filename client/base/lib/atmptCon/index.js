module.exports = function atmptCon({S, connect, wifiUsername, wifiPassword}){
  return new Promise((resolve, reject)=>{

    try{
    let {u, pswrd} = (S.readJSON('WFCRD') || {})
    if(!u){
      u = wifiUsername
      pswrd = wifiPassword
    }
    if(!u){
      return resolve({noCreds: true})
    }
    connect(u, {password: pswrd}, (e)=>{
      if(e){
        console.log('could not conn in atmptCon!', e)
        return reject(e)
      }
      resolve()
    })
    }
    catch(e){
      console.log('atmptCon error loading creds', e)
      Promise.reject(e)
    }
  })
}