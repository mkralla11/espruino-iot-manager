module.exports = function(sortedConfig){
  const fileList = []
  for (const data of sortedConfig){
    let {filenameId, entryPoint} = data
    fileList.push(filenameId)
  }
  return fileList
}