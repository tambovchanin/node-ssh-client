const { set, isArray, isPlainObject } = require('./utils');

const slice = Array.prototype.slice;

module.exports = function() {
  sequentially({}, arguments);
};

module.exports.call = function(ctx) {
  sequentially(ctx, slice.call(arguments, 1));
};

module.exports.apply = function(ctx, args) {
  sequentially(ctx, args);
};


function sequentially(ctx, sequence) {
  const length = sequence.length;
  const last = sequence[length - 1];
  let idx = 0;

  if (!length) return;
  if (typeof last !== 'function')
    throw new Error('Last argument has to be a function');
  else if (!last.length)
    throw new Error('Last function must accept error as first argument');

  addSet(proceed);

  proceed();

  function proceed(err, result) {
    let next = sequence[idx++];

    if (idx === length) return next.call(ctx, err, result);
    if (!next) return proceed(err, result);
    if (err && (!next.call || (next.length < 3))) return handle(err, result);

    switch (true) {
      case isPlainObject(next): return setter.call(ctx, next, proceed);
      case isArray(next): return parallel(next, proceed);

      // In these cases next is a function
      case next.length === 1: return next.call(ctx, proceed);
      case next.length === 2: return next.call(ctx, result, proceed);
      default: return next.call(ctx, err, result, proceed);
    }
  }

  function parallel(array, callback) {
    let count = array.length;
    let error;

    if (!count) callback();

    const results = new Array(count);

    array.forEach(function(next, idx) {
      if (!next) return done(idx)();
      if (isPlainObject(next)) return setter.call({}, next, done(idx));

      next.call(ctx, done(idx));
    });

    function done(idx) {
      return addSet(function(err, result) {
        error = error || err;
        results[idx] = err || result;

        if (!--count) callback(error, results);
      });
    }
  }

  function setter(object, callback) {
    const context = this;
    const keys = Object.keys(object);
    let count = keys.length;
    let error;

    if (!count) callback();

    keys.forEach(function(key) {
      var next = object[key];

      addSet(done);

      switch (next && next.constructor.name) {
        case 'Array': return parallel(next, done);
        case 'Object': return setter.call({}, next, done);
        case 'Function': return next.call(ctx, done);
        default: return done(null, next);
      }

      function done(err, value) {
        set(context, key, err || value);
        error = error || err;

        if (!--count) callback(error, context);
      }
    });
  }

  function handle(err, result) {
    var fn;

    do fn = sequence[idx++];
    while ((!fn.call || fn.length < 3) && idx < length);

    if (fn === last) return fn.call(ctx, err, result);

    return fn.call(ctx, err, result, proceed);
  }

  function addSet(next) {
    next.set = function(key, err, result) {
      switch (arguments.length) {
        case 1: return callback;
        case 2: result = err; err = null;
      }

      callback(err, result);

      function callback(err, result) {
        if (!err) set(ctx, key, result);

        next(err, result);
      }
    };

    return next;
  }
}
