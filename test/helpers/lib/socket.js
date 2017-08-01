var io = require('socket.io-client');
var asynk = require('asynk');


module.exports = function(host, port, dynFolder) {
  var self = this;
  this.host = 'http://' + host || 'http://localhost';
  this.port = port || 80;
  this.dynFolder = dynFolder || 'API';
  this.socket = io(this.host + ':' + this.port, {path: '/' + this.dynFolder + '/socket.io'});
  this.requests = {};

  this.emit = function(route, data) {
    var deferred = asynk.deferred();
    var uid = Math.random().toString(36).substr(2, 9);
    this.socket.emit('request', {request: route, uid: uid, data: data}, function() {
      self.requests[uid] = {deferred: deferred};
    });
    return deferred.promise();
  }

  this.socket.on('RESOLVE', function(response) {
    if (!response || !response.notification || !response.notification.uid) {
      throw new Error('invalid response');
    }
    if (self.requests[response.notification.uid] && self.requests[response.notification.uid].deferred) {
      self.requests[response.notification.uid].deferred.resolve(response);
      delete self.requests[response.notification.uid];
    }
  });
  this.socket.on('REJECT', function(response) {
    if (!response || !response.notification || !response.notification.uid) {
      throw new Error('invalid response');
    }
    if (self.requests[response.notification.uid] && self.requests[response.notification.uid].deferred) {
      self.requests[response.notification.uid].deferred.reject(new Error(response.notification.msg));
      delete self.requests[response.notification.uid];
    }
  });
  this.socket.on('NOTIFY', function(response) {
    if (!response || !response.notification || !response.notification.uid) {
      throw new Error('invalid response');
    }
    if (self.requests[response.notification.uid] && self.requests[response.notification.uid].deferred) {
      self.requests[response.notification.uid].deferred.notify(response);
    }
  });
}
