/* eslint-env node, mocha */
var assert = require('assert');
var Client = require('./helpers/index');
var asynk = require('asynk');
var processHelper = require('./helpers/process');
var generateKeys = require('../bin/utils/generateKeys');

describe('cluster', function() {
  var clusterNode1 = processHelper('clusterNode1');
  var clusterNode2 = processHelper('clusterNode2');
  var client;

  before(function(done) {
    generateKeys('test');

    clusterNode1.on('register', function(identity) {
      if (identity === 'clusterNode2') {
        asynk.when(ready1, ready2).asCallback(done);
      }
    });

    var ready1 = clusterNode1.start(8051);
    var ready2 = clusterNode2.start(8052);

    client = new Client('localhost', 8051);
  });

  it('request second node through a worker', function(done) {
    client.http.emit('cluster:workerPing').asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data.response);
      assert.strictEqual(data.response, 'PONG');
      done();
    });
  });

  it('request second node through first', function(done) {
    client.http.emit('cluster:ping').asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data.response);
      assert.strictEqual(data.response, 'PONG');
      done();
    });
  });

  it('check deferred resolve', function(done) {
    client.http.emit('cluster:resolve').asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data);
      assert.strictEqual(data, 'done');
      done();
    });
  });

  it('check deferred reject', function(done) {
    client.http.emit('cluster:reject').asCallback(function(err, data) {
      assert(!data);
      assert.strictEqual(JSON.parse(err.message).notification.msg, 'rejected');
      done();
    });
  });

  it('check deferred notify', function(done) {
    var notifCount = 0;
    client.socket.emit('cluster:notify').done(function(data) {
      assert(data);
      assert.strictEqual(data.result, 'notified');
      assert.strictEqual(notifCount, 2);
      done();
    }).fail(function(err) {
      if (err) {
        return done(err);
      }
    }).progress(function(msg) {
      ++notifCount;
      if (notifCount === 1) {
        assert.strictEqual(msg.data, 'notif1');
      } else if (notifCount === 2) {
        assert.strictEqual(msg.data, 'notif2');
      }
    });
  });

  it('request an unknown node', function(done) {
    client.http.emit('cluster:wrongNode').asCallback(function(err, data) {
      assert(!data);
      assert(err);
      assert.strictEqual(err.message, 'wrongNode is not registered');
      done();
    });
  });

  it('make first node throw second node callback', function(done) {
    client.http.emit('cluster:throw').asCallback(function(err, data) {
      assert(!data);
      assert(err);
      done();
    });
  });

  it('request a dead node', function(done) {
    clusterNode2.stop().done(function() {
      client.http.emit('cluster:ping').asCallback(function(err, data) {
        assert(!data);
        assert(err);
        assert.strictEqual(err.message, 'clusterNode2 is not registered');
        done();
      });
    });
  });

  after(function(done) {
    var kill1 = clusterNode1.stop();
    var kill2 = clusterNode2.stop();

    asynk.when(kill1, kill2).asCallback(done);
  });
});
