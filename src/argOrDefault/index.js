
function argOrDefault(args, arg, defaultVal){
  const idIdx = args.findIndex(x => x === arg);
  const val = idIdx === -1 ? defaultVal : args[idIdx + 1];
  return val
}

module.exports = argOrDefault