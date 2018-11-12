const babel = require("babel-core")
const {promisify} = require('util')
const UglifyJS = require("uglify-js")

const tranformFileAsync = promisify(babel.transformFile.bind(babel))



module.exports = async function transformRuntime(filepath, opts={}){
  let code;
  const babelOpts = opts.babelOptions || {};

  ({code} = await tranformFileAsync(filepath, {...babelOpts, plugins: []}));
  
  if(opts.replace){
    for(replaceConfig of opts.replace){
      // {
      //   rgx: /process.env.FILE_LIST_KEY_NAME/,
      //   replaceWith: `"${fileListKeyName}"`
      // }
      code = code.replace(replaceConfig.rgx, replaceConfig.replaceWith)
    }
  }
  ({code} = UglifyJS.minify(code));
  return code;
}