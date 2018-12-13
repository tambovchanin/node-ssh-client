exports.log = log;
exports.set = set;
exports.isArray = Array.isArray;
exports.isPlainObject = isPlainObject;

function getTime() {
  return new Date().toLocaleTimeString();
}

function log(...args) {
  console.log(`[${getTime()}]`, ...args);
}


function isPlainObject(o) {
  if (!o || typeof(o) !== 'object') return false;
  if (o.constructor.name !== 'Object') return false;

  return true;
}

function set(object, property, value) {
  const path = property.split('.');
  let position = object;
  let segment;

  for (let i=0, len=path.length - 1; i<len; i++) {
    segment = path[i];
    position = position[segment] = position[segment] || {};
  }

  position[path[path.length - 1]] = value;

  return object;
}
