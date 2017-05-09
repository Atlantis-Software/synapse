var child_process = require('child_process');
var asynk = require('asynk');
var path = require('path');

module.exports = function(appName) {
  var app = {};
  var onData;
  app.start = function() {
    var ready = asynk.deferred();
    onData = function(data) {
      if (data.toString().startsWith("ready")) {
        ready.resolve();
      } else {
        console.log(data.toString());
      }
    };
    app.process = child_process.exec('node ' + path.join(__dirname, '../apps/' + appName));
    app.process.stderr.pipe(process.stdout);
    app.process.stdout.on('data', onData);
    return ready.promise();
  };

  app.stop = function() {
    var killed = asynk.deferred();
    var onExit = function() {
      app.process.stderr.unpipe(process.stdout);
      app.process.removeListener('data', onData);
      app.process.removeListener('exit', onExit);
      killed.resolve();
    };
    if (app.process && app.process.kill(0)) {
      app.process.on('exit', onExit);
      app.process.kill();
    } else {
      killed.resolve();
    }
    return killed.promise();
  }
  return app;
};
