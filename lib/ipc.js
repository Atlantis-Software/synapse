var util = require('util');
var EventEmitter = require('events').EventEmitter;
var uuid = require('uuid');
var asynk = require('asynk');
var fs = require('fs');
var _ = require('lodash');
var requests = {};
var TIMEOUT = 60 * 60 * 1000; // 1 hour

var ipc = function(child) {
  EventEmitter.call(this);
  var self = this;
  this.otherProcess = child || process;

  process.on('message', function(message) {
    if (message.requestId && message.status === 'send' && message.event) {
      var deferred = asynk.deferred();
      deferred.done(function(result) {
        // if result is a buffer
        if (result.data instanceof Buffer) {
          result.data = {
            _data: null,
            _binary: result.data.toString('base64')
          };
        }
        self.otherProcess.send({
          status: 'resolve',
          requestId: message.requestId,
          data: result
        });
      }).progress(function(result) {
        // if result is a buffer
        if (result.data instanceof Buffer) {
          result.data = {
            _data: null,
            _binary: result.data.toString('base64')
          };
        }
        self.otherProcess.send({
          status: 'notify',
          requestId: message.requestId,
          data: result
        });
      }).fail(function(err) {
        self.otherProcess.send({
          status: 'reject',
          requestId: message.requestId,
          data: err
        });        
      });
      // if message contain binary data
      if (message.data._data && message.data._binary) {
        var data = message.data._data;
        var binary = message.data._binary;
        asynk.each(_.keys(binary), function(key, cb){
          var file = binary[key];
          fs.readFile(file.path, function(err, buffer) {
            if (err) {
              return cb(err);
            }
            fs.unlink(file.path);
            data[key] = buffer;
            cb();
          });
        }).parallel().done(function() {
          message.data.data = data;
          deferred.data = message.data;
          self.emit(message.event, deferred);
        }).fail(function(err) {
          __debug.error('error while parsing ipc binaries',err);
        });
      } else {
        deferred.data = message.data;
        self.emit(message.event, deferred);
      }
    }
  });
  this.otherProcess.on('message', function(event) {
    if (event.requestId && event.status !== 'send' && requests[event.requestId]) {
      // check binary data
      var message = event.data;
      if (message.data && message.data._data === null && message.data._binary) {
        message.data = new Buffer(message.data._binary, 'base64');
      }
      switch(event.status) {
        case 'resolve':
          requests[event.requestId].resolve(message);
          delete requests[event.requestId];
          break;
        case 'notify':
          requests[event.requestId].notify(message);
          break;
        case 'reject':
          requests[event.requestId].reject(message);
          delete requests[event.requestId];
          break;          
      }
    }
  });
};
util.inherits(ipc, EventEmitter);

ipc.prototype.send = function(event, data) {
  var deferred = asynk.deferred();
  var requestId = uuid.v4();
  requests[requestId] = deferred;
  setTimeout(function() {
    if (requests[requestId]) {
      requests[requestId].reject(new Error('TIMEOUT'));
      delete requests[requestId];
    }
  }, TIMEOUT);
  this.otherProcess.send({
    status: 'send',
    requestId: requestId,
    event: event,
    data: data
  });
  return deferred;
};


module.exports = ipc;