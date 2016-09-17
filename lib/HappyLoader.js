var assert = require('assert');
var loaderUtils = require('loader-utils');

function HappyLoader(sourceCode, sourceMap) {
  var happyPlugin, happyRPCHandler;
  var callback = this.async();
  var query = loaderUtils.parseQuery(this.query);
  var id = query.id || '1';
  var compilerId = query.compilerId || 'default';
  var remoteLoaderId = 'Loader::' + compilerId + id.toString() + ':' + this.resource;

  assert(callback, "HappyPack only works when asynchronous loaders are allowed!");

  this.cacheable();

  if (!this.options.plugins) {
    return callback(null, sourceCode, sourceMap);
  }

  happyPlugin = this.options.plugins.filter(isHappy(id))[0];

  assert(!!happyPlugin,
    "HappyPack: plugin for the loader '" + id + "' could not be found! " +
    "Did you forget to add it to the plugin list?"
  );

  happyRPCHandler = happyPlugin.threadPool.getRPCHandler();
  happyRPCHandler.registerActiveLoader(remoteLoaderId, this);

  happyPlugin.compile({
    remoteLoaderId: remoteLoaderId,
    compilerId: compilerId,
    sourceCode: sourceCode,
    sourceMap: sourceMap,

    useSourceMap: this._module.useSourceMap,

    // TODO: maybe too much data being pushed down the drain here? we can infer
    // all of this from `this.request`
    context: this.context,
    request: happyPlugin.generateRequest(this.resource),
    resource: this.resource,
    resourcePath: this.resourcePath,
    resourceQuery: this.resourceQuery,
    target: this.target,
  }, function(err, outSourceCode, outSourceMap) {
    happyRPCHandler.unregisterActiveLoader(remoteLoaderId);

    if (err) {
      return callback(new Error(err));
    }

    callback(null, outSourceCode, outSourceMap);
  });
}

module.exports = HappyLoader;

function isHappy(id) {
  return function(plugin) {
    return plugin.name === 'HappyPack' && plugin.id === id;
  };
}
