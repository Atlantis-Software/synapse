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

    if (process.env.NODE_ENV !== 'production') {
      var lastHeapSpaceStatistics = {};
      v8.getHeapSpaceStatistics().forEach(function(stat) {
        lastHeapSpaceStatistics[stat.space_name] = {
          space_used_size: stat.space_used_size,
          growing: 0,
          initial_used_size: stat.space_used_size
        };
      });

      function heapChecker() {
        v8.getHeapSpaceStatistics().forEach(function(stat) {
          var last = lastHeapSpaceStatistics[stat.space_name];
          if (last.space_used_size < stat.space_used_size) {
            ++last.growing;
          } else {
            last.initial_used_size = stat.space_used_size;
            last.growing = 0;
          }
          var delta = stat.space_used_size - last.initial_used_size;
          last.space_used_size = stat.space_used_size;
          if (last.growing >= 3) {
            synapps.debug('warn', 'heap ' + stat.space_name + ' is growing (' + last.space_used_size + ', delta ' + delta + ')');
          }
        });
        setTimeout(heapChecker, 500);
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
        setTimeout(onTick, 0);
      }
      onTick();
    }
  }
};
