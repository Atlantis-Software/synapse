var inquirer = require('inquirer');
var _ = require('lodash');
var telepathy = require('telepathymq');


var checkValidPort = function(value) {
  value = parseInt(value);
  if (Number.isInteger(value) && value > 0 && value < 65535) {
    return true;
  }
  return 'Port must be an integer between 0 and 65535';
};

var socket = new telepathy('debug');

inquirer.prompt([
  {type: 'input', name: 'host', message: 'What is the server host ?', default: 'localhost'},
  {type: 'input', name: 'port', message: 'What is the server port ?', default: 8000, validate: checkValidPort, filter: parseInt}
]).then(function(answers) {
  socket.register('synapps', 'tcp://' + answers.host + ':' + answers.port, function(err) {
    if (err) {
      console.log('Socket connection error : ', err); // eslint-disable-line no-console
      return;
    }
    socket.defer('synapps', 'debug.state').asCallback(function(err, state) {
      if (err) {
        console.log('Socket connection error : ', err); // eslint-disable-line no-console
        return;
      }
      if (!state.debugMode) {
        console.log('the server\'s NodeJs version does not support debug mode'); // eslint-disable-line no-console
        socket.close();
        process.exit(0);
        return;
      }

      console.log('\n'); // eslint-disable-line no-console

      var processes = _.keys(state.processes);

      processes.forEach(function(processName) {
        var status = '';
        if (state.processes[processName].debug) {
          status = state.processes[processName].debug;
        }
        console.log(processName, '\t\t', status); // eslint-disable-line no-console
      });

      console.log('\n'); // eslint-disable-line no-console

      inquirer.prompt([
        {type: 'list', name: 'processName', message: 'What process do you want to change debug mode ?', choices: processes},
        {
          type: 'list',
          name: 'stop',
          message: 'Do you want to stop the debuggers on this process ?',
          choices: [{name: 'yes', value: true}, {name: 'no', value: false}],
          when: function(answers) {
            return state.processes[answers.processName].debug;
          }
        },
        {
          type: 'list',
          name: 'start',
          message: 'Do you want to start the debuggers on this process ?',
          choices: [{name: 'yes', value: true}, {name: 'no', value: false}],
          when: function(answers) {
            return !state.processes[answers.processName].debug;
          }
        },
        {
          type: 'input',
          name: 'port',
          message: 'On wich port do you want to start the debugger ?',
          default: 9230,
          validate: checkValidPort,
          filter: parseInt,
          when: function(answers) {
            return answers.start;
          }
        },
        {
          type: 'list',
          choices: state.ifaces,
          name: 'iface',
          message: 'On wich interface do you want to start the debugger ?',
          when: function(answers) {
            return answers.start;
          }
        },
      ]).then(function(answers) {
        if (!answers.start && !answers.stop) {
          console.log('Nothing to do'); // eslint-disable-line no-console
          socket.close();
          process.exit(0);
          return;
        }
        var data = {
          process: answers.processName
        };
        var task = 'debug.stop';
        if (answers.start) {
          task = 'debug.start';
          data.port = answers.port;
          data.iface = answers.iface;
        }
        socket.defer('synapps', task, data).asCallback(function(err, response) {
          if (err) {
            console.log('error : ', err); // eslint-disable-line no-console
            return;
          }
          if (response.url) {
            console.log('\n'); // eslint-disable-line no-console
            console.log('debugger url:', response.url); // eslint-disable-line no-console
          }
          console.log('\n'); // eslint-disable-line no-console
          console.log('done !'); // eslint-disable-line no-console
          socket.close();
          process.exit(0);
        });
      });
    });
  });
});
