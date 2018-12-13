var synapps = require('../../index');
var hostHelper = require('../helpers/host');

var protocolApp = synapps();

protocolApp.set('name', 'protocolApp');
protocolApp.set('ipcLocalPort', 8006);
protocolApp.set('debug', 'debug');

protocolApp.route('test', {
  ping: [
    {},
    function(req) {
      req.resolve({response: 'PONG'});
    }
  ],
  room: [
    {},
    function(req) {
      req.socket.join('ROOM');
      req.resolve({});
      req.socket.to('ROOM').emit('room', {room: 'ROOM'});
    }
  ]
});

protocolApp.get('test/:id', function(req) {
  req.debug(JSON.stringify(req.data));
  req.resolve({ get: req.data.id });
});

protocolApp.post('test/:id', function(req) {
  req.resolve({ post: req.data.id });
});

protocolApp.put('test/:id', function(req) {
  req.resolve({ put: req.data.id });
});

protocolApp.delete('test/:id', function(req) {
  req.resolve({ delete: req.data.id });
});

hostHelper(protocolApp);

