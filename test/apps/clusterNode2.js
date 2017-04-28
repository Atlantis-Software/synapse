var synapps = require('../../index');

var clusterNode2 = synapps();
clusterNode2.set('name', 'clusterNode2');
clusterNode2.set('ipcLocalPort', 8002);
clusterNode2.set('debug', 0);

clusterNode2.set('tls', {
  publicKey: '/home/dev/svn/synapse/atlbusiness/tls/domain.crt',
  privateKey: '/home/dev/svn/synapse/atlbusiness/tls/domain.key',
  trusted: ['/home/dev/svn/synapse/atlbusiness/tls/domain.crt'],
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

clusterNode2.listen(8052);
