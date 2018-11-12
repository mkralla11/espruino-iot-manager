const https = require('https')
const rp = require('request-promise-native')
const findCacheDir = require('find-cache-dir')
const fs = require('fs-extra')

module.exports = function(){
  const espUrl = 'https://www.espruino.com/modules'

  async function get(filename){
    const cacheExists = await hasCache()
    if(!cacheExists){
      await loadAllModules()
    }
    return getFileFromDisk(filename)
  }



  function loadAllModules(){
    return new Promise((resolve)=>{
      fetchIndex().then((html)=>{
        const urls = extractUrls(html)
        getAllDataFromUrls({
          urls,
          afterFetchUrl
        }).then(()=>{
          resolve()
        })
      })
    })

  }


  function afterFetchUrl(filename, js){
    // store the data
    console.log('fetched and ready to store:', filename)
    return new Promise((resolve)=>{
      fs.outputFile(`${getCachePath(filename.replace(/\.js$/, ""))}/index.js`, js, (err) => {
        if (err) throw err;
        resolve()
      });
    })
  }

  function getAllDataFromUrls({urls, afterFetchUrl}){
    console.log(urls)
    const promises = urls.map((url)=>{
      return requestAndHandleAfterFetchUrl(url, {afterFetchUrl})
    })

    return Promise.all(promises)
  }


  function requestAndHandleAfterFetchUrl(filename, {afterFetchUrl}){
    return new Promise((resolve)=>{
      rp(espUrl + '/' + filename).then((js)=>{
        afterFetchUrl(filename, js).then(resolve)
        resolve()
      })
    })
  }



  function extractUrls(html){
    const $ = cheerio.load(html) 
    const urls = $('td a').get().map((el)=>{
      return $(el).attr('href')
    })
    return urls
  }

  function fetchIndex(){
    return new Promise((resolve)=>{
      https.get(espUrl + '/', (res) => {
        res.setEncoding('utf8')
        let rawData = ''
        res.on('data', (chunk) => { rawData += chunk; })
        res.on('end', () => {
          try {
            resolve(rawData)
          } catch (e) {
            console.error(e.message)
          }
        })
      })
    })
  }

  async function hasCache(){
    const exists = await fs.pathExists(getCachePath())
    return exists
  }

  function getCachePath(file=''){
    return findCacheDir({name: 'espruino-iot-manager'}) + '/espruino_modules/' + file
  }

  return {
    get
  }
}