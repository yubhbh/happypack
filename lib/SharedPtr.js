function SharedPtr(value) {
  this._refs = 1;
  this._value = value;
}

SharedPtr.prototype.lock = function() {
  this._refs += 1;
};

SharedPtr.prototype.reset = function() {
  this._refs -= 1;

  if (this._refs === 0) {
    delete this._value;
  }
};

SharedPtr.prototype.get = function() {
  return this._value;
};

SharedPtr.safeGet = function(ptr) {
  return ptr && ptr.get() || null;
};

module.exports = SharedPtr;
