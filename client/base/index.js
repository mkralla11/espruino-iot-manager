(function(){
  const booter = require('./lib/booter')
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
    cdnUrl: require('Storage').read('D_CDN'),
    wifiUsername: require('Storage').read('D_WU'),
    wifiPassword: require('Storage').read('D_WP')
})})()