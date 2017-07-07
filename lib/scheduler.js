var child_process = require('child_process');
var CPU_COUNT = require('os').cpus().length;
var asynk = require('asynk');

module.exports = function(synapps) {
  var running = true;
  var scheduler = {};
  scheduler.debugMode = false;
  scheduler.ipc = synapps._ipc;
  scheduler._lastWorkerUsed = 0;
  scheduler._workers = [];
  // init all workers
  var worker_count = 1;
  if (process.env.NODE_ENV === 'production') {
    worker_count = CPU_COUNT > synapps._config.maxWorker ? synapps._config.maxWorker : CPU_COUNT;
  }
  var new_worker_opts = {
    env: {
      isWorker: true
    }
  };
  for (var i = 0; i < worker_count; i++) {
    (function initWorker(index) {
      if (!running) {
        return;
      }
      new_worker_opts.env.WORKER_NAME = "worker" + index;
      scheduler._workers[index] = child_process.fork(synapps._config.indexScript, [], new_worker_opts);
      scheduler._workers[index].name = new_worker_opts.env.WORKER_NAME;
      scheduler._workers[index].send = function(event, data) {
        return scheduler.ipc.send(new_worker_opts.env.WORKER_NAME, event, data);
      };
      scheduler._workers[index].on('exit', function(code, signal) {
        synapps.debug(1, 'worker ' + scheduler._workers[index].pid + ' died, code: ' + code + ' signal: ' + signal);
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
      setTimeout(function() {
        try {
          process.kill(worker.pid, 0);
          process.kill(worker.pid, 'SIGKILL');
          cb();
        } catch(e) {
          cb();
        }
      }, 5000);
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
    return scheduler._workers[scheduler._lastWorkerUsed].send(req);
  };

  return scheduler;
};
