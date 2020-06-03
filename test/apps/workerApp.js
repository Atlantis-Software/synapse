var synapps = require('../../index');
var hostHelper = require('../helpers/host');

var workerApp = synapps();

workerApp.set('name', 'workerApp');
workerApp.set('ipcLocalPort', 8007);
workerApp.set('debug', 'debug');

workerApp.route('test', {
  ping: [
    {},
    function (req) {
      req.emit('my_worker', { test: 'PING' }).done(function (result) {
        req.resolve(result);
      });
    }
  ]
});

workerApp.createWorker('my_worker', function (worker) {
  worker.on('request', function (req) {
    if (req.data.test === 'PING') {
      req.resolve({ response: 'PONG' });
    }
  });
});

hostHelper(workerApp);