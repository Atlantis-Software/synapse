var util = require('util');
var EventEmitter = require('events').EventEmitter;
var uuid = require('uuid');
var asynk = require('asynk');
var _ = require('lodash');
var fs = require('fs');
var telepathy = require('telepathymq');

var inspector;
try {
  inspector = require('inspector');
} catch(e) {
  inspector = null;
}

var TIMEOUT = 60 * 1000; // 1 minute

module.exports = function(synapps) {
  var ipc = function() {
    EventEmitter.call(this);
    var self = this;

    this.socket = new telepathy(synapps._config.name);
    if (synapps.isMaster) {
      // create ipc tlc server for other cluster nodes
      if (synapps._config.tls && synapps._config.tls.key && synapps._config.tls.cert) {
        asynk.add(fs.readFile).args(synapps._config.tls.key, asynk.callback)
        .add(fs.readFile).args(synapps._config.tls.cert, asynk.callback)
        .each(synapps._config.tls.ca, fs.readFile)
        .parallel().asCallback(function(err, files) {
          if (err) {
            return synapps.debug('error', 'could not read tls key/certs files');
          }
          var tlsOptions = {
            requestCert: true,
            rejectUnauthorized: true,
            key: files.shift(),
            cert: files.shift(),
            ca: files
          };

          var host = synapps._config.tls.host || 'localhost';
          var port = synapps._config.tls.port || 9000;
          self.socket.listen('tls://' + host + ':' + port, tlsOptions);

          // connect to other cluster nodes
          if (synapps._config.tls.connectTo) {
            synapps._config.tls.connectTo.forEach(function(connect) {
              var connectString = 'tls://' + connect.host + ':' + connect.port;
              self.socket.register(connect.name, connectString, tlsOptions);
            });
          }
        });
      }
      // create local ipc server for workers
      var localPort = synapps._config.ipcLocalPort || 8000;
      this.socket.listen(localPort);

      this.socket.on('request', function(defer, data) {
        if (!data.host) {
          synapps._scheduler.send(data)
            .done(function(result) {
              defer.resolve(result);
            })
            .fail(function(error) {
              if (error instanceof Error) {
                error = error.message;
              }
              defer.reject(error);
            })
            .progress(function(notif) {
              defer.notify(notif);
            });
          return;
        }
        self.send(data.host, data.req)
          .done(function(result) {
            defer.resolve(result);
          })
          .fail(function(error) {
            if (error instanceof Error) {
              error = error.message;
            }
            defer.reject(error);
          })
          .progress(function(notif) {
            defer.notify(notif);
          });
      });

      var firstWorkerReady = false;
      this.socket.on('register', function(identity) {
        if (identity.startsWith('worker')) {
          if (!firstWorkerReady) {
            firstWorkerReady = true;
            self.emit('ready');
          }
          return synapps.debug('info', 'worker ' + identity + ' has registered');
        }
        synapps.debug('info', 'node ' + identity + ' has registered');
        synapps.emit('register', identity);
      });

      this.socket.on('socket.join', function(data) {
        var socket = synapps._io.sockets.connected[data.socketID];
        if (socket) {
          socket.join(data.room);
        }
      });
      this.socket.on('socket.leave', function(data) {
        var socket = synapps._io.sockets.connected[data.socketID];
        if (socket) {
          socket.leave(data.room);
        }
      });
      this.socket.on('socket.to.emit', function(data) {
        synapps._io.to(data.room).emit(data.event, data.msg);
      });

      this.socket.on('debug.state', function(defer, data) {
        var os = require('os');
        var ifaces = os.networkInterfaces();
        var state = {
          debugMode: !!inspector,
          ifaces: [],
          processes: {}
        };
        _.keys(ifaces).forEach(function (ifname) {
          ifaces[ifname].forEach(function(iface) {
            state.ifaces.push({name: iface.address + ' (' + ifname + ')', value: iface.address});
          });
        });
        if (inspector.url()) {
          state.processes.master = { debug: 'chrome-devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=' + inspector.url().substring(5) };
        } else {
          state.processes.master = { debug: false };
        }
        synapps._scheduler._workers.forEach(function(worker) {
          state.processes[worker.name] = { debug: worker.debug || false };
        });
        defer.resolve(state);
      });

      this.socket.on('debug.start', function(defer, data) {
        if (!inspector) {
          synapps.debug('info', 'client tried to start debug on this server but NodeJs version does not support debug mode');
          return defer.reject('NodeJs on server does not support debug mode');
        }
        var response = {};
        if (data.process === 'master') {
          inspector.open(data.port || 9229, data.iface || '127.0.0.1');
          response.url = 'chrome-devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=' + inspector.url().substring(5);
          synapps.debug('info', 'Master is now on debug mode: ' + response.url);
          return defer.resolve(response);
        }

        self.socket.defer(data.process, 'debug.start', data)
          .done(function(result) {
            var worker = _.find(synapps._scheduler._workers, function(worker) {
              return worker.name === data.process;
            });
            worker.debug = result.url;
            defer.resolve(result);
          })
          .fail(function(error) {
            if (error instanceof Error) {
              error = error.message;
            }
            defer.reject(error);
          })
          .progress(function(notif) {
            defer.notify(notif);
          });
      });

      this.socket.on('debug.stop', function(defer, data) {

        if (data.process === 'master') {
          inspector.close();
          synapps.debug('info', 'master leave debug mode');
          return defer.resolve({});
        }

         self.socket.defer(data.process, 'debug.stop', data)
          .done(function(result) {
            var worker = _.find(synapps._scheduler._workers, function(worker) {
              return worker.name === data.process;
            });
            worker.debug = false;
            defer.resolve(result);
          })
          .fail(function(error) {
            if (error instanceof Error) {
              error = error.message;
            }
            defer.reject(error);
          })
          .progress(function(notif) {
            defer.notify(notif);
          });
      });

    } else {
      // connect workers to master
      var localPort = synapps._config.ipcLocalPort || 8000;
      this.socket.register('master', 'tcp://localhost:' + localPort);
      this.socket.on('request', function(defer, data) {
        defer.data = data;
        self.emit('request', defer);
      });
      this.socket.on('debug.start', function(defer, data) {
        var response = {};
        inspector.open(data.port || 9229, data.iface || '127.0.0.1');
        response.url = 'chrome-devtools://devtools/bundled/inspector.html?experiments=true&v8only=true&ws=' + inspector.url().substring(5);
        synapps.debug('info', synapps._config.name + ' is now on debug mode: ' + response.url);
        return defer.resolve(response);
      });

      this.socket.on('debug.stop', function(defer, data) {
        inspector.close();
        synapps.debug('info', 'worker leave debug mode');
        defer.resolve({});
      });

    }
  };

  util.inherits(ipc, EventEmitter);

  ipc.prototype.close = function(cb) {
    this.socket.close(cb);
  };

  ipc.prototype.send = function(node, req, requestErrorHandler) {
    if (synapps.isMaster) {
      return this.socket.defer(node, 'request', req);
    } else {
      return this.socket.defer('master', 'request', { host: node, req: req });
    }
  };

  return ipc;
};
