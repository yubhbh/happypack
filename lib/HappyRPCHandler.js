var assert = require('assert');
var SourceMapSerializer = require('./SourceMapSerializer');
var SharedPtr = require('./SharedPtr');
var COMPILER_RPCs, LOADER_RPCS;

function HappyRPCHandler() {
  this.activeLoaders = {};
  this.activeCompilers = {};
}

HappyRPCHandler.prototype.registerActiveCompiler = function(compiler, id) {
  var compilerId = id || 'default';

  this.activeCompilers[compilerId] = new SharedPtr(compiler);
};

HappyRPCHandler.prototype.unregisterActiveCompiler = function(compiler, id) {
  var compilerId = id || 'default';

  if (this.activeCompilers[compilerId]) {
    this.activeCompilers[compilerId].reset();
  }
};

HappyRPCHandler.prototype.registerActiveLoader = function(id, instance) {
  this.activeLoaders[id] = instance;
};

HappyRPCHandler.prototype.unregisterActiveLoader = function(id) {
  delete this.activeLoaders[id];
};

HappyRPCHandler.prototype.execute = function(type, payload, done) {
  var compiler, loader;

  if (COMPILER_RPCs.hasOwnProperty(type)) {
    if (payload.compilerId) {
      compiler = SharedPtr.safeGet(this.activeCompilers[payload.compilerId]);
    }
    else {
      compiler = SharedPtr.safeGet(this.activeCompilers.default);
    }

    assert(!!compiler,
      "A compiler RPC was dispatched, but no compiler instance was registered!"
    );

    COMPILER_RPCs[type](compiler, payload, done);
  }
  else if (LOADER_RPCS.hasOwnProperty(type)) {
    loader = this.activeLoaders[payload.remoteLoaderId];

    assert(this.activeLoaders.hasOwnProperty(payload.remoteLoaderId),
      "A loader RPC was dispatched to HappyLoader[" + payload.remoteLoaderId +
      "] but no such loader is active!"
    );

    LOADER_RPCS[type](loader, payload, done);
  }
  else {
    assert(false, "Unrecognized loader RPC '" + type + '"');
  }
};

COMPILER_RPCs = {
  resolve: function(compiler, payload, done) {
    var resolver = compiler.resolvers.normal;
    var resolve = compiler.resolvers.normal.resolve;

    if (resolve.length === 4) {
      resolve.call(resolver, payload.context, payload.context, payload.resource, done);
    }
    else {
      resolve.call(resolver, payload.context, payload.resource, done);
    }
  },
};

LOADER_RPCS = {
  emitWarning: function(loader, payload) {
    loader.emitWarning(payload.message);
  },

  emitError: function(loader, payload) {
    loader.emitError(payload.message);
  },

  emitFile: function(loader, payload) {
    loader.emitFile(
      payload.name,
      payload.contents,
      SourceMapSerializer.deserialize(payload.sourceMap)
    );
  },

  addDependency: function(loader, payload) {
    loader.addDependency(payload.file);
  },

  addContextDependency: function(loader, payload) {
    loader.addContextDependency(payload.file);
  },

  clearDependencies: function(loader) {
    loader.clearDependencies();
  },

  loadModule: function(loader, payload, done) {
    loader.loadModule(payload.file, done);
  },
};


module.exports = HappyRPCHandler;
