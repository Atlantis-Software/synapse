var child_process = require('child_process');
var asynk = require('asynk');
var path = require('path');

module.exports = function(appName) {
  var app = {};
  var onData;
  app.start = function() {
    console.log('START CALL');
    var ready = asynk.deferred();
    onData = function(data) {
      console.log('START ONDATA');
      if (data.toString().startsWith("ready")) {
        console.log('START ONDATA READY');
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
    console.log('STOP CALL');
    var killed = asynk.deferred();
    var onExit = function() {
      console.log('PROCESS : ', appName, app.process && app.process.kill(0));
      console.log('STOP ONEXIT');
      app.process.stderr.unpipe(process.stdout);
      app.process.removeListener('data', onData);
      app.process.removeListener('close', onExit);
      killed.resolve();
    };
    if (app.process && app.process.kill(0)) {
      console.log('STOP KILL');
      app.process.on('close', onExit);
      app.process.stderr.destroy();
      app.process.stdin.destroy();
      app.process.stdout.destroy();
      app.process.kill();
    } else {
      console.log('STOP NOT KILL');
      killed.resolve();
    }
    return killed.promise();
  }
  return app;
};
