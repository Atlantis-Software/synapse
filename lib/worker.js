var memwatch = require('memwatch-next');
var util = require('util');
var asynk = require('asynk');
var ipc = require('./ipc');
var request = require('./request');

module.exports = {
  run: function(synapse) {
    var worker = {};
    worker.request = request(synapse);
    if (synapse._config.debug >= 6) {
      memwatch.on('leak', function(leak) {
        synapse.debug(6, "Memory Leak: " + util.inspect(leak, false, 3));
      });

      var heapChecker = function() {
        var hd = new memwatch.HeapDiff();
        setTimeout(function() {
          var diff = hd.end();
          heapChecker();
        }, 5000);
      };
      heapChecker();
    }
    if (synapse._config.debug) {
      var lastTime = (new Date().getTime());

      function onTick() {
        var time = (new Date().getTime());
        var interval = time - lastTime;
        lastTime = time;
        if (interval > 5) {
          synapse.debug(1, 'WARNING: worker tick interval = ' + interval);
        }
      }
      process.nextTick(onTick);
    }

    worker.ipc = new ipc();
    worker.ipc.on('request', worker.request);
  }
};