#!/usr/bin/env node
import {resolve as pathResolve} from 'path';
import 'regenerator-runtime/runtime.js';
import Pop3Command from '../lib/Command';

import {stream2String} from '../lib/helper';

const {argv} = process,
  options = {},
  alias = {
    c: 'config',
    u: 'user',
    p: 'password',
    h: 'host',
    m: 'method',
  },
  requiredOptionNames = ['user', 'password', 'host', 'method'],
  mailStructure = {
    port: 110,
    tls: false,
  },
  mailStructureOptionNames = ['user', 'password', 'host', 'port', 'tls', 'timeout'];

function printHelpAndExit() {
  const text = 'Usage: pop [options]\r\n'
           + '\r\n'
           + 'Example: pop -u example@gmail.com -p pwd -h example.pop3.com -m UIDL\r\n'
           + '\r\n'
           + 'Options:\r\n'
           + '  -c, --config      config file (in place of options below)\r\n'
           + '  -u, --user        username\r\n'
           + '  -p, --password    password\r\n'
           + '  -h, --host        host of server\r\n'
           + '  --port            port of server. Defaults to 110 or 995 if tls is used.\r\n'
           + '  --tls             whether to use TLS(SSL). Defaults to false.\r\n'
           + '  -m, --method      method and arguments of API in node-pop3. e.g. \'UIDL\', \'RETR 100\' or \'command USER example@gmail.com\'\r\n'
           + '  --help            print help';
  console.log(text);
  process.exit(0);
}

let optionName;
if (argv.slice(2).some(function(arg, i, args) {
  if (arg.charAt(0) === '-') {
    optionName = arg.replace(/-/g, '');
    if ((optionName || ' ').length === 1) {
      if (!{}.hasOwnProperty.call(alias, optionName)) {
        console.error('Invalid alias', optionName);
        return true;
      }
      optionName = alias[optionName];
    }
    if (i === args.length - 1) {
      options[optionName] = [true];
    }
  } else if (!optionName) {
    console.error('Invalid argument', arg);
    return true;
  } else if (options[optionName]) {
    options[optionName].push(arg);
  } else {
    options[optionName] = [arg];
  }
})) {
  process.exit();
}

if (options.help) {
  printHelpAndExit();
}

if (options.config) {
  const configOptions = require(pathResolve(process.cwd(), options.config[0]));
  ['method', ...mailStructureOptionNames].forEach((optionName) => {
    if (!(optionName in options) && optionName in configOptions) {
      options[optionName] = [configOptions[optionName]];
    }
  });
}

for (const requiredOptionName of requiredOptionNames) {
  if (!options[requiredOptionName]) {
    console.error(requiredOptionName + ' is required!');
    printHelpAndExit();
  }
}

if (options.timeout) {
  options.timeout[0] = parseFloat(options.timeout[0]);
}

if (options.tls && options.tls[0]) {
  mailStructure.port = '995';
}
for (const _optionName of mailStructureOptionNames) {
  mailStructure[_optionName] = (options[_optionName] || [])[0] || mailStructure[_optionName];
}

const pop3Command = new Pop3Command(mailStructure),
  [methodName] = options.method;

(async () => {

let result;
if (['UIDL', 'TOP', 'QUIT', 'RETR'].includes(methodName)) {
  result = await pop3Command[methodName](...options.method.slice(1));
  if (methodName === 'RETR') {
    result = await stream2String(result);
  }
} else {
  await pop3Command.connect();
  result = await pop3Command.command(...options.method);
  if (result[1]) {
    const [info, stream] = result;
    const str = await stream2String(stream);
    result = [info, str];
  }
}

console.dir(result);
process.exit(0);

})();
