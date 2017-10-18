var assert = require('assert');
var Client = require('./helpers/index');
var processHelper = require('./helpers/process');

describe('protocoles', function() {
  var protocolApp = processHelper('protocolApp');
  var client;

  before(function(done) {
    protocolApp.start(8055).done(function() {
      client = new Client('localhost', 8055);
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

  it('socket io room', function(done) {
    client.socket.emit('test:room', {}).asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
    });
    client.socket.on('room', function(data) {
      assert.strictEqual(data.room, 'ROOM');
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
    protocolApp.stop().asCallback(done);
  });
});
