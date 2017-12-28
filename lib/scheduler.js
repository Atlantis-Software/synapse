var child_process = require('child_process');
var CPU_COUNT = require('os').cpus().length;
var asynk = require('asynk');
var _ = require('lodash');

module.exports = function(synapps) {
  var running = true;
  var scheduler = {};
  scheduler.debugMode = false;
  scheduler.ipc = synapps._ipc;
  scheduler._lastWorkerUsed = 0;
  scheduler._workers = [];

  synapps.on('worker.register', function(identity) {
    var worker = _.find(scheduler._workers, function(worker) {
      return worker.name === identity;
    });
    if (worker) {
      worker.ready = true;
    } else {
      synapps.debug('debug', 'Worker ' + identity + ' doesn\'t exist');
    }
  });

  // init all workers
  var worker_count = 1;
  if (process.env.NODE_ENV === 'production') {
    worker_count = CPU_COUNT > synapps._config.maxWorker ? synapps._config.maxWorker : CPU_COUNT;
  }
  for (var i = 0; i < worker_count; i++) {
    (function initWorker(index) {
      if (!running) {
        return;
      }
      var new_worker_opts = {
        env: {
          isWorker: true,
          NODE_ENV: process.env.NODE_ENV
        }
      };
      new_worker_opts.env.WORKER_NAME = "worker" + index;
      scheduler._workers[index] = child_process.spawn(process.execPath, [synapps._config.indexScript], new_worker_opts);
      scheduler._workers[index].ready = false;
      scheduler._workers[index].name = new_worker_opts.env.WORKER_NAME;
      scheduler._workers[index].send = function(event, data) {
        return scheduler.ipc.send(new_worker_opts.env.WORKER_NAME, event, data);
      };
      scheduler._workers[index].on('exit', function(code, signal) {
        synapps.debug('fatal', 'worker ' + scheduler._workers[index].pid + ' died, code: ' + code + ' signal: ' + signal);
        initWorker(index);
      });
    })(i);
  }

  var stopWorkersThenMaster = function() {
    if (!running) {
      return;
    }
    running = false;
    asynk.each(scheduler._workers, function(worker, cb) {
      process.kill(worker.pid, 'SIGTERM');
      var iteration = 0;
      var waitAndKill = function(callback) {
        ++iteration;
        setTimeout(function() {
          try {
            process.kill(worker.pid, 0);
            if (iteration > 5) {
              process.kill(worker.pid, 'SIGKILL');
              return callback();
            }
            waitAndKill(callback);
          } catch(e) {
            callback();
          }
        }, 500);
      }
      waitAndKill(cb);
    }).parallel().done(function() {
      process.kill(process.pid, 'SIGKILL');
    });
  };

  process.on('exit', stopWorkersThenMaster);
  process.on('SIGINT', stopWorkersThenMaster);
  process.on('SIGTERM', stopWorkersThenMaster);

  scheduler.send = function(req) {
    if (!scheduler.debugMode) {
      scheduler._lastWorkerUsed++;
      if (scheduler._lastWorkerUsed >= scheduler._workers.length) {
        scheduler._lastWorkerUsed = 0;
      }
    }

    if (!scheduler._workers[scheduler._lastWorkerUsed].ready) {
      var worker = _.find(scheduler._workers, function(worker) {
        return worker.ready;
      });
      if (worker) {
        return worker.send(req);
      } else {
        return asynk.deferred().reject('No worker ready');
      }
    }
    return scheduler._workers[scheduler._lastWorkerUsed].send(req);
  };

  return scheduler;
};
