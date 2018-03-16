var program = require('commander');
var generateKeys = require('./utils/generateKeys');

program.command('genKey <name> <ip>').action(function(name, ip) {
  console.log('generating keys for ' + name + ' at ' + ip);
  generateKeys(name, ip);
});

program.parse(process.argv);
