module.exports = function({src}){
  return {
    babelrc: false,
    "presets": [
      [
        require.resolve("babel-preset-env"),
        {
          "targets": {
            "node": "1"
          }
        }
      ]
    ],
    "plugins": [
      [require.resolve("babel-plugin-module-resolver"), {
        "root": [src],
      }],
      require.resolve("babel-plugin-syntax-dynamic-import"),
      [require.resolve("babel-plugin-import-redirect"),
      {
        "suppressResolveWarning": true,
        "redirect": {
          [`${src}/(.*)`]: `^^^${src}/$1^^^`,
          [`^\/node_modules/(.+)`]: `espruino_module_$1`
        }
      }]
    ]
  }
}