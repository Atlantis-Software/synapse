var child_process = require('child_process');
var asynk = require('asynk');
var path = require('path');
var telepathy = require('telepathymq');
var EventEmitter = require('events').EventEmitter;

var sock = new telepathy('processHelper');
sock.listen(2345);

module.exports = function(appName) {
  var app =  Object.create(EventEmitter.prototype);
  app.running = false;

  app.start = function(port) {
    var self = this;
    app.process = child_process.exec('node ' + path.join(__dirname, '../apps/' + appName));
    app.process.stderr.pipe(process.stdout);
    app.process.stdout.pipe(process.stdout);
    var ready = asynk.deferred();

    sock.on('app register', function(data) {
      self.emit('register', data.register);
    });

    sock.on('register', function(identity) {
      if (identity === appName) {
        sock.defer(appName, 'start', port).done(function(data) {
          app.running = true;
          sock.removeAllListeners('app register');
          ready.resolve();
        });
      }
    });

    return ready.promise();
  };

  app.stop = function() {
    // app.process.stderr.unpipe(process.stdout);
    // app.process.stdout.unpipe(process.stdout);

    var stop = sock.defer(appName, 'stop');
    stop.done(function() {
      app.running = false;
    });

    if (!app.running) {
      return asynk.deferred().resolve();
    }

    return stop;
  }
  return app;
};
