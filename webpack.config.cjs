// webpack.config.cjs

const path = require('path');
const HtmlWebpackPlugin =
    require('html-webpack-plugin');

const CopyWebpackPlugin =
    require('copy-webpack-plugin');

module.exports = {

    entry: './src/index.js',

    output: {
        path:
            path.resolve(
                __dirname,
                'dist'
            ),

        filename:
            'bundle.[contenthash].js',

        clean: true
    },

    devtool: 'source-map',

    module: {
        rules: [
            {
                test: /\.js$/,
                exclude:
                    /node_modules/,
                use:
                    'babel-loader'
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader'
                ]
            }
        ]
    },

    plugins: [
        new HtmlWebpackPlugin({
            template:
                './src/index.html',
            filename:
                'index.html',
            inject:
                'body'
        }),

        new HtmlWebpackPlugin({
            template:
                './success.html',

            filename:
                'success.html',

            inject:
                'body'
        }),

      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'public/asaratianm',
            to: 'asaratianm'
          },

          {
            from: 'src/assets',
            to: 'assets'
          },

          {
            from: 'public/favicon.ico',
            to: 'favicon.ico'
          }
        ]
      })
    ],

    devServer: {
        static:
            path.resolve(
                __dirname,
                'dist'
            ),
        port: 3000,
        open: true
    },
    mode: 'production'
};