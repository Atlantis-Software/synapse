var child_process = require('child_process');
var path = require('path');
var assert = require('assert');
var Client = require('./helpers/index');
var _ = require('lodash');

describe('middlewares', function() {
  var middlewareApp;
  var client;
  var onData;

  before(function(done) {
    onData = function(data) {
      if (data.toString().startsWith("ready")) {
        done();
      } else {
        console.log(data.toString());
      }
    };
    middlewareApp = child_process.exec('node ' + path.join(__dirname, './apps/middlewareApp.js'));
    middlewareApp.stdout.on('data', onData);
    middlewareApp.stderr.pipe(process.stdout);

    client = new Client('localhost', 8053);
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
    middlewareApp.removeListener('data', onData);
    middlewareApp.stderr.unpipe(process.stdout);
    middlewareApp.kill();
    done();
  });

});
