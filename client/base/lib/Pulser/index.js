
let tId, queue=[], iId

module.exports = function(opts){
  const write = opts.write || digitalWrite
  function pulse({pin, dur, endOn, total=3, loop, onDur=200, offDur=200, waitPrevMax=2000}={}){
    function exec(lastVal){
      const val = !lastVal
      if(total > 0){
        !loop ? total-- : null
        write(pin, val)
        const dur = val ? onDur : offDur
        // console.log('dur', dur)
        tId = setTimeout(()=>
          exec(val)
        , dur)
      }
      else{
        write(pin, !!endOn)
        clearT()
        checkForNextPulse()
      }
    }
    total *= 2
    exec()
  }

  function checkForNextPulse(){
    checkForOverMax()
    if(!tId){
      const opts = dequeuePulse()
      if(opts){
        pulse(opts)
      }
      else{
        // if there are no more pulsers left,
        // we can clear the interval,
        // which will then re-created
        // on next queuePulse(opts)
        clearI()
      }
    }
  }

  function clearT(){
    if(tId){
      // console.log('clearing')
      clearTimeout(tId)
      tId = null
    }
  }

  function clearI(){
    if(iId){
      clearInterval(iId)
      iId = null
    }
  }

  function queuePulse(opts){
    opts.date = Date.now()
    queue.push(opts)
    checkForNextPulse()
    beginInterval()
  }

  function dequeuePulse(){
    return queue.shift()
  }

  function beginInterval(){
    clearI()
    iId = setInterval(()=>{
      checkForOverMax()
      checkForNextPulse()
    }, 400)
  }

  function checkForOverMax(){
      const d = Date.now()
      let items = queue.filter((i)=>
        d - i.date > i.waitPrevMax
      )
      if(items.length){
        // console.log(items)
        // store the most recently pushed item
        queue = [items.pop()]
        clearT()
        clearI()
      }
    }





  switch(opts.type){
    case "PULSE":
      return queuePulse(opts)
    default:
      return queuePulse(opts)
  }
}