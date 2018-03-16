#! /usr/bin/env node
var program = require('commander');

program.command('cluster', 'cluster interactions');
program.command('debug', 'debug mode enable/disable');
 
program.parse(process.argv);
