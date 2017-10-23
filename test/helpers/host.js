var telepathy = require('telepathymq');

module.exports = function(synapps) {
  if (synapps.isMaster) {
    var sock = new telepathy(synapps._config.name);
    sock.on('start', function(defer, port) {
      synapps.listen(port, function() {
        defer.resolve();
      });
    });
    sock.on('stop', function(defer) {
      synapps.close(function() {
        defer.resolve();
        sock.removeAllListeners();
        setTimeout(function() {
          process.exit();
        }, 300);
      });
    });
    var connected = false;
    sock.register('appHelper', 'tcp://localhost:2345', function() {
      connected = true;
      registers.forEach(function(appRegister) {
        sock.emit('appHelper', 'app register', appRegister);
      });
    });

    var registers = [];

    synapps.on('register', function(identity) {
      var appRegister = {
        identity: synapps._config.name,
        register: identity
      };
      if (!connected) {
        return registers.push(appRegister);
      }
      sock.emit('appHelper', 'app register', appRegister);
    });

  } else {
    synapps.listen();
  }
};
