const { extra } = require('./extra');
const Client = require('ssh2').Client;
const { log } = require('./lib/utils');
const seq = require('./lib/sequentially');
const through2 = require('through2');

const configLine = process.argv[2];

if (!configLine) return (usage());

process.stdin.setRawMode(true);

seq(
  { config: parseArguments },
  connect,
  done
);

function parseArguments(next) {
  const credentials = configLine.match(/^([^:]+):?([^@]+)?@([^:]+):?(\d+)?$/);

  if (!credentials) return usage();

  next(null, {
    username: credentials[1],
    password: credentials[2],
    host: credentials[3],
    port: credentials[4],
    debug: console.log
  });
}

function connect(next) {
  const config = this.config;

  const connection = new Client();

  log(`Connecting to ${config.host}...`);

  connection
    .on('ready', () => {
      log('Connection successful.');

      connection.shell(function(err, stream) {
        if (err) return next(err);

        process.stdin.pipe(through2(extra(connection))).pipe(stream);
        stream.pipe(process.stdout);
        stream.stderr.pipe(process.stderr);

        stream.on('close', function() {
          stream.end();
          connection.end();

          log('Connection closed.');

          next();
        });
      });
    }).connect(config);
}

function done(err) {
  err && console.error(err);

  process.exit(1);
}

function usage() {
  console.log('SSH client over NodeJS');
  console.log('Usage: node ssh.js user:pass@host[:port]');
  console.log('       - default port is 22\n');

  process.exit(1);
}
