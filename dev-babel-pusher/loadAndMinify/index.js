const babel = require("babel-core")
const {promisify} = require('util')
const UglifyJS = require('uglify-js')

const tranformFileAsync = promisify(babel.transformFile.bind(babel))



module.exports = async function transformRuntime(filepath, opts={}){
  let code;
  const babelOpts = opts.babelOptions || {};

  ({code} = await tranformFileAsync(filepath, {...babelOpts, plugins: []}));
  ({code} = UglifyJS.minify(code));
  return code;
}