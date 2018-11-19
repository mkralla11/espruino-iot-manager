const booter = require('./lib/booter')

// E.on('init', function() {
  booter({
    modules(){
      return Modules
    },
    storage(){
      return require('./lib/SCompat')
    },
    http(){
      return require('http')
    },
    wifi(){
      return require("Wifi")
    },
    random(){
      return E.hwRand()
    },
    reset: reset,
    load: load,
    cdnUrl: process.env.CDN_URL,
    wifiUsername: process.env.WIFI_USERNAME,
    wifiPassword: process.env.WIFI_PASSWORD
  })
// })