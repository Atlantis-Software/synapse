/* eslint-env node, mocha */
var assert = require('assert');
var Client = require('./helpers/index');
var processHelper = require('./helpers/process');

describe('workers', function() {
  var workerApp = processHelper('workerApp');
  var client;

  before(function(done) {
    workerApp.start(8056).done(function() {
      client = new Client('localhost', 8056);
      done();
    });
  });

  it('emit', function(done) {
    client.http.emit('test:ping', {msg: 'PING'}).asCallback(function(err, data) {
      if (err) {
        return done(err);
      }
      assert(data.response);
      assert.strictEqual(data.response, 'PONG');
      done();
    });
  });

  after(function(done) {
    workerApp.stop().asCallback(done);
  });
});
