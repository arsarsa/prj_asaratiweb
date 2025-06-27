// webpack.config.mjs

import path from 'path';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import NodePolyfillPlugin from 'node-polyfill-webpack-plugin';
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default {
  entry: {
    main: './src/assets/main.js',
    purchase: './src/scripts/entry/purchase_and_download.js',
  },

  output: {
    path: path.resolve(__dirname, 'public'),
    filename: '[name].bundle.js',
    clean: true,
  },

  resolve: {
    extensions: ['.js', '.json'],
    fallback: {
      stream: 'stream-browserify',
      crypto: 'crypto-browserify',
      http: 'http-browserify',
      https: 'https-browserify',
      os: 'os-browserify/browser',
      path: 'path-browserify',
      timers: 'timers-browserify',
      querystring: 'querystring-es3',
      events: 'events',
      process: 'process/browser',
      fs: false,
      zlib: false,
      net: false,
      tls: false,
      child_process: false,
    },
  },

  mode: 'production',
  devtool: false,

  experiments: {
    asyncWebAssembly: true,
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [['@babel/preset-env', { targets: '> 0.25%, not dead', modules: 'auto' }]],
          },
        },
      },
      {
      test: /\.wasm$/,
      type: 'webassembly/async',
    },
    {
      test: /\.css$/i,
      use: ['style-loader', 'css-loader'],
    },
    ],
  },

  plugins: [
    new CleanWebpackPlugin(),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src', 'assets', 'index.html'),
      filename: 'index.html',
      inject: 'body',
      minify: false,
      hash: true,
    }),
    new NodePolyfillPlugin(),
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'src', 'assets'),
          to: path.resolve(__dirname, 'public'),
          globOptions: { ignore: ['**/index.html'] },
        },
        {
          from: path.resolve(__dirname, 'uploadfile'),
          to: path.resolve(__dirname, 'public', 'uploadfile'),
        },
      ],
    }),
    new BundleAnalyzerPlugin({
      analyzerMode: 'static',
      openAnalyzer: false,
    }),
  ],

  optimization: {
    usedExports: true,
    minimize: false,
    splitChunks: {
      chunks: 'all',
      maxSize: 200000,
      minSize: 10000,
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: (module) => {
            const packageName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
            return `vendors/${packageName}`;
          },
          chunks: 'all',
          priority: 10,
          enforce: true,
        },
        default: {
          minChunks: 2,
          priority: 5,
          reuseExistingChunk: true,
        },
      },
    },
  },
};
