var jsonp = require('jsonp-client');
var asynk = require('asynk');
var querystring = require('querystring');

module.exports = function(host, port, dynFolder) {
  var self = this;
  this.host = 'http://' + host || 'http://localhost';
  this.port = port || 80;
  this.dynFolder = dynFolder || 'API';

  this.emit = function(route, data) {
    var deferred = asynk.deferred();
    jsonp(this.host + ':' + this.port + '/' + this.dynFolder + '/' + route + '?' + querystring.encode(data), function(err, response) {
      if(err) {
        return deferred.reject(err);
      }
      deferred.resolve(response);
    });
    return deferred.promise();
  }
}
