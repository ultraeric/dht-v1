const path = require('path');
const webpack = require('webpack');
const _ = require('lodash');
const os = require('os');
const fs = require('fs');
const UglifyEsPlugin = require('uglify-es-webpack-plugin');
const CompressionPlugin = require('compression-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require('copy-webpack-plugin');


/** Shared aliases for building both the backend and frontend JS bundles. **/
const aliases = {
  frontend: path.resolve(__dirname, './src/frontend'),
  backend: path.resolve(__dirname, './src/backend'),
  shared: path.resolve(__dirname, './src/shared'),
  blockchainSetup: path.resolve(__dirname, './BlockchainSetup'),
};

const optimization = {
  minimize: false
};

const mod_client = {
  rules: [
    // {
    //   test: [/\.jsx?$/],
    //   loader: 'babel-loader',
    //   exclude: path.resolve(__dirname, 'node_modules'),
    //   query: { presets:[ 'env', 'react'] }
    // }
  ]
};

const mod = {
  rules: [
    // {
    //   test: [/\.jsx?$/],
    //   loader: 'babel-loader',
    //   exclude: path.resolve(__dirname, 'node_modules'),
    //   query: { presets:[ 'env', 'react'] }
    // }
  ]
};

const plugins = [
  new webpack.DefinePlugin({
    'process.env': {
      NODE_ENV: JSON.stringify('production')
    }
  }),
  new UglifyEsPlugin(),
  new webpack.optimize.AggressiveMergingPlugin(),
  new CompressionPlugin({
    asset: "[path].gz[query]",
    algorithm: "gzip",
    test: /\.js$|\.css$|\.html$/,
    threshold: 10240,
    minRatio: 0.8
  })
];
var plugins_client = plugins.slice();

var nodeModules = {};

fs.readdirSync('node_modules')
    .filter(function(x) {
        return ['.bin'].indexOf(x) === -1;
    })
    .forEach(function(mod) {
        nodeModules[mod] = 'commonjs ' + mod;
    });

module.exports = [
{
  entry: {
    serverBundle: './src/backend/server.js',
    clientBundle: './src/frontend/client.js'
  },
  target: 'node',
  node: {
    __dirname: false,
    __filename: false,
  },
  output: {
    path: path.resolve(__dirname, './public'),
    publicPath: '/',
    filename: '../deploy/[name].js'
  },
  resolve: {
    alias: aliases,
    extensions: [
      '.js', '.jsx'
    ]
  },
  externals: nodeModules,
  module: mod,
  plugins: plugins
}];
