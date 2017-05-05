var child_process = require('child_process');
var path = require('path');
var assert = require('assert');
var Client = require('./helpers/index');
var _ = require('lodash');

describe('policies', function() {
  var policyApp;
  var comPolicyApp;
  var onData;

  before(function(done) {
    onData = function(data) {
      if (data.toString().startsWith("ready")) {
        done();
      } else {
        console.log(data.toString());
      }
    };
    policyApp = child_process.exec('node ' + path.join(__dirname, '/apps/policyApp.js'));
    policyApp.stdout.on('data', onData);
    policyApp.stderr.pipe(process.stdout);

    client = new Client('localhost', 8054);
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
    policyApp.removeListener('data', onData);
    policyApp.stderr.unpipe(process.stdout);
    policyApp.kill();
    done();
  });

});
