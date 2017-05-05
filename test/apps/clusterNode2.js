var synapps = require('../../index');
var path = require('path');

var clusterNode2 = synapps();
clusterNode2.set('name', 'clusterNode2');
clusterNode2.set('ipcLocalPort', 8002);
clusterNode2.set('debug', 0);

var keyPath = path.join(__dirname, '..', '..', 'test.key');
var certificatePath = path.join(__dirname, '..', '..', 'test.crt');

clusterNode2.set('tls', {
  publicKey: certificatePath,
  privateKey: keyPath,
  trusted: [certificatePath],
  port: 8102
});

clusterNode2.route('cluster', {
  pong: [
    {},
    function(req) {
      req.resolve({response: 'PONG'});
    }
  ]
});

clusterNode2.listen(8052, function(err, data) {
  if (err) {
    console.error(err);
  }
  console.log('ready');
});
