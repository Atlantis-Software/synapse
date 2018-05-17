var synapps = require('../../index');
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
      var n = 30000000;
      var a = Array(n = n/2);
      var t = (Math.sqrt(4+8*n)-2)/4;
      var u = 0;
      var r = [];
      for (var i = 1; i <= t; i++){
        u = (n-i)/(1+2*i);
        for (var j = i; j <= u; j++) a[i + j + 2*i*j] = true;
      }
      for (var k = 0; k<= n; k++) !a[k] && r.push(k*2+1);
      req.resolve({response: 'PONG'});
    }
  ],
  memory: [
    {},
    function(req) {
      var text = '';
      var arr = new Array(700).fill('a');
      asynk.each(arr, function(element, cb) {
        text += text;
        element = new Buffer(text);
        setTimeout(cb, 3);
      }).serie().done(function() {
        req.resolve({response: 'PONG'});
      });
    }
  ]
});

hostHelper(debugApp);
