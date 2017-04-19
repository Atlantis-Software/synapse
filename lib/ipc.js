var IPC = require('node-ipc').IPC;
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var uuid = require('uuid');
var asynk = require('asynk');
var _ = require('lodash');
var TIMEOUT = 60 * 60 * 1000; // 1 hour

module.exports = function(synapps) {
  var ipc = function() {
    this.sock = new IPC;
    this.relations = {};
    this.sock.config.id = synapps._config.name;
    this.sock.config.retry = 1500;
    this.sock.config.silent = true;
    EventEmitter.call(this);
    this.requests = {};
    var self = this;
    if (synapps.isMaster) {

      // create ipc tlc server for other cluster nodes
      if (synapps._config.tls && synapps._config.tls.privateKey && synapps._config.tls.publicKey) {
        var external = new IPC;
        external.config.id = synapps._config.name;
        external.config.retry = 1500;
        external.config.networkPort = synapps._config.tls.port || 9000;
        external.config.tls = {
          public: synapps._config.tls.publicKey,
          private: synapps._config.tls.privateKey,
          requestCert: true,
          rejectUnauthorized: true,
          trustedConnections: synapps._config.tls.trusted || []
        };
        external.serveNet(function(){
          external.server.on('register', function(data, socket) {
            synapps.debug(1, 'node ' + data.name + ' has registered');
            var emmiter = function(event, data) {
              external.server.emit(socket, event, data);
            };
            self.relations[data.name] = emmiter;
          });
          // handle incomming request
          external.server.on('request', function(event, socket) {
            var requestId = event.requestId;
            // check request
            if (requestId) {
              var req = event.data;
              req.type = 'cluster';
              var deferred = synapps._scheduler.send(req);
              deferred.done(function(result) {
                result.requestId = requestId;
                external.server.emit(socket, 'resolve', { requestId: requestId, data: result });
              }).fail(function(err) {
                external.server.emit(socket, 'reject', { requestId: requestId, data: err });
              }).progress(function(notif) {
                external.server.emit(socket, 'notify', { requestId: requestId, data: notif });
              });
            }
          });
          external.server.on('resolve', function(event, socket) {
            var requestId = event.requestId;
            if (self.requests[requestId]) {
              var data = _.cloneDeepWith(event.data, function(entry) {
                if (entry.type === 'Buffer' && entry.data) {
                  return new Buffer(entry.data);
                }
              });
              self.requests[requestId].resolve(data);
              delete self.requests[requestId];
            }
          });
          external.server.on('reject', function(event, socket) {
            var requestId = event.requestId;
            if (self.requests[requestId]) {
              var data = _.cloneDeepWith(event.data, function(entry) {
                if (entry.type === 'Buffer' && entry.data) {
                  return new Buffer(entry.data);
                }
              });
              self.requests[requestId].reject(data);
              delete self.requests[requestId];
            }
          });
          external.server.on('notify', function(event, socket) {
            var requestId = event.requestId;
            if (self.requests[requestId]) {
              var data = _.cloneDeepWith(event.data, function(entry) {
                if (entry.type === 'Buffer' && entry.data) {
                  return new Buffer(entry.data);
                }
              });
              self.requests[requestId].progress(data);
            }
          });
        });
        external.server.start();
      }

      // connect to other cluster nodes
      if (synapps._config.tls && synapps._config.tls.connectTo) {
        synapps._config.tls.connectTo.forEach(function(connect) {
          var sock = new IPC;
          sock.config.id = synapps._config.name;
          sock.config.networkHost = connect.host;
          sock.config.retry = 1500;
          sock.config.networkPort = connect.port || 9000;
          sock.config.tls = {
            public: synapps._config.tls.publicKey,
            private: synapps._config.tls.privateKey,
            rejectUnauthorized: true,
            trustedConnections: synapps._config.tls.trusted || []
          };
          sock.connectToNet(connect.name, function() {
            var emmiter = function(event, data) {
              sock.of[connect.name].emit(event, data);
            };
            emmiter('register', { name:  synapps._config.name });
            self.relations[connect.name] = emmiter;
            // handle incomming request
            sock.of[connect.name].on('request', function(event) {
              var requestId = event.requestId;
              // check request
              if (requestId) {
                var req = event.data;

                req.type = 'cluster';
                var deferred = synapps._scheduler.send(req);
                deferred.done(function(result) {
                  sock.of[connect.name].emit('resolve', { requestId: requestId, data: result });
                }).fail(function(err) {
                  sock.of[connect.name].emit('reject', { requestId: requestId, data: err });
                }).progress(function(notif) {
                  sock.of[connect.name].emit('notify', { requestId: requestId, data: notif });
                });
              }
            });
            sock.of[connect.name].on('resolve', function(event) {
              var requestId = event.requestId;
              if (self.requests[requestId]) {
                var data = _.cloneDeepWith(event.data, function(entry) {
                  if (entry.type === 'Buffer' && entry.data) {
                    return new Buffer(entry.data);
                  }
                });
                self.requests[requestId].resolve(data);
                delete self.requests[requestId];
              }
            });
            sock.of[connect.name].on('reject', function(event) {
              var requestId = event.requestId;
              if (self.requests[requestId]) {
                var data = _.cloneDeepWith(event.data, function(entry) {
                  if (entry.type === 'Buffer' && entry.data) {
                    return new Buffer(entry.data);
                  }
                });
                self.requests[requestId].reject(data);
                delete self.requests[requestId];
              }
            });
            sock.of[connect.name].on('notify', function(event) {
              var requestId = event.requestId;
              if (self.requests[requestId]) {
                var data = _.cloneDeepWith(event.data, function(entry) {
                  if (entry.type === 'Buffer' && entry.data) {
                    return new Buffer(entry.data);
                  }
                });
                self.requests[requestId].progress(data);
              }
            });
          });
        });
      }

      // create local ipc server for workers
      var localPort = synapps._config.ipcLocalPort || 8000;
      self.sock.serveNet(localPort, function() {
        self.sock.server.on('register', function(data, socket) {
          synapps.debug(1, 'worker ' + data.name + ' has registered');
          var emmiter = function(event, data) {
            self.sock.server.emit(socket, event, data);
          }
          self.relations[data.name] = emmiter;
        });
        // master start serving
        self.sock.server.on('request', function(event, socket) {
          var host = event.host;
          var requestId = event.requestId;
          var req = event.data;
          req.type = 'local';
          var deferred;
          if (host === synapps._config.name) {
            deferred = synapps._scheduler.send(req);
          } else {
            deferred = self.send(host, req);
          }
          deferred.done(function(result) {
            self.sock.server.emit(socket, 'resolve', { requestId: requestId, data: result });
          }).fail(function(err) {
            self.sock.server.emit(socket, 'reject', { requestId: requestId, data: err });
          }).progress(function(notif) {
            self.sock.server.emit(socket, 'notify', { requestId: requestId, data: notif });
          });
        });

        self.sock.server.on('resolve', function(event, socket) {
          var requestId = event.requestId;
          if (self.requests[requestId]) {
            var data = _.cloneDeepWith(event.data, function(entry) {
              if (entry.type === 'Buffer' && entry.data) {
                return new Buffer(entry.data);
              }
            });
            self.requests[requestId].resolve(data);
            delete self.requests[requestId];
          }
        });
        self.sock.server.on('reject', function(req, socket) {
          if (self.requests[requestId]) {
            var data = _.cloneDeepWith(event.data, function(entry) {
              if (entry.type === 'Buffer' && entry.data) {
                return new Buffer(entry.data);
              }
            });
            self.requests[requestId].reject(data);
            delete self.requests[requestId];
          }
        });
        self.sock.server.on('notify', function(req, socket) {
          if (self.requests[requestId]) {
            var data = _.cloneDeepWith(event.data, function(entry) {
              if (entry.type === 'Buffer' && entry.data) {
                return new Buffer(entry.data);
              }
            });
            self.requests[requestId].progress(data);
          }
        });
      });
      self.sock.server.start();
    } else {
      // connect workers to master
      self.sock.config.maxRetries = 10;
      var localPort = synapps._config.ipcLocalPort || 8000;
      self.sock.connectToNet(synapps._config.masterName, localPort, function() {
        // worker is connected
        var master = self.sock.of[synapps._config.masterName];
        master.on('request', function(req) {
          // check request
          if (req.requestId) {
            var deferred = asynk.deferred();
            // emit the deferred
            deferred.data = req.data;
            self.emit('request', deferred);
            // answer master
            deferred.done(function(data) {
              master.emit('resolve', { requestId: req.requestId, data: data });
            });
            deferred.fail(function(err) {
              master.emit('reject', { requestId: req.requestId, data: err });
            });
            deferred.notify(function(data) {
              master.emit('notify', { requestId: req.requestId, data: data });
            });
          }
        });

        master.on('resolve', function(event) {
          var requestId = event.requestId;
          if (self.requests[requestId]) {
            var data = _.cloneDeepWith(event.data, function(entry) {
              if (entry.type === 'Buffer' && entry.data) {
                return new Buffer(entry.data);
              }
            });
            self.requests[requestId].resolve(data);
            delete self.requests[requestId];
          }
        });
        master.on('reject', function(event) {
          var requestId = event.requestId;
          if (self.requests[requestId]) {
            var data = _.cloneDeepWith(event.data, function(entry) {
              if (entry.type === 'Buffer' && entry.data) {
                return new Buffer(entry.data);
              }
            });
            self.requests[requestId].reject(data);
            delete self.requests[requestId];
          }
        });
        master.on('notify', function(event) {
          var requestId = event.requestId;
          if (self.requests[requestId]) {
            var data = _.cloneDeepWith(event.data, function(entry) {
              if (entry.type === 'Buffer' && entry.data) {
                return new Buffer(entry.data);
              }
            });
            self.requests[requestId].progress(data);
          }
        });
        master.emit('register', { name:  synapps._config.name });
      });
    }
  }

  ipc.prototype.send = function(node, req) {
    var self = this;
    var deferred = asynk.deferred();
    var requestId = uuid.v4();
    this.requests[requestId] = deferred;
    // handle worker timeout
    setTimeout(function() {
      if (requests[requestId]) {
        self.requests[requestId].reject(new Error('TIMEOUT'));
        delete self.requests[requestId];
      }
    }, TIMEOUT);
    // send request to host
    if (synapps.isMaster ) {
      if (this.relations[node]) {
        var emit = this.relations[node];
        emit('request', {requestId: requestId, data: req});
      } else {
        this.requests[requestId].reject(new Error('unknown process ' + node));
        delete this.requests[requestId];
      }
    } else {
      var master = self.sock.of[synapps._config.masterName];
      master.emit('request', { requestId: requestId, host: node, data: req });
    }
    return deferred;
  }

  util.inherits(ipc, EventEmitter);
  return ipc;
};
