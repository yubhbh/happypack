var async = require('async');
var assert = require('assert');
var HappyThread = require('./HappyThread');
var HappyRPCHandler = require('./HappyRPCHandler');

/**
 * Create a thread pool that can be shared between multiple plugin instances.
 *
 * @param {Object} config
 * @param {Number!} config.size
 *        The number of background threads to spawn for running loaders.
 *
 * @param {String?} config.id
 *        Used for prefixing the thread IDs. This is only used for logging
 *        purposes and does not affect the functionality.
 *
 * @param {Boolean?} [config.verbose=false]
 *        Allow this module and threads to log information to the console.
 *
 * @param {Boolean?} [config.debug=false]
 *        Allow this module and threads to log debugging information to the
 *        console.
 */
module.exports = function HappyThreadPool(config) {
  var happyRPCHandler = new HappyRPCHandler();

  assert(!isNaN(config.size),
    "ArgumentError: HappyThreadPool requires a valid integer for its size, but got NaN."
  );

  assert(config.size > 0,
    "ArgumentError: HappyThreadPool requires a positive integer for its size " +
    ", but got {" + config.size + "}."
  );

  var threads = createThreads(config.size, happyRPCHandler, {
    id: config.id,
    verbose: config.verbose,
    debug: config.debug,
  });

  var activeCompilers = {};

  return {
    size: config.size,

    start: function(done) {
      async.parallel(threads.filter(not(send('isOpen'))).map(get('open')), done);
    },

    configure: function(compilerId, compilerOptions, done) {
      registerCompilerReference(compilerId);

      assert(!threads.some(not(send('isOpen'))),
        "ThreadPool must be started before attempting to configure it!"
      );

      async.parallel(threads.map(function(thread) {
        return function(callback) {
          thread.configure(compilerId, compilerOptions, callback);
        }
      }), done);
    },

    isRunning: function() {
      return !threads.some(not(send('isOpen')));
    },

    stop: function(compilerId) {
      discardCompilerReference(compilerId);

      if (Object.keys(activeCompilers).length === 0) {
        threads.filter(send('isOpen')).map(send('close'));
      }
    },

    get: RoundRobinThreadPool(threads),

    getRPCHandler: function() {
      return happyRPCHandler;
    }
  };

  function registerCompilerReference(id) {
    if (!activeCompilers.hasOwnProperty(id)) {
      activeCompilers[id] = 0;
    }

    activeCompilers[id] += 1;
  }

  function discardCompilerReference(id) {
    if (activeCompilers.hasOwnProperty(id)) {
      activeCompilers[id] -= 1;

      if (activeCompilers[id] === 0) {
        delete activeCompilers[id];
      }
    }
  }
}

function createThreads(count, happyRPCHandler, config) {
  var set = []

  for (var threadId = 0; threadId < count; ++threadId) {
    var fullThreadId = config.id ? [ config.id, threadId ].join(':') : threadId;
    set.push(HappyThread(fullThreadId, happyRPCHandler, config));
  }

  return set;
}

function send(method) {
  return function(receiver) {
    return receiver[method].call(receiver);
  };
}

function get(attr) {
  return function(object) {
    return object[attr];
  };
}

function not(f) {
  return function(x) {
    return !f(x);
  };
}

function RoundRobinThreadPool(threads) {
  var lastThreadId = 0;

  return function getThread() {
    var threadId = lastThreadId;

    lastThreadId++;

    if (lastThreadId >= threads.length) {
      lastThreadId = 0;
    }

    return threads[threadId];
  }
}
