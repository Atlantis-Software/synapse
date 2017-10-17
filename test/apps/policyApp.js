var synapps = require('../../index');
var _ = require('lodash');
var hostHelper = require('../helpers/host');

var policyApp = synapps();
policyApp.set('name', 'policyApp');
policyApp.set('ipcLocalPort', 8005);
policyApp.set('debug', 'error');

policyApp.policy('named', function(req, next) {
  if (req.data.msg === 'let me pass') {
    return next();
  }
  next('forbidden');
});

policyApp.policy('throw', function(req, next) {
  setTimeout(function() {
    throw new Error('policy throw');
  }, 0);
});

policyApp.route('policy', {
  named: [
    {
      policy: 'named',
      input: {
        msg: {
          type: 'string'
        }
      }
    },
    function(req) {
      req.resolve({response: 'OK'});
    }
  ],
  inline: [
    {
      policy: function(req, next) {
        if (req.data.msg === 'let me pass') {
          return next();
        }
        next('forbidden');
      },
      input: {
        msg: {
          type: 'string'
        }
      }
    },
    function(req) {
      req.resolve({response: 'OK'});
    }
  ],
  mixed: [
    {
      policy: [ 'named', function(req, next) {
        if (req.data.msg === 'let me pass') {
          return next();
        }
        next('forbidden');
      }],
      input: {
        msg: {
          type: 'string'
        }
      }
    },
    function(req) {
      req.resolve({response: 'OK'});
    }
  ],
  unknown: [
    {
      policy: 'unknown',
      input: {
        msg: {
          type: 'string'
        }
      }
    },
    function(req) {
      req.resolve({response: 'OK'});
    }
  ],
  mixedUnknown: [
    {
      policy: [ 'named', 'unknown' ],
      input: {
        msg: {
          type: 'string'
        }
      }
    },
    function(req) {
      req.resolve({response: 'OK'});
    }
  ],
  empty: [
    {
      policy: [],
      input: {
        msg: {
          type: 'string'
        }
      }
    },
    function(req) {
      req.resolve({response: 'OK'});
    }
  ],
  wrongType: [
    {
      policy: [ null, {}, void 0, true, 12 ],
      input: {
        msg: {
          type: 'string'
        }
      }
    },
    function(req) {
      req.resolve({response: 'OK'});
    }
  ],
  throw: [
    {
      policy: 'throw',
      input: {
        msg: {
          type: 'string'
        }
      }
    },
    function(req) {
      req.resolve({response: 'OK'});
    }
  ],
});

hostHelper(policyApp);
