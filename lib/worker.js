var v8 = require('v8');
var IPC = require('./ipc');
var request = require('./request');

module.exports = {
  run: function(synapps) {
    process.on('uncaughtException', function(e) {
      synapps.debug('fatal', e);
    });

    var worker = {};
    worker.request = request(synapps);
    worker.ipc = synapps._ipc;
    worker.ipc.on('request', worker.request);

    //if (['debug', 'trace'].indexOf(synapps._config.debug) !== -1) {
    synapps.debug('trace', 'STATUS : ' + process.env.NODE_ENV);
    if (process.env.NODE_ENV !== 'production') {
      var lastHeapSpaceStatistics = {};
      v8.getHeapSpaceStatistics().forEach(function(stat) {
        lastHeapSpaceStatistics[stat.space_name] = {
          available_size: stat.space_available_size,
          growing: 0
        };
      });

      function heapChecker() {
        v8.getHeapSpaceStatistics().forEach(function(stat) {
          var last = lastHeapSpaceStatistics[stat.space_name];
          if (last.available_size < stat.space_available_size) {
            ++last.growing;
          } else {
            last.growing = 0;
          }
          last.available_size = stat.space_available_size;
          if (last.growing >= 3) {
            synapps.debug('warn', 'heap ' + stat.space_name + ' is growing...');
          }
        });
        setTimeout(heapChecker, 1000);
      };
      heapChecker();

      // check tick interval
      var lastTime = new Date().getTime();
      function onTick() {
        var time = new Date().getTime();
        var interval = time - lastTime;
        lastTime = time;
        if (interval > 5) {
          synapps.debug('warn', 'worker tick interval = ' + interval + ' ms');
        }
        setTimeout(heapChecker, 0);
      }
      onTick();
    }
  }
};
