var path = require('path');
var webpack = require('webpack');

module.exports = {
  entry: './src',
  target: 'node',
  output: {
    path: path.resolve(__dirname, './build'),
    filename: 'bundle.js'
  },
  module: {
    loaders: [
      {
        test: /\.js$/,
        loader: 'babel-loader',
        include: __dirname + '/src'
      }
    ]
  },
  plugins: [
    new webpack.LoaderOptionsPlugin({
      options: {
        babel: {
          "presets": ["es2015"],
          "plugins": ["transform-runtime"]
        }
      }
    }),
    new webpack.ProvidePlugin({
      $: "jquery",
      jQuery: "jquery",
      Hammer: "hammerjs/hammer"
    })
  ]

}

// module.exports = {
//   entry: './app/main.js',
//   target: 'node',
//   output: {
//     path: path.resolve(__dirname, './dist'),
//     filename: 'build.js'
//   },
//   module: {
//     rules: [
//       {
//         test: /\.css$/,
//         use: [ 'style-loader', 'css-loader' ]
//       }
//     ],
//     loaders: [
//       {
//         test: /\.vue$/,
//         loader: 'vue-loader'
//       },
//       {
//         test: /\.js$/,
//         loader: 'babel-loader',
//         exclude: /node_modules/
//       },
//       {
//         test: /\.woff($|\?)|\.woff2($|\?)|\.ttf($|\?)|\.eot($|\?)|\.svg($|\?)/,
//         loader: 'url-loader'
//       }
//     ]
//   },
//   plugins: [
//     new webpack.ExternalsPlugin('commonjs', [
//       'electron'
//     ]),
//     new webpack.LoaderOptionsPlugin({
//       options: {
//         babel: {
//           "presets": ["es2015"],
//           "plugins": ["transform-runtime"]
//         }
//       }
//     }),
//     new webpack.ProvidePlugin({
//       $: "jquery",
//       jQuery: "jquery",
//       Hammer: "hammerjs/hammer"
//     })
//   ]
// }
