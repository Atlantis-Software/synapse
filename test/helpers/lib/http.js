var asynk = require('asynk');
var _ = require('lodash');
var request = require('request');

module.exports = function(host, port, dynFolder) {
  this.host = 'http://' + host || 'http://localhost';
  this.port = port || 80;
  this.dynFolder = dynFolder ? '/' + dynFolder : '';

  this.emit = function(route, data) {
    var deferred = asynk.deferred();

    request.post({url:this.host + ':' + this.port + this.dynFolder + '/' + route, json: data}, function optionalCallback(err, httpResponse, body) {
      if (err) {
        return deferred.reject(err);
      }

      if (!body) {
        deferred.reject(new Error('#EMPTY_RESPONSE'));
      }

      if (httpResponse.headers['content-type'] && httpResponse.headers['content-type'] === 'text/json' && _.isString(body)) {
        body = JSON.parse(body, function (key, value) {
          // if is an iso datetime
          if (typeof value === 'string' && value.match(/\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d\.\d+([+-][0-2]\d:[0-5]\d|Z)/)) {
            return new Date(value);
          }
          if (value && value.type === 'Buffer' && _.isArray(value.data) ) {
            return new Buffer(value.data);
          }
          return value;
        });
      }

      if (httpResponse.statusCode !== 200) {
        return deferred.reject(new Error(body));
      }
      deferred.resolve(body);
    });
    return deferred.promise();
  };
};
