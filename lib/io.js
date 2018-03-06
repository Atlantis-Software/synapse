var IO = require('socket.io');

module.exports = function(synapps) {
  var config = {};
  if (synapps._config.apiDir) {
    config.path = '/' + synapps._config.apiDir + '/socket.io';
  }
  var io = IO(synapps._http, config);
  io.on('connection', function(socket) {
    socket.on('request', function(data, ack) {
      var req = {
        type: 'socket.io',
        request: data.request,
        sessionID: data.sessionID,
        data: data.data,
        uid: data.uid,
        socketID: socket.id
      };
      ack();
      synapps._scheduler.send(req).done(function(message) {
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
