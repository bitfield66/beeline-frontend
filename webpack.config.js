var path = require('path');

module.exports = {
    devtool: 'source-map',
    module: {
        loaders: [
            {
                test: /\.html$/,
                loader: 'html',
                exclude: /node_modules/,
                include: path.resolve('beeline'),
            },
            {
                test: /\.js$/,
                loader: 'babel',
                exclude: /node_modules/,
                include: path.resolve('beeline'),
            },
        ],
    },
    entry: [
        'babel-polyfill',
        path.resolve('beeline/main.js'),
    ],
    output: {
        path: path.resolve('www/lib/beeline'),
        filename: 'bundle.js',
        pathinfo: true,
    },
    babel: {
        presets: ['es2015', 'stage-3'],
        sourceMaps: true,
    },
};

