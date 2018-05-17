/* eslint-env node, mocha */
var assert = require('assert');
var Client = require('./helpers/index');
var processHelper = require('./helpers/process');

describe('policies', function() {
  var policyApp = processHelper('policyApp');
  var client;

  before(function(done) {
    policyApp.start(8054).done(function() {
      client = new Client('localhost', 8054);
      done();
    });
  });

  it('named policy', function(done) {
    client.socket.emit('policy:named', {msg: 'let me pass'}).asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data);
      assert.strictEqual(data.response, 'OK');
      done();
    });
  });

  it('named policy forbidden', function(done) {
    client.socket.emit('policy:named', {msg: 'do not let me pass'}).asCallback(function(err, data) {
      assert(!data);
      assert(err);
      assert.strictEqual(err.message, '#FORBIDDEN');
      done();
    });
  });

  it('inline policy', function(done) {
    client.socket.emit('policy:inline', {msg: 'let me pass'}).asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data);
      assert.strictEqual(data.response, 'OK');
      done();
    });
  });

  it('inline policy forbidden', function(done) {
    client.socket.emit('policy:inline', {msg: 'do not let me pass'}).asCallback(function(err, data) {
      assert(!data);
      assert(err);
      assert.strictEqual(err.message, '#FORBIDDEN');
      done();
    });
  });

  it('mixed policy', function(done) {
    client.socket.emit('policy:mixed', {msg: 'let me pass'}).asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data);
      assert.strictEqual(data.response, 'OK');
      done();
    });
  });

  it('mixed policy forbidden', function(done) {
    client.socket.emit('policy:mixed', {msg: 'do not let me pass'}).asCallback(function(err, data) {
      assert(!data);
      assert(err);
      assert.strictEqual(err.message, '#FORBIDDEN');
      done();
    });
  });

  it('unknown policy', function(done) {
    client.socket.emit('policy:unknown', {msg: 'let me pass'}).asCallback(function(err, data) {
      assert(!data);
      assert(err);
      assert.strictEqual(err.message, '#INTERNAL_SERVER_ERROR');
      done();
    });
  });

  it('mixed unknown', function(done) {
    client.socket.emit('policy:mixedUnknown', {msg: 'let me pass'}).asCallback(function(err, data) {
      assert(!data);
      assert(err);
      assert.strictEqual(err.message, '#INTERNAL_SERVER_ERROR');
      done();
    });
  });

  it('empty policy', function(done) {
    client.socket.emit('policy:empty', {msg: 'let me pass'}).asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data);
      assert.strictEqual(data.response, 'OK');
      done();
    });
  });

  it('wrong type policy', function(done) {
    client.socket.emit('policy:wrongType', {msg: 'let me pass'}).asCallback(function(err, data) {
      assert(!data);
      assert(err);
      assert.strictEqual(err.message, '#INTERNAL_SERVER_ERROR');
      done();
    });
  });

  it('policy throw error', function(done) {
    client.socket.emit('policy:throw', {msg: 'let me pass'}).asCallback(function(err, data) {
      assert(!data);
      assert(err);
      assert.strictEqual(err.message, '#INTERNAL_SERVER_ERROR');
      done();
    });
  });

  after(function(done) {
    policyApp.stop().asCallback(done);
  });

});
