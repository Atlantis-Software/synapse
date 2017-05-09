var router = require('./lib/router');
var worker = require('./lib/worker');
var scheduler = require('./lib/scheduler');
var http = require('./lib/http');
var io = require('./lib/io');
var IPC = require('./lib/ipc');
var asynk = require('asynk');

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
    if (level <= this._config.debug) {
      console.log(msg);
    }
  };

  // configure synapps app
  synapps.set = function(key, value) {
    synapps._config[key] = value;
  };

  synapps.use = noop;
  synapps.route = noop;
  synapps.listen = noop;
  synapps.policy = noop;
  synapps.isMaster = false;
  synapps.isWorker = false;


  if (!process.env.isWorker) {
    // Master
    synapps.isMaster = true;

    synapps.listen = function(port, cb) {
      var httpReady = asynk.deferred();
      var ipcReady = asynk.deferred();
       // set process name
      synapps._config.name = synapps._config.name || 'synapps';
      synapps._config.masterName = synapps._config.name;
      // init ipc
      var ipc = IPC(synapps);
      synapps._ipc = new ipc();
      synapps._scheduler = scheduler(synapps);
      synapps._http = http(synapps);
      synapps._http.listen(port, function(err) {
        httpReady.resolve();
      });
      synapps._io = io(synapps);
      synapps.debug(1, 'Server is listening on port: ' + port);
      synapps._ipc.on('ready', function() {
        ipcReady.resolve();
      });
      process.on('exit', function() {
        synapps._http.close();
      });
      if (cb) {
        asynk.when(httpReady, ipcReady).asCallback(cb);
      }
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
      // set workers and master names
      synapps._config.masterName = synapps._config.name || 'synapps';
      synapps._config.name = process.env.WORKER_NAME;
      // init ipc
      var ipc = IPC(synapps);
      synapps._ipc = new ipc();
      worker.run(synapps);
    }

    synapps.policy = function(name, fn) {
      synapps._policies[name] = fn;
    }
  }

  return synapps;
};
