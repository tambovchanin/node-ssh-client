const readline = require('readline');
const Client = require('ssh2').Client;
const { log } = require('./lib/utils');
const seq = require('./lib/sequentially');
const { createReadStream, createWriteStream } = require('fs');

const configLine = process.argv[2];

if (!configLine) return (usage());

const std = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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
    port: credentials[4] || 22
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

        std.on('line', input => {
          const match = input.match(/^(get|put)\s(.*?)\s(.*?)$/);

          if (!match) return stream.write(`${input}\r\n`);

          switch (match[1]) {
            case 'get':
              return getFile(connection, match[2], match[3]);
            case 'put':
              return putFile(connection, match[2], match[3]);
          }
        });

        stream.pipe(process.stdout);
        stream.stderr.pipe(process.stderr);

        stream.on('close', function() {
          std.close();
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

function putFile(connection, from, to) {
  connection.sftp(function(err, sftp) {
    if (err) return log(`Can't connect to remote`, err);

    const rs = createReadStream(from);
    const ws = sftp.createWriteStream(to);

    log(`Upload 127.0.0.1:${from} to ${connection.config.host}:${to}`);

    ws.on('close', () => {
      sftp.end();

      log('File uploaded successfully');
    });

    ws.on('error', err => {
      log(`Can't upload file`, err);
    });

    rs.on('error', err => {
      if (err.code === 'ENOENT') return log(`File not found ${from}`);

      log(`Can't read file`, err);
    });

    rs.pipe(ws);
  });
}

function getFile(connection, from, to) {
  connection.sftp(function(err, sftp) {
    if (err) return log(`Can't connect to remote`, err);

    const rs = sftp.createReadStream(from);
    const ws = createWriteStream(to);

    log(`Download ${connection.config.host}:${from} to 127.0.0.1:${to}`);

    ws.on('close', () => {
      sftp.end();

      log('File downloaded successfully');
    });

    ws.on('error', err => {
      log(`Can't upload file`, err);
    });

    rs.on('error', err => {
      log(`Can't read file`, err);
    });

    rs.pipe(ws);
  });
}
