var synapps = require('../../index');
var asynk = require('asynk');
var _ = require('lodash');

var clusterNode1 = synapps();
clusterNode1.set('name', 'clusterNode1');
clusterNode1.set('ipcLocalPort', 8001);
clusterNode1.set('debug', 0);

clusterNode1.set('tls', {
  publicKey: '/home/dev/svn/synapse/atlbusiness/tls/domain.crt',
  privateKey: '/home/dev/svn/synapse/atlbusiness/tls/domain.key',
  trusted: ['/home/dev/svn/synapse/atlbusiness/tls/domain.crt'],
  port: 8101,
  connectTo: [{name: 'clusterNode2', host:'localhost', port: 8102}]
});

clusterNode1.route('cluster', {
  ping: [
    {},
    function(req) {
      req.emit('clusterNode2', {request: 'cluster:pong'}).done(function(result) {
        return req.resolve(result.data);
      }).fail(function(err) {
        req.reject(err);
      });
    }
  ],
  wrongNode: [
    {},
    function(req) {
      req.emit('wrongNode', {request: 'cluster:pong'}).done(function(result) {
        return req.resolve(result.data);
      }).fail(function(err) {
        req.reject(err);
      });

    }
  ]
});

clusterNode1.listen(8051);
