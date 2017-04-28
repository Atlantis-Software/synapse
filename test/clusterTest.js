var child_process = require('child_process');
var path = require('path');
var assert = require('assert');
var Client = require('./helpers/index');

describe('cluster', function() {
  var clusterNode1;
  var clusterNode2;
  var client;

  before(function(done) {
    clusterNode2 = child_process.exec('node ' + path.join(__dirname, './apps/clusterNode2.js'));
    clusterNode2.stdout.pipe(process.stdout);
    clusterNode2.stderr.pipe(process.stdout);

    clusterNode1 = child_process.exec('node ' + path.join(__dirname, './apps/clusterNode1.js'));
    clusterNode1.stdout.pipe(process.stdout);
    clusterNode1.stderr.pipe(process.stdout);

    client = new Client('localhost', 8051);
    setTimeout(done, 1000);
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
    clusterNode2.kill();
    client.http.emit('cluster:ping').asCallback(function(err, data) {
      assert(!data);
      assert(err);
      assert.strictEqual(err.message, 'Could not connect to node clusterNode2');
      done();
    });
  });

  after(function(done) {
    clusterNode2.stdout.unpipe(process.stdout);
    clusterNode2.stderr.unpipe(process.stdout);
    clusterNode1.stdout.unpipe(process.stdout);
    clusterNode1.stderr.unpipe(process.stdout);

    clusterNode2.kill();
    clusterNode1.kill();
    done();
  });
});
