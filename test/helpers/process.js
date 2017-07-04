var child_process = require('child_process');
var asynk = require('asynk');
var path = require('path');
var socket = require('../../lib/socket');
var EventEmitter = require('events').EventEmitter;

var fakeSynapps = {
  debug: function() {}
}
var Socket = socket(fakeSynapps);
var sock = new Socket();
sock.bind(2345);

module.exports = function(appName) {
  var app =  Object.create(EventEmitter.prototype);
  app.running = false;

  app.start = function(port) {
    var self = this;
    app.process = child_process.exec('node ' + path.join(__dirname, '../apps/' + appName));
    app.process.stderr.pipe(process.stdout);
    app.process.stdout.pipe(process.stdout);
    app.emitter = null;
    var ready = asynk.deferred();
    var onRegister = function(identity, emitter) {
      if (identity === appName) {
        app.emitter = emitter;
        app.emitter.emit('start', port);
      }
    };
    var onMessage = function(task, data, emitter) {
      if (task === 'app register' && data.identity === appName) {
        self.emit('register', data.register);
      }
      if (task === 'started' && data === appName) {
        app.running = true;
        sock.removeListener('register', onRegister);
        sock.removeListener('message', onMessage);
        ready.resolve();
      }
    };
    sock.on('register', onRegister);
    sock.on('message', onMessage);
    return ready.promise();
  };

  app.stop = function() {
    // app.process.stderr.unpipe(process.stdout);
    // app.process.stdout.unpipe(process.stdout);
    var stop = asynk.deferred();

    var onMessage = function(task, data, emitter) {
      if (task === 'stopped' && data === appName) {
        app.running = false;
        sock.removeListener('message', onMessage);
        stop.resolve();
      }
    };
    sock.on('message', onMessage);
    if (!app.running) {
      sock.removeListener('message', onMessage);
      stop.resolve();
    }
    app.emitter.emit('stop', true);
    return stop.promise();
  }
  return app;
};
