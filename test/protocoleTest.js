var assert = require('assert');
var Client = require('./helpers/index');
var processHelper = require('./helpers/process');

describe('protocoles', function() {
  var basicApp = processHelper('basicApp');
  var client;

  before(function(done) {
    basicApp.start().done(function() {
      client = new Client('localhost', 8050);
      done();
    });
  });

  it('http', function(done) {
    client.http.emit('test:ping', {msg: 'PING'}).asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data.response);
      assert.strictEqual(data.response, 'PONG');
      done();
    });
  });

  it('socket io', function(done) {
    client.socket.emit('test:ping', {msg: 'PING FIRST'}).asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data.response);
      assert.strictEqual(data.response, 'PONG');
      done();
    });
  });

  it('jsonp', function(done) {
    client.jsonp.emit('test:ping', {msg: 'PING'}).asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data.response);
      assert.strictEqual(data.response, 'PONG');
      done();
    });
  });

  after(function(done) {
    basicApp.stop().asCallback(done);
  });
});
