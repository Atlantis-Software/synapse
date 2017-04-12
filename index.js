var router = require('./lib/router');
var worker = require('./lib/worker');
var scheduler = require('./lib/scheduler');
var http = require('./lib/http');
var io = require('./lib/io');

module.exports = function() {
  var noop = function() {};
  var synapps = {};

  synapps._config = {
    staticDir: false,
    apiDir: 'API',
    debug: false,
    indexScript: module.parent.filename
  };

  synapps.debug = function(level, msg) {
    console.log(msg);
  };

  // configure synapps app
  synapps.set = function(key, value) {
    synapps._config[key] = value;
  };

  synapps.use = noop;
  synapps.route = noop;
  synapps.listen = noop;
  synapps.isMaster = false;
  synapps.isWorker = false;

  if (!process.env.isWorker) {
    // Master
    synapps.isMaster = true;
    synapps.listen = function(port) {
      synapps._config.name = synapps._config.name || 'synapps';
      synapps._config.masterName = synapps._config.name;
      synapps._scheduler = scheduler(synapps);
      synapps._http = http(synapps);
      synapps._http.listen(port);
      synapps._io = io(synapps);
      synapps.debug(1, 'Server is listening on port: ' + port);
    };
  } else {
    // Worker
    synapps.debug(1, 'Starting Worker id: ' + process.env.WORKER_NAME);
    synapps.isWorker = true;
    synapps._middlewares = [];
    synapps._policies = {};
    synapps._router = router(synapps);

    // add a middleware
    synapps.use = function(middleware) {
      synapps._middlewares.push(middleware);
    };

    synapps.route = function(route, definition) {
      return synapps._router.addRoute(route, definition);
    };

    synapps.listen = function() {
      synapps._config.masterName = synapps._config.name || 'synapps';
      synapps._config.name = process.env.WORKER_NAME;
      worker.run(synapps);
    }
  }

  return synapps;
};
