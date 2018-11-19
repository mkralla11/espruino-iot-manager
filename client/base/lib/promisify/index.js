
module.exports = function promisify(f, {firstArgNotError}={}){
  return function(...args){
    return new Promise(function(resolve, reject){
      // const cb = args.pop()
      f(...args, function(...args){
        const [err, ...cbArgs] = args
        if(!firstArgNotError && err){
          return reject(err)
        }
        resolve(...args)
      })
    })
  }
}