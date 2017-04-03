var path = require('path');
var webpack = require('webpack');
var ExtractTextPlugin = require('extract-text-webpack-plugin');

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
      },
      {
        test: /\.css$/,
        loader: ExtractTextPlugin.extract('css-loader')
      },
      {
        test: /\.(png|jpg|gif|svg|eot|ttf|woff|woff2)$/,
        loader: 'url-loader',
        options: {
          limit: 10000
        }
      }
    ]
  },
  plugins: [
    new ExtractTextPlugin("styles.css"),
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
      // {
      //   test: /\.woff($|\?)|\.woff2($|\?)|\.ttf($|\?)|\.eot($|\?)|\.svg($|\?)/,
      //   loader: 'url-loader'
      // }
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
