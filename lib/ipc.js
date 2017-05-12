var socket = require('./socket');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var uuid = require('uuid');
var asynk = require('asynk');
var _ = require('lodash');
var fs = require('fs');
var TIMEOUT = 60 * 60 * 1000; // 1 hour

module.exports = function(synapps) {
  var Socket = socket(synapps);
  var ipc = function() {
    this.relations = {};
    EventEmitter.call(this);
    this.requests = {};
    this.externalSocks = [];
    var self = this;
    if (synapps.isMaster) {

      // create ipc tlc server for other cluster nodes
      if (synapps._config.tls && synapps._config.tls.key && synapps._config.tls.cert) {
        this.external = new Socket();
        var keyDef = asynk.add(fs.readFile).args(synapps._config.tls.key, asynk.callback).serie();
        var certDef = asynk.add(fs.readFile).args(synapps._config.tls.cert, asynk.callback).serie();
        var caDef = asynk.each(synapps._config.tls.ca, fs.readFile).parallel();
        asynk.when(keyDef, certDef, caDef).done(function(key, cert, ca) {
          self.external.set('tls', {
            requestCert: true,
            rejectUnauthorized: true,
            key: key,
            cert: cert,
            ca: ca
          });

          self.external.bind(synapps._config.tls.port || 9000);
          self.external.on('register', function(identity, emitter) {
            synapps.debug(1, 'node ' + identity + ' has registered');
            synapps.emit('register', identity);
            self.relations[identity] = emitter;
          });
          self.external.on('disconnect', function(identity) {
            if (identity) {
              self.relations[identity] = null;
            }
          });

          self.external.on('message', function(task, event, emitter) {
            switch(task) {
              case 'request':
                var requestId = event.requestId;
                // check request
                if (requestId) {
                  var req = event.data;
                  req.type = 'cluster';
                  var deferred = synapps._scheduler.send(req);
                  deferred.done(function(result) {
                    result.requestId = requestId;
                    emitter.emit('resolve', { requestId: requestId, data: result });
                  }).fail(function(err) {
                    emitter.emit('reject', { requestId: requestId, data: err });
                  }).progress(function(notif) {
                    emitter.emit('notify', { requestId: requestId, data: notif });
                  });
                }
                break;
              case 'resolve':
                var requestId = event.requestId;
                if (self.requests[requestId]) {
                  var data = _.cloneDeepWith(event.data, function(entry) {
                    if (_.isObject(entry) && entry.type === 'Buffer' && entry.data) {
                      return new Buffer(entry.data);
                    }
                  });
                  self.requests[requestId].resolve(data);
                  delete self.requests[requestId];
                }
                break;
              case 'reject':
                var requestId = event.requestId;
                if (self.requests[requestId]) {
                  var data = _.cloneDeepWith(event.data, function(entry) {
                    if (_.isObject(entry) && entry.type === 'Buffer' && entry.data) {
                      return new Buffer(entry.data);
                    }
                  });
                  self.requests[requestId].reject(data);
                  delete self.requests[requestId];
                }
                break;
              case 'notify':
                var requestId = event.requestId;
                if (self.requests[requestId]) {
                  var data = _.cloneDeepWith(event.data, function(entry) {
                    if (_.isObject(entry) && entry.type === 'Buffer' && entry.data) {
                      return new Buffer(entry.data);
                    }
                  });
                  self.requests[requestId].progress(data);
                }
                break;
            }
          });
        }).fail(function(err) {
          synapps.debug(0, 'could not read file ' +  err);
        });
      }

      // connect to other cluster nodes
      if (synapps._config.tls && synapps._config.tls.connectTo) {
        synapps._config.tls.connectTo.forEach(function(connect) {
          var sock = new Socket();
          var keyDef = asynk.add(fs.readFile).args(synapps._config.tls.key, asynk.callback).serie();
          var certDef = asynk.add(fs.readFile).args(synapps._config.tls.cert, asynk.callback).serie();
          var caDef = asynk.each(synapps._config.tls.ca, fs.readFile).parallel();
          asynk.when(keyDef, certDef, caDef).done(function(key, cert, ca) {
            sock.set('tls', {
              requestCert: true,
              rejectUnauthorized: true,
              key: key,
              cert: cert,
              ca: ca
            });
            sock.set('identity', synapps._config.name);
            self.externalSocks.push(sock);
            var connectString = 'tls://' + connect.host + ':' + connect.port;
            sock.register(connect.name, connectString, function(emitter) {
              synapps.emit('register', connect.name);
              self.relations[connect.name] = emitter;
              synapps.debug(5, 'client registered');
            });
            sock.on('socket close', function(identity) {
              self.relations[identity] = null;
            });
            sock.on('message', function(task, event, emitter) {
              switch(task) {
                case 'request':
                  var requestId = event.requestId;
                  // check request
                  if (requestId) {
                    var req = event.data;

                    req.type = 'cluster';
                    var deferred = synapps._scheduler.send(req);
                    deferred.done(function(result) {
                      emitter.emit('resolve', { requestId: requestId, data: result });
                    }).fail(function(err) {
                      emitter.emit('reject', { requestId: requestId, data: err });
                    }).progress(function(notif) {
                      emitter.emit('notify', { requestId: requestId, data: notif });
                    });
                  }
                  break;
                case 'resolve':
                  var requestId = event.requestId;
                  if (self.requests[requestId]) {
                    var data = _.cloneDeepWith(event.data, function(entry) {
                      if (_.isObject(entry) && entry.type === 'Buffer' && entry.data) {
                        return new Buffer(entry.data);
                      }
                    });
                    self.requests[requestId].resolve(data);
                    delete self.requests[requestId];
                  }
                  break;
                case 'reject':
                  var requestId = event.requestId;
                  if (self.requests[requestId]) {
                    var data = _.cloneDeepWith(event.data, function(entry) {
                      if (_.isObject(entry) && entry.type === 'Buffer' && entry.data) {
                        return new Buffer(entry.data);
                      }
                    });
                    self.requests[requestId].reject(data);
                    delete self.requests[requestId];
                  }
                  break;
                case 'notify':
                  var requestId = event.requestId;
                  if (self.requests[requestId]) {
                    var data = _.cloneDeepWith(event.data, function(entry) {
                      if (_.isObject(entry) && entry.type === 'Buffer' && entry.data) {
                        return new Buffer(entry.data);
                      }
                    });
                    self.requests[requestId].progress(data);
                  }
                  break;
              }
            });
          });
        });
      }

      // create local ipc server for workers
      var localPort = synapps._config.ipcLocalPort || 8000;
      self.sock = new Socket();
      self.sock.bind(localPort);
      var firstWorkerReady = false;
      self.sock.on('register', function(identity, emitter) {
        if (!firstWorkerReady) {
          firstWorkerReady = true;
          self.emit('ready');
        }
        synapps.debug(1, 'worker ' + identity + ' has registered');
        self.relations[identity] = emitter;
      });
      self.sock.on('message', function(task, event, emitter) {
        switch(task) {
          case 'request':
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
              emitter.emit('resolve', { requestId: requestId, data: result });
            }).fail(function(err) {
              emitter.emit('reject', { requestId: requestId, data: err });
            }).progress(function(notif) {
              emitter.emit('notify', { requestId: requestId, data: notif });
            });
            break;
          case 'resolve':
            var requestId = event.requestId;
            if (self.requests[requestId]) {
              var data = _.cloneDeepWith(event.data, function(entry) {
                if (_.isObject(entry) && entry.type === 'Buffer' && entry.data) {
                  return new Buffer(entry.data);
                }
              });
              self.requests[requestId].resolve(data);
              delete self.requests[requestId];
            }
            break;
          case 'reject':
            var requestId = event.requestId;
            if (self.requests[requestId]) {
              var data = _.cloneDeepWith(event.data, function(entry) {
                if (_.isObject(entry) && entry.type === 'Buffer' && entry.data) {
                  return new Buffer(entry.data);
                }
              });
              self.requests[requestId].reject(data);
              delete self.requests[requestId];
            }
            break;
          case 'notify':
            var requestId = event.requestId;
            if (self.requests[requestId]) {
              var data = _.cloneDeepWith(event.data, function(entry) {
                if (_.isObject(entry) && entry.type === 'Buffer' && entry.data) {
                  return new Buffer(entry.data);
                }
              });
              self.requests[requestId].progress(data);
            }
            break;
        }
      });
      self.sock.on('disconnect', function(identity) {
        if (identity) {
          self.relations[identity] = null;
        }
      });
    } else {
      // connect workers to master
      var localPort = synapps._config.ipcLocalPort || 8000;
      self.sock = new Socket();
      self.sock.set('identity', synapps._config.name);
      self.sock.register('master', localPort, function(emitter) {
        self.relations[emitter.sock.identity] = emitter;
      });
      self.sock.on('message', function(task, event, emitter) {
        switch(task) {
          case 'request':
            if (event.requestId) {
              var deferred = asynk.deferred();
              // emit the deferred
              var data = _.cloneDeepWith(event.data, function(entry) {
                if (_.isObject(entry) && entry.type === 'Buffer' && entry.data) {
                  return new Buffer(entry.data);
                }
              });
              deferred.data = data;

              self.emit('request', deferred);
              // answer master
              deferred.done(function(data) {
                emitter.emit('resolve', { requestId: event.requestId, data: data });
              });
              deferred.fail(function(err) {
                emitter.emit('reject', { requestId: event.requestId, data: err });
              });
              deferred.notify(function(data) {
                emitter.emit('notify', { requestId: event.requestId, data: data });
              });
            }
            break;
          case 'resolve':
            var requestId = event.requestId;
            if (self.requests[requestId]) {
              var data = _.cloneDeepWith(event.data, function(entry) {
                if (_.isObject(entry) && entry.type === 'Buffer' && entry.data) {
                  return new Buffer(entry.data);
                }
              });
              self.requests[requestId].resolve(data);
              delete self.requests[requestId];
            }
            break;
          case 'reject':
            var requestId = event.requestId;
            if (self.requests[requestId]) {
              var data = _.cloneDeepWith(event.data, function(entry) {
                if (_.isObject(entry) && entry.type === 'Buffer' && entry.data) {
                  return new Buffer(entry.data);
                }
              });

              self.requests[requestId].reject(data);
              delete self.requests[requestId];
            }
            break;
          case 'notify':
            var requestId = event.requestId;
            if (self.requests[requestId]) {
              var data = _.cloneDeepWith(event.data, function(entry) {
                if (_.isObject(entry) && entry.type === 'Buffer' && entry.data) {
                  return new Buffer(entry.data);
                }
              });
              self.requests[requestId].progress(data);
            }
            break;
        }
      });
    }
  }

  ipc.prototype.close = function(cb) {
    var socketClosed = asynk.deferred();
    var externalClosed = asynk.deferred();
    cb = cb || function(){};

    var externalSocksClosed = asynk.each(this.externalSocks, function(sock, cb) {
      sock.close(function(err) {
        if (err && err.message !== 'Not running') {
          return cb(err);
        }
        cb();
      });
    }).parallel();

    this.sock.close(function(err) {
      if (err && err.message !== 'Not running') {
        return socketClosed.reject(err);
      }
      socketClosed.resolve();
    });

    if (this.external) {
      this.external.close(function(err) {
        if (err && err.message !== 'Not running') {
          return externalClosed.reject(err);
        }
        externalClosed.resolve();
      });
    } else {
      externalClosed.resolve();
    }

    asynk.when(socketClosed, externalClosed, externalSocksClosed).asCallback(cb);
  }

  ipc.prototype.send = function(node, req, requestErrorHandler) {
    var self = this;
    var deferred = asynk.deferred();
    // handle errors in controller to ensure client receive an `#INTERNAL_SERVER_ERROR`
    if (requestErrorHandler) {
      deferred.resolve = requestErrorHandler.bind(deferred.resolve);
      deferred.reject = requestErrorHandler.bind(deferred.reject);
      deferred.progress = requestErrorHandler.bind(deferred.progress);
    }
    var requestId = uuid.v4();
    this.requests[requestId] = deferred;
    // handle worker timeout
    setTimeout(function() {
      if (self.requests[requestId]) {
        self.requests[requestId].reject(new Error('TIMEOUT'));
        delete self.requests[requestId];
      }
    }, TIMEOUT);
    // send request to host
    if (synapps.isMaster) {
      if (this.relations[node]) {
        var emitter = this.relations[node];
        emitter.emit('request', {requestId: requestId, data: req});
      } else {
        this.requests[requestId].reject('Could not connect to node ' + node);
        delete this.requests[requestId];
      }
    } else {
      var master = this.relations['master'];
      master.emit('request', { requestId: requestId, host: node, data: req });
    }
    return deferred.promise();
  }

  util.inherits(ipc, EventEmitter);
  return ipc;
};
