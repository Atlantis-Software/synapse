/* eslint-env node, mocha */
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

  it('http/get', function(done) {
    client.http.get('test:1', {}).asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data.get);
      assert.strictEqual(data.get, '1');
      done();
    });
  });

  it('http/post', function(done) {
    client.http.post('test:2', {}).asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data.post);
      assert.strictEqual(data.post, '2');
      done();
    });
  });

  it('http/put', function(done) {
    client.http.put('test:3', {}).asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data.put);
      assert.strictEqual(data.put, '3');
      done();
    });
  });

  it('http/delete', function(done) {
    client.http.delete('test:2', {}).asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data.delete);
      assert.strictEqual(data.delete, '2');
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
    client.socket.emit('test:room', {}).asCallback(function(err) {
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
