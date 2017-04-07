var router = require('./lib/router');
var worker = require('./lib/worker');
var scheduler = require('./lib/scheduler');
var http = require('./lib/http');
var io = require('./lib/io');

module.exports = function() {
  var noop = function() {};
  var synapse = {};

  synapse._config = {
    staticDir: false,
    apiDir: 'API',
    debug: false,
    indexScript: module.parent.filename
  };

  synapse.debug = function(level, msg) {
    console.log(msg);
  };

  // configure synapse app
  synapse.set = function(key, value) {
    synapse._config[key] = value;
  };

  synapse.use = noop;
  synapse.route = noop;
  synapse.listen = noop;
  synapse.isMaster = false;
  synapse.isWorker = false;

  if (!process.env.isWorker) {
    // Master
    synapse.isMaster = true;
    synapse.listen = function(port) {
      synapse._scheduler = scheduler(synapse);
      synapse._http = http(synapse);
      synapse._http.listen(port);
      synapse._io = io(synapse);
      synapse.debug(1, 'Server is listening on port: ' + port);
    };
  } else {
    // Worker
    synapse.debug(1, 'Starting Worker id: ' + process.env.WORKER_NAME);
    synapse.isWorker = true;
    synapse._middlewares = [];
    synapse._policies = {};
    synapse._router = router(synapse);

    // add a middleware
    synapse.use = function(middleware) {
      synapse._middlewares.push(middleware);
    };

    synapse.route = function(route, definition) {
      return synapse._router.addRoute(route, definition);
    };

    synapse.listen = function() {
      worker.run(synapse);
    }
  }

  return synapse;
};
