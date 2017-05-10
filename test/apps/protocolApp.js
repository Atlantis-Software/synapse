var synapps = require('../../index');
var _ = require('lodash');

var protocolApp = synapps();

protocolApp.set('name', 'protocolApp');
protocolApp.set('ipcLocalPort', 8006);
protocolApp.set('debug', 0);

protocolApp.route('test', {
  ping: [
    {},
    function(req) {
      req.resolve({response: 'PONG'});
    }
  ]
});

protocolApp.listen(8055, function(err, data) {
  if (err) {
    console.error(err);
  }
  console.log('ready');
});
