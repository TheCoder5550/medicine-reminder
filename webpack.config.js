const path = require('path');
const dotenv = require('dotenv');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { DefinePlugin } = require('webpack');
const FaviconsWebpackPlugin = require('favicons-webpack-plugin')

dotenv.config({ path: './.env' }); 

const name = "Medicine reminder";
const description = "Automatically add reminders to Google Calendar for when medicine expires by scanning the data matrix";

module.exports = env => {
  const isDev = !!env.WEBPACK_SERVE;
  if (isDev) {
    console.log("Development build");
  }
  else {
    console.log("Production build");
  }

  return {
    mode: isDev ? "development" : "production",

    devtool: isDev ? 'inline-source-map' : undefined,
    devServer: isDev ? {
      static: './dist',
      // Make ngrok work
      allowedHosts: 'all',
      client: {
        webSocketURL: 'auto://0.0.0.0:0/ws'
      },
    } : undefined,
    optimization: isDev ? {
      runtimeChunk: "single",
    } : undefined,

    plugins: [
      new HtmlWebpackPlugin({
        title: name,
        template: "./src/index.html",
      }),

      new DefinePlugin({
        'process.env': JSON.stringify(dotenv.config().parsed)
      }),

      new FaviconsWebpackPlugin({
        logo: "./logo.png",
        mode: "webapp",
        favicons: {
          appName: name,
          appShortName: "Med reminder",
          appDescription: description,
        }
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

        // Images
        {
          test: /\.(png|svg|jpg|jpeg|gif|webp|hdr)$/i,
          type: "asset/resource",
        },

        // JSON
        {
          test: /\.(json)$/i,
          type: "asset/resource",
        },
      ],
    },
  };
};