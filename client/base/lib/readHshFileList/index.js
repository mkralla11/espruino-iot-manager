
module.exports = function(hsh, {S}){
  const fallback = {fileList: []}
  console.log('reading file', hsh)
  let files
  try{
    files = hsh ? S.readJSON(hsh) || fallback : fallback
  }
  catch(e){
    console.log('rf!', e)
    files = fallback
  }
  return files.fileList
}