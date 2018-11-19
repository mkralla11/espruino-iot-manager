module.exports = function atmptCon({S, connect, wifiUsername, wifiPassword}){
  return new Promise((resolve, reject)=>{
    try{
    let {u, pswrd} = (S.readJSON('WFCRD') || {})
    if(!u){
      u = wifiUsername
      pswrd = wifiPassword
    }

    connect(u, {password: pswrd}, (e)=>{
      if(e){
        console.log('atmptCon!', e)
        return reject(e)
      }
      resolve()
    })
    }
    catch(e){
      console.log('atmptCon!', atmptCon)
      Promise.reject(e)
    }
  })
}