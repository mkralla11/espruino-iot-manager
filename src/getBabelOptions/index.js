module.exports = function({src}){
  return {
    babelrc: false,
    comments: false,
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
      [
      require.resolve("babel-plugin-module-resolver"), 
        {
          "root": [src],
        }
      ],
      [
        require.resolve("babel-plugin-transform-for-of-as-array"), 
        {
          "loose": true
        }
      ],
      require.resolve("babel-plugin-syntax-dynamic-import"),

    ]
  }
}