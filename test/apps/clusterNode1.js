var synapps = require('../../index');
var asynk = require('asynk');
var _ = require('lodash');
var path = require('path');

var clusterNode1 = synapps();
clusterNode1.set('name', 'clusterNode1');
clusterNode1.set('ipcLocalPort', 8001);
clusterNode1.set('debug', 0);

var keyPath = path.join(__dirname, '..', '..', 'test.key');
var certificatePath = path.join(__dirname, '..', '..', 'test.crt');

clusterNode1.set('tls', {
  publicKey: certificatePath,
  privateKey: keyPath,
  trusted: [certificatePath],
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
