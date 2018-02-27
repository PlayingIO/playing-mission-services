if (!global._babelPolyfill) { require('babel-polyfill'); }

module.exports = require('./lib/index');
module.exports.entities = require('./lib/entities');
module.exports.models = require('./lib/models');
module.exports.helpers = require('./lib/helpers');
