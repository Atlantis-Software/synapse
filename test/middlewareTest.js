var assert = require('assert');
var Client = require('./helpers/index');
var _ = require('lodash');
var processHelper = require('./helpers/process');

describe('middlewares', function() {
  var middlewareApp = processHelper('middlewareApp');
  var client;

  before(function(done) {
    middlewareApp.start().done(function() {
      client = new Client('localhost', 8053);
      done();
    });
  });

  it('should be intercepted and modified by middleware', function(done) {
    client.http.emit('middleware:test', {msg: 'Original message'}).asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data);
      assert.strictEqual(data.response, 'Modified message');
      done();
    });
  });

  it('should be intercepted and rejected by middleware', function(done) {
    client.http.emit('middleware:test', {msg: 'Middleware reject'}).asCallback(function(err, data) {
      assert(!data);
      assert(err);
      assert.strictEqual(err.message, 'Rejected by middleware');
      done();
    });
  });

  it('should be intercepted and middleware should throw Error', function(done) {
    client.http.emit('middleware:test', {msg: 'Middleware throw error'}).asCallback(function(err, data) {
      assert(!data);
      assert(err);
      assert.strictEqual(err.message, '#INTERNAL_SERVER_ERROR');
      done();
    });
  });

  after(function(done) {
    middlewareApp.stop().asCallback(done);
  });

});
