var assert = require('assert');
var Client = require('./helpers/index');
var asynk = require('asynk');
var processHelper = require('./helpers/process');

describe('cluster', function() {
  var clusterNode1 = processHelper('clusterNode1');
  var clusterNode2 = processHelper('clusterNode2');
  var client;

  before(function(done) {
    var ready1 = clusterNode1.start();
    var ready2 = clusterNode2.start();

    client = new Client('localhost', 8051);
    asynk.when(ready1, ready2).asCallback(done);
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

  it('request an unknown node', function(done) {
    client.http.emit('cluster:wrongNode').asCallback(function(err, data) {
      assert(!data);
      assert(err);
      assert.strictEqual(err.message, 'Could not connect to node wrongNode');
      done();
    });
  });

  it('request a dead node', function(done) {
    clusterNode2.stop().done(function() {
      client.http.emit('cluster:ping').asCallback(function(err, data) {
        assert(!data, 'Should not return data');
        assert(err, 'Should return an error');
        assert.strictEqual(err.message, 'Could not connect to node clusterNode2');
        done();
      });
    });
  });

  after(function(done) {
    var kill1 = clusterNode1.stop();
    var kill2 = clusterNode2.stop();

    asynk.when(kill1,kill2).asCallback(done);
  });
});
