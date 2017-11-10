var assert = require('assert');
var Client = require('./helpers/index');
var processHelper = require('./helpers/process');
var fs = require('fs');

describe('debug', function() {
  var debugApp = processHelper('debugApp');
  var client;

  before(function(done) {
    debugApp.start(8056).done(function() {
      client = new Client('localhost', 8056);
      done();
    });
  });

  it('should detect longer tick interval', function(done) {
    var logLength = fs.readFileSync('synapps.log').length;
    client.http.emit('test:tick', {msg: 'PING'}).asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data.response);
      assert.strictEqual(data.response, 'PONG');
      var logs = fs.readFileSync('synapps.log').slice(logLength).toString();
      assert(logs.includes('worker tick interval'));
      done();
    });
  });

  it('should detect (possible) memory leak', function(done) {
    var logLength = fs.readFileSync('synapps.log').length;
    client.http.emit('test:memory', {msg: 'PING'}).asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data.response);
      assert.strictEqual(data.response, 'PONG');
      var logs = fs.readFileSync('synapps.log').slice(logLength).toString();
      assert(logs.match(".heap(.*)is growing."));
      done();
    });
  });

  after(function(done) {
    debugApp.stop().asCallback(done);
  });
});
