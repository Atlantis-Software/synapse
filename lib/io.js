var IO = require('socket.io');

module.exports = function(synapse) {
  var io = IO(synapse._http, { path: '/' + synapse._config.apiDir + '/socket.io' });
  io.on('connection', function(socket) {
    socket.on('request', function(data, ack) {
      var req = {
        type: 'socket.io',
        request: data.request,
        sessionID: data.sessionID,
        data: data.data,
        uid: data.uid
      };
      ack();
      synapse._scheduler.send(req).done(function(message) {
        var data = message.data || {};
        data.notification = message.notification;
        socket.emit('RESOLVE', data);
      }).progress(function(message) {
        var data = message.data || {};
        data.notification = message.notification;
        socket.emit('NOTIFY', data);
      }).fail(function(message) {
        var data = message.data || {};
        data.notification = message.notification;
        socket.emit('REJECT', data);
      });
    });
  });
  return io;
};
