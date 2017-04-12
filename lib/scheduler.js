var child_process = require('child_process');
var IPC = require('./ipc');
var CPU_COUNT = require('os').cpus().length;

module.exports = function(synapps) {
  var ipc = IPC(synapps);
  var scheduler = {};
  scheduler.ipc = new ipc();
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
      new_worker_opts.env.WORKER_NAME = "worker" + index;
      scheduler._workers[index] = child_process.fork(synapps._config.indexScript, [], new_worker_opts);
      scheduler._workers[index].send = function(event, data) {
        return scheduler.ipc.send(new_worker_opts.env.WORKER_NAME, event, data);
      };
      scheduler._workers[index].on('exit', function(code, signal) {
        synapps.debug(1, 'worker ' + scheduler._workers[index].pid + ' died, code: ' + code + ' signal: ' + signal);
        initWorker(index);
      });
    })(i);
  }

  scheduler.send = function(req) {
    scheduler._lastWorkerUsed++;
    if (scheduler._lastWorkerUsed >= scheduler._workers.length) {
      scheduler._lastWorkerUsed = 0;
    }
    return scheduler._workers[scheduler._lastWorkerUsed].send('request', req);
  };
  return scheduler;
};
