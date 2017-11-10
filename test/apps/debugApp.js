var synapps = require('../../index');
var _ = require('lodash');
var hostHelper = require('../helpers/host');
var asynk = require('asynk');

var debugApp = synapps();

debugApp.set('name', 'debugApp');
debugApp.set('ipcLocalPort', 8006);
debugApp.set('debug', 'debug');

debugApp.route('test', {
  tick: [
    {},
    function(req) {
      var n = 10000000;
      var a = Array(n = n/2),
      t = (Math.sqrt(4+8*n)-2)/4,
      u = 0,
      r = [];
      for(var i = 1; i <= t; i++){
        u = (n-i)/(1+2*i);
        for(var j = i; j <= u; j++) a[i + j + 2*i*j] = true;
      }
      for(var i = 0; i<= n; i++) !a[i] && r.push(i*2+1);
      req.resolve({response: 'PONG'});
    }
  ],
  memory: [
    {},
    function(req) {
      var obj = {};
      var text = '';
      var arr = new Array(700).fill('a');
      asynk.each(arr, function(element, cb) {
        text += text;
        element = new Buffer(text);
        setTimeout(cb, 3);
      }).serie().done(function(err, res) {
        req.resolve({response: 'PONG'});
      });
    }
  ]
});

hostHelper(debugApp);
