var socket = require('./socket');
var EventEmitter = require('events').EventEmitter;
var uuid = require('uuid');
var inquirer = require('inquirer');
var os = require('os');

var Socket = socket();
var socket = new Socket();

var ifaces = os.networkInterfaces();

var checkValidPort = function(value) {
  value = parseInt(value);
  if (Number.isInteger(value) && value > 0 && value < 65535) {
    return true;
  }
  return 'Port must be an integer between 0 and 65535';
};

var filterPort = function(value) {
  return parseInt(value);
};

var interfaces = [];
Object.keys(ifaces).forEach(function (ifname) {
  ifaces[ifname].forEach(function(iface) {
    interfaces.push({name: iface.address + ' (' + ifname + ')', value: iface.address});
  });
});
interfaces.push('Other');

inquirer.prompt([
  {type: 'list', name: 'task', message: 'Do you want to start or stop the debuggers ?', choices: [
    {name: 'Start', value: 'startDebug'}, {name: 'Stop', value: 'stopDebug'}
  ]},
  {type: 'checkbox', name: 'processToDebug', message: 'What process do you want to debug ?', choices: ['Master', 'Worker']},
  {type: 'input', name: 'workerIndex', message: 'What worker (index) do you want to debug ?', default: 0, when: function(answers) {
    return answers.processToDebug.indexOf('Worker') !== -1;
  }, filter: parseInt},
  {type: 'input', name: 'serverHost', message: 'What is the server host ?', default: 'localhost'},
  {type: 'input', name: 'serverPort', message: 'What is the server port ?', default: 9000, validate: checkValidPort, filter: parseInt},
  {type: 'list', name: 'debugHost', message: 'On wich interface do you want the debugger to listen ?', choices: interfaces, when: function(answers) {
    return answers.task === 'startDebug';
  }},
  {type: 'input', name: 'debugHost', message: 'On wich interface do you want the debugger to listen ?', default: '127.0.0.1', when: function(answers) {
    return answers.debugHost === 'Other';
  }},
  {type: 'input', name: 'masterDebugPort', message: 'On wich port do you want the master debugger ?', default: 9229, when: function(answers) {
    return answers.processToDebug.indexOf('Master') !== -1 && answers.task !== 'stopDebug';
  }, validate: checkValidPort, filter: parseInt},
  {type: 'input', name: 'workerDebugPort', message: 'On wich port do you want the worker debugger ?', default: 9230, when: function(answers) {
    return answers.processToDebug.indexOf('Worker') !== -1 && answers.task !== 'stopDebug';
  }, validate: checkValidPort, filter: parseInt},
]).then(function (answers) {
  socket.set('identity', 'debug');
  socket.connect('debug', answers.serverPort, answers.serverHost, function(err, emitter) {
    if (err) {
      console.log('Socket connection error : ', err);
    }

    var data = {
      worker: answers.workerIndex,
      debugMaster: answers.processToDebug.indexOf('Master') !== -1,
      debugHost: answers.debugHost,
      masterPort: answers.masterDebugPort,
      workerPort: answers.workerDebugPort
    };

    socket.netSend(emitter, answers.task, {requestId: uuid.v4(), data: data}, function(err, response) {
      if (err) {
        return console.error('Encountered error : ', err);
      }
      if (answers.task === 'startDebug') {
        if (!response.url) {
          return console.error('No debug URL returned');
        }
        if (response.url.master) {
          console.log('Master debug url : ', response.url.master);
        }
        if (response.url.worker) {
          console.log('Worker debug url : ', response.url.worker);
        }
      } else {
        if (!response.stopped || !response.stopped.length) {
          return console.error('No debugger stopped');
        }
        response.stopped.forEach(function(msg) {
          console.log(msg);
        });
      }
    });
  });
});
