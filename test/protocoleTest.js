var child_process = require('child_process');
var path = require('path');
var assert = require('assert');
var Client = require('./helpers/index');

describe('protocoles', function() {
  var basicApp;
  var client;

  before(function(done) {
    basicApp = child_process.exec('node ' + path.join(__dirname, './apps/basicApp.js'));
    basicApp.stdout.pipe(process.stdout);
    basicApp.stderr.pipe(process.stdout);

    client = new Client('localhost', 8050);
    setTimeout(done, 1000);
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
    basicApp.stdout.unpipe(process.stdout);
    basicApp.stderr.unpipe(process.stdout);
    basicApp.kill();
    done();
  });
});
