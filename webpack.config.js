const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { DefinePlugin } = require('webpack');
const dotenv = require('dotenv');

dotenv.config({ path: './.env' }); 

module.exports = {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    static: './dist',
    server: "https"
  },
  optimization: {
    runtimeChunk: 'single',
  },

  plugins: [
    new HtmlWebpackPlugin({
      title: 'Development',
      template: "index.html",
    }),

    new DefinePlugin({
      'process.env': JSON.stringify(dotenv.config().parsed)
    })
  ],

  entry: {
    index: './src/index.js',
  },

  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },

  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
};