var assert = require('assert');
var Client = require('./helpers/index');
var _ = require('lodash');
var processHelper = require('./helpers/process');

describe('datatypes', function() {
  var datatypeApp = processHelper('datatypeApp');
  var client;


  before(function(done) {
    datatypeApp.start().done(function() {
      client = new Client('localhost', 8050);
      done();
    });

  });

  describe('input', function() {
    it('should accept string input', function(done) {
      client.http.emit('type:string', {
        string: 'test string'
      }).asCallback(function(err, data) {
        if (err) {
          return done(err);
        }
        assert(data.ok);
        done();
      });
    });
    it('should accept boolean input', function(done) {
      client.http.emit('type:boolean', {
        true: true,
        false: false
      }).asCallback(function(err, data) {
        if (err) {
          return done(err);
        }
        assert(data.ok);
        done();
      });
    });
    it('should accept date input', function(done) {
      client.http.emit('type:date', {
        date: new Date(2009,07,11)
      }).asCallback(function(err, data) {
        if (err) {
          return done(err);
        }
        assert(data.ok);
        done();
      });
    });
    it('should accept float input', function(done) {
      client.http.emit('type:float', {
        float: 4.2
      }).asCallback(function(err, data) {
        if (err) {
          return done(err);
        }
        assert(data.ok);
        done();
      });
    });
    it('should accept integer input', function(done) {
      client.http.emit('type:integer', {
        integer: 10
      }).asCallback(function(err, data) {
        if (err) {
          return done(err);
        }
        assert(data.ok);
        done();
      });
    });
    it('should accept binary input', function(done) {
      client.http.emit('type:binary', {
        binary: new Buffer('i am a buffer')
      }).asCallback(function(err, data) {
        if (err) {
          return done(err);
        }
        assert(data.ok);
        done();
      });
    });

  });

  describe('output', function() {

    it('string', function(done) {
      client.http.emit('get:string').asCallback(function(err, data) {
        if (err) {
          return done(err);
        }
        assert(data.response);
        assert(typeof data.response === 'string', 'Should be a string');
        assert.strictEqual(data.response, 'wubba lubba dub dub !');
        done();
      });
    });

    it('float', function(done) {
      client.http.emit('get:float').asCallback(function(err, data) {
        if (err) {
          return done(err);
        }
        assert(data.response);
        assert(typeof data.response === 'number', 'Should be a float');
        assert.strictEqual(data.response, 7.32);
        done();
      });
    });

    it('date', function(done) {
      client.http.emit('get:date').asCallback(function(err, data) {
        if (err) {
          return done(err);
        }
        assert(data.response);
        assert(_.isDate(data.response), 'Should be a date');
        assert.deepStrictEqual(data.response, new Date(1998,05,10));
        done();
      });
    });

    it('buffer', function(done) {
      client.http.emit('get:buffer').asCallback(function(err, data) {
        if (err) {
          return done(err);
        }
        assert(data.response);
        assert(_.isBuffer(data.response), 'Should be a buffer');
        assert.strictEqual(data.response.toString(), 'I am a buffer and i love it!');
        done();
      });
    });

    it('boolean', function(done) {
      client.http.emit('get:boolean').asCallback(function(err, data) {
        if (err) {
          return done(err);
        }
        assert(data.response);
        assert(_.isBoolean(data.response), 'Should be a boolean');
        assert.strictEqual(data.response, true);
        done();
      });
    });
  });

  describe('required', function() {
    it('should work with all fields', function(done) {
      client.http.emit('type:required', {
        required: 'i am required',
        notRequired: 'i am not required'
      }).asCallback(function(err, data) {
        if (err) {
          return done(err);
        }
        assert(data.ok);
        done();
      });
    });

    it('should work with only required fields', function(done) {
      client.http.emit('type:required', {
        required: 'i am required'
      }).asCallback(function(err, data) {
        if (err) {
          return done(err);
        }
        assert(data.ok);
        done();
      });
    });

    it('should not work with only non-required fields', function(done) {
      client.http.emit('type:required', {
        notRequired: 'i am not required'
      }).asCallback(function(err, data) {
        if (data) {
          return done(new Error('Should not work without required fields'));
        }
        assert(err);
        assert.strictEqual(err.message, '#INVALID_REQUEST');
        done();
      });
    });

    it('should not work without fields', function(done) {
      client.http.emit('type:required').asCallback(function(err, data) {
        if (data) {
          return done(new Error('Should not work without fields'));
        }
        assert(err);
        assert.strictEqual(err.message, '#INVALID_REQUEST');
        done();
      });
    });

  });

  after(function(done) {
    datatypeApp.stop().asCallback(done);
  });
});
