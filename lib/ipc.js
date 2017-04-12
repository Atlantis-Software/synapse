var IPC = require('node-ipc').IPC;
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var uuid = require('uuid');
var asynk = require('asynk');
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
      self.sock.serveNet(function() {
        self.sock.server.on('register', function(data, socket) {
          synapps.debug(1, 'worker ' + data.name + ' has registered');
          self.relations[data.name] = socket;
        });
        // master start serving
        self.sock.server.on('resolve', function(req, socket) {
          self.requests[req.requestId].resolve(req.data);
          delete self.requests[req.requestId];
        });
        self.sock.server.on('reject', function(req, socket) {
          self.requests[req.requestId].reject(req.data);
          delete self.requests[req.requestId];
        });
        self.sock.server.on('notify', function(req, socket) {
          self.requests[req.requestId].notify(req.data);
        });
      });
      self.sock.server.start();
    } else {
      self.sock.config.maxRetries = 10;
      self.sock.connectToNet(synapps._config.masterName, function() {
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
        master.emit('register', { name:  synapps._config.name });
      });
    }
  }

  ipc.prototype.send = function(node, event, data) {
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
    // send request to child
    var otherProcess = this.relations[node];
    if (otherProcess) {
      this.sock.server.emit(otherProcess, event, {requestId: requestId, data: data});
    } else {
      this.requests[requestId].reject(new Error('unknown process ' + node));
      delete this.requests[requestId];
    }
    return deferred;
  }

  util.inherits(ipc, EventEmitter);
  return ipc;
};
