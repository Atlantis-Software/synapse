var os = require('os');
var log4js = require('log4js');
var router = require('./lib/router');
var worker = require('./lib/worker');
var scheduler = require('./lib/scheduler');
var http = require('./lib/http');
var io = require('./lib/io');
var IPC = require('./lib/ipc');
var asynk = require('asynk');
var _ = require('lodash');
var EventEmitter = require('events').EventEmitter;
var child_process = require('child_process');

module.exports = function() {
  var noop = function() {};
  var synapps = Object.create(EventEmitter.prototype);

  synapps._config = {
    staticDir: false,
    apiDir: null,
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
  synapps.get = noop;
  synapps.post = noop;
  synapps.put = noop;
  synapps.delete = noop;
  synapps.listen = noop;
  synapps.policy = noop;
  synapps.close = noop;
  synapps.createWorker = noop;
  synapps.isMaster = false;
  synapps.isWorker = false;


  if (!process.env.isWorker) {
    // Master
    synapps.isMaster = true;
    synapps._workers = {};
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
      synapps._http.listen(port, function() {
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
      cb = cb || function() {};
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

      _.keys(synapps._workers).forEach(function(key) {
        synapps._ipc.socket.emit(key, 'synapps.kill');
      });

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

    synapps.createWorker = function(name, fct) {
      var new_worker_opts = {
        env: {
          isWorker: name,
          NODE_ENV: process.env.NODE_ENV,
          WORKER_NAME: name
        }
      };
      var worker = child_process.spawn(process.execPath, [synapps._config.indexScript], new_worker_opts);
      synapps._workers[name] = worker;
    };

  } else if (process.env.isWorker === "true") {
    // Worker
    synapps.isWorker = true;
    synapps._middlewares = [];
    synapps._policies = {};
    synapps._router = router(synapps);

    // add a middleware
    synapps.use = function(middleware) {
      synapps._middlewares.push(middleware);
    };

    synapps.route = function() {
      return synapps._router.addRoute.apply(synapps._router, arguments);
    };

    synapps.get = function(route, options, handler) {
      if (_.isUndefined(handler)) {
        handler = options;
        options = {};
      }
      options.method = 'get';
      return synapps._router.addRoute(route, options, handler);
    };

    synapps.post = function(route, options, handler) {
      if (_.isUndefined(handler)) {
        handler = options;
        options = {};
      }
      options.method = 'post';
      return synapps._router.addRoute(route, options, handler);
    };

    synapps.put = function(route, options, handler) {
      if (_.isUndefined(handler)) {
        handler = options;
        options = {};
      }
      options.method = 'put';
      return synapps._router.addRoute(route, options, handler);
    };

    synapps.delete = function(route, options, handler) {
      if (_.isUndefined(handler)) {
        handler = options;
        options = {};
      }
      options.method = 'delete';
      return synapps._router.addRoute(route, options, handler);
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
      synapps._ipc = new (IPC(synapps))();
      worker.run(synapps);
    };

    synapps.policy = function(name, fn) {
      synapps._policies[name] = fn;
    };
  } else {
    // createWorker
    synapps.isWorker = true;
    synapps.fct = noop;

    synapps.listen = function() {
      // set workers and master names
      synapps._config.masterName = synapps._config.name || 'synapps';
      synapps._config.name = process.env.WORKER_NAME;
      log4js.configure({
        appenders: { worker: { type: 'file', filename: synapps._config.logFile } },
        categories: { default: { appenders: ['worker'], level: synapps._config.debug } },
      });
      synapps.debug('info', 'Starting Worker name: ' + process.env.WORKER_NAME);

      // worker error handler
      var domain = require('domain');
      var workerDomain = domain = domain.create();
      workerDomain.on('error', function(err) {
        synapps.debug('error', err);
      });
      workerDomain.run(function() {
        // init ipc
        synapps._ipc = new (IPC(synapps))();
        // init worker
        var worker = {};

        // call an other request
        worker.emit = function(hostname, req, cb) {
          // invalid arguments
          if (!arguments.length) {
            throw new Error('invalid arguments: req.emit([hostname = String,] request = Object || String [, cb = function ])');
          }
          // if hostname isn't specified, send request to master
          if (arguments.length === 1) {
            req = hostname;
            hostname = 'master';
          }
          if (arguments.length === 2 && _.isFunction(req)) {
            cb = req;
            req = hostname;
            hostname = 'master';
          }
          if (_.isString(req)) {
            req = { request: req };
          }
          if (!_.isString(hostname) || !_.isPlainObject(req)) {
            throw new Error('invalid arguments: req.emit([hostname = String,] request = Object || String [, cb = function ])');
          }
          var promise = synapps._ipc.send(hostname, req);
          if (cb && _.isFunction(cb)) {
            return promise.asCallback(cb);
          }
          return promise;
        };

        worker.debug = function() {
          var args = Array.prototype.slice.call(arguments);
          args.forEach(function(arg, index) {
            if (arg instanceof Error) {
              args[index] = arg.stack + os.EOL;
            }
          });
          var msg = args.join(' ');
          synapps.debug('debug', msg);
        };

        worker.on = function(event, fct) {
          switch (event) {
            case 'request':
              synapps._ipc.on('request', fct);
              break;
          }
        };
        synapps.fct(worker);
      });
    };

    synapps.createWorker = function(name, fct) {
      if (process.env.WORKER_NAME !== name) {
        return;
      }
      synapps.fct = fct;
    };

  }

  return synapps;
};
