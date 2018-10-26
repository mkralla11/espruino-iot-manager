module.exports = function(config){
  let configNestedArray = Object.entries(config)
  configNestedArray.sort(([k1, a], [k2, b])=>
    b.position - a.position
  )
  return configNestedArray
}