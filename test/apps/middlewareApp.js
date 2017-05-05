var synapps = require('../../index');
var _ = require('lodash');

var middlewareApp = synapps();
middlewareApp.set('name', 'middlewareApp');
middlewareApp.set('ipcLocalPort', 8004);
middlewareApp.set('debug', 0);


middlewareApp.use(function(req, next) {
  if (req.data && req.data.msg) {
    if (req.data.msg === 'Original message') {
      req.data.msg = 'Modified message';
      return next();
    }
    if (req.data.msg === 'Middleware reject') {
      req.reject('Rejected by middleware');
      return next();
    }
    if (req.data.msg === 'Middleware throw error') {
      setTimeout(function() {
        throw new Error('middleware err');
        next();
      }, 0);
    }
  }
});

middlewareApp.route('middleware', {
  test: [
    {
      input: {
        msg: {
          type: 'string'
        }
      }
    },
    function(req) {
      req.resolve({response: req.data.msg});
    }
  ]
});

middlewareApp.listen(8053, function(err, data) {
  if (err) {
    console.error(err);
  }
  console.log('ready');
});
