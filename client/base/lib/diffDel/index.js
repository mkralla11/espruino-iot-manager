const readHshFileList = require('../readHshFileList')

module.exports = function({S, keep, kMods=[], rm}){

  function loadFileLists(flNames){
    let names = []
    for(const name of flNames){
      names = names.concat(readHshFileList(name, {S}))
    }
    return names
  }

  const rmNames = loadFileLists(rm)
  let kNames = loadFileLists(keep)

  kNames = kNames.concat(kMods)
  console.log('rmNames', rmNames)
  console.log('kNames', kNames)
  for(const rmName of rmNames){
    if(kNames.indexOf(rmName) < 0){
      console.log('deleting unshared file', rmName)
      S.erase(rmName)
    }
  }

}

