/*
 * FlashLoader.js - Load all code modules saved in flash using the FlashString module
 * Thorsten von Eicken 2016
 * MIT License
 *
 * Usage: require("FlashLoader")();
 */



// iterate through flash pages and load all modules



E.on('init', function() {
  const S = require("Storage")
  const files = S.readJSON('filelist') || {fileList: []}
  console.log('files', files)
  files.fileList.forEach((name)=>{
    console.log('adding', name)
    const data = S.read(name)
    try{
      Modules.addCached(name, data)
    }
    catch(e){
      console.log('error!', name, data)
    }
  })
})


  // var FL = require("Flash");
  // var FR = FL.getFree()[2]; // 3rd area has biggest chunk under 1MB
  // var FB = FR.addr;         // start of flash save area (0xf7000)
  // var FS = 0x1000;          // esp8266 flash page size
  // var FN = FR.length / FS;  // number of flash pages
  // var FO = 0x40200000;      // offset from flash address to its memory-mapped location

  // for (var i=0; i<FN; i++) {
  //   var addr = FB+i*FS;
  //   //console.log("Checking", i, addr.toString(16));
  //   // read index at start of page with name length and code text length
  //   var ix = FL.read(4, addr);
  //   var nameLen = ix[0]<<2;
  //   var codeAddr = addr+4+nameLen;
  //   var codeLen = ix[1]<<4;
  //   // see whether page is unused
  //   if (ix[0] == 0 || ix[1] == 0 || ix[2] != 0xA5 || ix[3] != 0xC3) {
  //     // console.log("  nothing at", addr.toString(16));
  //     continue;
  //   }
  //   // read the name
  //   var name = E.toString(FL.read(nameLen, addr+4)).trim();
  //   // load memory area as module
  //   console.log("  memoryArea", codeAddr.toString(16), codeLen, name);
  //   console.log(E.toString(FL.read(codeLen, codeAddr)).trim());
  //   out = FO+codeAddr;
  //   Modules.addCached(name, E.memoryArea(FO+codeAddr, codeLen));
  // }