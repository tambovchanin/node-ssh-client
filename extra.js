const { createReadStream, createWriteStream } = require('fs');
const { log } = require('./lib/utils');

exports.extra = extra;

function extra(connection) {
  let cmd = '';

  return function(chunk, encoding, callback) {
    const letter = chunk.toString();

    // Пока не нажата клавиша Enter
    // собираем команду в cmd
    cmd += letter;

    if (letter !== '\r') return callback(null, chunk);

    const match = cmd.match(/^(get|put)\s(.*?)\s(.*?)$/);

    cmd = '';

    if (!match) return callback(null, chunk);

    switch(match[1]) {
      case 'get':
        getFile(match[2], match[3], callback);
        break;
      case 'put':
        putFile(match[2], match[3], callback);
        break;
      default:
        callback(null, chunk);
    }
  }

  function putFile(from, to, callback) {
    connection.sftp(function(err, sftp) {
      if (err) return callback(err);

      const rs = createReadStream(from);
      const ws = sftp.createWriteStream(to);

      console.log(`\nUpload 127.0.01:${from} to ${connection.config.host}:${to}`);

      ws.on('close', function() {
        sftp.end();

        log('File is uploaded successfully');

        callback(null, null);
      });

      ws.on('exit', err => {
        if (err) callback(err);
      });

      ws.on('error', function(err) {
        console.error('err:', err);
      });

      rs.on('error', err => {
        if (err) callback(err);
      });

      rs.pipe(ws);
    });
  }

  function getFile(from, to, callback) {
    connection.sftp(function(err, sftp) {
      if (err) return callback(err);

      const rs = sftp.createReadStream(from);
      const ws = createWriteStream(to);

      console.log(`\nDownload ${connection.config.host}:${from} from 127.0.0.1:${to}`);

      ws.on('close', function() {
        sftp.end();

        log('File is downloaded successfully');

        callback(null, null);
      });

      ws.on('exit', err => {
        if (err) callback(err);
      });

      ws.on('error', function(err) {
        console.error('err:', err);
      });

      rs.on('error', err => {
        if (err) callback(err);
      });

      rs.pipe(ws);
    });
  }
}
