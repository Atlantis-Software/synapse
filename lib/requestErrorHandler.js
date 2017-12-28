// create an independant module as domain is deprecated but not replaced
var domain = require('domain');

var requestErrorHandler = function(request) {
  this.req = request;
  this.domain = domain.create();
  this.executionError = null;
};

requestErrorHandler.prototype.run = function(fn) {
  var self = this;
  this.domain.on('error', function(err) {
    self.executionError = err;
    self.req.log('error', err);
    self.req.reject("#INTERNAL_SERVER_ERROR");
  });
  this.domain.run(fn);
};

requestErrorHandler.prototype.bind = function(fn) {
  return this.domain.bind(fn);
};

requestErrorHandler.prototype.exit = function() {
  return this.domain.exit();
};

module.exports = requestErrorHandler;
