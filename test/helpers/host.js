var socket = require('../../lib/socket');

module.exports = function(synapps) {
  if (synapps.isMaster) {
    var Socket = socket(synapps);
    var sock = new Socket();
    sock.set('identity', synapps._config.name);
    var onMessage = function(task, data, emitter) {
      switch(task) {
        case 'start':
          synapps.listen(data, function() {
            emitter.emit('started', synapps._config.name);
          });
          break;
        case 'stop':
          synapps.close(function() {
            emitter.emit('stopped', synapps._config.name);
            sock.removeListener('message', onMessage);
            process.exit();
          });
          break;
      }
    };
    var registers = [];
    var appEmitter = null;
    synapps.on('register', function(identity) {
      var appRegister = {
        identity: synapps._config.name,
        register: identity
      };
      if (!appEmitter) {
        return registers.push(appRegister);
      }
      appEmitter.emit('app register', appRegister);
    });

    sock.register('appHelper', 2345, function(emitter) {
      appEmitter = emitter;
      registers.forEach(function(register) {
        emitter.emit('app register', register);
      });
    });

    sock.on('message', onMessage);
  } else {
    synapps.listen();
  }
};
