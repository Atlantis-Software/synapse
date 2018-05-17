var Http = require('./lib/http');
var Jsonp = require('./lib/jsonp');
var Socket = require('./lib/socket');

module.exports = function(host, port, dynFolder) {
  this.http = new Http(host, port, dynFolder);
  this.jsonp = new Jsonp(host, port, dynFolder);
  this.socket = new Socket(host, port, dynFolder);
};
