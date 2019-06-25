module.exports = function({src}){
  return {
    babelrc: false,
    comments: false,
    "presets": [
      [
        require.resolve("@babel/preset-env"),
        {
          "targets": {
            "node": "10"
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
        require.resolve("@babel/plugin-transform-spread"), 
        {
          "useBuiltIns": true
        }
      ],
      [
        require.resolve("babel-plugin-transform-inline-environment-variables"), 
        {
          "exclude": [
            // "NODE_ENV",
            // "DEV_SERVER_IP"
          ]
        }
      ],
      require.resolve("@babel/plugin-transform-computed-properties"),
      require.resolve("@babel/plugin-transform-shorthand-properties"),
      require.resolve("@babel/plugin-transform-parameters"),
      require.resolve("@babel/plugin-transform-destructuring")
    ]
  }
}