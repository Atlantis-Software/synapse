var log4js = require('log4js');
var router = require('./lib/router');
var worker = require('./lib/worker');
var scheduler = require('./lib/scheduler');
var http = require('./lib/http');
var io = require('./lib/io');
var IPC = require('./lib/ipc');
var asynk = require('asynk');
var EventEmitter = require('events').EventEmitter;

module.exports = function() {
  var noop = function() {};
  var synapps = Object.create(EventEmitter.prototype);

  synapps._config = {
    staticDir: false,
    apiDir: 'API',
    debug: 'error',
    indexScript: module.parent.filename,
    logFile: 'synapps.log'
  };

  synapps.debug = function(level, msg) {
    var logger = log4js.getLogger(synapps._config.name);
    logger[level](msg);
  };

  // configure synapps app
  synapps.set = function(key, value) {
    synapps._config[key] = value;
  };

  synapps.use = noop;
  synapps.route = noop;
  synapps.listen = noop;
  synapps.policy = noop;
  synapps.close = noop;
  synapps.isMaster = false;
  synapps.isWorker = false;


  if (!process.env.isWorker) {
    // Master
    synapps.isMaster = true;
    var lastSocketKey = 0;
    var socketMap = {};
    synapps.listen = function(port, cb) {
      log4js.configure({
        appenders: { master: { type: 'file', filename: synapps._config.logFile } },
        categories: { default: { appenders: ['master'], level: synapps._config.debug } }
      });
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
      synapps._http.on('connection', function(socket) {
        var socketKey = ++lastSocketKey;
        socketMap[socketKey] = socket;
        socket.on('close', function() {
            delete socketMap[socketKey];
        });
      });
      synapps._http.listen(port, function(err) {
        httpReady.resolve();
      });
      synapps._io = io(synapps);
      synapps.debug('info', 'Server is listening on port: ' + port);
      synapps._ipc.on('ready', function() {
        ipcReady.resolve();
      });
      if (cb) {
        asynk.when(httpReady, ipcReady).asCallback(cb);
      }
    };

    synapps.close = function(cb) {
      cb = cb || function(){};
      var httpClosed = asynk.deferred();
      var workerClosed = asynk.deferred();
      if (synapps._http.listening) {
        Object.keys(socketMap).forEach(function(key) {
          socketMap[key].destroy();
        });
        synapps._http.close(function(err) {
          if (err) {
            return httpClosed.reject(err);
          }
          httpClosed.resolve();
        });
      } else {
        httpClosed.resolve();
      }

      synapps._scheduler.close(function(err) {
        if (err) {
          return workerClosed.reject(err);
        }
        synapps._ipc.close(function(err) {
          if (err) {
            return workerClosed.reject(err);
          }
          workerClosed.resolve();
        });
      });

      asynk.when(httpClosed, workerClosed).asCallback(cb);
    };
  } else {
    // Worker
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
      log4js.configure({
        appenders: { worker: { type: 'file', filename: synapps._config.logFile } },
        categories: { default: { appenders: ['worker'], level: synapps._config.debug } },
      });
      synapps.debug('info', 'Starting Worker id: ' + process.env.WORKER_NAME);
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
