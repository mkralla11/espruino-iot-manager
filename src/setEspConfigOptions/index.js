

module.exports = function(Espruino){
  Espruino.Config.BAUD_RATE = "115200"
  Espruino.Config.SAVE_ON_SEND = true
  Espruino.Config.MINIFICATION_LEVEL = "ESPRIMA"
  Espruino.Config.MODULE_AS_FUNCTION = true
  Espruino.Config.MODULE_MINIFICATION_LEVEL = "ESPRIMA"
  Espruino.Config.BLUETOOTH_LOW_ENERGY = false
}