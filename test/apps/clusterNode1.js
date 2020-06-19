var synapps = require('../../index');
var path = require('path');
var hostHelper = require('../helpers/host');

var clusterNode1 = synapps();
clusterNode1.set('name', 'clusterNode1');
clusterNode1.set('ipcLocalPort', 8001);
clusterNode1.set('debug', 'debug');

var keyPath = path.join(__dirname, '..', '..', 'test.key');
var certificatePath = path.join(__dirname, '..', '..', 'test.crt');

clusterNode1.set('tls', {
  key: keyPath,
  cert: certificatePath,
  ca: [certificatePath],
  port: 8101,
  connectTo: [{name: 'clusterNode2', host:'127.0.0.1', port: 8102}]
});

clusterNode1.createWorker('myWorker', function (worker) {
  worker.on('request', function (req) {
    worker.emit('clusterNode2', '/cluster/pong', function(err, result) {
      if (err) {
        return req.reject(err);
      }
      req.resolve(result.data);
    });
  });
});

clusterNode1.route('cluster', {
  ping: [
    {},
    function(req) {
      req.emit('clusterNode2', '/cluster/pong', function(err, result) {
        if (err) {
          return req.reject(err);
        }
        req.resolve(result.data);
      });
    }
  ],
  workerPing: [
    {},
    function(req) {
      req.emit('myWorker', '/cluster/pong', function(err, result) {
        if (err) {
          return req.reject(err);
        }
        req.resolve(result);
        //req.resolve(result.data);
      });
    }
  ],
  resolve: [
    {},
    function(req) {
      req.emit('clusterNode2', {request: 'cluster:done'}).done(function(result) {
        return req.resolve(result.data);
      }).fail(function(err) {
        req.reject(err);
      });
    }
  ],
  reject: [
    {},
    function(req) {
      req.emit('clusterNode2', {request: 'cluster:reject'}).done(function(result) {
        return req.resolve(result.data);
      }).fail(function(err) {
        req.reject(err);
      });
    }
  ],
  notify: [
    {},
    function(req) {
      req.emit('clusterNode2', {request: 'cluster:notify'}).done(function(result) {
        return req.resolve(result.data);
      }).fail(function(err) {
        req.reject(err);
      }).progress(function(msg) {
        req.notify(msg);
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
  ],
  throw: [
    {},
    function(req) {
      req.emit('clusterNode2', {request: 'cluster:pong'}).done(function() {
        throw new Error('Throw after second node callback');
      }).fail(function(err) {
        req.reject(err);
      });
    }
  ]
});

hostHelper(clusterNode1);
