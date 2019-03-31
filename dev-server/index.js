const http = require('http')
const MemoryFileSystem = require('memory-fs')
const fnv = require('fnv-plus')
const {promisify} = require('util')
const babelTransformToMemory = require('./babelTransformToMemory')
const chokidar = require('chokidar')
const path = require('path')
const memfs = new MemoryFileSystem()
const asyncWrite = promisify(memfs.writeFile.bind(memfs))
const asyncRead = promisify(memfs.readFile.bind(memfs))
const fs = require('fs')




function devServer({port, src, namespacePath='/', asyncRead: externalAsyncRead}){
  let memBabel
  const namespacePathLength = namespacePath.length
  let watcher
  let server

  const watch = async ()=>{
    close()
    memBabel = babelTransformToMemory({src, asyncWrite})
    watcher = chokidar.watch(src)
    watcher.on('ready', function(){
      console.log('Dev-server ready and watching...')
      watcher.on('change', async (path, stats) => {
        if (stats) console.log(`File ${path} changed size to ${stats.size}`);
        await memBabel.compile()
        console.log('recompile complete.')
      })
    })
    await memBabel.compile()
    console.log('first compile complete.')
  }


  
  
  async function handleRequest(req, res, next){
    let filePath = req.url


    const extname = path.extname(filePath)
    let contentType = 'text/plain';
    switch (extname) {
      case '.js':
        contentType = 'text/javascript';
        break;
      case '.css':
        contentType = 'text/css';
        break;
      case '.json':
        contentType = 'application/json';
        break;
    }



    try{
      console.log('filePath', filePath)
      if(filePath.slice(0, namespacePathLength) !== namespacePath){
        throw new Error('INCORRECT_NAMESPACE_PATH')
      }

      const endPath = filePath.slice(namespacePathLength, filePath.length)
      console.log('end path', endPath)
      const read = externalAsyncRead || asyncRead
      const content = await read(endPath)
      res.writeHead(200, {'Content-Type': contentType})
      res.end(content, 'utf-8')
      next && next('IOT_SCRIPT_SERVE_COMPLETE')
    }
    catch(error){
      // if we are being used as a middleware,
      // simply continue to the next func in the chain
      if(next){
        next()
      }
      // if we are a standalone server,
      // send a response now if the file does not 
      // exist within the namespace or the namespace
      // for the given filePath was incorrect
      else if(error.code == 'ENOENT' || error.message === 'INCORRECT_NAMESPACE_PATH'){
        res.writeHead(404, {'Content-Type': contentType})
        res.end("NOT FOUND", 'utf-8')
      }
      else {
        res.writeHead(500)
        res.end('Sorry, check with the site admin for error: '+error.code+' ..\n')
        res.end()
      }
    }
  }

  function close(){
    if(watcher){
      watcher.close()
    }
  }


  function runLocalServer(){
    watch()
    server = http.createServer(handleRequest)
    server.listen(port)
  }

  function createMiddleware(){
    return handleRequest
  }

  return {
    runLocalServer,
    watch,
    createMiddleware
  }
}




module.exports = function(opts){
  return devServer(opts)
}