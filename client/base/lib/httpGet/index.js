module.exports = ({H})=>(url, {onData}={})=>{
  return new Promise((resolve, reject)=>{
    // console.log('H.get', url)
    H.get(url, function(res){
      let allData = ''
      res.on('data', function(data){
        if(onData){
          onData(data)
        }
        else{
          allData += data
        }
      })
      res.on('close', function(){
        // console.log('received data', allData)

        if(/\.json$/.test(url)){
          // console.log(url, allData)
          allData = JSON.parse(allData)
        }
        resolve(allData)
      })
    }).on('error', function(e) {
      // console.log("http!", e)
      reject(e)
    })
  })
}