(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Hls = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
var bundleFn = arguments[3];
var sources = arguments[4];
var cache = arguments[5];

var stringify = JSON.stringify;

module.exports = function (fn) {
    var keys = [];
    var wkey;
    var cacheKeys = Object.keys(cache);

    for (var i = 0, l = cacheKeys.length; i < l; i++) {
        var key = cacheKeys[i];
        var exp = cache[key].exports;
        // Using babel as a transpiler to use esmodule, the export will always
        // be an object with the default export as a property of it. To ensure
        // the existing api and babel esmodule exports are both supported we
        // check for both
        if (exp === fn || exp.default === fn) {
            wkey = key;
            break;
        }
    }

    if (!wkey) {
        wkey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);
        var wcache = {};
        for (var i = 0, l = cacheKeys.length; i < l; i++) {
            var key = cacheKeys[i];
            wcache[key] = key;
        }
        sources[wkey] = [
            Function(['require','module','exports'], '(' + fn + ')(self)'),
            wcache
        ];
    }
    var skey = Math.floor(Math.pow(16, 8) * Math.random()).toString(16);

    var scache = {}; scache[wkey] = wkey;
    sources[skey] = [
        Function(['require'], (
            // try to call default if defined to also support babel esmodule
            // exports
            'var f = require(' + stringify(wkey) + ');' +
            '(f.default ? f.default : f)(self);'
        )),
        scache
    ];

    var src = '(' + bundleFn + ')({'
        + Object.keys(sources).map(function (key) {
            return stringify(key) + ':['
                + sources[key][0]
                + ',' + stringify(sources[key][1]) + ']'
            ;
        }).join(',')
        + '},{},[' + stringify(skey) + '])'
    ;

    var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;

    return new Worker(URL.createObjectURL(
        new Blob([src], { type: 'text/javascript' })
    ));
};

},{}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _bufferHelper = require('../helper/buffer-helper');

var _bufferHelper2 = _interopRequireDefault(_bufferHelper);

var _errors = require('../errors');

var _logger = require('../utils/logger');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * simple ABR Controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *  - compute next level based on last fragment bw heuristics
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                *  - implement an abandon rules triggered if we have less than 2 frag buffered and if computed bw shows that we risk buffer stalling
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                */

var AbrController = function (_EventHandler) {
  _inherits(AbrController, _EventHandler);

  function AbrController(hls) {
    _classCallCheck(this, AbrController);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(AbrController).call(this, hls, _events2.default.FRAG_LOADING, _events2.default.FRAG_LOAD_PROGRESS, _events2.default.FRAG_LOADED, _events2.default.ERROR));

    _this.lastfetchlevel = 0;
    _this._autoLevelCapping = -1;
    _this._nextAutoLevel = -1;
    _this.hls = hls;
    _this.onCheck = _this.abandonRulesCheck.bind(_this);
    return _this;
  }

  _createClass(AbrController, [{
    key: 'destroy',
    value: function destroy() {
      this.clearTimer();
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onFragLoading',
    value: function onFragLoading(data) {
      this.timer = setInterval(this.onCheck, 100);
      this.fragCurrent = data.frag;
    }
  }, {
    key: 'onFragLoadProgress',
    value: function onFragLoadProgress(data) {
      var stats = data.stats;
      // only update stats if first frag loading
      // if same frag is loaded multiple times, it might be in browser cache, and loaded quickly
      // and leading to wrong bw estimation
      if (stats.aborted === undefined && data.frag.loadCounter === 1) {
        this.lastfetchduration = (performance.now() - stats.trequest) / 1000;
        this.lastfetchlevel = data.frag.level;
        this.lastbw = stats.loaded * 8 / this.lastfetchduration;
        //console.log(`fetchDuration:${this.lastfetchduration},bw:${(this.lastbw/1000).toFixed(0)}/${stats.aborted}`);
      }
    }
  }, {
    key: 'abandonRulesCheck',
    value: function abandonRulesCheck() {
      /*
        monitor fragment retrieval time...
        we compute expected time of arrival of the complete fragment.
        we compare it to expected time of buffer starvation
      */
      var hls = this.hls,
          v = hls.media,
          frag = this.fragCurrent;
      /* only monitor frag retrieval time if
      (video not paused OR first fragment being loaded(ready state === HAVE_NOTHING = 0)) AND autoswitching enabled AND not lowest level (=> means that we have several levels) */
      if (v && (!v.paused || !v.readyState) && frag.autoLevel && frag.level) {
        var requestDelay = performance.now() - frag.trequest;
        // monitor fragment load progress after half of expected fragment duration,to stabilize bitrate
        if (requestDelay > 500 * frag.duration) {
          var loadRate = Math.max(1, frag.loaded * 1000 / requestDelay); // byte/s; at least 1 byte/s to avoid division by zero
          if (frag.expectedLen < frag.loaded) {
            frag.expectedLen = frag.loaded;
          }
          var pos = v.currentTime;
          var fragLoadedDelay = (frag.expectedLen - frag.loaded) / loadRate;
          var bufferStarvationDelay = _bufferHelper2.default.bufferInfo(v, pos, hls.config.maxBufferHole).end - pos;
          // consider emergency switch down only if we have less than 2 frag buffered AND
          // time to finish loading current fragment is bigger than buffer starvation delay
          // ie if we risk buffer starvation if bw does not increase quickly
          if (bufferStarvationDelay < 2 * frag.duration && fragLoadedDelay > bufferStarvationDelay) {
            var fragLevelNextLoadedDelay = void 0,
                nextLoadLevel = void 0;
            // lets iterate through lower level and try to find the biggest one that could avoid rebuffering
            // we start from current level - 1 and we step down , until we find a matching level
            for (nextLoadLevel = frag.level - 1; nextLoadLevel >= 0; nextLoadLevel--) {
              // compute time to load next fragment at lower level
              // 0.8 : consider only 80% of current bw to be conservative
              // 8 = bits per byte (bps/Bps)
              fragLevelNextLoadedDelay = frag.duration * hls.levels[nextLoadLevel].bitrate / (8 * 0.8 * loadRate);
              _logger.logger.log('fragLoadedDelay/bufferStarvationDelay/fragLevelNextLoadedDelay[' + nextLoadLevel + '] :' + fragLoadedDelay.toFixed(1) + '/' + bufferStarvationDelay.toFixed(1) + '/' + fragLevelNextLoadedDelay.toFixed(1));
              if (fragLevelNextLoadedDelay < bufferStarvationDelay) {
                // we found a lower level that be rebuffering free with current estimated bw !
                break;
              }
            }
            // only emergency switch down if it takes less time to load new fragment at lowest level instead
            // of finishing loading current one ...
            if (fragLevelNextLoadedDelay < fragLoadedDelay) {
              // ensure nextLoadLevel is not negative
              nextLoadLevel = Math.max(0, nextLoadLevel);
              // force next load level in auto mode
              hls.nextLoadLevel = nextLoadLevel;
              // abort fragment loading ...
              _logger.logger.warn('loading too slow, abort fragment loading and switch to level ' + nextLoadLevel);
              //abort fragment loading
              frag.loader.abort();
              this.clearTimer();
              hls.trigger(_events2.default.FRAG_LOAD_EMERGENCY_ABORTED, { frag: frag });
            }
          }
        }
      }
    }
  }, {
    key: 'onFragLoaded',
    value: function onFragLoaded() {
      // stop monitoring bw once frag loaded
      this.clearTimer();
    }
  }, {
    key: 'onError',
    value: function onError(data) {
      // stop timer in case of frag loading error
      switch (data.details) {
        case _errors.ErrorDetails.FRAG_LOAD_ERROR:
        case _errors.ErrorDetails.FRAG_LOAD_TIMEOUT:
          this.clearTimer();
          break;
        default:
          break;
      }
    }
  }, {
    key: 'clearTimer',
    value: function clearTimer() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }

    /** Return the capping/max level value that could be used by automatic level selection algorithm **/

  }, {
    key: 'autoLevelCapping',
    get: function get() {
      return this._autoLevelCapping;
    }

    /** set the capping/max level value that could be used by automatic level selection algorithm **/
    ,
    set: function set(newLevel) {
      this._autoLevelCapping = newLevel;
    }
  }, {
    key: 'nextAutoLevel',
    get: function get() {
      var lastbw = this.lastbw,
          hls = this.hls,
          adjustedbw,
          i,
          maxAutoLevel;
      if (this._autoLevelCapping === -1) {
        maxAutoLevel = hls.levels.length - 1;
      } else {
        maxAutoLevel = this._autoLevelCapping;
      }

      if (this._nextAutoLevel !== -1) {
        var nextLevel = Math.min(this._nextAutoLevel, maxAutoLevel);
        if (nextLevel === this.lastfetchlevel) {
          this._nextAutoLevel = -1;
        } else {
          return nextLevel;
        }
      }

      // follow algorithm captured from stagefright :
      // https://android.googlesource.com/platform/frameworks/av/+/master/media/libstagefright/httplive/LiveSession.cpp
      // Pick the highest bandwidth stream below or equal to estimated bandwidth.
      for (i = 0; i <= maxAutoLevel; i++) {
        // consider only 80% of the available bandwidth, but if we are switching up,
        // be even more conservative (70%) to avoid overestimating and immediately
        // switching back.
        if (i <= this.lastfetchlevel) {
          adjustedbw = 0.8 * lastbw;
        } else {
          adjustedbw = 0.7 * lastbw;
        }
        if (adjustedbw < hls.levels[i].bitrate) {
          return Math.max(0, i - 1);
        }
      }
      return i - 1;
    },
    set: function set(nextLevel) {
      this._nextAutoLevel = nextLevel;
    }
  }]);

  return AbrController;
}(_eventHandler2.default);

exports.default = AbrController;

},{"../errors":20,"../event-handler":21,"../events":22,"../helper/buffer-helper":23,"../utils/logger":36}],4:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _logger = require('../utils/logger');

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Buffer Controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var BufferController = function (_EventHandler) {
  _inherits(BufferController, _EventHandler);

  function BufferController(hls) {
    _classCallCheck(this, BufferController);

    // Source Buffer listeners

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(BufferController).call(this, hls, _events2.default.MEDIA_ATTACHING, _events2.default.MEDIA_DETACHING, _events2.default.BUFFER_RESET, _events2.default.BUFFER_APPENDING, _events2.default.BUFFER_CODECS, _events2.default.BUFFER_EOS, _events2.default.BUFFER_FLUSHING));

    _this.onsbue = _this.onSBUpdateEnd.bind(_this);
    _this.onsbe = _this.onSBUpdateError.bind(_this);
    return _this;
  }

  _createClass(BufferController, [{
    key: 'destroy',
    value: function destroy() {
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onMediaAttaching',
    value: function onMediaAttaching(data) {
      var media = this.media = data.media;
      // setup the media source
      var ms = this.mediaSource = new MediaSource();
      //Media Source listeners
      this.onmso = this.onMediaSourceOpen.bind(this);
      this.onmse = this.onMediaSourceEnded.bind(this);
      this.onmsc = this.onMediaSourceClose.bind(this);
      ms.addEventListener('sourceopen', this.onmso);
      ms.addEventListener('sourceended', this.onmse);
      ms.addEventListener('sourceclose', this.onmsc);
      // link video and media Source
      media.src = URL.createObjectURL(ms);
    }
  }, {
    key: 'onMediaDetaching',
    value: function onMediaDetaching() {
      var ms = this.mediaSource;
      if (ms) {
        if (ms.readyState === 'open') {
          try {
            // endOfStream could trigger exception if any sourcebuffer is in updating state
            // we don't really care about checking sourcebuffer state here,
            // as we are anyway detaching the MediaSource
            // let's just avoid this exception to propagate
            ms.endOfStream();
          } catch (err) {
            _logger.logger.warn('onMediaDetaching:' + err.message + ' while calling endOfStream');
          }
        }
        ms.removeEventListener('sourceopen', this.onmso);
        ms.removeEventListener('sourceended', this.onmse);
        ms.removeEventListener('sourceclose', this.onmsc);
        // unlink MediaSource from video tag
        this.media.src = '';
        this.media.removeAttribute('src');
        this.mediaSource = null;
        this.media = null;
        this.pendingTracks = null;
        this.sourceBuffer = null;
      }
      this.onmso = this.onmse = this.onmsc = null;
      this.hls.trigger(_events2.default.MEDIA_DETACHED);
    }
  }, {
    key: 'onMediaSourceOpen',
    value: function onMediaSourceOpen() {
      _logger.logger.log('media source opened');
      this.hls.trigger(_events2.default.MEDIA_ATTACHED, { media: this.media });
      // once received, don't listen anymore to sourceopen event
      this.mediaSource.removeEventListener('sourceopen', this.onmso);
      // if any buffer codecs pending, treat it here.
      var pendingTracks = this.pendingTracks;
      if (pendingTracks) {
        this.onBufferCodecs(pendingTracks);
        this.pendingTracks = null;
        this.doAppending();
      }
    }
  }, {
    key: 'onMediaSourceClose',
    value: function onMediaSourceClose() {
      _logger.logger.log('media source closed');
    }
  }, {
    key: 'onMediaSourceEnded',
    value: function onMediaSourceEnded() {
      _logger.logger.log('media source ended');
    }
  }, {
    key: 'onSBUpdateEnd',
    value: function onSBUpdateEnd() {

      if (this._needsFlush) {
        this.doFlush();
      }

      if (this._needsEos) {
        this.onBufferEos();
      }

      this.hls.trigger(_events2.default.BUFFER_APPENDED);

      this.doAppending();
    }
  }, {
    key: 'onSBUpdateError',
    value: function onSBUpdateError(event) {
      _logger.logger.error('sourceBuffer error:' + event);
      // according to http://www.w3.org/TR/media-source/#sourcebuffer-append-error
      // this error might not always be fatal (it is fatal if decode error is set, in that case
      // it will be followed by a mediaElement error ...)
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_APPENDING_ERROR, fatal: false });
      // we don't need to do more than that, as accordin to the spec, updateend will be fired just after
    }
  }, {
    key: 'onBufferReset',
    value: function onBufferReset() {
      var sourceBuffer = this.sourceBuffer;
      if (sourceBuffer) {
        for (var type in sourceBuffer) {
          var sb = sourceBuffer[type];
          try {
            this.mediaSource.removeSourceBuffer(sb);
            sb.removeEventListener('updateend', this.onsbue);
            sb.removeEventListener('error', this.onsbe);
          } catch (err) {}
        }
        this.sourceBuffer = null;
      }
      this.flushRange = [];
      this.appended = 0;
    }
  }, {
    key: 'onBufferCodecs',
    value: function onBufferCodecs(tracks) {
      var sb, trackName, track, codec, mimeType;

      if (!this.media) {
        this.pendingTracks = tracks;
        return;
      }

      if (!this.sourceBuffer) {
        var sourceBuffer = {},
            mediaSource = this.mediaSource;
        for (trackName in tracks) {
          track = tracks[trackName];
          // use levelCodec as first priority
          codec = track.levelCodec || track.codec;
          mimeType = track.container + ';codecs=' + codec;
          _logger.logger.log('creating sourceBuffer with mimeType:' + mimeType);
          sb = sourceBuffer[trackName] = mediaSource.addSourceBuffer(mimeType);
          sb.addEventListener('updateend', this.onsbue);
          sb.addEventListener('error', this.onsbe);
        }
        this.sourceBuffer = sourceBuffer;
      }
    }
  }, {
    key: 'onBufferAppending',
    value: function onBufferAppending(data) {
      if (!this.segments) {
        this.segments = [data];
      } else {
        this.segments.push(data);
      }
      this.doAppending();
    }
  }, {
    key: 'onBufferAppendFail',
    value: function onBufferAppendFail(data) {
      _logger.logger.error('sourceBuffer error:' + data.event);
      // according to http://www.w3.org/TR/media-source/#sourcebuffer-append-error
      // this error might not always be fatal (it is fatal if decode error is set, in that case
      // it will be followed by a mediaElement error ...)
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_APPENDING_ERROR, fatal: false, frag: this.fragCurrent });
    }
  }, {
    key: 'onBufferEos',
    value: function onBufferEos() {
      var sb = this.sourceBuffer,
          mediaSource = this.mediaSource;
      if (!mediaSource || mediaSource.readyState !== 'open') {
        return;
      }
      if (!(sb.audio && sb.audio.updating || sb.video && sb.video.updating)) {
        _logger.logger.log('all media data available, signal endOfStream() to MediaSource and stop loading fragment');
        //Notify the media element that it now has all of the media data
        mediaSource.endOfStream();
        this._needsEos = false;
      } else {
        this._needsEos = true;
      }
    }
  }, {
    key: 'onBufferFlushing',
    value: function onBufferFlushing(data) {
      this.flushRange.push({ start: data.startOffset, end: data.endOffset });
      // attempt flush immediatly
      this.flushBufferCounter = 0;
      this.doFlush();
    }
  }, {
    key: 'doFlush',
    value: function doFlush() {
      // loop through all buffer ranges to flush
      while (this.flushRange.length) {
        var range = this.flushRange[0];
        // flushBuffer will abort any buffer append in progress and flush Audio/Video Buffer
        if (this.flushBuffer(range.start, range.end)) {
          // range flushed, remove from flush array
          this.flushRange.shift();
          this.flushBufferCounter = 0;
        } else {
          this._needsFlush = true;
          // avoid looping, wait for SB update end to retrigger a flush
          return;
        }
      }
      if (this.flushRange.length === 0) {
        // everything flushed
        this._needsFlush = false;

        // let's recompute this.appended, which is used to avoid flush looping
        var appended = 0;
        var sourceBuffer = this.sourceBuffer;
        if (sourceBuffer) {
          for (var type in sourceBuffer) {
            appended += sourceBuffer[type].buffered.length;
          }
        }
        this.appended = appended;
        this.hls.trigger(_events2.default.BUFFER_FLUSHED);
      }
    }
  }, {
    key: 'doAppending',
    value: function doAppending() {
      var hls = this.hls,
          sourceBuffer = this.sourceBuffer,
          segments = this.segments;
      if (sourceBuffer) {
        if (this.media.error) {
          segments = [];
          _logger.logger.error('trying to append although a media error occured, flush segment and abort');
          return;
        }
        for (var type in sourceBuffer) {
          if (sourceBuffer[type].updating) {
            //logger.log('sb update in progress');
            return;
          }
        }
        if (segments.length) {
          var segment = segments.shift();
          try {
            //logger.log(`appending ${segment.type} SB, size:${segment.data.length});
            sourceBuffer[segment.type].appendBuffer(segment.data);
            this.appendError = 0;
            this.appended++;
          } catch (err) {
            // in case any error occured while appending, put back segment in segments table
            _logger.logger.error('error while trying to append buffer:' + err.message);
            segments.unshift(segment);
            var event = { type: _errors.ErrorTypes.MEDIA_ERROR };
            if (err.code !== 22) {
              if (this.appendError) {
                this.appendError++;
              } else {
                this.appendError = 1;
              }
              event.details = _errors.ErrorDetails.BUFFER_APPEND_ERROR;
              event.frag = this.fragCurrent;
              /* with UHD content, we could get loop of quota exceeded error until
                browser is able to evict some data from sourcebuffer. retrying help recovering this
              */
              if (this.appendError > hls.config.appendErrorMaxRetry) {
                _logger.logger.log('fail ' + hls.config.appendErrorMaxRetry + ' times to append segment in sourceBuffer');
                segments = [];
                event.fatal = true;
                hls.trigger(_events2.default.ERROR, event);
                return;
              } else {
                event.fatal = false;
                hls.trigger(_events2.default.ERROR, event);
              }
            } else {
              // QuotaExceededError: http://www.w3.org/TR/html5/infrastructure.html#quotaexceedederror
              // let's stop appending any segments, and report BUFFER_FULL_ERROR error
              segments = [];
              event.details = _errors.ErrorDetails.BUFFER_FULL_ERROR;
              hls.trigger(_events2.default.ERROR, event);
            }
          }
        }
      }
    }

    /*
      flush specified buffered range,
      return true once range has been flushed.
      as sourceBuffer.remove() is asynchronous, flushBuffer will be retriggered on sourceBuffer update end
    */

  }, {
    key: 'flushBuffer',
    value: function flushBuffer(startOffset, endOffset) {
      var sb, i, bufStart, bufEnd, flushStart, flushEnd;
      //logger.log('flushBuffer,pos/start/end: ' + this.media.currentTime + '/' + startOffset + '/' + endOffset);
      // safeguard to avoid infinite looping : don't try to flush more than the nb of appended segments
      if (this.flushBufferCounter < this.appended && this.sourceBuffer) {
        for (var type in this.sourceBuffer) {
          sb = this.sourceBuffer[type];
          if (!sb.updating) {
            for (i = 0; i < sb.buffered.length; i++) {
              bufStart = sb.buffered.start(i);
              bufEnd = sb.buffered.end(i);
              // workaround firefox not able to properly flush multiple buffered range.
              if (navigator.userAgent.toLowerCase().indexOf('firefox') !== -1 && endOffset === Number.POSITIVE_INFINITY) {
                flushStart = startOffset;
                flushEnd = endOffset;
              } else {
                flushStart = Math.max(bufStart, startOffset);
                flushEnd = Math.min(bufEnd, endOffset);
              }
              /* sometimes sourcebuffer.remove() does not flush
                 the exact expected time range.
                 to avoid rounding issues/infinite loop,
                 only flush buffer range of length greater than 500ms.
              */
              if (Math.min(flushEnd, bufEnd) - flushStart > 0.5) {
                this.flushBufferCounter++;
                _logger.logger.log('flush ' + type + ' [' + flushStart + ',' + flushEnd + '], of [' + bufStart + ',' + bufEnd + '], pos:' + this.media.currentTime);
                sb.remove(flushStart, flushEnd);
                return false;
              }
            }
          } else {
            //logger.log('abort ' + type + ' append in progress');
            // this will abort any appending in progress
            //sb.abort();
            _logger.logger.warn('cannot flush, sb updating in progress');
            return false;
          }
        }
      } else {
        _logger.logger.warn('abort flushing too many retries');
      }
      _logger.logger.log('buffer flushed');
      // everything flushed !
      return true;
    }
  }]);

  return BufferController;
}(_eventHandler2.default);

exports.default = BufferController;

},{"../errors":20,"../event-handler":21,"../events":22,"../utils/logger":36}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * cap stream level to media size dimension controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var CapLevelController = function (_EventHandler) {
  _inherits(CapLevelController, _EventHandler);

  function CapLevelController(hls) {
    _classCallCheck(this, CapLevelController);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(CapLevelController).call(this, hls, _events2.default.MEDIA_ATTACHING, _events2.default.MANIFEST_PARSED));
  }

  _createClass(CapLevelController, [{
    key: 'destroy',
    value: function destroy() {
      if (this.hls.config.capLevelToPlayerSize) {
        this.media = null;
        this.autoLevelCapping = Number.POSITIVE_INFINITY;
        if (this.timer) {
          this.timer = clearInterval(this.timer);
        }
      }
    }
  }, {
    key: 'onMediaAttaching',
    value: function onMediaAttaching(data) {
      this.media = data.media instanceof HTMLVideoElement ? data.media : null;
    }
  }, {
    key: 'onManifestParsed',
    value: function onManifestParsed(data) {
      if (this.hls.config.capLevelToPlayerSize) {
        this.autoLevelCapping = Number.POSITIVE_INFINITY;
        this.levels = data.levels;
        this.hls.firstLevel = this.getMaxLevel(data.firstLevel);
        clearInterval(this.timer);
        this.timer = setInterval(this.detectPlayerSize.bind(this), 1000);
        this.detectPlayerSize();
      }
    }
  }, {
    key: 'detectPlayerSize',
    value: function detectPlayerSize() {
      if (this.media) {
        var levelsLength = this.levels ? this.levels.length : 0;
        if (levelsLength) {
          this.hls.autoLevelCapping = this.getMaxLevel(levelsLength - 1);
          if (this.hls.autoLevelCapping > this.autoLevelCapping) {
            // if auto level capping has a higher value for the previous one, flush the buffer using nextLevelSwitch
            // usually happen when the user go to the fullscreen mode.
            this.hls.streamController.nextLevelSwitch();
          }
          this.autoLevelCapping = this.hls.autoLevelCapping;
        }
      }
    }

    /*
    * returns level should be the one with the dimensions equal or greater than the media (player) dimensions (so the video will be downscaled)
    */

  }, {
    key: 'getMaxLevel',
    value: function getMaxLevel(capLevelIndex) {
      var result = void 0,
          i = void 0,
          level = void 0,
          mWidth = this.mediaWidth,
          mHeight = this.mediaHeight,
          lWidth = 0,
          lHeight = 0;

      for (i = 0; i <= capLevelIndex; i++) {
        level = this.levels[i];
        result = i;
        lWidth = level.width;
        lHeight = level.height;
        if (mWidth <= lWidth || mHeight <= lHeight) {
          break;
        }
      }
      return result;
    }
  }, {
    key: 'contentScaleFactor',
    get: function get() {
      var pixelRatio = 1;
      try {
        pixelRatio = window.devicePixelRatio;
      } catch (e) {}
      return pixelRatio;
    }
  }, {
    key: 'mediaWidth',
    get: function get() {
      var width = void 0;
      if (this.media) {
        width = this.media.width || this.media.clientWidth || this.media.offsetWidth;
        width *= this.contentScaleFactor;
      }
      return width;
    }
  }, {
    key: 'mediaHeight',
    get: function get() {
      var height = void 0;
      if (this.media) {
        height = this.media.height || this.media.clientHeight || this.media.offsetHeight;
        height *= this.contentScaleFactor;
      }
      return height;
    }
  }]);

  return CapLevelController;
}(_eventHandler2.default);

exports.default = CapLevelController;

},{"../event-handler":21,"../events":22}],6:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _logger = require('../utils/logger');

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Level Controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var LevelController = function (_EventHandler) {
  _inherits(LevelController, _EventHandler);

  function LevelController(hls) {
    _classCallCheck(this, LevelController);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(LevelController).call(this, hls, _events2.default.MANIFEST_LOADED, _events2.default.LEVEL_LOADED, _events2.default.ERROR));

    _this.ontick = _this.tick.bind(_this);
    _this._manualLevel = _this._autoLevelCapping = -1;
    return _this;
  }

  _createClass(LevelController, [{
    key: 'destroy',
    value: function destroy() {
      if (this.timer) {
        clearInterval(this.timer);
      }
      this._manualLevel = -1;
    }
  }, {
    key: 'startLoad',
    value: function startLoad() {
      this.canload = true;
      // speed up live playlist refresh if timer exists
      if (this.timer) {
        this.tick();
      }
    }
  }, {
    key: 'stopLoad',
    value: function stopLoad() {
      this.canload = false;
    }
  }, {
    key: 'onManifestLoaded',
    value: function onManifestLoaded(data) {
      var levels0 = [],
          levels = [],
          bitrateStart,
          i,
          bitrateSet = {},
          videoCodecFound = false,
          audioCodecFound = false,
          hls = this.hls;

      // regroup redundant level together
      data.levels.forEach(function (level) {
        if (level.videoCodec) {
          videoCodecFound = true;
        }
        if (level.audioCodec) {
          audioCodecFound = true;
        }
        var redundantLevelId = bitrateSet[level.bitrate];
        if (redundantLevelId === undefined) {
          bitrateSet[level.bitrate] = levels0.length;
          level.url = [level.url];
          level.urlId = 0;
          levels0.push(level);
        } else {
          levels0[redundantLevelId].url.push(level.url);
        }
      });

      // remove audio-only level if we also have levels with audio+video codecs signalled
      if (videoCodecFound && audioCodecFound) {
        levels0.forEach(function (level) {
          if (level.videoCodec) {
            levels.push(level);
          }
        });
      } else {
        levels = levels0;
      }

      // only keep level with supported audio/video codecs
      levels = levels.filter(function (level) {
        var checkSupportedAudio = function checkSupportedAudio(codec) {
          return MediaSource.isTypeSupported('audio/mp4;codecs=' + codec);
        };
        var checkSupportedVideo = function checkSupportedVideo(codec) {
          return MediaSource.isTypeSupported('video/mp4;codecs=' + codec);
        };
        var audioCodec = level.audioCodec,
            videoCodec = level.videoCodec;

        return (!audioCodec || checkSupportedAudio(audioCodec)) && (!videoCodec || checkSupportedVideo(videoCodec));
      });

      if (levels.length) {
        // start bitrate is the first bitrate of the manifest
        bitrateStart = levels[0].bitrate;
        // sort level on bitrate
        levels.sort(function (a, b) {
          return a.bitrate - b.bitrate;
        });
        this._levels = levels;
        // find index of first level in sorted levels
        for (i = 0; i < levels.length; i++) {
          if (levels[i].bitrate === bitrateStart) {
            this._firstLevel = i;
            _logger.logger.log('manifest loaded,' + levels.length + ' level(s) found, first bitrate:' + bitrateStart);
            break;
          }
        }
        hls.trigger(_events2.default.MANIFEST_PARSED, { levels: this._levels, firstLevel: this._firstLevel, stats: data.stats });
      } else {
        hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR, fatal: true, url: hls.url, reason: 'no level with compatible codecs found in manifest' });
      }
      return;
    }
  }, {
    key: 'setLevelInternal',
    value: function setLevelInternal(newLevel) {
      // check if level idx is valid
      if (newLevel >= 0 && newLevel < this._levels.length) {
        // stopping live reloading timer if any
        if (this.timer) {
          clearInterval(this.timer);
          this.timer = null;
        }
        this._level = newLevel;
        _logger.logger.log('switching to level ' + newLevel);
        this.hls.trigger(_events2.default.LEVEL_SWITCH, { level: newLevel });
        var level = this._levels[newLevel];
        // check if we need to load playlist for this level
        if (level.details === undefined || level.details.live === true) {
          // level not retrieved yet, or live playlist we need to (re)load it
          _logger.logger.log('(re)loading playlist for level ' + newLevel);
          var urlId = level.urlId;
          this.hls.trigger(_events2.default.LEVEL_LOADING, { url: level.url[urlId], level: newLevel, id: urlId });
        }
      } else {
        // invalid level id given, trigger error
        this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.OTHER_ERROR, details: _errors.ErrorDetails.LEVEL_SWITCH_ERROR, level: newLevel, fatal: false, reason: 'invalid level idx' });
      }
    }
  }, {
    key: 'onError',
    value: function onError(data) {
      if (data.fatal) {
        return;
      }

      var details = data.details,
          hls = this.hls,
          levelId,
          level;
      // try to recover not fatal errors
      switch (details) {
        case _errors.ErrorDetails.FRAG_LOAD_ERROR:
        case _errors.ErrorDetails.FRAG_LOAD_TIMEOUT:
        case _errors.ErrorDetails.FRAG_LOOP_LOADING_ERROR:
        case _errors.ErrorDetails.KEY_LOAD_ERROR:
        case _errors.ErrorDetails.KEY_LOAD_TIMEOUT:
          levelId = data.frag.level;
          break;
        case _errors.ErrorDetails.LEVEL_LOAD_ERROR:
        case _errors.ErrorDetails.LEVEL_LOAD_TIMEOUT:
          levelId = data.level;
          break;
        default:
          break;
      }
      /* try to switch to a redundant stream if any available.
       * if no redundant stream available, emergency switch down (if in auto mode and current level not 0)
       * otherwise, we cannot recover this network error ...
       * don't raise FRAG_LOAD_ERROR and FRAG_LOAD_TIMEOUT as fatal, as it is handled by mediaController
       */
      if (levelId !== undefined) {
        level = this._levels[levelId];
        if (level.urlId < level.url.length - 1) {
          level.urlId++;
          level.details = undefined;
          _logger.logger.warn('level controller,' + details + ' for level ' + levelId + ': switching to redundant stream id ' + level.urlId);
        } else {
          // we could try to recover if in auto mode and current level not lowest level (0)
          var recoverable = this._manualLevel === -1 && levelId;
          if (recoverable) {
            _logger.logger.warn('level controller,' + details + ': emergency switch-down for next fragment');
            hls.abrController.nextAutoLevel = 0;
          } else if (level && level.details && level.details.live) {
            _logger.logger.warn('level controller,' + details + ' on live stream, discard');
            // FRAG_LOAD_ERROR and FRAG_LOAD_TIMEOUT are handled by mediaController
          } else if (details !== _errors.ErrorDetails.FRAG_LOAD_ERROR && details !== _errors.ErrorDetails.FRAG_LOAD_TIMEOUT) {
              _logger.logger.error('cannot recover ' + details + ' error');
              this._level = undefined;
              // stopping live reloading timer if any
              if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
              }
              // redispatch same error but with fatal set to true
              data.fatal = true;
              hls.trigger(event, data);
            }
        }
      }
    }
  }, {
    key: 'onLevelLoaded',
    value: function onLevelLoaded(data) {
      // check if current playlist is a live playlist
      if (data.details.live && !this.timer) {
        // if live playlist we will have to reload it periodically
        // set reload period to playlist target duration
        this.timer = setInterval(this.ontick, 1000 * data.details.targetduration);
      }
      if (!data.details.live && this.timer) {
        // playlist is not live and timer is armed : stopping it
        clearInterval(this.timer);
        this.timer = null;
      }
    }
  }, {
    key: 'tick',
    value: function tick() {
      var levelId = this._level;
      if (levelId !== undefined && this.canload) {
        var level = this._levels[levelId],
            urlId = level.urlId;
        this.hls.trigger(_events2.default.LEVEL_LOADING, { url: level.url[urlId], level: levelId, id: urlId });
      }
    }
  }, {
    key: 'levels',
    get: function get() {
      return this._levels;
    }
  }, {
    key: 'level',
    get: function get() {
      return this._level;
    },
    set: function set(newLevel) {
      if (this._level !== newLevel || this._levels[newLevel].details === undefined) {
        this.setLevelInternal(newLevel);
      }
    }
  }, {
    key: 'manualLevel',
    get: function get() {
      return this._manualLevel;
    },
    set: function set(newLevel) {
      this._manualLevel = newLevel;
      if (newLevel !== -1) {
        this.level = newLevel;
      }
    }
  }, {
    key: 'firstLevel',
    get: function get() {
      return this._firstLevel;
    },
    set: function set(newLevel) {
      this._firstLevel = newLevel;
    }
  }, {
    key: 'startLevel',
    get: function get() {
      if (this._startLevel === undefined) {
        return this._firstLevel;
      } else {
        return this._startLevel;
      }
    },
    set: function set(newLevel) {
      this._startLevel = newLevel;
    }
  }, {
    key: 'nextLoadLevel',
    get: function get() {
      if (this._manualLevel !== -1) {
        return this._manualLevel;
      } else {
        return this.hls.abrController.nextAutoLevel;
      }
    },
    set: function set(nextLevel) {
      this.level = nextLevel;
      if (this._manualLevel === -1) {
        this.hls.abrController.nextAutoLevel = nextLevel;
      }
    }
  }]);

  return LevelController;
}(_eventHandler2.default);

exports.default = LevelController;

},{"../errors":20,"../event-handler":21,"../events":22,"../utils/logger":36}],7:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _demuxer = require('../demux/demuxer');

var _demuxer2 = _interopRequireDefault(_demuxer);

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _logger = require('../utils/logger');

var _binarySearch = require('../utils/binary-search');

var _binarySearch2 = _interopRequireDefault(_binarySearch);

var _bufferHelper = require('../helper/buffer-helper');

var _bufferHelper2 = _interopRequireDefault(_bufferHelper);

var _levelHelper = require('../helper/level-helper');

var _levelHelper2 = _interopRequireDefault(_levelHelper);

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Stream Controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var State = {
  STOPPED: 'STOPPED',
  STARTING: 'STARTING',
  IDLE: 'IDLE',
  PAUSED: 'PAUSED',
  KEY_LOADING: 'KEY_LOADING',
  FRAG_LOADING: 'FRAG_LOADING',
  FRAG_LOADING_WAITING_RETRY: 'FRAG_LOADING_WAITING_RETRY',
  WAITING_LEVEL: 'WAITING_LEVEL',
  PARSING: 'PARSING',
  PARSED: 'PARSED',
  ENDED: 'ENDED',
  ERROR: 'ERROR'
};

var StreamController = function (_EventHandler) {
  _inherits(StreamController, _EventHandler);

  function StreamController(hls) {
    _classCallCheck(this, StreamController);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(StreamController).call(this, hls, _events2.default.MEDIA_ATTACHED, _events2.default.MEDIA_DETACHING, _events2.default.MANIFEST_LOADING, _events2.default.MANIFEST_PARSED, _events2.default.LEVEL_LOADED, _events2.default.KEY_LOADED, _events2.default.FRAG_LOADED, _events2.default.FRAG_LOAD_EMERGENCY_ABORTED, _events2.default.FRAG_PARSING_INIT_SEGMENT, _events2.default.FRAG_PARSING_DATA, _events2.default.FRAG_PARSED, _events2.default.ERROR, _events2.default.BUFFER_APPENDED, _events2.default.BUFFER_FLUSHED));

    _this.config = hls.config;
    _this.audioCodecSwap = false;
    _this.ticks = 0;
    _this.ontick = _this.tick.bind(_this);
    return _this;
  }

  _createClass(StreamController, [{
    key: 'destroy',
    value: function destroy() {
      this.stopLoad();
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      _eventHandler2.default.prototype.destroy.call(this);
      this.state = State.STOPPED;
    }
  }, {
    key: 'startLoad',
    value: function startLoad() {
      var startPosition = arguments.length <= 0 || arguments[0] === undefined ? 0 : arguments[0];

      if (this.levels) {
        var media = this.media,
            lastCurrentTime = this.lastCurrentTime;
        this.stopLoad();
        this.demuxer = new _demuxer2.default(this.hls);
        if (!this.timer) {
          this.timer = setInterval(this.ontick, 100);
        }
        this.level = -1;
        this.fragLoadError = 0;
        if (media && lastCurrentTime) {
          _logger.logger.log('configure startPosition @' + lastCurrentTime);
          if (!this.lastPaused) {
            _logger.logger.log('resuming video');
            media.play();
          }
          this.state = State.IDLE;
        } else {
          this.lastCurrentTime = this.startPosition ? this.startPosition : startPosition;
          this.state = State.STARTING;
        }
        this.nextLoadPosition = this.startPosition = this.lastCurrentTime;
        this.tick();
      } else {
        _logger.logger.warn('cannot start loading as manifest not parsed yet');
        this.state = State.STOPPED;
      }
    }
  }, {
    key: 'stopLoad',
    value: function stopLoad() {
      var frag = this.fragCurrent;
      if (frag) {
        if (frag.loader) {
          frag.loader.abort();
        }
        this.fragCurrent = null;
      }
      this.fragPrevious = null;
      if (this.demuxer) {
        this.demuxer.destroy();
        this.demuxer = null;
      }
      this.state = State.STOPPED;
    }
  }, {
    key: 'tick',
    value: function tick() {
      this.ticks++;
      if (this.ticks === 1) {
        this.doTick();
        if (this.ticks > 1) {
          setTimeout(this.tick, 1);
        }
        this.ticks = 0;
      }
    }
  }, {
    key: 'doTick',
    value: function doTick() {
      var _this2 = this;

      var pos,
          level,
          levelDetails,
          hls = this.hls,
          config = hls.config;
      //logger.log(this.state);
      switch (this.state) {
        case State.ERROR:
        //don't do anything in error state to avoid breaking further ...
        case State.PAUSED:
          //don't do anything in paused state either ...
          break;
        case State.STARTING:
          // determine load level
          this.startLevel = hls.startLevel;
          if (this.startLevel === -1) {
            // -1 : guess start Level by doing a bitrate test by loading first fragment of lowest quality level
            this.startLevel = 0;
            this.fragBitrateTest = true;
          }
          // set new level to playlist loader : this will trigger start level load
          this.level = hls.nextLoadLevel = this.startLevel;
          this.state = State.WAITING_LEVEL;
          this.loadedmetadata = false;
          break;
        case State.IDLE:
          // if video not attached AND
          // start fragment already requested OR start frag prefetch disable
          // exit loop
          // => if media not attached but start frag prefetch is enabled and start frag not requested yet, we will not exit loop
          if (!this.media && (this.startFragRequested || !config.startFragPrefetch)) {
            break;
          }
          // determine next candidate fragment to be loaded, based on current position and
          //  end of buffer position
          //  ensure 60s of buffer upfront
          // if we have not yet loaded any fragment, start loading from start position
          if (this.loadedmetadata) {
            pos = this.media.currentTime;
          } else {
            pos = this.nextLoadPosition;
          }
          // determine next load level
          if (this.startFragRequested === false) {
            level = this.startLevel;
          } else {
            // we are not at playback start, get next load level from level Controller
            level = hls.nextLoadLevel;
          }
          var bufferInfo = _bufferHelper2.default.bufferInfo(this.media, pos, config.maxBufferHole),
              bufferLen = bufferInfo.len,
              bufferEnd = bufferInfo.end,
              fragPrevious = this.fragPrevious,
              maxBufLen;
          // compute max Buffer Length that we could get from this load level, based on level bitrate. don't buffer more than 60 MB and more than 30s
          if (this.levels[level].hasOwnProperty('bitrate')) {
            maxBufLen = Math.max(8 * config.maxBufferSize / this.levels[level].bitrate, config.maxBufferLength);
            maxBufLen = Math.min(maxBufLen, config.maxMaxBufferLength);
          } else {
            maxBufLen = config.maxBufferLength;
          }
          // if buffer length is less than maxBufLen try to load a new fragment
          if (bufferLen < maxBufLen) {
            // set next load level : this will trigger a playlist load if needed
            hls.nextLoadLevel = level;
            this.level = level;
            levelDetails = this.levels[level].details;
            // if level info not retrieved yet, switch state and wait for level retrieval
            // if live playlist, ensure that new playlist has been refreshed to avoid loading/try to load
            // a useless and outdated fragment (that might even introduce load error if it is already out of the live playlist)
            if (typeof levelDetails === 'undefined' || levelDetails.live && this.levelLastLoaded !== level) {
              this.state = State.WAITING_LEVEL;
              break;
            }
            // find fragment index, contiguous with end of buffer position
            var fragments = levelDetails.fragments,
                fragLen = fragments.length,
                start = fragments[0].start,
                end = fragments[fragLen - 1].start + fragments[fragLen - 1].duration,
                frag = void 0;

            // in case of live playlist we need to ensure that requested position is not located before playlist start
            if (levelDetails.live) {
              // check if requested position is within seekable boundaries :
              //logger.log(`start/pos/bufEnd/seeking:${start.toFixed(3)}/${pos.toFixed(3)}/${bufferEnd.toFixed(3)}/${this.media.seeking}`);
              var maxLatency = config.liveMaxLatencyDuration !== undefined ? config.liveMaxLatencyDuration : config.liveMaxLatencyDurationCount * levelDetails.targetduration;

              if (bufferEnd < Math.max(start, end - maxLatency)) {
                var targetLatency = config.liveSyncDuration !== undefined ? config.liveSyncDuration : config.liveSyncDurationCount * levelDetails.targetduration;
                this.seekAfterBuffered = start + Math.max(0, levelDetails.totalduration - targetLatency);
                _logger.logger.log('buffer end: ' + bufferEnd + ' is located too far from the end of live sliding playlist, media position will be reseted to: ' + this.seekAfterBuffered.toFixed(3));
                bufferEnd = this.seekAfterBuffered;
              }
              if (this.startFragRequested && !levelDetails.PTSKnown) {
                /* we are switching level on live playlist, but we don't have any PTS info for that quality level ...
                   try to load frag matching with next SN.
                   even if SN are not synchronized between playlists, loading this frag will help us
                   compute playlist sliding and find the right one after in case it was not the right consecutive one */
                if (fragPrevious) {
                  var targetSN = fragPrevious.sn + 1;
                  if (targetSN >= levelDetails.startSN && targetSN <= levelDetails.endSN) {
                    frag = fragments[targetSN - levelDetails.startSN];
                    _logger.logger.log('live playlist, switching playlist, load frag with next SN: ' + frag.sn);
                  }
                }
                if (!frag) {
                  /* we have no idea about which fragment should be loaded.
                     so let's load mid fragment. it will help computing playlist sliding and find the right one
                  */
                  frag = fragments[Math.min(fragLen - 1, Math.round(fragLen / 2))];
                  _logger.logger.log('live playlist, switching playlist, unknown, load middle frag : ' + frag.sn);
                }
              }
            } else {
              // VoD playlist: if bufferEnd before start of playlist, load first fragment
              if (bufferEnd < start) {
                frag = fragments[0];
              }
            }
            if (!frag) {
              (function () {
                var foundFrag = void 0;
                var maxFragLookUpTolerance = config.maxFragLookUpTolerance;
                if (bufferEnd < end) {
                  if (bufferEnd > end - maxFragLookUpTolerance) {
                    maxFragLookUpTolerance = 0;
                  }
                  foundFrag = _binarySearch2.default.search(fragments, function (candidate) {
                    // offset should be within fragment boundary - config.maxFragLookUpTolerance
                    // this is to cope with situations like
                    // bufferEnd = 9.991
                    // frag[Ø] : [0,10]
                    // frag[1] : [10,20]
                    // bufferEnd is within frag[0] range ... although what we are expecting is to return frag[1] here
                    //              frag start               frag start+duration
                    //                  |-----------------------------|
                    //              <--->                         <--->
                    //  ...--------><-----------------------------><---------....
                    // previous frag         matching fragment         next frag
                    //  return -1             return 0                 return 1
                    //logger.log(`level/sn/start/end/bufEnd:${level}/${candidate.sn}/${candidate.start}/${(candidate.start+candidate.duration)}/${bufferEnd}`);
                    if (candidate.start + candidate.duration - maxFragLookUpTolerance <= bufferEnd) {
                      return 1;
                    } else if (candidate.start - maxFragLookUpTolerance > bufferEnd) {
                      return -1;
                    }
                    return 0;
                  });
                } else {
                  // reach end of playlist
                  foundFrag = fragments[fragLen - 1];
                }
                if (foundFrag) {
                  frag = foundFrag;
                  start = foundFrag.start;
                  //logger.log('find SN matching with pos:' +  bufferEnd + ':' + frag.sn);
                  if (fragPrevious && frag.level === fragPrevious.level && frag.sn === fragPrevious.sn) {
                    if (frag.sn < levelDetails.endSN) {
                      frag = fragments[frag.sn + 1 - levelDetails.startSN];
                      _logger.logger.log('SN just loaded, load next one: ' + frag.sn);
                    } else {
                      // have we reached end of VOD playlist ?
                      if (!levelDetails.live) {
                        _this2.hls.trigger(_events2.default.BUFFER_EOS);
                        _this2.state = State.ENDED;
                      }
                      frag = null;
                    }
                  }
                }
              })();
            }
            if (frag) {
              //logger.log('      loading frag ' + i +',pos/bufEnd:' + pos.toFixed(3) + '/' + bufferEnd.toFixed(3));
              if (frag.decryptdata.uri != null && frag.decryptdata.key == null) {
                _logger.logger.log('Loading key for ' + frag.sn + ' of [' + levelDetails.startSN + ' ,' + levelDetails.endSN + '],level ' + level);
                this.state = State.KEY_LOADING;
                hls.trigger(_events2.default.KEY_LOADING, { frag: frag });
              } else {
                _logger.logger.log('Loading ' + frag.sn + ' of [' + levelDetails.startSN + ' ,' + levelDetails.endSN + '],level ' + level + ', currentTime:' + pos + ',bufferEnd:' + bufferEnd.toFixed(3));
                frag.autoLevel = hls.autoLevelEnabled;
                if (this.levels.length > 1) {
                  frag.expectedLen = Math.round(frag.duration * this.levels[level].bitrate / 8);
                  frag.trequest = performance.now();
                }
                // ensure that we are not reloading the same fragments in loop ...
                if (this.fragLoadIdx !== undefined) {
                  this.fragLoadIdx++;
                } else {
                  this.fragLoadIdx = 0;
                }
                if (frag.loadCounter) {
                  frag.loadCounter++;
                  var maxThreshold = config.fragLoadingLoopThreshold;
                  // if this frag has already been loaded 3 times, and if it has been reloaded recently
                  if (frag.loadCounter > maxThreshold && Math.abs(this.fragLoadIdx - frag.loadIdx) < maxThreshold) {
                    hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_LOOP_LOADING_ERROR, fatal: false, frag: frag });
                    return;
                  }
                } else {
                  frag.loadCounter = 1;
                }
                frag.loadIdx = this.fragLoadIdx;
                this.fragCurrent = frag;
                this.startFragRequested = true;
                hls.trigger(_events2.default.FRAG_LOADING, { frag: frag });
                this.state = State.FRAG_LOADING;
              }
            }
          }
          break;
        case State.WAITING_LEVEL:
          level = this.levels[this.level];
          // check if playlist is already loaded
          if (level && level.details) {
            this.state = State.IDLE;
          }
          break;
        case State.FRAG_LOADING_WAITING_RETRY:
          var now = performance.now();
          var retryDate = this.retryDate;
          var media = this.media;
          var isSeeking = media && media.seeking;
          // if current time is gt than retryDate, or if media seeking let's switch to IDLE state to retry loading
          if (!retryDate || now >= retryDate || isSeeking) {
            _logger.logger.log('mediaController: retryDate reached, switch back to IDLE state');
            this.state = State.IDLE;
          }
          break;
        case State.STOPPED:
        case State.FRAG_LOADING:
        case State.PARSING:
        case State.PARSED:
        case State.ENDED:
          break;
        default:
          break;
      }
      // check buffer
      this._checkBuffer();
      // check/update current fragment
      this._checkFragmentChanged();
    }
  }, {
    key: 'getBufferRange',
    value: function getBufferRange(position) {
      var i,
          range,
          bufferRange = this.bufferRange;
      if (bufferRange) {
        for (i = bufferRange.length - 1; i >= 0; i--) {
          range = bufferRange[i];
          if (position >= range.start && position <= range.end) {
            return range;
          }
        }
      }
      return null;
    }
  }, {
    key: 'followingBufferRange',
    value: function followingBufferRange(range) {
      if (range) {
        // try to get range of next fragment (500ms after this range)
        return this.getBufferRange(range.end + 0.5);
      }
      return null;
    }
  }, {
    key: 'isBuffered',
    value: function isBuffered(position) {
      var v = this.media,
          buffered = v.buffered;
      for (var i = 0; i < buffered.length; i++) {
        if (position >= buffered.start(i) && position <= buffered.end(i)) {
          return true;
        }
      }
      return false;
    }
  }, {
    key: '_checkFragmentChanged',
    value: function _checkFragmentChanged() {
      var rangeCurrent,
          currentTime,
          video = this.media;
      if (video && video.seeking === false) {
        currentTime = video.currentTime;
        /* if video element is in seeked state, currentTime can only increase.
          (assuming that playback rate is positive ...)
          As sometimes currentTime jumps back to zero after a
          media decode error, check this, to avoid seeking back to
          wrong position after a media decode error
        */
        if (currentTime > video.playbackRate * this.lastCurrentTime) {
          this.lastCurrentTime = currentTime;
        }
        if (this.isBuffered(currentTime)) {
          rangeCurrent = this.getBufferRange(currentTime);
        } else if (this.isBuffered(currentTime + 0.1)) {
          /* ensure that FRAG_CHANGED event is triggered at startup,
            when first video frame is displayed and playback is paused.
            add a tolerance of 100ms, in case current position is not buffered,
            check if current pos+100ms is buffered and use that buffer range
            for FRAG_CHANGED event reporting */
          rangeCurrent = this.getBufferRange(currentTime + 0.1);
        }
        if (rangeCurrent) {
          var fragPlaying = rangeCurrent.frag;
          if (fragPlaying !== this.fragPlaying) {
            this.fragPlaying = fragPlaying;
            this.hls.trigger(_events2.default.FRAG_CHANGED, { frag: fragPlaying });
          }
        }
      }
    }

    /*
      on immediate level switch :
       - pause playback if playing
       - cancel any pending load request
       - and trigger a buffer flush
    */

  }, {
    key: 'immediateLevelSwitch',
    value: function immediateLevelSwitch() {
      _logger.logger.log('immediateLevelSwitch');
      if (!this.immediateSwitch) {
        this.immediateSwitch = true;
        this.previouslyPaused = this.media.paused;
        this.media.pause();
      }
      var fragCurrent = this.fragCurrent;
      if (fragCurrent && fragCurrent.loader) {
        fragCurrent.loader.abort();
      }
      this.fragCurrent = null;
      // flush everything
      this.hls.trigger(_events2.default.BUFFER_FLUSHING, { startOffset: 0, endOffset: Number.POSITIVE_INFINITY });
      this.state = State.PAUSED;
      // increase fragment load Index to avoid frag loop loading error after buffer flush
      this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
      // speed up switching, trigger timer function
      this.tick();
    }

    /*
       on immediate level switch end, after new fragment has been buffered :
        - nudge video decoder by slightly adjusting video currentTime
        - resume the playback if needed
    */

  }, {
    key: 'immediateLevelSwitchEnd',
    value: function immediateLevelSwitchEnd() {
      this.immediateSwitch = false;
      this.media.currentTime -= 0.0001;
      if (!this.previouslyPaused) {
        this.media.play();
      }
    }
  }, {
    key: 'nextLevelSwitch',
    value: function nextLevelSwitch() {
      /* try to switch ASAP without breaking video playback :
         in order to ensure smooth but quick level switching,
        we need to find the next flushable buffer range
        we should take into account new segment fetch time
      */
      var fetchdelay, currentRange, nextRange;
      currentRange = this.getBufferRange(this.media.currentTime);
      if (currentRange && currentRange.start > 1) {
        // flush buffer preceding current fragment (flush until current fragment start offset)
        // minus 1s to avoid video freezing, that could happen if we flush keyframe of current video ...
        this.hls.trigger(_events2.default.BUFFER_FLUSHING, { startOffset: 0, endOffset: currentRange.start - 1 });
        this.state = State.PAUSED;
      }
      if (!this.media.paused) {
        // add a safety delay of 1s
        var nextLevelId = this.hls.nextLoadLevel,
            nextLevel = this.levels[nextLevelId],
            fragLastKbps = this.fragLastKbps;
        if (fragLastKbps && this.fragCurrent) {
          fetchdelay = this.fragCurrent.duration * nextLevel.bitrate / (1000 * fragLastKbps) + 1;
        } else {
          fetchdelay = 0;
        }
      } else {
        fetchdelay = 0;
      }
      //logger.log('fetchdelay:'+fetchdelay);
      // find buffer range that will be reached once new fragment will be fetched
      nextRange = this.getBufferRange(this.media.currentTime + fetchdelay);
      if (nextRange) {
        // we can flush buffer range following this one without stalling playback
        nextRange = this.followingBufferRange(nextRange);
        if (nextRange) {
          // flush position is the start position of this new buffer
          this.hls.trigger(_events2.default.BUFFER_FLUSHING, { startOffset: nextRange.start, endOffset: Number.POSITIVE_INFINITY });
          this.state = State.PAUSED;
          // if we are here, we can also cancel any loading/demuxing in progress, as they are useless
          var fragCurrent = this.fragCurrent;
          if (fragCurrent && fragCurrent.loader) {
            fragCurrent.loader.abort();
          }
          this.fragCurrent = null;
          // increase fragment load Index to avoid frag loop loading error after buffer flush
          this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
        }
      }
    }
  }, {
    key: 'onMediaAttached',
    value: function onMediaAttached(data) {
      var media = this.media = data.media;
      this.onvseeking = this.onMediaSeeking.bind(this);
      this.onvseeked = this.onMediaSeeked.bind(this);
      this.onvended = this.onMediaEnded.bind(this);
      media.addEventListener('seeking', this.onvseeking);
      media.addEventListener('seeked', this.onvseeked);
      media.addEventListener('ended', this.onvended);
      if (this.levels && this.config.autoStartLoad) {
        this.hls.startLoad();
      }
    }
  }, {
    key: 'onMediaDetaching',
    value: function onMediaDetaching() {
      var media = this.media;
      if (media && media.ended) {
        _logger.logger.log('MSE detaching and video ended, reset startPosition');
        this.startPosition = this.lastCurrentTime = 0;
      }

      // reset fragment loading counter on MSE detaching to avoid reporting FRAG_LOOP_LOADING_ERROR after error recovery
      var levels = this.levels;
      if (levels) {
        // reset fragment load counter
        levels.forEach(function (level) {
          if (level.details) {
            level.details.fragments.forEach(function (fragment) {
              fragment.loadCounter = undefined;
            });
          }
        });
      }
      // remove video listeners
      if (media) {
        media.removeEventListener('seeking', this.onvseeking);
        media.removeEventListener('seeked', this.onvseeked);
        media.removeEventListener('ended', this.onvended);
        this.onvseeking = this.onvseeked = this.onvended = null;
      }
      this.media = null;
      this.loadedmetadata = false;
      this.stopLoad();
    }
  }, {
    key: 'onMediaSeeking',
    value: function onMediaSeeking() {
      if (this.state === State.FRAG_LOADING) {
        // check if currently loaded fragment is inside buffer.
        //if outside, cancel fragment loading, otherwise do nothing
        if (_bufferHelper2.default.bufferInfo(this.media, this.media.currentTime, this.config.maxBufferHole).len === 0) {
          _logger.logger.log('seeking outside of buffer while fragment load in progress, cancel fragment load');
          var fragCurrent = this.fragCurrent;
          if (fragCurrent) {
            if (fragCurrent.loader) {
              fragCurrent.loader.abort();
            }
            this.fragCurrent = null;
          }
          this.fragPrevious = null;
          // switch to IDLE state to load new fragment
          this.state = State.IDLE;
        }
      } else if (this.state === State.ENDED) {
        // switch to IDLE state to check for potential new fragment
        this.state = State.IDLE;
      }
      if (this.media) {
        this.lastCurrentTime = this.media.currentTime;
      }
      // avoid reporting fragment loop loading error in case user is seeking several times on same position
      if (this.fragLoadIdx !== undefined) {
        this.fragLoadIdx += 2 * this.config.fragLoadingLoopThreshold;
      }
      // tick to speed up processing
      this.tick();
    }
  }, {
    key: 'onMediaSeeked',
    value: function onMediaSeeked() {
      // tick to speed up FRAGMENT_PLAYING triggering
      this.tick();
    }
  }, {
    key: 'onMediaEnded',
    value: function onMediaEnded() {
      _logger.logger.log('media ended');
      // reset startPosition and lastCurrentTime to restart playback @ stream beginning
      this.startPosition = this.lastCurrentTime = 0;
    }
  }, {
    key: 'onManifestLoading',
    value: function onManifestLoading() {
      // reset buffer on manifest loading
      _logger.logger.log('trigger BUFFER_RESET');
      this.hls.trigger(_events2.default.BUFFER_RESET);
      this.bufferRange = [];
      this.stalled = false;
    }
  }, {
    key: 'onManifestParsed',
    value: function onManifestParsed(data) {
      var aac = false,
          heaac = false,
          codec;
      data.levels.forEach(function (level) {
        // detect if we have different kind of audio codecs used amongst playlists
        codec = level.audioCodec;
        if (codec) {
          if (codec.indexOf('mp4a.40.2') !== -1) {
            aac = true;
          }
          if (codec.indexOf('mp4a.40.5') !== -1) {
            heaac = true;
          }
        }
      });
      this.audioCodecSwitch = aac && heaac;
      if (this.audioCodecSwitch) {
        _logger.logger.log('both AAC/HE-AAC audio found in levels; declaring level codec as HE-AAC');
      }
      this.levels = data.levels;
      this.startLevelLoaded = false;
      this.startFragRequested = false;
      if (this.config.autoStartLoad) {
        this.hls.startLoad();
      }
    }
  }, {
    key: 'onLevelLoaded',
    value: function onLevelLoaded(data) {
      var newDetails = data.details,
          newLevelId = data.level,
          curLevel = this.levels[newLevelId],
          duration = newDetails.totalduration,
          sliding = 0;

      _logger.logger.log('level ' + newLevelId + ' loaded [' + newDetails.startSN + ',' + newDetails.endSN + '],duration:' + duration);
      this.levelLastLoaded = newLevelId;

      if (newDetails.live) {
        var curDetails = curLevel.details;
        if (curDetails) {
          // we already have details for that level, merge them
          _levelHelper2.default.mergeDetails(curDetails, newDetails);
          sliding = newDetails.fragments[0].start;
          if (newDetails.PTSKnown) {
            _logger.logger.log('live playlist sliding:' + sliding.toFixed(3));
          } else {
            _logger.logger.log('live playlist - outdated PTS, unknown sliding');
          }
        } else {
          newDetails.PTSKnown = false;
          _logger.logger.log('live playlist - first load, unknown sliding');
        }
      } else {
        newDetails.PTSKnown = false;
      }
      // override level info
      curLevel.details = newDetails;
      this.hls.trigger(_events2.default.LEVEL_UPDATED, { details: newDetails, level: newLevelId });

      // compute start position
      if (this.startFragRequested === false) {
        // if live playlist, set start position to be fragment N-this.config.liveSyncDurationCount (usually 3)
        if (newDetails.live) {
          var targetLatency = this.config.liveSyncDuration !== undefined ? this.config.liveSyncDuration : this.config.liveSyncDurationCount * newDetails.targetduration;
          this.startPosition = Math.max(0, sliding + duration - targetLatency);
        }
        this.nextLoadPosition = this.startPosition;
      }
      // only switch batck to IDLE state if we were waiting for level to start downloading a new fragment
      if (this.state === State.WAITING_LEVEL) {
        this.state = State.IDLE;
      }
      //trigger handler right now
      this.tick();
    }
  }, {
    key: 'onKeyLoaded',
    value: function onKeyLoaded() {
      if (this.state === State.KEY_LOADING) {
        this.state = State.IDLE;
        this.tick();
      }
    }
  }, {
    key: 'onFragLoaded',
    value: function onFragLoaded(data) {
      var fragCurrent = this.fragCurrent;
      if (this.state === State.FRAG_LOADING && fragCurrent && data.frag.level === fragCurrent.level && data.frag.sn === fragCurrent.sn) {
        if (this.fragBitrateTest === true) {
          // switch back to IDLE state ... we just loaded a fragment to determine adequate start bitrate and initialize autoswitch algo
          this.state = State.IDLE;
          this.fragBitrateTest = false;
          data.stats.tparsed = data.stats.tbuffered = performance.now();
          this.hls.trigger(_events2.default.FRAG_BUFFERED, { stats: data.stats, frag: fragCurrent });
        } else {
          this.state = State.PARSING;
          // transmux the MPEG-TS data to ISO-BMFF segments
          this.stats = data.stats;
          var currentLevel = this.levels[this.level],
              details = currentLevel.details,
              duration = details.totalduration,
              start = fragCurrent.start,
              level = fragCurrent.level,
              sn = fragCurrent.sn,
              audioCodec = currentLevel.audioCodec || this.config.defaultAudioCodec;
          if (this.audioCodecSwap) {
            _logger.logger.log('swapping playlist audio codec');
            if (audioCodec === undefined) {
              audioCodec = this.lastAudioCodec;
            }
            if (audioCodec) {
              if (audioCodec.indexOf('mp4a.40.5') !== -1) {
                audioCodec = 'mp4a.40.2';
              } else {
                audioCodec = 'mp4a.40.5';
              }
            }
          }
          this.pendingAppending = 0;
          _logger.logger.log('Demuxing ' + sn + ' of [' + details.startSN + ' ,' + details.endSN + '],level ' + level);
          this.demuxer.push(data.payload, audioCodec, currentLevel.videoCodec, start, fragCurrent.cc, level, sn, duration, fragCurrent.decryptdata);
        }
      }
      this.fragLoadError = 0;
    }
  }, {
    key: 'onFragParsingInitSegment',
    value: function onFragParsingInitSegment(data) {
      if (this.state === State.PARSING) {
        var tracks = data.tracks,
            trackName,
            track;

        // include levelCodec in audio and video tracks
        track = tracks.audio;
        if (track) {
          var audioCodec = this.levels[this.level].audioCodec,
              ua = navigator.userAgent.toLowerCase();
          if (audioCodec && this.audioCodecSwap) {
            _logger.logger.log('swapping playlist audio codec');
            if (audioCodec.indexOf('mp4a.40.5') !== -1) {
              audioCodec = 'mp4a.40.2';
            } else {
              audioCodec = 'mp4a.40.5';
            }
          }
          // in case AAC and HE-AAC audio codecs are signalled in manifest
          // force HE-AAC , as it seems that most browsers prefers that way,
          // except for mono streams OR on FF
          // these conditions might need to be reviewed ...
          if (this.audioCodecSwitch) {
            // don't force HE-AAC if mono stream
            if (track.metadata.channelCount !== 1 &&
            // don't force HE-AAC if firefox
            ua.indexOf('firefox') === -1) {
              audioCodec = 'mp4a.40.5';
            }
          }
          // HE-AAC is broken on Android, always signal audio codec as AAC even if variant manifest states otherwise
          if (ua.indexOf('android') !== -1) {
            audioCodec = 'mp4a.40.2';
            _logger.logger.log('Android: force audio codec to' + audioCodec);
          }
          track.levelCodec = audioCodec;
        }
        track = tracks.video;
        if (track) {
          track.levelCodec = this.levels[this.level].videoCodec;
        }

        // if remuxer specify that a unique track needs to generated,
        // let's merge all tracks together
        if (data.unique) {
          var mergedTrack = {
            codec: '',
            levelCodec: ''
          };
          for (trackName in data.tracks) {
            track = tracks[trackName];
            mergedTrack.container = track.container;
            if (mergedTrack.codec) {
              mergedTrack.codec += ',';
              mergedTrack.levelCodec += ',';
            }
            if (track.codec) {
              mergedTrack.codec += track.codec;
            }
            if (track.levelCodec) {
              mergedTrack.levelCodec += track.levelCodec;
            }
          }
          tracks = { audiovideo: mergedTrack };
        }
        this.hls.trigger(_events2.default.BUFFER_CODECS, tracks);
        // loop through tracks that are going to be provided to bufferController
        for (trackName in tracks) {
          track = tracks[trackName];
          _logger.logger.log('track:' + trackName + ',container:' + track.container + ',codecs[level/parsed]=[' + track.levelCodec + '/' + track.codec + ']');
          var initSegment = track.initSegment;
          if (initSegment) {
            this.pendingAppending++;
            this.hls.trigger(_events2.default.BUFFER_APPENDING, { type: trackName, data: initSegment });
          }
        }
        //trigger handler right now
        this.tick();
      }
    }
  }, {
    key: 'onFragParsingData',
    value: function onFragParsingData(data) {
      var _this3 = this;

      if (this.state === State.PARSING) {
        this.tparse2 = Date.now();
        var level = this.levels[this.level],
            frag = this.fragCurrent;

        _logger.logger.log('parsed ' + data.type + ',PTS:[' + data.startPTS.toFixed(3) + ',' + data.endPTS.toFixed(3) + '],DTS:[' + data.startDTS.toFixed(3) + '/' + data.endDTS.toFixed(3) + '],nb:' + data.nb);

        var drift = _levelHelper2.default.updateFragPTS(level.details, frag.sn, data.startPTS, data.endPTS),
            hls = this.hls;
        hls.trigger(_events2.default.LEVEL_PTS_UPDATED, { details: level.details, level: this.level, drift: drift });

        [data.data1, data.data2].forEach(function (buffer) {
          if (buffer) {
            _this3.pendingAppending++;
            hls.trigger(_events2.default.BUFFER_APPENDING, { type: data.type, data: buffer });
          }
        });

        this.nextLoadPosition = data.endPTS;
        this.bufferRange.push({ type: data.type, start: data.startPTS, end: data.endPTS, frag: frag });

        //trigger handler right now
        this.tick();
      } else {
        _logger.logger.warn('not in PARSING state but ' + this.state + ', ignoring FRAG_PARSING_DATA event');
      }
    }
  }, {
    key: 'onFragParsed',
    value: function onFragParsed() {
      if (this.state === State.PARSING) {
        this.stats.tparsed = performance.now();
        this.state = State.PARSED;
        this._checkAppendedParsed();
      }
    }
  }, {
    key: 'onBufferAppended',
    value: function onBufferAppended() {
      switch (this.state) {
        case State.PARSING:
        case State.PARSED:
          this.pendingAppending--;
          this._checkAppendedParsed();
          break;
        default:
          break;
      }
    }
  }, {
    key: '_checkAppendedParsed',
    value: function _checkAppendedParsed() {
      //trigger handler right now
      if (this.state === State.PARSED && this.pendingAppending === 0) {
        var frag = this.fragCurrent,
            stats = this.stats;
        if (frag) {
          this.fragPrevious = frag;
          stats.tbuffered = performance.now();
          this.fragLastKbps = Math.round(8 * stats.length / (stats.tbuffered - stats.tfirst));
          this.hls.trigger(_events2.default.FRAG_BUFFERED, { stats: stats, frag: frag });
          _logger.logger.log('media buffered : ' + this.timeRangesToString(this.media.buffered));
          this.state = State.IDLE;
        }
        this.tick();
      }
    }
  }, {
    key: 'onError',
    value: function onError(data) {
      switch (data.details) {
        case _errors.ErrorDetails.FRAG_LOAD_ERROR:
        case _errors.ErrorDetails.FRAG_LOAD_TIMEOUT:
          if (!data.fatal) {
            var loadError = this.fragLoadError;
            if (loadError) {
              loadError++;
            } else {
              loadError = 1;
            }
            if (loadError <= this.config.fragLoadingMaxRetry) {
              this.fragLoadError = loadError;
              // reset load counter to avoid frag loop loading error
              data.frag.loadCounter = 0;
              // exponential backoff capped to 64s
              var delay = Math.min(Math.pow(2, loadError - 1) * this.config.fragLoadingRetryDelay, 64000);
              _logger.logger.warn('mediaController: frag loading failed, retry in ' + delay + ' ms');
              this.retryDate = performance.now() + delay;
              // retry loading state
              this.state = State.FRAG_LOADING_WAITING_RETRY;
            } else {
              _logger.logger.error('mediaController: ' + data.details + ' reaches max retry, redispatch as fatal ...');
              // redispatch same error but with fatal set to true
              data.fatal = true;
              this.hls.trigger(_events2.default.ERROR, data);
              this.state = State.ERROR;
            }
          }
          break;
        case _errors.ErrorDetails.FRAG_LOOP_LOADING_ERROR:
        case _errors.ErrorDetails.LEVEL_LOAD_ERROR:
        case _errors.ErrorDetails.LEVEL_LOAD_TIMEOUT:
        case _errors.ErrorDetails.KEY_LOAD_ERROR:
        case _errors.ErrorDetails.KEY_LOAD_TIMEOUT:
          // if fatal error, stop processing, otherwise move to IDLE to retry loading
          _logger.logger.warn('mediaController: ' + data.details + ' while loading frag,switch to ' + (data.fatal ? 'ERROR' : 'IDLE') + ' state ...');
          this.state = data.fatal ? State.ERROR : State.IDLE;
          break;
        case _errors.ErrorDetails.BUFFER_FULL_ERROR:
          // trigger a smooth level switch to empty buffers
          // also reduce max buffer length as it might be too high. we do this to avoid loop flushing ...
          this.config.maxMaxBufferLength /= 2;
          _logger.logger.warn('reduce max buffer length to ' + this.config.maxMaxBufferLength + 's and trigger a nextLevelSwitch to flush old buffer and fix QuotaExceededError');
          this.nextLevelSwitch();
          break;
        default:
          break;
      }
    }
  }, {
    key: '_checkBuffer',
    value: function _checkBuffer() {
      var media = this.media;
      if (media) {
        // compare readyState
        var readyState = media.readyState;
        // if ready state different from HAVE_NOTHING (numeric value 0), we are allowed to seek
        if (readyState) {
          var targetSeekPosition, currentTime;
          // if seek after buffered defined, let's seek if within acceptable range
          var seekAfterBuffered = this.seekAfterBuffered;
          if (seekAfterBuffered) {
            if (media.duration >= seekAfterBuffered) {
              targetSeekPosition = seekAfterBuffered;
              this.seekAfterBuffered = undefined;
            }
          } else {
            currentTime = media.currentTime;
            var loadedmetadata = this.loadedmetadata;

            // adjust currentTime to start position on loaded metadata
            if (!loadedmetadata && media.buffered.length) {
              this.loadedmetadata = true;
              // only adjust currentTime if not equal to 0
              if (!currentTime && currentTime !== this.startPosition) {
                targetSeekPosition = this.startPosition;
              }
            }
          }
          if (targetSeekPosition) {
            currentTime = targetSeekPosition;
            _logger.logger.log('target seek position:' + targetSeekPosition);
          }
          var bufferInfo = _bufferHelper2.default.bufferInfo(media, currentTime, 0),
              expectedPlaying = !(media.paused || media.ended || media.seeking || readyState < 2),
              jumpThreshold = 0.4,
              // tolerance needed as some browsers stalls playback before reaching buffered range end
          playheadMoving = currentTime > media.playbackRate * this.lastCurrentTime;

          if (this.stalled && playheadMoving) {
            this.stalled = false;
            _logger.logger.log('playback not stuck anymore @' + currentTime);
          }
          // check buffer upfront
          // if less than 200ms is buffered, and media is expected to play but playhead is not moving,
          // and we have a new buffer range available upfront, let's seek to that one
          if (bufferInfo.len <= jumpThreshold) {
            if (playheadMoving || !expectedPlaying) {
              // playhead moving or media not playing
              jumpThreshold = 0;
            } else {
              // playhead not moving AND media expected to play
              if (!this.stalled) {
                _logger.logger.log('playback seems stuck @' + currentTime);
                this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_STALLED_ERROR, fatal: false });
                this.stalled = true;
              }
            }
            // if we are below threshold, try to jump if next buffer range is close
            if (bufferInfo.len <= jumpThreshold) {
              // no buffer available @ currentTime, check if next buffer is close (within a config.maxSeekHole second range)
              var nextBufferStart = bufferInfo.nextStart,
                  delta = nextBufferStart - currentTime;
              if (nextBufferStart && delta < this.config.maxSeekHole && delta > 0 && !media.seeking) {
                // next buffer is close ! adjust currentTime to nextBufferStart
                // this will ensure effective video decoding
                _logger.logger.log('adjust currentTime from ' + media.currentTime + ' to next buffered @ ' + nextBufferStart);
                media.currentTime = nextBufferStart;
                this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.BUFFER_SEEK_OVER_HOLE, fatal: false });
              }
            }
          } else {
            if (targetSeekPosition && media.currentTime !== targetSeekPosition) {
              _logger.logger.log('adjust currentTime from ' + media.currentTime + ' to ' + targetSeekPosition);
              media.currentTime = targetSeekPosition;
            }
          }
        }
      }
    }
  }, {
    key: 'onFragLoadEmergencyAborted',
    value: function onFragLoadEmergencyAborted() {
      this.state = State.IDLE;
      this.tick();
    }
  }, {
    key: 'onBufferFlushed',
    value: function onBufferFlushed() {
      /* after successful buffer flushing, rebuild buffer Range array
        loop through existing buffer range and check if
        corresponding range is still buffered. only push to new array already buffered range
      */
      var newRange = [],
          range,
          i;
      for (i = 0; i < this.bufferRange.length; i++) {
        range = this.bufferRange[i];
        if (this.isBuffered((range.start + range.end) / 2)) {
          newRange.push(range);
        }
      }
      this.bufferRange = newRange;

      // handle end of immediate switching if needed
      if (this.immediateSwitch) {
        this.immediateLevelSwitchEnd();
      }
      // move to IDLE once flush complete. this should trigger new fragment loading
      this.state = State.IDLE;
      // reset reference to frag
      this.fragPrevious = null;
    }
  }, {
    key: 'swapAudioCodec',
    value: function swapAudioCodec() {
      this.audioCodecSwap = !this.audioCodecSwap;
    }
  }, {
    key: 'timeRangesToString',
    value: function timeRangesToString(r) {
      var log = '',
          len = r.length;
      for (var i = 0; i < len; i++) {
        log += '[' + r.start(i) + ',' + r.end(i) + ']';
      }
      return log;
    }
  }, {
    key: 'currentLevel',
    get: function get() {
      if (this.media) {
        var range = this.getBufferRange(this.media.currentTime);
        if (range) {
          return range.frag.level;
        }
      }
      return -1;
    }
  }, {
    key: 'nextBufferRange',
    get: function get() {
      if (this.media) {
        // first get end range of current fragment
        return this.followingBufferRange(this.getBufferRange(this.media.currentTime));
      } else {
        return null;
      }
    }
  }, {
    key: 'nextLevel',
    get: function get() {
      var range = this.nextBufferRange;
      if (range) {
        return range.frag.level;
      } else {
        return -1;
      }
    }
  }]);

  return StreamController;
}(_eventHandler2.default);

exports.default = StreamController;

},{"../demux/demuxer":16,"../errors":20,"../event-handler":21,"../events":22,"../helper/buffer-helper":23,"../helper/level-helper":24,"../utils/binary-search":34,"../utils/logger":36}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _cea708Interpreter = require('../utils/cea-708-interpreter');

var _cea708Interpreter2 = _interopRequireDefault(_cea708Interpreter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Timeline Controller
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var TimelineController = function (_EventHandler) {
  _inherits(TimelineController, _EventHandler);

  function TimelineController(hls) {
    _classCallCheck(this, TimelineController);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(TimelineController).call(this, hls, _events2.default.MEDIA_ATTACHING, _events2.default.MEDIA_DETACHING, _events2.default.FRAG_PARSING_USERDATA, _events2.default.MANIFEST_LOADING, _events2.default.FRAG_LOADED));

    _this.hls = hls;
    _this.config = hls.config;

    if (_this.config.enableCEA708Captions) {
      _this.cea708Interpreter = new _cea708Interpreter2.default();
    }
    return _this;
  }

  _createClass(TimelineController, [{
    key: 'destroy',
    value: function destroy() {
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onMediaAttaching',
    value: function onMediaAttaching(data) {
      var media = this.media = data.media;
      this.cea708Interpreter.attach(media);
    }
  }, {
    key: 'onMediaDetaching',
    value: function onMediaDetaching() {
      this.cea708Interpreter.detach();
    }
  }, {
    key: 'onManifestLoading',
    value: function onManifestLoading() {
      this.lastPts = Number.POSITIVE_INFINITY;
    }
  }, {
    key: 'onFragLoaded',
    value: function onFragLoaded(data) {
      var pts = data.frag.start; //Number.POSITIVE_INFINITY;

      // if this is a frag for a previously loaded timerange, remove all captions
      // TODO: consider just removing captions for the timerange
      if (pts <= this.lastPts) {
        this.cea708Interpreter.clear();
      }

      this.lastPts = pts;
    }
  }, {
    key: 'onFragParsingUserdata',
    value: function onFragParsingUserdata(data) {
      // push all of the CEA-708 messages into the interpreter
      // immediately. It will create the proper timestamps based on our PTS value
      for (var i = 0; i < data.samples.length; i++) {
        this.cea708Interpreter.push(data.samples[i].pts, data.samples[i].bytes);
      }
    }
  }]);

  return TimelineController;
}(_eventHandler2.default);

exports.default = TimelineController;

},{"../event-handler":21,"../events":22,"../utils/cea-708-interpreter":35}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
 *
 * This file contains an adaptation of the AES decryption algorithm
 * from the Standford Javascript Cryptography Library. That work is
 * covered by the following copyright and permissions notice:
 *
 * Copyright 2009-2010 Emily Stark, Mike Hamburg, Dan Boneh.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above
 *    copyright notice, this list of conditions and the following
 *    disclaimer in the documentation and/or other materials provided
 *    with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE AUTHORS ``AS IS'' AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR
 * BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
 * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN
 * IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * The views and conclusions contained in the software and documentation
 * are those of the authors and should not be interpreted as representing
 * official policies, either expressed or implied, of the authors.
 */

var AES = function () {

  /**
   * Schedule out an AES key for both encryption and decryption. This
   * is a low-level class. Use a cipher mode to do bulk encryption.
   *
   * @constructor
   * @param key {Array} The key as an array of 4, 6 or 8 words.
   */

  function AES(key) {
    _classCallCheck(this, AES);

    /**
     * The expanded S-box and inverse S-box tables. These will be computed
     * on the client so that we don't have to send them down the wire.
     *
     * There are two tables, _tables[0] is for encryption and
     * _tables[1] is for decryption.
     *
     * The first 4 sub-tables are the expanded S-box with MixColumns. The
     * last (_tables[01][4]) is the S-box itself.
     *
     * @private
     */
    this._tables = [[[], [], [], [], []], [[], [], [], [], []]];

    this._precompute();

    var i,
        j,
        tmp,
        encKey,
        decKey,
        sbox = this._tables[0][4],
        decTable = this._tables[1],
        keyLen = key.length,
        rcon = 1;

    if (keyLen !== 4 && keyLen !== 6 && keyLen !== 8) {
      throw new Error('Invalid aes key size=' + keyLen);
    }

    encKey = key.slice(0);
    decKey = [];
    this._key = [encKey, decKey];

    // schedule encryption keys
    for (i = keyLen; i < 4 * keyLen + 28; i++) {
      tmp = encKey[i - 1];

      // apply sbox
      if (i % keyLen === 0 || keyLen === 8 && i % keyLen === 4) {
        tmp = sbox[tmp >>> 24] << 24 ^ sbox[tmp >> 16 & 255] << 16 ^ sbox[tmp >> 8 & 255] << 8 ^ sbox[tmp & 255];

        // shift rows and add rcon
        if (i % keyLen === 0) {
          tmp = tmp << 8 ^ tmp >>> 24 ^ rcon << 24;
          rcon = rcon << 1 ^ (rcon >> 7) * 283;
        }
      }

      encKey[i] = encKey[i - keyLen] ^ tmp;
    }

    // schedule decryption keys
    for (j = 0; i; j++, i--) {
      tmp = encKey[j & 3 ? i : i - 4];
      if (i <= 4 || j < 4) {
        decKey[j] = tmp;
      } else {
        decKey[j] = decTable[0][sbox[tmp >>> 24]] ^ decTable[1][sbox[tmp >> 16 & 255]] ^ decTable[2][sbox[tmp >> 8 & 255]] ^ decTable[3][sbox[tmp & 255]];
      }
    }
  }

  /**
   * Expand the S-box tables.
   *
   * @private
   */


  _createClass(AES, [{
    key: '_precompute',
    value: function _precompute() {
      var encTable = this._tables[0],
          decTable = this._tables[1],
          sbox = encTable[4],
          sboxInv = decTable[4],
          i,
          x,
          xInv,
          d = [],
          th = [],
          x2,
          x4,
          x8,
          s,
          tEnc,
          tDec;

      // Compute double and third tables
      for (i = 0; i < 256; i++) {
        th[(d[i] = i << 1 ^ (i >> 7) * 283) ^ i] = i;
      }

      for (x = xInv = 0; !sbox[x]; x ^= x2 || 1, xInv = th[xInv] || 1) {
        // Compute sbox
        s = xInv ^ xInv << 1 ^ xInv << 2 ^ xInv << 3 ^ xInv << 4;
        s = s >> 8 ^ s & 255 ^ 99;
        sbox[x] = s;
        sboxInv[s] = x;

        // Compute MixColumns
        x8 = d[x4 = d[x2 = d[x]]];
        tDec = x8 * 0x1010101 ^ x4 * 0x10001 ^ x2 * 0x101 ^ x * 0x1010100;
        tEnc = d[s] * 0x101 ^ s * 0x1010100;

        for (i = 0; i < 4; i++) {
          encTable[i][x] = tEnc = tEnc << 24 ^ tEnc >>> 8;
          decTable[i][s] = tDec = tDec << 24 ^ tDec >>> 8;
        }
      }

      // Compactify. Considerable speedup on Firefox.
      for (i = 0; i < 5; i++) {
        encTable[i] = encTable[i].slice(0);
        decTable[i] = decTable[i].slice(0);
      }
    }

    /**
     * Decrypt 16 bytes, specified as four 32-bit words.
     * @param encrypted0 {number} the first word to decrypt
     * @param encrypted1 {number} the second word to decrypt
     * @param encrypted2 {number} the third word to decrypt
     * @param encrypted3 {number} the fourth word to decrypt
     * @param out {Int32Array} the array to write the decrypted words
     * into
     * @param offset {number} the offset into the output array to start
     * writing results
     * @return {Array} The plaintext.
     */

  }, {
    key: 'decrypt',
    value: function decrypt(encrypted0, encrypted1, encrypted2, encrypted3, out, offset) {
      var key = this._key[1],

      // state variables a,b,c,d are loaded with pre-whitened data
      a = encrypted0 ^ key[0],
          b = encrypted3 ^ key[1],
          c = encrypted2 ^ key[2],
          d = encrypted1 ^ key[3],
          a2,
          b2,
          c2,
          nInnerRounds = key.length / 4 - 2,
          // key.length === 2 ?
      i,
          kIndex = 4,
          table = this._tables[1],


      // load up the tables
      table0 = table[0],
          table1 = table[1],
          table2 = table[2],
          table3 = table[3],
          sbox = table[4];

      // Inner rounds. Cribbed from OpenSSL.
      for (i = 0; i < nInnerRounds; i++) {
        a2 = table0[a >>> 24] ^ table1[b >> 16 & 255] ^ table2[c >> 8 & 255] ^ table3[d & 255] ^ key[kIndex];
        b2 = table0[b >>> 24] ^ table1[c >> 16 & 255] ^ table2[d >> 8 & 255] ^ table3[a & 255] ^ key[kIndex + 1];
        c2 = table0[c >>> 24] ^ table1[d >> 16 & 255] ^ table2[a >> 8 & 255] ^ table3[b & 255] ^ key[kIndex + 2];
        d = table0[d >>> 24] ^ table1[a >> 16 & 255] ^ table2[b >> 8 & 255] ^ table3[c & 255] ^ key[kIndex + 3];
        kIndex += 4;
        a = a2;b = b2;c = c2;
      }

      // Last round.
      for (i = 0; i < 4; i++) {
        out[(3 & -i) + offset] = sbox[a >>> 24] << 24 ^ sbox[b >> 16 & 255] << 16 ^ sbox[c >> 8 & 255] << 8 ^ sbox[d & 255] ^ key[kIndex++];
        a2 = a;a = b;b = c;c = d;d = a2;
      }
    }
  }]);

  return AES;
}();

exports.default = AES;

},{}],10:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * This file contains an adaptation of the AES decryption algorithm
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * from the Standford Javascript Cryptography Library. That work is
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * covered by the following copyright and permissions notice:
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Copyright 2009-2010 Emily Stark, Mike Hamburg, Dan Boneh.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * All rights reserved.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Redistribution and use in source and binary forms, with or without
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * modification, are permitted provided that the following conditions are
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * met:
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * 1. Redistributions of source code must retain the above copyright
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *    notice, this list of conditions and the following disclaimer.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * 2. Redistributions in binary form must reproduce the above
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *    copyright notice, this list of conditions and the following
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *    disclaimer in the documentation and/or other materials provided
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *    with the distribution.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * THIS SOFTWARE IS PROVIDED BY THE AUTHORS ``AS IS'' AND ANY EXPRESS OR
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> OR CONTRIBUTORS BE
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * The views and conclusions contained in the software and documentation
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * are those of the authors and should not be interpreted as representing
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * official policies, either expressed or implied, of the authors.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _aes = require('./aes');

var _aes2 = _interopRequireDefault(_aes);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AES128Decrypter = function () {
  function AES128Decrypter(key, initVector) {
    _classCallCheck(this, AES128Decrypter);

    this.key = key;
    this.iv = initVector;
  }

  /**
   * Convert network-order (big-endian) bytes into their little-endian
   * representation.
   */


  _createClass(AES128Decrypter, [{
    key: 'ntoh',
    value: function ntoh(word) {
      return word << 24 | (word & 0xff00) << 8 | (word & 0xff0000) >> 8 | word >>> 24;
    }

    /**
     * Decrypt bytes using AES-128 with CBC and PKCS#7 padding.
     * @param encrypted {Uint8Array} the encrypted bytes
     * @param key {Uint32Array} the bytes of the decryption key
     * @param initVector {Uint32Array} the initialization vector (IV) to
     * use for the first round of CBC.
     * @return {Uint8Array} the decrypted bytes
     *
     * @see http://en.wikipedia.org/wiki/Advanced_Encryption_Standard
     * @see http://en.wikipedia.org/wiki/Block_cipher_mode_of_operation#Cipher_Block_Chaining_.28CBC.29
     * @see https://tools.ietf.org/html/rfc2315
     */

  }, {
    key: 'doDecrypt',
    value: function doDecrypt(encrypted, key, initVector) {
      var
      // word-level access to the encrypted bytes
      encrypted32 = new Int32Array(encrypted.buffer, encrypted.byteOffset, encrypted.byteLength >> 2),
          decipher = new _aes2.default(Array.prototype.slice.call(key)),


      // byte and word-level access for the decrypted output
      decrypted = new Uint8Array(encrypted.byteLength),
          decrypted32 = new Int32Array(decrypted.buffer),


      // temporary variables for working with the IV, encrypted, and
      // decrypted data
      init0,
          init1,
          init2,
          init3,
          encrypted0,
          encrypted1,
          encrypted2,
          encrypted3,


      // iteration variable
      wordIx;

      // pull out the words of the IV to ensure we don't modify the
      // passed-in reference and easier access
      init0 = ~ ~initVector[0];
      init1 = ~ ~initVector[1];
      init2 = ~ ~initVector[2];
      init3 = ~ ~initVector[3];

      // decrypt four word sequences, applying cipher-block chaining (CBC)
      // to each decrypted block
      for (wordIx = 0; wordIx < encrypted32.length; wordIx += 4) {
        // convert big-endian (network order) words into little-endian
        // (javascript order)
        encrypted0 = ~ ~this.ntoh(encrypted32[wordIx]);
        encrypted1 = ~ ~this.ntoh(encrypted32[wordIx + 1]);
        encrypted2 = ~ ~this.ntoh(encrypted32[wordIx + 2]);
        encrypted3 = ~ ~this.ntoh(encrypted32[wordIx + 3]);

        // decrypt the block
        decipher.decrypt(encrypted0, encrypted1, encrypted2, encrypted3, decrypted32, wordIx);

        // XOR with the IV, and restore network byte-order to obtain the
        // plaintext
        decrypted32[wordIx] = this.ntoh(decrypted32[wordIx] ^ init0);
        decrypted32[wordIx + 1] = this.ntoh(decrypted32[wordIx + 1] ^ init1);
        decrypted32[wordIx + 2] = this.ntoh(decrypted32[wordIx + 2] ^ init2);
        decrypted32[wordIx + 3] = this.ntoh(decrypted32[wordIx + 3] ^ init3);

        // setup the IV for the next round
        init0 = encrypted0;
        init1 = encrypted1;
        init2 = encrypted2;
        init3 = encrypted3;
      }

      return decrypted;
    }
  }, {
    key: 'localDecrypt',
    value: function localDecrypt(encrypted, key, initVector, decrypted) {
      var bytes = this.doDecrypt(encrypted, key, initVector);
      decrypted.set(bytes, encrypted.byteOffset);
    }
  }, {
    key: 'decrypt',
    value: function decrypt(encrypted) {
      var step = 4 * 8000,

      //encrypted32 = new Int32Array(encrypted.buffer),
      encrypted32 = new Int32Array(encrypted),
          decrypted = new Uint8Array(encrypted.byteLength),
          i = 0;

      // split up the encryption job and do the individual chunks asynchronously
      var key = this.key;
      var initVector = this.iv;
      this.localDecrypt(encrypted32.subarray(i, i + step), key, initVector, decrypted);

      for (i = step; i < encrypted32.length; i += step) {
        initVector = new Uint32Array([this.ntoh(encrypted32[i - 4]), this.ntoh(encrypted32[i - 3]), this.ntoh(encrypted32[i - 2]), this.ntoh(encrypted32[i - 1])]);
        this.localDecrypt(encrypted32.subarray(i, i + step), key, initVector, decrypted);
      }

      return decrypted;
    }
  }]);

  return AES128Decrypter;
}();

exports.default = AES128Decrypter;

},{"./aes":9}],11:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * AES128 decryption.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _aes128Decrypter = require('./aes128-decrypter');

var _aes128Decrypter2 = _interopRequireDefault(_aes128Decrypter);

var _errors = require('../errors');

var _logger = require('../utils/logger');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Decrypter = function () {
  function Decrypter(hls) {
    _classCallCheck(this, Decrypter);

    this.hls = hls;
    try {
      var browserCrypto = window ? window.crypto : crypto;
      this.subtle = browserCrypto.subtle || browserCrypto.webkitSubtle;
      this.disableWebCrypto = !this.subtle;
    } catch (e) {
      this.disableWebCrypto = true;
    }
  }

  _createClass(Decrypter, [{
    key: 'destroy',
    value: function destroy() {}
  }, {
    key: 'decrypt',
    value: function decrypt(data, key, iv, callback) {
      if (this.disableWebCrypto && this.hls.config.enableSoftwareAES) {
        this.decryptBySoftware(data, key, iv, callback);
      } else {
        this.decryptByWebCrypto(data, key, iv, callback);
      }
    }
  }, {
    key: 'decryptByWebCrypto',
    value: function decryptByWebCrypto(data, key, iv, callback) {
      var _this = this;

      _logger.logger.log('decrypting by WebCrypto API');

      this.subtle.importKey('raw', key, { name: 'AES-CBC', length: 128 }, false, ['decrypt']).then(function (importedKey) {
        _this.subtle.decrypt({ name: 'AES-CBC', iv: iv.buffer }, importedKey, data).then(callback).catch(function (err) {
          _this.onWebCryptoError(err, data, key, iv, callback);
        });
      }).catch(function (err) {
        _this.onWebCryptoError(err, data, key, iv, callback);
      });
    }
  }, {
    key: 'decryptBySoftware',
    value: function decryptBySoftware(data, key8, iv8, callback) {
      _logger.logger.log('decrypting by JavaScript Implementation');

      var view = new DataView(key8.buffer);
      var key = new Uint32Array([view.getUint32(0), view.getUint32(4), view.getUint32(8), view.getUint32(12)]);

      view = new DataView(iv8.buffer);
      var iv = new Uint32Array([view.getUint32(0), view.getUint32(4), view.getUint32(8), view.getUint32(12)]);

      var decrypter = new _aes128Decrypter2.default(key, iv);
      callback(decrypter.decrypt(data).buffer);
    }
  }, {
    key: 'onWebCryptoError',
    value: function onWebCryptoError(err, data, key, iv, callback) {
      if (this.hls.config.enableSoftwareAES) {
        _logger.logger.log('disabling to use WebCrypto API');
        this.disableWebCrypto = true;
        this.decryptBySoftware(data, key, iv, callback);
      } else {
        _logger.logger.error('decrypting error : ' + err.message);
        this.hls.trigger(Event.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_DECRYPT_ERROR, fatal: true, reason: err.message });
      }
    }
  }]);

  return Decrypter;
}();

exports.default = Decrypter;

},{"../errors":20,"../utils/logger":36,"./aes128-decrypter":10}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * AAC demuxer
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */


var _adts = require('./adts');

var _adts2 = _interopRequireDefault(_adts);

var _logger = require('../utils/logger');

var _id = require('../demux/id3');

var _id2 = _interopRequireDefault(_id);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AACDemuxer = function () {
  function AACDemuxer(observer, remuxerClass) {
    _classCallCheck(this, AACDemuxer);

    this.observer = observer;
    this.remuxerClass = remuxerClass;
    this.remuxer = new this.remuxerClass(observer);
    this._aacTrack = { container: 'audio/adts', type: 'audio', id: -1, sequenceNumber: 0, samples: [], len: 0 };
  }

  _createClass(AACDemuxer, [{
    key: 'push',


    // feed incoming data to the front of the parsing pipeline
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration) {
      var track = this._aacTrack,
          id3 = new _id2.default(data),
          pts = 90 * id3.timeStamp,
          config,
          frameLength,
          frameDuration,
          frameIndex,
          offset,
          headerLength,
          stamp,
          len,
          aacSample;
      // look for ADTS header (0xFFFx)
      for (offset = id3.length, len = data.length; offset < len - 1; offset++) {
        if (data[offset] === 0xff && (data[offset + 1] & 0xf0) === 0xf0) {
          break;
        }
      }

      if (!track.audiosamplerate) {
        config = _adts2.default.getAudioConfig(this.observer, data, offset, audioCodec);
        track.config = config.config;
        track.audiosamplerate = config.samplerate;
        track.channelCount = config.channelCount;
        track.codec = config.codec;
        track.duration = duration;
        _logger.logger.log('parsed codec:' + track.codec + ',rate:' + config.samplerate + ',nb channel:' + config.channelCount);
      }
      frameIndex = 0;
      frameDuration = 1024 * 90000 / track.audiosamplerate;
      while (offset + 5 < len) {
        // The protection skip bit tells us if we have 2 bytes of CRC data at the end of the ADTS header
        headerLength = !!(data[offset + 1] & 0x01) ? 7 : 9;
        // retrieve frame size
        frameLength = (data[offset + 3] & 0x03) << 11 | data[offset + 4] << 3 | (data[offset + 5] & 0xE0) >>> 5;
        frameLength -= headerLength;
        //stamp = pes.pts;

        if (frameLength > 0 && offset + headerLength + frameLength <= len) {
          stamp = pts + frameIndex * frameDuration;
          //logger.log(`AAC frame, offset/length/total/pts:${offset+headerLength}/${frameLength}/${data.byteLength}/${(stamp/90).toFixed(0)}`);
          aacSample = { unit: data.subarray(offset + headerLength, offset + headerLength + frameLength), pts: stamp, dts: stamp };
          track.samples.push(aacSample);
          track.len += frameLength;
          offset += frameLength + headerLength;
          frameIndex++;
          // look for ADTS header (0xFFFx)
          for (; offset < len - 1; offset++) {
            if (data[offset] === 0xff && (data[offset + 1] & 0xf0) === 0xf0) {
              break;
            }
          }
        } else {
          break;
        }
      }
      this.remuxer.remux(this._aacTrack, { samples: [] }, { samples: [{ pts: pts, dts: pts, unit: id3.payload }] }, { samples: [] }, timeOffset);
    }
  }, {
    key: 'destroy',
    value: function destroy() {}
  }], [{
    key: 'probe',
    value: function probe(data) {
      // check if data contains ID3 timestamp and ADTS sync worc
      var id3 = new _id2.default(data),
          offset,
          len;
      if (id3.hasTimeStamp) {
        // look for ADTS header (0xFFFx)
        for (offset = id3.length, len = data.length; offset < len - 1; offset++) {
          if (data[offset] === 0xff && (data[offset + 1] & 0xf0) === 0xf0) {
            //logger.log('ADTS sync word found !');
            return true;
          }
        }
      }
      return false;
    }
  }]);

  return AACDemuxer;
}();

exports.default = AACDemuxer;

},{"../demux/id3":18,"../utils/logger":36,"./adts":13}],13:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *  ADTS parser helper
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */


var _logger = require('../utils/logger');

var _errors = require('../errors');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ADTS = function () {
  function ADTS() {
    _classCallCheck(this, ADTS);
  }

  _createClass(ADTS, null, [{
    key: 'getAudioConfig',
    value: function getAudioConfig(observer, data, offset, audioCodec) {
      var adtsObjectType,
          // :int
      adtsSampleingIndex,
          // :int
      adtsExtensionSampleingIndex,
          // :int
      adtsChanelConfig,
          // :int
      config,
          userAgent = navigator.userAgent.toLowerCase(),
          adtsSampleingRates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
      // byte 2
      adtsObjectType = ((data[offset + 2] & 0xC0) >>> 6) + 1;
      adtsSampleingIndex = (data[offset + 2] & 0x3C) >>> 2;
      if (adtsSampleingIndex > adtsSampleingRates.length - 1) {
        observer.trigger(Event.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: true, reason: 'invalid ADTS sampling index:' + adtsSampleingIndex });
        return;
      }
      adtsChanelConfig = (data[offset + 2] & 0x01) << 2;
      // byte 3
      adtsChanelConfig |= (data[offset + 3] & 0xC0) >>> 6;
      _logger.logger.log('manifest codec:' + audioCodec + ',ADTS data:type:' + adtsObjectType + ',sampleingIndex:' + adtsSampleingIndex + '[' + adtsSampleingRates[adtsSampleingIndex] + 'Hz],channelConfig:' + adtsChanelConfig);
      // firefox: freq less than 24kHz = AAC SBR (HE-AAC)
      if (userAgent.indexOf('firefox') !== -1) {
        if (adtsSampleingIndex >= 6) {
          adtsObjectType = 5;
          config = new Array(4);
          // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
          // there is a factor 2 between frame sample rate and output sample rate
          // multiply frequency by 2 (see table below, equivalent to substract 3)
          adtsExtensionSampleingIndex = adtsSampleingIndex - 3;
        } else {
          adtsObjectType = 2;
          config = new Array(2);
          adtsExtensionSampleingIndex = adtsSampleingIndex;
        }
        // Android : always use AAC
      } else if (userAgent.indexOf('android') !== -1) {
          adtsObjectType = 2;
          config = new Array(2);
          adtsExtensionSampleingIndex = adtsSampleingIndex;
        } else {
          /*  for other browsers (chrome ...)
              always force audio type to be HE-AAC SBR, as some browsers do not support audio codec switch properly (like Chrome ...)
          */
          adtsObjectType = 5;
          config = new Array(4);
          // if (manifest codec is HE-AAC or HE-AACv2) OR (manifest codec not specified AND frequency less than 24kHz)
          if (audioCodec && (audioCodec.indexOf('mp4a.40.29') !== -1 || audioCodec.indexOf('mp4a.40.5') !== -1) || !audioCodec && adtsSampleingIndex >= 6) {
            // HE-AAC uses SBR (Spectral Band Replication) , high frequencies are constructed from low frequencies
            // there is a factor 2 between frame sample rate and output sample rate
            // multiply frequency by 2 (see table below, equivalent to substract 3)
            adtsExtensionSampleingIndex = adtsSampleingIndex - 3;
          } else {
            // if (manifest codec is AAC) AND (frequency less than 24kHz AND nb channel is 1) OR (manifest codec not specified and mono audio)
            // Chrome fails to play back with low frequency AAC LC mono when initialized with HE-AAC.  This is not a problem with stereo.
            if (audioCodec && audioCodec.indexOf('mp4a.40.2') !== -1 && adtsSampleingIndex >= 6 && adtsChanelConfig === 1 || !audioCodec && adtsChanelConfig === 1) {
              adtsObjectType = 2;
              config = new Array(2);
            }
            adtsExtensionSampleingIndex = adtsSampleingIndex;
          }
        }
      /* refer to http://wiki.multimedia.cx/index.php?title=MPEG-4_Audio#Audio_Specific_Config
          ISO 14496-3 (AAC).pdf - Table 1.13 — Syntax of AudioSpecificConfig()
        Audio Profile / Audio Object Type
        0: Null
        1: AAC Main
        2: AAC LC (Low Complexity)
        3: AAC SSR (Scalable Sample Rate)
        4: AAC LTP (Long Term Prediction)
        5: SBR (Spectral Band Replication)
        6: AAC Scalable
       sampling freq
        0: 96000 Hz
        1: 88200 Hz
        2: 64000 Hz
        3: 48000 Hz
        4: 44100 Hz
        5: 32000 Hz
        6: 24000 Hz
        7: 22050 Hz
        8: 16000 Hz
        9: 12000 Hz
        10: 11025 Hz
        11: 8000 Hz
        12: 7350 Hz
        13: Reserved
        14: Reserved
        15: frequency is written explictly
        Channel Configurations
        These are the channel configurations:
        0: Defined in AOT Specifc Config
        1: 1 channel: front-center
        2: 2 channels: front-left, front-right
      */
      // audioObjectType = profile => profile, the MPEG-4 Audio Object Type minus 1
      config[0] = adtsObjectType << 3;
      // samplingFrequencyIndex
      config[0] |= (adtsSampleingIndex & 0x0E) >> 1;
      config[1] |= (adtsSampleingIndex & 0x01) << 7;
      // channelConfiguration
      config[1] |= adtsChanelConfig << 3;
      if (adtsObjectType === 5) {
        // adtsExtensionSampleingIndex
        config[1] |= (adtsExtensionSampleingIndex & 0x0E) >> 1;
        config[2] = (adtsExtensionSampleingIndex & 0x01) << 7;
        // adtsObjectType (force to 2, chrome is checking that object type is less than 5 ???
        //    https://chromium.googlesource.com/chromium/src.git/+/master/media/formats/mp4/aac.cc
        config[2] |= 2 << 2;
        config[3] = 0;
      }
      return { config: config, samplerate: adtsSampleingRates[adtsSampleingIndex], channelCount: adtsChanelConfig, codec: 'mp4a.40.' + adtsObjectType };
    }
  }]);

  return ADTS;
}();

exports.default = ADTS;

},{"../errors":20,"../utils/logger":36}],14:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*  inline demuxer.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      *   probe fragments and instantiate appropriate demuxer depending on content type (TSDemuxer, AACDemuxer, ...)
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _errors = require('../errors');

var _aacdemuxer = require('../demux/aacdemuxer');

var _aacdemuxer2 = _interopRequireDefault(_aacdemuxer);

var _tsdemuxer = require('../demux/tsdemuxer');

var _tsdemuxer2 = _interopRequireDefault(_tsdemuxer);

var _mp4Remuxer = require('../remux/mp4-remuxer');

var _mp4Remuxer2 = _interopRequireDefault(_mp4Remuxer);

var _passthroughRemuxer = require('../remux/passthrough-remuxer');

var _passthroughRemuxer2 = _interopRequireDefault(_passthroughRemuxer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var DemuxerInline = function () {
  function DemuxerInline(hls, typeSupported) {
    _classCallCheck(this, DemuxerInline);

    this.hls = hls;
    this.typeSupported = typeSupported;
  }

  _createClass(DemuxerInline, [{
    key: 'destroy',
    value: function destroy() {
      var demuxer = this.demuxer;
      if (demuxer) {
        demuxer.destroy();
      }
    }
  }, {
    key: 'push',
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration) {
      var demuxer = this.demuxer;
      if (!demuxer) {
        var hls = this.hls;
        // probe for content type
        if (_tsdemuxer2.default.probe(data)) {
          if (this.typeSupported.mp2t === true) {
            demuxer = new _tsdemuxer2.default(hls, _passthroughRemuxer2.default);
          } else {
            demuxer = new _tsdemuxer2.default(hls, _mp4Remuxer2.default);
          }
        } else if (_aacdemuxer2.default.probe(data)) {
          demuxer = new _aacdemuxer2.default(hls, _mp4Remuxer2.default);
        } else {
          hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: true, reason: 'no demux matching with content found' });
          return;
        }
        this.demuxer = demuxer;
      }
      demuxer.push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration);
    }
  }]);

  return DemuxerInline;
}();

exports.default = DemuxerInline;

},{"../demux/aacdemuxer":12,"../demux/tsdemuxer":19,"../errors":20,"../events":22,"../remux/mp4-remuxer":31,"../remux/passthrough-remuxer":32}],15:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _demuxerInline = require('../demux/demuxer-inline');

var _demuxerInline2 = _interopRequireDefault(_demuxerInline);

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _events3 = require('events');

var _events4 = _interopRequireDefault(_events3);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var DemuxerWorker = function DemuxerWorker(self) {
  // observer setup
  var observer = new _events4.default();
  observer.trigger = function trigger(event) {
    for (var _len = arguments.length, data = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      data[_key - 1] = arguments[_key];
    }

    observer.emit.apply(observer, [event, event].concat(data));
  };

  observer.off = function off(event) {
    for (var _len2 = arguments.length, data = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
      data[_key2 - 1] = arguments[_key2];
    }

    observer.removeListener.apply(observer, [event].concat(data));
  };
  self.addEventListener('message', function (ev) {
    var data = ev.data;
    //console.log('demuxer cmd:' + data.cmd);
    switch (data.cmd) {
      case 'init':
        self.demuxer = new _demuxerInline2.default(observer, data.typeSupported);
        break;
      case 'demux':
        self.demuxer.push(new Uint8Array(data.data), data.audioCodec, data.videoCodec, data.timeOffset, data.cc, data.level, data.sn, data.duration);
        break;
      default:
        break;
    }
  });

  // listen to events triggered by Demuxer
  observer.on(_events2.default.FRAG_PARSING_INIT_SEGMENT, function (ev, data) {
    self.postMessage({ event: ev, tracks: data.tracks, unique: data.unique });
  });

  observer.on(_events2.default.FRAG_PARSING_DATA, function (ev, data) {
    var objData = { event: ev, type: data.type, startPTS: data.startPTS, endPTS: data.endPTS, startDTS: data.startDTS, endDTS: data.endDTS, data1: data.data1.buffer, data2: data.data2.buffer, nb: data.nb };
    // pass data1/data2 as transferable object (no copy)
    self.postMessage(objData, [objData.data1, objData.data2]);
  });

  observer.on(_events2.default.FRAG_PARSED, function (event) {
    self.postMessage({ event: event });
  });

  observer.on(_events2.default.ERROR, function (event, data) {
    self.postMessage({ event: event, data: data });
  });

  observer.on(_events2.default.FRAG_PARSING_METADATA, function (event, data) {
    var objData = { event: event, samples: data.samples };
    self.postMessage(objData);
  });

  observer.on(_events2.default.FRAG_PARSING_USERDATA, function (event, data) {
    var objData = { event: event, samples: data.samples };
    self.postMessage(objData);
  });
}; /* demuxer web worker.
    *  - listen to worker message, and trigger DemuxerInline upon reception of Fragments.
    *  - provides MP4 Boxes back to main thread using [transferable objects](https://developers.google.com/web/updates/2011/12/Transferable-Objects-Lightning-Fast) in order to minimize message passing overhead.
    */

exports.default = DemuxerWorker;

},{"../demux/demuxer-inline":14,"../events":22,"events":1}],16:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _demuxerInline = require('../demux/demuxer-inline');

var _demuxerInline2 = _interopRequireDefault(_demuxerInline);

var _demuxerWorker = require('../demux/demuxer-worker');

var _demuxerWorker2 = _interopRequireDefault(_demuxerWorker);

var _logger = require('../utils/logger');

var _decrypter = require('../crypt/decrypter');

var _decrypter2 = _interopRequireDefault(_decrypter);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Demuxer = function () {
  function Demuxer(hls) {
    _classCallCheck(this, Demuxer);

    this.hls = hls;
    var typeSupported = {
      mp4: MediaSource.isTypeSupported('video/mp4'),
      mp2t: hls.config.enableMP2TPassThrough && MediaSource.isTypeSupported('video/mp2t')
    };
    if (hls.config.enableWorker && typeof Worker !== 'undefined') {
      _logger.logger.log('demuxing in webworker');
      try {
        var work = require('webworkify');
        this.w = work(_demuxerWorker2.default);
        this.onwmsg = this.onWorkerMessage.bind(this);
        this.w.addEventListener('message', this.onwmsg);
        this.w.postMessage({ cmd: 'init', typeSupported: typeSupported });
      } catch (err) {
        _logger.logger.error('error while initializing DemuxerWorker, fallback on DemuxerInline');
        this.demuxer = new _demuxerInline2.default(hls, typeSupported);
      }
    } else {
      this.demuxer = new _demuxerInline2.default(hls, typeSupported);
    }
    this.demuxInitialized = true;
  }

  _createClass(Demuxer, [{
    key: 'destroy',
    value: function destroy() {
      if (this.w) {
        this.w.removeEventListener('message', this.onwmsg);
        this.w.terminate();
        this.w = null;
      } else {
        this.demuxer.destroy();
        this.demuxer = null;
      }
      if (this.decrypter) {
        this.decrypter.destroy();
        this.decrypter = null;
      }
    }
  }, {
    key: 'pushDecrypted',
    value: function pushDecrypted(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration) {
      if (this.w) {
        // post fragment payload as transferable objects (no copy)
        this.w.postMessage({ cmd: 'demux', data: data, audioCodec: audioCodec, videoCodec: videoCodec, timeOffset: timeOffset, cc: cc, level: level, sn: sn, duration: duration }, [data]);
      } else {
        this.demuxer.push(new Uint8Array(data), audioCodec, videoCodec, timeOffset, cc, level, sn, duration);
      }
    }
  }, {
    key: 'push',
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration, decryptdata) {
      if (data.byteLength > 0 && decryptdata != null && decryptdata.key != null && decryptdata.method === 'AES-128') {
        if (this.decrypter == null) {
          this.decrypter = new _decrypter2.default(this.hls);
        }

        var localthis = this;
        this.decrypter.decrypt(data, decryptdata.key, decryptdata.iv, function (decryptedData) {
          localthis.pushDecrypted(decryptedData, audioCodec, videoCodec, timeOffset, cc, level, sn, duration);
        });
      } else {
        this.pushDecrypted(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration);
      }
    }
  }, {
    key: 'onWorkerMessage',
    value: function onWorkerMessage(ev) {
      var data = ev.data;
      //console.log('onWorkerMessage:' + data.event);
      switch (data.event) {
        case _events2.default.FRAG_PARSING_INIT_SEGMENT:
          var obj = {};
          obj.tracks = data.tracks;
          obj.unique = data.unique;
          this.hls.trigger(_events2.default.FRAG_PARSING_INIT_SEGMENT, obj);
          break;
        case _events2.default.FRAG_PARSING_DATA:
          this.hls.trigger(_events2.default.FRAG_PARSING_DATA, {
            data1: new Uint8Array(data.data1),
            data2: new Uint8Array(data.data2),
            startPTS: data.startPTS,
            endPTS: data.endPTS,
            startDTS: data.startDTS,
            endDTS: data.endDTS,
            type: data.type,
            nb: data.nb
          });
          break;
        case _events2.default.FRAG_PARSING_METADATA:
          this.hls.trigger(_events2.default.FRAG_PARSING_METADATA, {
            samples: data.samples
          });
          break;
        case _events2.default.FRAG_PARSING_USERDATA:
          this.hls.trigger(_events2.default.FRAG_PARSING_USERDATA, {
            samples: data.samples
          });
          break;
        default:
          this.hls.trigger(data.event, data.data);
          break;
      }
    }
  }]);

  return Demuxer;
}();

exports.default = Demuxer;

},{"../crypt/decrypter":11,"../demux/demuxer-inline":14,"../demux/demuxer-worker":15,"../events":22,"../utils/logger":36,"webworkify":2}],17:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Parser for exponential Golomb codes, a variable-bitwidth number encoding scheme used by h264.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

var _logger = require('../utils/logger');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ExpGolomb = function () {
  function ExpGolomb(data) {
    _classCallCheck(this, ExpGolomb);

    this.data = data;
    // the number of bytes left to examine in this.data
    this.bytesAvailable = this.data.byteLength;
    // the current word being examined
    this.word = 0; // :uint
    // the number of bits left to examine in the current word
    this.bitsAvailable = 0; // :uint
  }

  // ():void


  _createClass(ExpGolomb, [{
    key: 'loadWord',
    value: function loadWord() {
      var position = this.data.byteLength - this.bytesAvailable,
          workingBytes = new Uint8Array(4),
          availableBytes = Math.min(4, this.bytesAvailable);
      if (availableBytes === 0) {
        throw new Error('no bytes available');
      }
      workingBytes.set(this.data.subarray(position, position + availableBytes));
      this.word = new DataView(workingBytes.buffer).getUint32(0);
      // track the amount of this.data that has been processed
      this.bitsAvailable = availableBytes * 8;
      this.bytesAvailable -= availableBytes;
    }

    // (count:int):void

  }, {
    key: 'skipBits',
    value: function skipBits(count) {
      var skipBytes; // :int
      if (this.bitsAvailable > count) {
        this.word <<= count;
        this.bitsAvailable -= count;
      } else {
        count -= this.bitsAvailable;
        skipBytes = count >> 3;
        count -= skipBytes >> 3;
        this.bytesAvailable -= skipBytes;
        this.loadWord();
        this.word <<= count;
        this.bitsAvailable -= count;
      }
    }

    // (size:int):uint

  }, {
    key: 'readBits',
    value: function readBits(size) {
      var bits = Math.min(this.bitsAvailable, size),
          // :uint
      valu = this.word >>> 32 - bits; // :uint
      if (size > 32) {
        _logger.logger.error('Cannot read more than 32 bits at a time');
      }
      this.bitsAvailable -= bits;
      if (this.bitsAvailable > 0) {
        this.word <<= bits;
      } else if (this.bytesAvailable > 0) {
        this.loadWord();
      }
      bits = size - bits;
      if (bits > 0) {
        return valu << bits | this.readBits(bits);
      } else {
        return valu;
      }
    }

    // ():uint

  }, {
    key: 'skipLZ',
    value: function skipLZ() {
      var leadingZeroCount; // :uint
      for (leadingZeroCount = 0; leadingZeroCount < this.bitsAvailable; ++leadingZeroCount) {
        if (0 !== (this.word & 0x80000000 >>> leadingZeroCount)) {
          // the first bit of working word is 1
          this.word <<= leadingZeroCount;
          this.bitsAvailable -= leadingZeroCount;
          return leadingZeroCount;
        }
      }
      // we exhausted word and still have not found a 1
      this.loadWord();
      return leadingZeroCount + this.skipLZ();
    }

    // ():void

  }, {
    key: 'skipUEG',
    value: function skipUEG() {
      this.skipBits(1 + this.skipLZ());
    }

    // ():void

  }, {
    key: 'skipEG',
    value: function skipEG() {
      this.skipBits(1 + this.skipLZ());
    }

    // ():uint

  }, {
    key: 'readUEG',
    value: function readUEG() {
      var clz = this.skipLZ(); // :uint
      return this.readBits(clz + 1) - 1;
    }

    // ():int

  }, {
    key: 'readEG',
    value: function readEG() {
      var valu = this.readUEG(); // :int
      if (0x01 & valu) {
        // the number is odd if the low order bit is set
        return 1 + valu >>> 1; // add 1 to make it even, and divide by 2
      } else {
          return -1 * (valu >>> 1); // divide by two then make it negative
        }
    }

    // Some convenience functions
    // :Boolean

  }, {
    key: 'readBoolean',
    value: function readBoolean() {
      return 1 === this.readBits(1);
    }

    // ():int

  }, {
    key: 'readUByte',
    value: function readUByte() {
      return this.readBits(8);
    }

    // ():int

  }, {
    key: 'readUShort',
    value: function readUShort() {
      return this.readBits(16);
    }
    // ():int

  }, {
    key: 'readUInt',
    value: function readUInt() {
      return this.readBits(32);
    }

    /**
     * Advance the ExpGolomb decoder past a scaling list. The scaling
     * list is optionally transmitted as part of a sequence parameter
     * set and is not relevant to transmuxing.
     * @param count {number} the number of entries in this scaling list
     * @see Recommendation ITU-T H.264, Section 7.3.2.1.1.1
     */

  }, {
    key: 'skipScalingList',
    value: function skipScalingList(count) {
      var lastScale = 8,
          nextScale = 8,
          j,
          deltaScale;
      for (j = 0; j < count; j++) {
        if (nextScale !== 0) {
          deltaScale = this.readEG();
          nextScale = (lastScale + deltaScale + 256) % 256;
        }
        lastScale = nextScale === 0 ? lastScale : nextScale;
      }
    }

    /**
     * Read a sequence parameter set and return some interesting video
     * properties. A sequence parameter set is the H264 metadata that
     * describes the properties of upcoming video frames.
     * @param data {Uint8Array} the bytes of a sequence parameter set
     * @return {object} an object with configuration parsed from the
     * sequence parameter set, including the dimensions of the
     * associated video frames.
     */

  }, {
    key: 'readSPS',
    value: function readSPS() {
      var frameCropLeftOffset = 0,
          frameCropRightOffset = 0,
          frameCropTopOffset = 0,
          frameCropBottomOffset = 0,
          sarScale = 1,
          profileIdc,
          profileCompat,
          levelIdc,
          numRefFramesInPicOrderCntCycle,
          picWidthInMbsMinus1,
          picHeightInMapUnitsMinus1,
          frameMbsOnlyFlag,
          scalingListCount,
          i;
      this.readUByte();
      profileIdc = this.readUByte(); // profile_idc
      profileCompat = this.readBits(5); // constraint_set[0-4]_flag, u(5)
      this.skipBits(3); // reserved_zero_3bits u(3),
      levelIdc = this.readUByte(); //level_idc u(8)
      this.skipUEG(); // seq_parameter_set_id
      // some profiles have more optional data we don't need
      if (profileIdc === 100 || profileIdc === 110 || profileIdc === 122 || profileIdc === 244 || profileIdc === 44 || profileIdc === 83 || profileIdc === 86 || profileIdc === 118 || profileIdc === 128) {
        var chromaFormatIdc = this.readUEG();
        if (chromaFormatIdc === 3) {
          this.skipBits(1); // separate_colour_plane_flag
        }
        this.skipUEG(); // bit_depth_luma_minus8
        this.skipUEG(); // bit_depth_chroma_minus8
        this.skipBits(1); // qpprime_y_zero_transform_bypass_flag
        if (this.readBoolean()) {
          // seq_scaling_matrix_present_flag
          scalingListCount = chromaFormatIdc !== 3 ? 8 : 12;
          for (i = 0; i < scalingListCount; i++) {
            if (this.readBoolean()) {
              // seq_scaling_list_present_flag[ i ]
              if (i < 6) {
                this.skipScalingList(16);
              } else {
                this.skipScalingList(64);
              }
            }
          }
        }
      }
      this.skipUEG(); // log2_max_frame_num_minus4
      var picOrderCntType = this.readUEG();
      if (picOrderCntType === 0) {
        this.readUEG(); //log2_max_pic_order_cnt_lsb_minus4
      } else if (picOrderCntType === 1) {
          this.skipBits(1); // delta_pic_order_always_zero_flag
          this.skipEG(); // offset_for_non_ref_pic
          this.skipEG(); // offset_for_top_to_bottom_field
          numRefFramesInPicOrderCntCycle = this.readUEG();
          for (i = 0; i < numRefFramesInPicOrderCntCycle; i++) {
            this.skipEG(); // offset_for_ref_frame[ i ]
          }
        }
      this.skipUEG(); // max_num_ref_frames
      this.skipBits(1); // gaps_in_frame_num_value_allowed_flag
      picWidthInMbsMinus1 = this.readUEG();
      picHeightInMapUnitsMinus1 = this.readUEG();
      frameMbsOnlyFlag = this.readBits(1);
      if (frameMbsOnlyFlag === 0) {
        this.skipBits(1); // mb_adaptive_frame_field_flag
      }
      this.skipBits(1); // direct_8x8_inference_flag
      if (this.readBoolean()) {
        // frame_cropping_flag
        frameCropLeftOffset = this.readUEG();
        frameCropRightOffset = this.readUEG();
        frameCropTopOffset = this.readUEG();
        frameCropBottomOffset = this.readUEG();
      }
      if (this.readBoolean()) {
        // vui_parameters_present_flag
        if (this.readBoolean()) {
          // aspect_ratio_info_present_flag
          var sarRatio = void 0;
          var aspectRatioIdc = this.readUByte();
          switch (aspectRatioIdc) {
            case 1:
              sarRatio = [1, 1];break;
            case 2:
              sarRatio = [12, 11];break;
            case 3:
              sarRatio = [10, 11];break;
            case 4:
              sarRatio = [16, 11];break;
            case 5:
              sarRatio = [40, 33];break;
            case 6:
              sarRatio = [24, 11];break;
            case 7:
              sarRatio = [20, 11];break;
            case 8:
              sarRatio = [32, 11];break;
            case 9:
              sarRatio = [80, 33];break;
            case 10:
              sarRatio = [18, 11];break;
            case 11:
              sarRatio = [15, 11];break;
            case 12:
              sarRatio = [64, 33];break;
            case 13:
              sarRatio = [160, 99];break;
            case 14:
              sarRatio = [4, 3];break;
            case 15:
              sarRatio = [3, 2];break;
            case 16:
              sarRatio = [2, 1];break;
            case 255:
              {
                sarRatio = [this.readUByte() << 8 | this.readUByte(), this.readUByte() << 8 | this.readUByte()];
                break;
              }
          }
          if (sarRatio) {
            sarScale = sarRatio[0] / sarRatio[1];
          }
        }
      }
      return {
        width: Math.ceil(((picWidthInMbsMinus1 + 1) * 16 - frameCropLeftOffset * 2 - frameCropRightOffset * 2) * sarScale),
        height: (2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16 - (frameMbsOnlyFlag ? 2 : 4) * (frameCropTopOffset + frameCropBottomOffset)
      };
    }
  }, {
    key: 'readSliceType',
    value: function readSliceType() {
      // skip NALu type
      this.readUByte();
      // discard first_mb_in_slice
      this.readUEG();
      // return slice_type
      return this.readUEG();
    }
  }]);

  return ExpGolomb;
}();

exports.default = ExpGolomb;

},{"../utils/logger":36}],18:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * ID3 parser
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      */


var _logger = require('../utils/logger');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

//import Hex from '../utils/hex';

var ID3 = function () {
  function ID3(data) {
    _classCallCheck(this, ID3);

    this._hasTimeStamp = false;
    var offset = 0,
        byte1,
        byte2,
        byte3,
        byte4,
        tagSize,
        endPos,
        header,
        len;
    do {
      header = this.readUTF(data, offset, 3);
      offset += 3;
      // first check for ID3 header
      if (header === 'ID3') {
        // skip 24 bits
        offset += 3;
        // retrieve tag(s) length
        byte1 = data[offset++] & 0x7f;
        byte2 = data[offset++] & 0x7f;
        byte3 = data[offset++] & 0x7f;
        byte4 = data[offset++] & 0x7f;
        tagSize = (byte1 << 21) + (byte2 << 14) + (byte3 << 7) + byte4;
        endPos = offset + tagSize;
        //logger.log(`ID3 tag found, size/end: ${tagSize}/${endPos}`);

        // read ID3 tags
        this._parseID3Frames(data, offset, endPos);
        offset = endPos;
      } else if (header === '3DI') {
        // http://id3.org/id3v2.4.0-structure chapter 3.4.   ID3v2 footer
        offset += 7;
        _logger.logger.log('3DI footer found, end: ' + offset);
      } else {
        offset -= 3;
        len = offset;
        if (len) {
          //logger.log(`ID3 len: ${len}`);
          if (!this.hasTimeStamp) {
            _logger.logger.warn('ID3 tag found, but no timestamp');
          }
          this._length = len;
          this._payload = data.subarray(0, len);
        }
        return;
      }
    } while (true);
  }

  _createClass(ID3, [{
    key: 'readUTF',
    value: function readUTF(data, start, len) {

      var result = '',
          offset = start,
          end = start + len;
      do {
        result += String.fromCharCode(data[offset++]);
      } while (offset < end);
      return result;
    }
  }, {
    key: '_parseID3Frames',
    value: function _parseID3Frames(data, offset, endPos) {
      var tagId, tagLen, tagStart, tagFlags, timestamp;
      while (offset + 8 <= endPos) {
        tagId = this.readUTF(data, offset, 4);
        offset += 4;

        tagLen = data[offset++] << 24 + data[offset++] << 16 + data[offset++] << 8 + data[offset++];

        tagFlags = data[offset++] << 8 + data[offset++];

        tagStart = offset;
        //logger.log("ID3 tag id:" + tagId);
        switch (tagId) {
          case 'PRIV':
            //logger.log('parse frame:' + Hex.hexDump(data.subarray(offset,endPos)));
            // owner should be "com.apple.streaming.transportStreamTimestamp"
            if (this.readUTF(data, offset, 44) === 'com.apple.streaming.transportStreamTimestamp') {
              offset += 44;
              // smelling even better ! we found the right descriptor
              // skip null character (string end) + 3 first bytes
              offset += 4;

              // timestamp is 33 bit expressed as a big-endian eight-octet number, with the upper 31 bits set to zero.
              var pts33Bit = data[offset++] & 0x1;
              this._hasTimeStamp = true;

              timestamp = ((data[offset++] << 23) + (data[offset++] << 15) + (data[offset++] << 7) + data[offset++]) / 45;

              if (pts33Bit) {
                timestamp += 47721858.84; // 2^32 / 90
              }
              timestamp = Math.round(timestamp);
              _logger.logger.trace('ID3 timestamp found: ' + timestamp);
              this._timeStamp = timestamp;
            }
            break;
          default:
            break;
        }
      }
    }
  }, {
    key: 'hasTimeStamp',
    get: function get() {
      return this._hasTimeStamp;
    }
  }, {
    key: 'timeStamp',
    get: function get() {
      return this._timeStamp;
    }
  }, {
    key: 'length',
    get: function get() {
      return this._length;
    }
  }, {
    key: 'payload',
    get: function get() {
      return this._payload;
    }
  }]);

  return ID3;
}();

exports.default = ID3;

},{"../utils/logger":36}],19:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * highly optimized TS demuxer:
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * parse PAT, PMT
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * extract PES packet from audio and video PIDs
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * extract AVC/H264 NAL units and AAC/ADTS samples from PES packet
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * trigger the remuxer upon parsing completion
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * it also tries to workaround as best as it can audio codec switch (HE-AAC to AAC and vice versa), without having to restart the MediaSource.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * it also controls the remuxing process :
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * upon discontinuity or level switch detection, it will also notifies the remuxer so that it can reset its state.
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

// import Hex from '../utils/hex';


var _adts = require('./adts');

var _adts2 = _interopRequireDefault(_adts);

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _expGolomb = require('./exp-golomb');

var _expGolomb2 = _interopRequireDefault(_expGolomb);

var _logger = require('../utils/logger');

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TSDemuxer = function () {
  function TSDemuxer(observer, remuxerClass) {
    _classCallCheck(this, TSDemuxer);

    this.observer = observer;
    this.remuxerClass = remuxerClass;
    this.lastCC = 0;
    this.remuxer = new this.remuxerClass(observer);
  }

  _createClass(TSDemuxer, [{
    key: 'switchLevel',
    value: function switchLevel() {
      this.pmtParsed = false;
      this._pmtId = -1;
      this.lastAacPTS = null;
      this.aacOverFlow = null;
      this._avcTrack = { container: 'video/mp2t', type: 'video', id: -1, sequenceNumber: 0, samples: [], len: 0, nbNalu: 0 };
      this._aacTrack = { container: 'video/mp2t', type: 'audio', id: -1, sequenceNumber: 0, samples: [], len: 0 };
      this._id3Track = { type: 'id3', id: -1, sequenceNumber: 0, samples: [], len: 0 };
      this._txtTrack = { type: 'text', id: -1, sequenceNumber: 0, samples: [], len: 0 };
      this.remuxer.switchLevel();
    }
  }, {
    key: 'insertDiscontinuity',
    value: function insertDiscontinuity() {
      this.switchLevel();
      this.remuxer.insertDiscontinuity();
    }

    // feed incoming data to the front of the parsing pipeline

  }, {
    key: 'push',
    value: function push(data, audioCodec, videoCodec, timeOffset, cc, level, sn, duration) {
      var avcData,
          aacData,
          id3Data,
          start,
          len = data.length,
          stt,
          pid,
          atf,
          offset,
          codecsOnly = this.remuxer.passthrough;

      this.audioCodec = audioCodec;
      this.videoCodec = videoCodec;
      this.timeOffset = timeOffset;
      this._duration = duration;
      this.contiguous = false;
      if (cc !== this.lastCC) {
        _logger.logger.log('discontinuity detected');
        this.insertDiscontinuity();
        this.lastCC = cc;
      } else if (level !== this.lastLevel) {
        _logger.logger.log('level switch detected');
        this.switchLevel();
        this.lastLevel = level;
      } else if (sn === this.lastSN + 1) {
        this.contiguous = true;
      }
      this.lastSN = sn;

      if (!this.contiguous) {
        // flush any partial content
        this.aacOverFlow = null;
      }

      var pmtParsed = this.pmtParsed,
          avcId = this._avcTrack.id,
          aacId = this._aacTrack.id,
          id3Id = this._id3Track.id;

      // don't parse last TS packet if incomplete
      len -= len % 188;
      // loop through TS packets
      for (start = 0; start < len; start += 188) {
        if (data[start] === 0x47) {
          stt = !!(data[start + 1] & 0x40);
          // pid is a 13-bit field starting at the last bit of TS[1]
          pid = ((data[start + 1] & 0x1f) << 8) + data[start + 2];
          atf = (data[start + 3] & 0x30) >> 4;
          // if an adaption field is present, its length is specified by the fifth byte of the TS packet header.
          if (atf > 1) {
            offset = start + 5 + data[start + 4];
            // continue if there is only adaptation field
            if (offset === start + 188) {
              continue;
            }
          } else {
            offset = start + 4;
          }
          if (pmtParsed) {
            if (pid === avcId) {
              if (stt) {
                if (avcData) {
                  this._parseAVCPES(this._parsePES(avcData));
                  if (codecsOnly) {
                    // if we have video codec info AND
                    // if audio PID is undefined OR if we have audio codec info,
                    // we have all codec info !
                    if (this._avcTrack.codec && (aacId === -1 || this._aacTrack.codec)) {
                      this.remux(data);
                      return;
                    }
                  }
                }
                avcData = { data: [], size: 0 };
              }
              if (avcData) {
                avcData.data.push(data.subarray(offset, start + 188));
                avcData.size += start + 188 - offset;
              }
            } else if (pid === aacId) {
              if (stt) {
                if (aacData) {
                  this._parseAACPES(this._parsePES(aacData));
                  if (codecsOnly) {
                    // here we now that we have audio codec info
                    // if video PID is undefined OR if we have video codec info,
                    // we have all codec infos !
                    if (this._aacTrack.codec && (avcId === -1 || this._avcTrack.codec)) {
                      this.remux(data);
                      return;
                    }
                  }
                }
                aacData = { data: [], size: 0 };
              }
              if (aacData) {
                aacData.data.push(data.subarray(offset, start + 188));
                aacData.size += start + 188 - offset;
              }
            } else if (pid === id3Id) {
              if (stt) {
                if (id3Data) {
                  this._parseID3PES(this._parsePES(id3Data));
                }
                id3Data = { data: [], size: 0 };
              }
              if (id3Data) {
                id3Data.data.push(data.subarray(offset, start + 188));
                id3Data.size += start + 188 - offset;
              }
            }
          } else {
            if (stt) {
              offset += data[offset] + 1;
            }
            if (pid === 0) {
              this._parsePAT(data, offset);
            } else if (pid === this._pmtId) {
              this._parsePMT(data, offset);
              pmtParsed = this.pmtParsed = true;
              avcId = this._avcTrack.id;
              aacId = this._aacTrack.id;
              id3Id = this._id3Track.id;
            }
          }
        } else {
          this.observer.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: false, reason: 'TS packet did not start with 0x47' });
        }
      }
      // parse last PES packet
      if (avcData) {
        this._parseAVCPES(this._parsePES(avcData));
      }
      if (aacData) {
        this._parseAACPES(this._parsePES(aacData));
      }
      if (id3Data) {
        this._parseID3PES(this._parsePES(id3Data));
      }
      this.remux(null);
    }
  }, {
    key: 'remux',
    value: function remux(data) {
      this.remuxer.remux(this._aacTrack, this._avcTrack, this._id3Track, this._txtTrack, this.timeOffset, this.contiguous, data);
    }
  }, {
    key: 'destroy',
    value: function destroy() {
      this.switchLevel();
      this._initPTS = this._initDTS = undefined;
      this._duration = 0;
    }
  }, {
    key: '_parsePAT',
    value: function _parsePAT(data, offset) {
      // skip the PSI header and parse the first PMT entry
      this._pmtId = (data[offset + 10] & 0x1F) << 8 | data[offset + 11];
      //logger.log('PMT PID:'  + this._pmtId);
    }
  }, {
    key: '_parsePMT',
    value: function _parsePMT(data, offset) {
      var sectionLength, tableEnd, programInfoLength, pid;
      sectionLength = (data[offset + 1] & 0x0f) << 8 | data[offset + 2];
      tableEnd = offset + 3 + sectionLength - 4;
      // to determine where the table is, we have to figure out how
      // long the program info descriptors are
      programInfoLength = (data[offset + 10] & 0x0f) << 8 | data[offset + 11];
      // advance the offset to the first entry in the mapping table
      offset += 12 + programInfoLength;
      while (offset < tableEnd) {
        pid = (data[offset + 1] & 0x1F) << 8 | data[offset + 2];
        switch (data[offset]) {
          // ISO/IEC 13818-7 ADTS AAC (MPEG-2 lower bit-rate audio)
          case 0x0f:
            //logger.log('AAC PID:'  + pid);
            this._aacTrack.id = pid;
            break;
          // Packetized metadata (ID3)
          case 0x15:
            //logger.log('ID3 PID:'  + pid);
            this._id3Track.id = pid;
            break;
          // ITU-T Rec. H.264 and ISO/IEC 14496-10 (lower bit-rate video)
          case 0x1b:
            //logger.log('AVC PID:'  + pid);
            this._avcTrack.id = pid;
            break;
          default:
            _logger.logger.log('unkown stream type:' + data[offset]);
            break;
        }
        // move to the next table entry
        // skip past the elementary stream descriptors, if present
        offset += ((data[offset + 3] & 0x0F) << 8 | data[offset + 4]) + 5;
      }
    }
  }, {
    key: '_parsePES',
    value: function _parsePES(stream) {
      var i = 0,
          frag,
          pesFlags,
          pesPrefix,
          pesLen,
          pesHdrLen,
          pesData,
          pesPts,
          pesDts,
          payloadStartOffset,
          data = stream.data;
      //retrieve PTS/DTS from first fragment
      frag = data[0];
      pesPrefix = (frag[0] << 16) + (frag[1] << 8) + frag[2];
      if (pesPrefix === 1) {
        pesLen = (frag[4] << 8) + frag[5];
        pesFlags = frag[7];
        if (pesFlags & 0xC0) {
          /* PES header described here : http://dvd.sourceforge.net/dvdinfo/pes-hdr.html
              as PTS / DTS is 33 bit we cannot use bitwise operator in JS,
              as Bitwise operators treat their operands as a sequence of 32 bits */
          pesPts = (frag[9] & 0x0E) * 536870912 + // 1 << 29
          (frag[10] & 0xFF) * 4194304 + // 1 << 22
          (frag[11] & 0xFE) * 16384 + // 1 << 14
          (frag[12] & 0xFF) * 128 + // 1 << 7
          (frag[13] & 0xFE) / 2;
          // check if greater than 2^32 -1
          if (pesPts > 4294967295) {
            // decrement 2^33
            pesPts -= 8589934592;
          }
          if (pesFlags & 0x40) {
            pesDts = (frag[14] & 0x0E) * 536870912 + // 1 << 29
            (frag[15] & 0xFF) * 4194304 + // 1 << 22
            (frag[16] & 0xFE) * 16384 + // 1 << 14
            (frag[17] & 0xFF) * 128 + // 1 << 7
            (frag[18] & 0xFE) / 2;
            // check if greater than 2^32 -1
            if (pesDts > 4294967295) {
              // decrement 2^33
              pesDts -= 8589934592;
            }
          } else {
            pesDts = pesPts;
          }
        }
        pesHdrLen = frag[8];
        payloadStartOffset = pesHdrLen + 9;

        stream.size -= payloadStartOffset;
        //reassemble PES packet
        pesData = new Uint8Array(stream.size);
        while (data.length) {
          frag = data.shift();
          var len = frag.byteLength;
          if (payloadStartOffset) {
            if (payloadStartOffset > len) {
              // trim full frag if PES header bigger than frag
              payloadStartOffset -= len;
              continue;
            } else {
              // trim partial frag if PES header smaller than frag
              frag = frag.subarray(payloadStartOffset);
              len -= payloadStartOffset;
              payloadStartOffset = 0;
            }
          }
          pesData.set(frag, i);
          i += len;
        }
        return { data: pesData, pts: pesPts, dts: pesDts, len: pesLen };
      } else {
        return null;
      }
    }
  }, {
    key: '_parseAVCPES',
    value: function _parseAVCPES(pes) {
      var _this = this;

      var track = this._avcTrack,
          samples = track.samples,
          units = this._parseAVCNALu(pes.data),
          units2 = [],
          debug = false,
          key = false,
          length = 0,
          expGolombDecoder,
          avcSample,
          push,
          i;
      // no NALu found
      if (units.length === 0 && samples.length > 0) {
        // append pes.data to previous NAL unit
        var lastavcSample = samples[samples.length - 1];
        var lastUnit = lastavcSample.units.units[lastavcSample.units.units.length - 1];
        var tmp = new Uint8Array(lastUnit.data.byteLength + pes.data.byteLength);
        tmp.set(lastUnit.data, 0);
        tmp.set(pes.data, lastUnit.data.byteLength);
        lastUnit.data = tmp;
        lastavcSample.units.length += pes.data.byteLength;
        track.len += pes.data.byteLength;
      }
      //free pes.data to save up some memory
      pes.data = null;
      var debugString = '';

      units.forEach(function (unit) {
        switch (unit.type) {
          //NDR
          case 1:
            push = true;
            if (debug) {
              debugString += 'NDR ';
            }
            break;
          //IDR
          case 5:
            push = true;
            if (debug) {
              debugString += 'IDR ';
            }
            key = true;
            break;
          //SEI
          case 6:
            push = true;
            if (debug) {
              debugString += 'SEI ';
            }
            expGolombDecoder = new _expGolomb2.default(unit.data);

            // skip frameType
            expGolombDecoder.readUByte();

            var payloadType = expGolombDecoder.readUByte();

            // TODO: there can be more than one payload in an SEI packet...
            // TODO: need to read type and size in a while loop to get them all
            if (payloadType === 4) {
              var payloadSize = 0;

              do {
                payloadSize = expGolombDecoder.readUByte();
              } while (payloadSize === 255);

              var countryCode = expGolombDecoder.readUByte();

              if (countryCode === 181) {
                var providerCode = expGolombDecoder.readUShort();

                if (providerCode === 49) {
                  var userStructure = expGolombDecoder.readUInt();

                  if (userStructure === 0x47413934) {
                    var userDataType = expGolombDecoder.readUByte();

                    // Raw CEA-608 bytes wrapped in CEA-708 packet
                    if (userDataType === 3) {
                      var firstByte = expGolombDecoder.readUByte();
                      var secondByte = expGolombDecoder.readUByte();

                      var totalCCs = 31 & firstByte;
                      var byteArray = [firstByte, secondByte];

                      for (i = 0; i < totalCCs; i++) {
                        // 3 bytes per CC
                        byteArray.push(expGolombDecoder.readUByte());
                        byteArray.push(expGolombDecoder.readUByte());
                        byteArray.push(expGolombDecoder.readUByte());
                      }

                      _this._txtTrack.samples.push({ type: 3, pts: pes.pts, bytes: byteArray });
                    }
                  }
                }
              }
            }
            break;
          //SPS
          case 7:
            push = true;
            if (debug) {
              debugString += 'SPS ';
            }
            if (!track.sps) {
              expGolombDecoder = new _expGolomb2.default(unit.data);
              var config = expGolombDecoder.readSPS();
              track.width = config.width;
              track.height = config.height;
              track.sps = [unit.data];
              track.duration = _this._duration;
              var codecarray = unit.data.subarray(1, 4);
              var codecstring = 'avc1.';
              for (i = 0; i < 3; i++) {
                var h = codecarray[i].toString(16);
                if (h.length < 2) {
                  h = '0' + h;
                }
                codecstring += h;
              }
              track.codec = codecstring;
            }
            break;
          //PPS
          case 8:
            push = true;
            if (debug) {
              debugString += 'PPS ';
            }
            if (!track.pps) {
              track.pps = [unit.data];
            }
            break;
          case 9:
            push = false;
            if (debug) {
              debugString += 'AUD ';
            }
            break;
          default:
            push = false;
            debugString += 'unknown NAL ' + unit.type + ' ';
            break;
        }
        if (push) {
          units2.push(unit);
          length += unit.data.byteLength;
        }
      });
      if (debug || debugString.length) {
        _logger.logger.log(debugString);
      }
      //build sample from PES
      // Annex B to MP4 conversion to be done
      if (units2.length) {
        // only push AVC sample if keyframe already found. browsers expect a keyframe at first to start decoding
        if (key === true || track.sps) {
          avcSample = { units: { units: units2, length: length }, pts: pes.pts, dts: pes.dts, key: key };
          samples.push(avcSample);
          track.len += length;
          track.nbNalu += units2.length;
        }
      }
    }
  }, {
    key: '_parseAVCNALu',
    value: function _parseAVCNALu(array) {
      var i = 0,
          len = array.byteLength,
          value,
          overflow,
          state = 0;
      var units = [],
          unit,
          unitType,
          lastUnitStart,
          lastUnitType;
      //logger.log('PES:' + Hex.hexDump(array));
      while (i < len) {
        value = array[i++];
        // finding 3 or 4-byte start codes (00 00 01 OR 00 00 00 01)
        switch (state) {
          case 0:
            if (value === 0) {
              state = 1;
            }
            break;
          case 1:
            if (value === 0) {
              state = 2;
            } else {
              state = 0;
            }
            break;
          case 2:
          case 3:
            if (value === 0) {
              state = 3;
            } else if (value === 1 && i < len) {
              unitType = array[i] & 0x1f;
              //logger.log('find NALU @ offset:' + i + ',type:' + unitType);
              if (lastUnitStart) {
                unit = { data: array.subarray(lastUnitStart, i - state - 1), type: lastUnitType };
                //logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
                units.push(unit);
              } else {
                // If NAL units are not starting right at the beginning of the PES packet, push preceding data into previous NAL unit.
                overflow = i - state - 1;
                if (overflow) {
                  var track = this._avcTrack,
                      samples = track.samples;
                  //logger.log('first NALU found with overflow:' + overflow);
                  if (samples.length) {
                    var lastavcSample = samples[samples.length - 1],
                        lastUnits = lastavcSample.units.units,
                        lastUnit = lastUnits[lastUnits.length - 1],
                        tmp = new Uint8Array(lastUnit.data.byteLength + overflow);
                    tmp.set(lastUnit.data, 0);
                    tmp.set(array.subarray(0, overflow), lastUnit.data.byteLength);
                    lastUnit.data = tmp;
                    lastavcSample.units.length += overflow;
                    track.len += overflow;
                  }
                }
              }
              lastUnitStart = i;
              lastUnitType = unitType;
              state = 0;
            } else {
              state = 0;
            }
            break;
          default:
            break;
        }
      }
      if (lastUnitStart) {
        unit = { data: array.subarray(lastUnitStart, len), type: lastUnitType };
        units.push(unit);
        //logger.log('pushing NALU, type/size:' + unit.type + '/' + unit.data.byteLength);
      }
      return units;
    }
  }, {
    key: '_parseAACPES',
    value: function _parseAACPES(pes) {
      var track = this._aacTrack,
          data = pes.data,
          pts = pes.pts,
          startOffset = 0,
          duration = this._duration,
          audioCodec = this.audioCodec,
          aacOverFlow = this.aacOverFlow,
          lastAacPTS = this.lastAacPTS,
          config,
          frameLength,
          frameDuration,
          frameIndex,
          offset,
          headerLength,
          stamp,
          len,
          aacSample;
      if (aacOverFlow) {
        var tmp = new Uint8Array(aacOverFlow.byteLength + data.byteLength);
        tmp.set(aacOverFlow, 0);
        tmp.set(data, aacOverFlow.byteLength);
        //logger.log(`AAC: append overflowing ${aacOverFlow.byteLength} bytes to beginning of new PES`);
        data = tmp;
      }
      // look for ADTS header (0xFFFx)
      for (offset = startOffset, len = data.length; offset < len - 1; offset++) {
        if (data[offset] === 0xff && (data[offset + 1] & 0xf0) === 0xf0) {
          break;
        }
      }
      // if ADTS header does not start straight from the beginning of the PES payload, raise an error
      if (offset) {
        var reason, fatal;
        if (offset < len - 1) {
          reason = 'AAC PES did not start with ADTS header,offset:' + offset;
          fatal = false;
        } else {
          reason = 'no ADTS header found in AAC PES';
          fatal = true;
        }
        this.observer.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: fatal, reason: reason });
        if (fatal) {
          return;
        }
      }
      if (!track.audiosamplerate) {
        config = _adts2.default.getAudioConfig(this.observer, data, offset, audioCodec);
        track.config = config.config;
        track.audiosamplerate = config.samplerate;
        track.channelCount = config.channelCount;
        track.codec = config.codec;
        track.duration = duration;
        _logger.logger.log('parsed codec:' + track.codec + ',rate:' + config.samplerate + ',nb channel:' + config.channelCount);
      }
      frameIndex = 0;
      frameDuration = 1024 * 90000 / track.audiosamplerate;

      // if last AAC frame is overflowing, we should ensure timestamps are contiguous:
      // first sample PTS should be equal to last sample PTS + frameDuration
      if (aacOverFlow && lastAacPTS) {
        var newPTS = lastAacPTS + frameDuration;
        if (Math.abs(newPTS - pts) > 1) {
          _logger.logger.log('AAC: align PTS for overlapping frames by ' + Math.round((newPTS - pts) / 90));
          pts = newPTS;
        }
      }

      while (offset + 5 < len) {
        // The protection skip bit tells us if we have 2 bytes of CRC data at the end of the ADTS header
        headerLength = !!(data[offset + 1] & 0x01) ? 7 : 9;
        // retrieve frame size
        frameLength = (data[offset + 3] & 0x03) << 11 | data[offset + 4] << 3 | (data[offset + 5] & 0xE0) >>> 5;
        frameLength -= headerLength;
        //stamp = pes.pts;

        if (frameLength > 0 && offset + headerLength + frameLength <= len) {
          stamp = pts + frameIndex * frameDuration;
          //logger.log(`AAC frame, offset/length/total/pts:${offset+headerLength}/${frameLength}/${data.byteLength}/${(stamp/90).toFixed(0)}`);
          aacSample = { unit: data.subarray(offset + headerLength, offset + headerLength + frameLength), pts: stamp, dts: stamp };
          track.samples.push(aacSample);
          track.len += frameLength;
          offset += frameLength + headerLength;
          frameIndex++;
          // look for ADTS header (0xFFFx)
          for (; offset < len - 1; offset++) {
            if (data[offset] === 0xff && (data[offset + 1] & 0xf0) === 0xf0) {
              break;
            }
          }
        } else {
          break;
        }
      }
      if (offset < len) {
        aacOverFlow = data.subarray(offset, len);
        //logger.log(`AAC: overflow detected:${len-offset}`);
      } else {
          aacOverFlow = null;
        }
      this.aacOverFlow = aacOverFlow;
      this.lastAacPTS = stamp;
    }
  }, {
    key: '_parseID3PES',
    value: function _parseID3PES(pes) {
      this._id3Track.samples.push(pes);
    }
  }], [{
    key: 'probe',
    value: function probe(data) {
      // a TS fragment should contain at least 3 TS packets, a PAT, a PMT, and one PID, each starting with 0x47
      if (data.length >= 3 * 188 && data[0] === 0x47 && data[188] === 0x47 && data[2 * 188] === 0x47) {
        return true;
      } else {
        return false;
      }
    }
  }]);

  return TSDemuxer;
}();

exports.default = TSDemuxer;

},{"../errors":20,"../events":22,"../utils/logger":36,"./adts":13,"./exp-golomb":17}],20:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var ErrorTypes = exports.ErrorTypes = {
  // Identifier for a network error (loading error / timeout ...)
  NETWORK_ERROR: 'networkError',
  // Identifier for a media Error (video/parsing/mediasource error)
  MEDIA_ERROR: 'mediaError',
  // Identifier for all other errors
  OTHER_ERROR: 'otherError'
};

var ErrorDetails = exports.ErrorDetails = {
  // Identifier for a manifest load error - data: { url : faulty URL, response : XHR response}
  MANIFEST_LOAD_ERROR: 'manifestLoadError',
  // Identifier for a manifest load timeout - data: { url : faulty URL, response : XHR response}
  MANIFEST_LOAD_TIMEOUT: 'manifestLoadTimeOut',
  // Identifier for a manifest parsing error - data: { url : faulty URL, reason : error reason}
  MANIFEST_PARSING_ERROR: 'manifestParsingError',
  // Identifier for a manifest with only incompatible codecs error - data: { url : faulty URL, reason : error reason}
  MANIFEST_INCOMPATIBLE_CODECS_ERROR: 'manifestIncompatibleCodecsError',
  // Identifier for playlist load error - data: { url : faulty URL, response : XHR response}
  LEVEL_LOAD_ERROR: 'levelLoadError',
  // Identifier for playlist load timeout - data: { url : faulty URL, response : XHR response}
  LEVEL_LOAD_TIMEOUT: 'levelLoadTimeOut',
  // Identifier for a level switch error - data: { level : faulty level Id, event : error description}
  LEVEL_SWITCH_ERROR: 'levelSwitchError',
  // Identifier for fragment load error - data: { frag : fragment object, response : XHR response}
  FRAG_LOAD_ERROR: 'fragLoadError',
  // Identifier for fragment loop loading error - data: { frag : fragment object}
  FRAG_LOOP_LOADING_ERROR: 'fragLoopLoadingError',
  // Identifier for fragment load timeout error - data: { frag : fragment object}
  FRAG_LOAD_TIMEOUT: 'fragLoadTimeOut',
  // Identifier for a fragment decryption error event - data: parsing error description
  FRAG_DECRYPT_ERROR: 'fragDecryptError',
  // Identifier for a fragment parsing error event - data: parsing error description
  FRAG_PARSING_ERROR: 'fragParsingError',
  // Identifier for decrypt key load error - data: { frag : fragment object, response : XHR response}
  KEY_LOAD_ERROR: 'keyLoadError',
  // Identifier for decrypt key load timeout error - data: { frag : fragment object}
  KEY_LOAD_TIMEOUT: 'keyLoadTimeOut',
  // Identifier for a buffer append error - data: append error description
  BUFFER_APPEND_ERROR: 'bufferAppendError',
  // Identifier for a buffer appending error event - data: appending error description
  BUFFER_APPENDING_ERROR: 'bufferAppendingError',
  // Identifier for a buffer stalled error event
  BUFFER_STALLED_ERROR: 'bufferStalledError',
  // Identifier for a buffer full event
  BUFFER_FULL_ERROR: 'bufferFullError',
  // Identifier for a buffer seek over hole event
  BUFFER_SEEK_OVER_HOLE: 'bufferSeekOverHole'
};

},{}],21:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
*
* All objects in the event handling chain should inherit from this class
*
*/

//import {logger} from './utils/logger';

var EventHandler = function () {
  function EventHandler(hls) {
    _classCallCheck(this, EventHandler);

    this.hls = hls;
    this.onEvent = this.onEvent.bind(this);

    for (var _len = arguments.length, events = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      events[_key - 1] = arguments[_key];
    }

    this.handledEvents = events;
    this.useGenericHandler = true;

    this.registerListeners();
  }

  _createClass(EventHandler, [{
    key: 'destroy',
    value: function destroy() {
      this.unregisterListeners();
    }
  }, {
    key: 'isEventHandler',
    value: function isEventHandler() {
      return _typeof(this.handledEvents) === 'object' && this.handledEvents.length && typeof this.onEvent === 'function';
    }
  }, {
    key: 'registerListeners',
    value: function registerListeners() {
      if (this.isEventHandler()) {
        this.handledEvents.forEach(function (event) {
          if (event === 'hlsEventGeneric') {
            throw new Error('Forbidden event name: ' + event);
          }
          this.hls.on(event, this.onEvent);
        }.bind(this));
      }
    }
  }, {
    key: 'unregisterListeners',
    value: function unregisterListeners() {
      if (this.isEventHandler()) {
        this.handledEvents.forEach(function (event) {
          this.hls.off(event, this.onEvent);
        }.bind(this));
      }
    }

    /*
    * arguments: event (string), data (any)
    */

  }, {
    key: 'onEvent',
    value: function onEvent(event, data) {
      this.onEventGeneric(event, data);
    }
  }, {
    key: 'onEventGeneric',
    value: function onEventGeneric(event, data) {
      var eventToFunction = function eventToFunction(event, data) {
        var funcName = 'on' + event.replace('hls', '');
        if (typeof this[funcName] !== 'function') {
          throw new Error('Event ' + event + ' has no generic handler in this ' + this.constructor.name + ' class (tried ' + funcName + ')');
        }
        return this[funcName].bind(this, data);
      };
      eventToFunction.call(this, event, data).call();
    }
  }]);

  return EventHandler;
}();

exports.default = EventHandler;

},{}],22:[function(require,module,exports){
'use strict';

module.exports = {
  // fired before MediaSource is attaching to media element - data: { media }
  MEDIA_ATTACHING: 'hlsMediaAttaching',
  // fired when MediaSource has been succesfully attached to media element - data: { }
  MEDIA_ATTACHED: 'hlsMediaAttached',
  // fired before detaching MediaSource from media element - data: { }
  MEDIA_DETACHING: 'hlsMediaDetaching',
  // fired when MediaSource has been detached from media element - data: { }
  MEDIA_DETACHED: 'hlsMediaDetached',
  // fired when we buffer is going to be resetted
  BUFFER_RESET: 'hlsBufferReset',
  // fired when we know about the codecs that we need buffers for to push into - data: {tracks : { container, codec, levelCodec, initSegment, metadata }}
  BUFFER_CODECS: 'hlsBufferCodecs',
  // fired when we append a segment to the buffer - data: { segment: segment object }
  BUFFER_APPENDING: 'hlsBufferAppending',
  // fired when we are done with appending a media segment to the buffer
  BUFFER_APPENDED: 'hlsBufferAppended',
  // fired when the stream is finished and we want to notify the media buffer that there will be no more data
  BUFFER_EOS: 'hlsBufferEos',
  // fired when the media buffer should be flushed - data {startOffset, endOffset}
  BUFFER_FLUSHING: 'hlsBufferFlushing',
  // fired when the media has been flushed
  BUFFER_FLUSHED: 'hlsBufferFlushed',
  // fired to signal that a manifest loading starts - data: { url : manifestURL}
  MANIFEST_LOADING: 'hlsManifestLoading',
  // fired after manifest has been loaded - data: { levels : [available quality levels] , url : manifestURL, stats : { trequest, tfirst, tload, mtime}}
  MANIFEST_LOADED: 'hlsManifestLoaded',
  // fired after manifest has been parsed - data: { levels : [available quality levels] , firstLevel : index of first quality level appearing in Manifest}
  MANIFEST_PARSED: 'hlsManifestParsed',
  // fired when a level playlist loading starts - data: { url : level URL  level : id of level being loaded}
  LEVEL_LOADING: 'hlsLevelLoading',
  // fired when a level playlist loading finishes - data: { details : levelDetails object, level : id of loaded level, stats : { trequest, tfirst, tload, mtime} }
  LEVEL_LOADED: 'hlsLevelLoaded',
  // fired when a level's details have been updated based on previous details, after it has been loaded. - data: { details : levelDetails object, level : id of updated level }
  LEVEL_UPDATED: 'hlsLevelUpdated',
  // fired when a level's PTS information has been updated after parsing a fragment - data: { details : levelDetails object, level : id of updated level, drift: PTS drift observed when parsing last fragment }
  LEVEL_PTS_UPDATED: 'hlsLevelPtsUpdated',
  // fired when a level switch is requested - data: { level : id of new level }
  LEVEL_SWITCH: 'hlsLevelSwitch',
  // fired when a fragment loading starts - data: { frag : fragment object}
  FRAG_LOADING: 'hlsFragLoading',
  // fired when a fragment loading is progressing - data: { frag : fragment object, { trequest, tfirst, loaded}}
  FRAG_LOAD_PROGRESS: 'hlsFragLoadProgress',
  // Identifier for fragment load aborting for emergency switch down - data: {frag : fragment object}
  FRAG_LOAD_EMERGENCY_ABORTED: 'hlsFragLoadEmergencyAborted',
  // fired when a fragment loading is completed - data: { frag : fragment object, payload : fragment payload, stats : { trequest, tfirst, tload, length}}
  FRAG_LOADED: 'hlsFragLoaded',
  // fired when Init Segment has been extracted from fragment - data: { moov : moov MP4 box, codecs : codecs found while parsing fragment}
  FRAG_PARSING_INIT_SEGMENT: 'hlsFragParsingInitSegment',
  // fired when parsing sei text is completed - data: { samples : [ sei samples pes ] }
  FRAG_PARSING_USERDATA: 'hlsFragParsingUserdata',
  // fired when parsing id3 is completed - data: { samples : [ id3 samples pes ] }
  FRAG_PARSING_METADATA: 'hlsFragParsingMetadata',
  // fired when data have been extracted from fragment - data: { data1 : moof MP4 box or TS fragments, data2 : mdat MP4 box or null}
  FRAG_PARSING_DATA: 'hlsFragParsingData',
  // fired when fragment parsing is completed - data: undefined
  FRAG_PARSED: 'hlsFragParsed',
  // fired when fragment remuxed MP4 boxes have all been appended into SourceBuffer - data: { frag : fragment object, stats : { trequest, tfirst, tload, tparsed, tbuffered, length} }
  FRAG_BUFFERED: 'hlsFragBuffered',
  // fired when fragment matching with current media position is changing - data : { frag : fragment object }
  FRAG_CHANGED: 'hlsFragChanged',
  // Identifier for a FPS drop event - data: {curentDropped, currentDecoded, totalDroppedFrames}
  FPS_DROP: 'hlsFpsDrop',
  // Identifier for an error event - data: { type : error type, details : error details, fatal : if true, hls.js cannot/will not try to recover, if false, hls.js will try to recover,other error specific data}
  ERROR: 'hlsError',
  // fired when hls.js instance starts destroying. Different from MEDIA_DETACHED as one could want to detach and reattach a media to the instance of hls.js to handle mid-rolls for example
  DESTROYING: 'hlsDestroying',
  // fired when a decrypt key loading starts - data: { frag : fragment object}
  KEY_LOADING: 'hlsKeyLoading',
  // fired when a decrypt key loading is completed - data: { frag : fragment object, payload : key payload, stats : { trequest, tfirst, tload, length}}
  KEY_LOADED: 'hlsKeyLoaded'
};

},{}],23:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Buffer Helper class, providing methods dealing buffer length retrieval
*/

var BufferHelper = function () {
  function BufferHelper() {
    _classCallCheck(this, BufferHelper);
  }

  _createClass(BufferHelper, null, [{
    key: "bufferInfo",
    value: function bufferInfo(media, pos, maxHoleDuration) {
      if (media) {
        var vbuffered = media.buffered,
            buffered = [],
            i;
        for (i = 0; i < vbuffered.length; i++) {
          buffered.push({ start: vbuffered.start(i), end: vbuffered.end(i) });
        }
        return this.bufferedInfo(buffered, pos, maxHoleDuration);
      } else {
        return { len: 0, start: 0, end: 0, nextStart: undefined };
      }
    }
  }, {
    key: "bufferedInfo",
    value: function bufferedInfo(buffered, pos, maxHoleDuration) {
      var buffered2 = [],

      // bufferStart and bufferEnd are buffer boundaries around current video position
      bufferLen,
          bufferStart,
          bufferEnd,
          bufferStartNext,
          i;
      // sort on buffer.start/smaller end (IE does not always return sorted buffered range)
      buffered.sort(function (a, b) {
        var diff = a.start - b.start;
        if (diff) {
          return diff;
        } else {
          return b.end - a.end;
        }
      });
      // there might be some small holes between buffer time range
      // consider that holes smaller than maxHoleDuration are irrelevant and build another
      // buffer time range representations that discards those holes
      for (i = 0; i < buffered.length; i++) {
        var buf2len = buffered2.length;
        if (buf2len) {
          var buf2end = buffered2[buf2len - 1].end;
          // if small hole (value between 0 or maxHoleDuration ) or overlapping (negative)
          if (buffered[i].start - buf2end < maxHoleDuration) {
            // merge overlapping time ranges
            // update lastRange.end only if smaller than item.end
            // e.g.  [ 1, 15] with  [ 2,8] => [ 1,15] (no need to modify lastRange.end)
            // whereas [ 1, 8] with  [ 2,15] => [ 1,15] ( lastRange should switch from [1,8] to [1,15])
            if (buffered[i].end > buf2end) {
              buffered2[buf2len - 1].end = buffered[i].end;
            }
          } else {
            // big hole
            buffered2.push(buffered[i]);
          }
        } else {
          // first value
          buffered2.push(buffered[i]);
        }
      }
      for (i = 0, bufferLen = 0, bufferStart = bufferEnd = pos; i < buffered2.length; i++) {
        var start = buffered2[i].start,
            end = buffered2[i].end;
        //logger.log('buf start/end:' + buffered.start(i) + '/' + buffered.end(i));
        if (pos + maxHoleDuration >= start && pos < end) {
          // play position is inside this buffer TimeRange, retrieve end of buffer position and buffer length
          bufferStart = start;
          bufferEnd = end;
          bufferLen = bufferEnd - pos;
        } else if (pos + maxHoleDuration < start) {
          bufferStartNext = start;
          break;
        }
      }
      return { len: bufferLen, start: bufferStart, end: bufferEnd, nextStart: bufferStartNext };
    }
  }]);

  return BufferHelper;
}();

exports.default = BufferHelper;

},{}],24:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * Level Helper class, providing methods dealing with playlist sliding and drift
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

var _logger = require('../utils/logger');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var LevelHelper = function () {
  function LevelHelper() {
    _classCallCheck(this, LevelHelper);
  }

  _createClass(LevelHelper, null, [{
    key: 'mergeDetails',
    value: function mergeDetails(oldDetails, newDetails) {
      var start = Math.max(oldDetails.startSN, newDetails.startSN) - newDetails.startSN,
          end = Math.min(oldDetails.endSN, newDetails.endSN) - newDetails.startSN,
          delta = newDetails.startSN - oldDetails.startSN,
          oldfragments = oldDetails.fragments,
          newfragments = newDetails.fragments,
          ccOffset = 0,
          PTSFrag;

      // check if old/new playlists have fragments in common
      if (end < start) {
        newDetails.PTSKnown = false;
        return;
      }
      // loop through overlapping SN and update startPTS , cc, and duration if any found
      for (var i = start; i <= end; i++) {
        var oldFrag = oldfragments[delta + i],
            newFrag = newfragments[i];
        ccOffset = oldFrag.cc - newFrag.cc;
        if (!isNaN(oldFrag.startPTS)) {
          newFrag.start = newFrag.startPTS = oldFrag.startPTS;
          newFrag.endPTS = oldFrag.endPTS;
          newFrag.duration = oldFrag.duration;
          PTSFrag = newFrag;
        }
      }

      if (ccOffset) {
        _logger.logger.log('discontinuity sliding from playlist, take drift into account');
        for (i = 0; i < newfragments.length; i++) {
          newfragments[i].cc += ccOffset;
        }
      }

      // if at least one fragment contains PTS info, recompute PTS information for all fragments
      if (PTSFrag) {
        LevelHelper.updateFragPTS(newDetails, PTSFrag.sn, PTSFrag.startPTS, PTSFrag.endPTS);
      } else {
        // adjust start by sliding offset
        var sliding = oldfragments[delta].start;
        for (i = 0; i < newfragments.length; i++) {
          newfragments[i].start += sliding;
        }
      }
      // if we are here, it means we have fragments overlapping between
      // old and new level. reliable PTS info is thus relying on old level
      newDetails.PTSKnown = oldDetails.PTSKnown;
      return;
    }
  }, {
    key: 'updateFragPTS',
    value: function updateFragPTS(details, sn, startPTS, endPTS) {
      var fragIdx, fragments, frag, i;
      // exit if sn out of range
      if (sn < details.startSN || sn > details.endSN) {
        return 0;
      }
      fragIdx = sn - details.startSN;
      fragments = details.fragments;
      frag = fragments[fragIdx];
      if (!isNaN(frag.startPTS)) {
        startPTS = Math.min(startPTS, frag.startPTS);
        endPTS = Math.max(endPTS, frag.endPTS);
      }

      var drift = startPTS - frag.start;

      frag.start = frag.startPTS = startPTS;
      frag.endPTS = endPTS;
      frag.duration = endPTS - startPTS;
      // adjust fragment PTS/duration from seqnum-1 to frag 0
      for (i = fragIdx; i > 0; i--) {
        LevelHelper.updatePTS(fragments, i, i - 1);
      }

      // adjust fragment PTS/duration from seqnum to last frag
      for (i = fragIdx; i < fragments.length - 1; i++) {
        LevelHelper.updatePTS(fragments, i, i + 1);
      }
      details.PTSKnown = true;
      //logger.log(`                                            frag start/end:${startPTS.toFixed(3)}/${endPTS.toFixed(3)}`);

      return drift;
    }
  }, {
    key: 'updatePTS',
    value: function updatePTS(fragments, fromIdx, toIdx) {
      var fragFrom = fragments[fromIdx],
          fragTo = fragments[toIdx],
          fragToPTS = fragTo.startPTS;
      // if we know startPTS[toIdx]
      if (!isNaN(fragToPTS)) {
        // update fragment duration.
        // it helps to fix drifts between playlist reported duration and fragment real duration
        if (toIdx > fromIdx) {
          fragFrom.duration = fragToPTS - fragFrom.start;
          if (fragFrom.duration < 0) {
            _logger.logger.error('negative duration computed for frag ' + fragFrom.sn + ',level ' + fragFrom.level + ', there should be some duration drift between playlist and fragment!');
          }
        } else {
          fragTo.duration = fragFrom.start - fragToPTS;
          if (fragTo.duration < 0) {
            _logger.logger.error('negative duration computed for frag ' + fragTo.sn + ',level ' + fragTo.level + ', there should be some duration drift between playlist and fragment!');
          }
        }
      } else {
        // we dont know startPTS[toIdx]
        if (toIdx > fromIdx) {
          fragTo.start = fragFrom.start + fragFrom.duration;
        } else {
          fragTo.start = fragFrom.start - fragTo.duration;
        }
      }
    }
  }]);

  return LevelHelper;
}();

exports.default = LevelHelper;

},{"../utils/logger":36}],25:[function(require,module,exports){
/**
 * HLS interface
 */
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
//import FPSController from './controller/fps-controller';


var _events = require('./events');

var _events2 = _interopRequireDefault(_events);

var _errors = require('./errors');

var _playlistLoader = require('./loader/playlist-loader');

var _playlistLoader2 = _interopRequireDefault(_playlistLoader);

var _fragmentLoader = require('./loader/fragment-loader');

var _fragmentLoader2 = _interopRequireDefault(_fragmentLoader);

var _abrController = require('./controller/abr-controller');

var _abrController2 = _interopRequireDefault(_abrController);

var _bufferController = require('./controller/buffer-controller');

var _bufferController2 = _interopRequireDefault(_bufferController);

var _capLevelController = require('./controller/cap-level-controller');

var _capLevelController2 = _interopRequireDefault(_capLevelController);

var _streamController = require('./controller/stream-controller');

var _streamController2 = _interopRequireDefault(_streamController);

var _levelController = require('./controller/level-controller');

var _levelController2 = _interopRequireDefault(_levelController);

var _timelineController = require('./controller/timeline-controller');

var _timelineController2 = _interopRequireDefault(_timelineController);

var _logger = require('./utils/logger');

var _xhrLoader = require('./utils/xhr-loader');

var _xhrLoader2 = _interopRequireDefault(_xhrLoader);

var _events3 = require('events');

var _events4 = _interopRequireDefault(_events3);

var _keyLoader = require('./loader/key-loader');

var _keyLoader2 = _interopRequireDefault(_keyLoader);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Hls = function () {
  _createClass(Hls, null, [{
    key: 'isSupported',
    value: function isSupported() {
      return window.MediaSource && window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"');
    }
  }, {
    key: 'Events',
    get: function get() {
      return _events2.default;
    }
  }, {
    key: 'ErrorTypes',
    get: function get() {
      return _errors.ErrorTypes;
    }
  }, {
    key: 'ErrorDetails',
    get: function get() {
      return _errors.ErrorDetails;
    }
  }, {
    key: 'DefaultConfig',
    get: function get() {
      if (!Hls.defaultConfig) {
        Hls.defaultConfig = {
          autoStartLoad: true,
          debug: false,
          capLevelToPlayerSize: false,
          maxBufferLength: 30,
          maxBufferSize: 60 * 1000 * 1000,
          maxBufferHole: 0.5,
          maxSeekHole: 2,
          maxFragLookUpTolerance: 0.2,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: Infinity,
          liveSyncDuration: undefined,
          liveMaxLatencyDuration: undefined,
          maxMaxBufferLength: 600,
          enableWorker: true,
          enableSoftwareAES: true,
          manifestLoadingTimeOut: 10000,
          manifestLoadingMaxRetry: 1,
          manifestLoadingRetryDelay: 1000,
          levelLoadingTimeOut: 10000,
          levelLoadingMaxRetry: 4,
          levelLoadingRetryDelay: 1000,
          fragLoadingTimeOut: 20000,
          fragLoadingMaxRetry: 6,
          fragLoadingRetryDelay: 1000,
          fragLoadingLoopThreshold: 3,
          startFragPrefetch: false,
          // fpsDroppedMonitoringPeriod: 5000,
          // fpsDroppedMonitoringThreshold: 0.2,
          appendErrorMaxRetry: 3,
          loader: _xhrLoader2.default,
          fLoader: undefined,
          pLoader: undefined,
          abrController: _abrController2.default,
          bufferController: _bufferController2.default,
          capLevelController: _capLevelController2.default,
          streamController: _streamController2.default,
          timelineController: _timelineController2.default,
          enableCEA708Captions: true,
          enableMP2TPassThrough: false
        };
      }
      return Hls.defaultConfig;
    },
    set: function set(defaultConfig) {
      Hls.defaultConfig = defaultConfig;
    }
  }]);

  function Hls() {
    var config = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    _classCallCheck(this, Hls);

    var defaultConfig = Hls.DefaultConfig;

    if ((config.liveSyncDurationCount || config.liveMaxLatencyDurationCount) && (config.liveSyncDuration || config.liveMaxLatencyDuration)) {
      throw new Error('Illegal hls.js config: don\'t mix up liveSyncDurationCount/liveMaxLatencyDurationCount and liveSyncDuration/liveMaxLatencyDuration');
    }

    for (var prop in defaultConfig) {
      if (prop in config) {
        continue;
      }
      config[prop] = defaultConfig[prop];
    }

    if (config.liveMaxLatencyDurationCount !== undefined && config.liveMaxLatencyDurationCount <= config.liveSyncDurationCount) {
      throw new Error('Illegal hls.js config: "liveMaxLatencyDurationCount" must be gt "liveSyncDurationCount"');
    }

    if (config.liveMaxLatencyDuration !== undefined && (config.liveMaxLatencyDuration <= config.liveSyncDuration || config.liveSyncDuration === undefined)) {
      throw new Error('Illegal hls.js config: "liveMaxLatencyDuration" must be gt "liveSyncDuration"');
    }

    (0, _logger.enableLogs)(config.debug);
    this.config = config;
    // observer setup
    var observer = this.observer = new _events4.default();
    observer.trigger = function trigger(event) {
      for (var _len = arguments.length, data = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        data[_key - 1] = arguments[_key];
      }

      observer.emit.apply(observer, [event, event].concat(data));
    };

    observer.off = function off(event) {
      for (var _len2 = arguments.length, data = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        data[_key2 - 1] = arguments[_key2];
      }

      observer.removeListener.apply(observer, [event].concat(data));
    };
    this.on = observer.on.bind(observer);
    this.off = observer.off.bind(observer);
    this.trigger = observer.trigger.bind(observer);
    this.playlistLoader = new _playlistLoader2.default(this);
    this.fragmentLoader = new _fragmentLoader2.default(this);
    this.levelController = new _levelController2.default(this);
    this.abrController = new config.abrController(this);
    this.bufferController = new config.bufferController(this);
    this.capLevelController = new config.capLevelController(this);
    this.streamController = new config.streamController(this);
    this.timelineController = new config.timelineController(this);
    this.keyLoader = new _keyLoader2.default(this);
    //this.fpsController = new FPSController(this);
  }

  _createClass(Hls, [{
    key: 'destroy',
    value: function destroy() {
      _logger.logger.log('destroy');
      this.trigger(_events2.default.DESTROYING);
      this.detachMedia();
      this.playlistLoader.destroy();
      this.fragmentLoader.destroy();
      this.levelController.destroy();
      this.bufferController.destroy();
      this.capLevelController.destroy();
      this.streamController.destroy();
      this.timelineController.destroy();
      this.keyLoader.destroy();
      //this.fpsController.destroy();
      this.url = null;
      this.observer.removeAllListeners();
    }
  }, {
    key: 'attachMedia',
    value: function attachMedia(media) {
      _logger.logger.log('attachMedia');
      this.media = media;
      this.trigger(_events2.default.MEDIA_ATTACHING, { media: media });
    }
  }, {
    key: 'detachMedia',
    value: function detachMedia() {
      _logger.logger.log('detachMedia');
      this.trigger(_events2.default.MEDIA_DETACHING);
      this.media = null;
    }
  }, {
    key: 'loadSource',
    value: function loadSource(url) {
      _logger.logger.log('loadSource:' + url);
      this.url = url;
      // when attaching to a source URL, trigger a playlist load
      this.trigger(_events2.default.MANIFEST_LOADING, { url: url });
    }
  }, {
    key: 'startLoad',
    value: function startLoad() {
      var startPosition = arguments.length <= 0 || arguments[0] === undefined ? 0 : arguments[0];

      _logger.logger.log('startLoad');
      this.levelController.startLoad();
      this.streamController.startLoad(startPosition);
    }
  }, {
    key: 'stopLoad',
    value: function stopLoad() {
      _logger.logger.log('stopLoad');
      this.levelController.stopLoad();
      this.streamController.stopLoad();
    }
  }, {
    key: 'swapAudioCodec',
    value: function swapAudioCodec() {
      _logger.logger.log('swapAudioCodec');
      this.streamController.swapAudioCodec();
    }
  }, {
    key: 'recoverMediaError',
    value: function recoverMediaError() {
      _logger.logger.log('recoverMediaError');
      var media = this.media;
      this.detachMedia();
      this.attachMedia(media);
    }

    /** Return all quality levels **/

  }, {
    key: 'levels',
    get: function get() {
      return this.levelController.levels;
    }

    /** Return current playback quality level **/

  }, {
    key: 'currentLevel',
    get: function get() {
      return this.streamController.currentLevel;
    }

    /* set quality level immediately (-1 for automatic level selection) */
    ,
    set: function set(newLevel) {
      _logger.logger.log('set currentLevel:' + newLevel);
      this.loadLevel = newLevel;
      this.streamController.immediateLevelSwitch();
    }

    /** Return next playback quality level (quality level of next fragment) **/

  }, {
    key: 'nextLevel',
    get: function get() {
      return this.streamController.nextLevel;
    }

    /* set quality level for next fragment (-1 for automatic level selection) */
    ,
    set: function set(newLevel) {
      _logger.logger.log('set nextLevel:' + newLevel);
      this.levelController.manualLevel = newLevel;
      this.streamController.nextLevelSwitch();
    }

    /** Return the quality level of current/last loaded fragment **/

  }, {
    key: 'loadLevel',
    get: function get() {
      return this.levelController.level;
    }

    /* set quality level for current/next loaded fragment (-1 for automatic level selection) */
    ,
    set: function set(newLevel) {
      _logger.logger.log('set loadLevel:' + newLevel);
      this.levelController.manualLevel = newLevel;
    }

    /** Return the quality level of next loaded fragment **/

  }, {
    key: 'nextLoadLevel',
    get: function get() {
      return this.levelController.nextLoadLevel;
    }

    /** set quality level of next loaded fragment **/
    ,
    set: function set(level) {
      this.levelController.nextLoadLevel = level;
    }

    /** Return first level (index of first level referenced in manifest)
    **/

  }, {
    key: 'firstLevel',
    get: function get() {
      return this.levelController.firstLevel;
    }

    /** set first level (index of first level referenced in manifest)
    **/
    ,
    set: function set(newLevel) {
      _logger.logger.log('set firstLevel:' + newLevel);
      this.levelController.firstLevel = newLevel;
    }

    /** Return start level (level of first fragment that will be played back)
        if not overrided by user, first level appearing in manifest will be used as start level
        if -1 : automatic start level selection, playback will start from level matching download bandwidth (determined from download of first segment)
    **/

  }, {
    key: 'startLevel',
    get: function get() {
      return this.levelController.startLevel;
    }

    /** set  start level (level of first fragment that will be played back)
        if not overrided by user, first level appearing in manifest will be used as start level
        if -1 : automatic start level selection, playback will start from level matching download bandwidth (determined from download of first segment)
    **/
    ,
    set: function set(newLevel) {
      _logger.logger.log('set startLevel:' + newLevel);
      this.levelController.startLevel = newLevel;
    }

    /** Return the capping/max level value that could be used by automatic level selection algorithm **/

  }, {
    key: 'autoLevelCapping',
    get: function get() {
      return this.abrController.autoLevelCapping;
    }

    /** set the capping/max level value that could be used by automatic level selection algorithm **/
    ,
    set: function set(newLevel) {
      _logger.logger.log('set autoLevelCapping:' + newLevel);
      this.abrController.autoLevelCapping = newLevel;
    }

    /* check if we are in automatic level selection mode */

  }, {
    key: 'autoLevelEnabled',
    get: function get() {
      return this.levelController.manualLevel === -1;
    }

    /* return manual level */

  }, {
    key: 'manualLevel',
    get: function get() {
      return this.levelController.manualLevel;
    }
  }]);

  return Hls;
}();

exports.default = Hls;

},{"./controller/abr-controller":3,"./controller/buffer-controller":4,"./controller/cap-level-controller":5,"./controller/level-controller":6,"./controller/stream-controller":7,"./controller/timeline-controller":8,"./errors":20,"./events":22,"./loader/fragment-loader":27,"./loader/key-loader":28,"./loader/playlist-loader":29,"./utils/logger":36,"./utils/xhr-loader":38,"events":1}],26:[function(require,module,exports){
'use strict';

// This is mostly for support of the es6 module export
// syntax with the babel compiler, it looks like it doesnt support
// function exports like we are used to in node/commonjs
module.exports = require('./hls.js').default;

},{"./hls.js":25}],27:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Fragment Loader
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var FragmentLoader = function (_EventHandler) {
  _inherits(FragmentLoader, _EventHandler);

  function FragmentLoader(hls) {
    _classCallCheck(this, FragmentLoader);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(FragmentLoader).call(this, hls, _events2.default.FRAG_LOADING));
  }

  _createClass(FragmentLoader, [{
    key: 'destroy',
    value: function destroy() {
      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onFragLoading',
    value: function onFragLoading(data) {
      var frag = data.frag;
      this.frag = frag;
      this.frag.loaded = 0;
      var config = this.hls.config;
      frag.loader = this.loader = typeof config.fLoader !== 'undefined' ? new config.fLoader(config) : new config.loader(config);
      this.loader.load(frag.url, 'arraybuffer', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), config.fragLoadingTimeOut, 1, 0, this.loadprogress.bind(this), frag);
    }
  }, {
    key: 'loadsuccess',
    value: function loadsuccess(event, stats) {
      var payload = event.currentTarget.response;
      stats.length = payload.byteLength;
      // detach fragment loader on load success
      this.frag.loader = undefined;
      this.hls.trigger(_events2.default.FRAG_LOADED, { payload: payload, frag: this.frag, stats: stats });
    }
  }, {
    key: 'loaderror',
    value: function loaderror(event) {
      if (this.loader) {
        this.loader.abort();
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.FRAG_LOAD_ERROR, fatal: false, frag: this.frag, response: event });
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout() {
      if (this.loader) {
        this.loader.abort();
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.FRAG_LOAD_TIMEOUT, fatal: false, frag: this.frag });
    }
  }, {
    key: 'loadprogress',
    value: function loadprogress(event, stats) {
      this.frag.loaded = stats.loaded;
      this.hls.trigger(_events2.default.FRAG_LOAD_PROGRESS, { frag: this.frag, stats: stats });
    }
  }]);

  return FragmentLoader;
}(_eventHandler2.default);

exports.default = FragmentLoader;

},{"../errors":20,"../event-handler":21,"../events":22}],28:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Decrypt key Loader
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var KeyLoader = function (_EventHandler) {
  _inherits(KeyLoader, _EventHandler);

  function KeyLoader(hls) {
    _classCallCheck(this, KeyLoader);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(KeyLoader).call(this, hls, _events2.default.KEY_LOADING));

    _this.decryptkey = null;
    _this.decrypturl = null;
    return _this;
  }

  _createClass(KeyLoader, [{
    key: 'destroy',
    value: function destroy() {
      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onKeyLoading',
    value: function onKeyLoading(data) {
      var frag = this.frag = data.frag,
          decryptdata = frag.decryptdata,
          uri = decryptdata.uri;
      // if uri is different from previous one or if decrypt key not retrieved yet
      if (uri !== this.decrypturl || this.decryptkey === null) {
        var config = this.hls.config;
        frag.loader = this.loader = new config.loader(config);
        this.decrypturl = uri;
        this.decryptkey = null;
        frag.loader.load(uri, 'arraybuffer', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), config.fragLoadingTimeOut, config.fragLoadingMaxRetry, config.fragLoadingRetryDelay, this.loadprogress.bind(this), frag);
      } else if (this.decryptkey) {
        // we already loaded this key, return it
        decryptdata.key = this.decryptkey;
        this.hls.trigger(_events2.default.KEY_LOADED, { frag: frag });
      }
    }
  }, {
    key: 'loadsuccess',
    value: function loadsuccess(event) {
      var frag = this.frag;
      this.decryptkey = frag.decryptdata.key = new Uint8Array(event.currentTarget.response);
      // detach fragment loader on load success
      frag.loader = undefined;
      this.hls.trigger(_events2.default.KEY_LOADED, { frag: frag });
    }
  }, {
    key: 'loaderror',
    value: function loaderror(event) {
      if (this.loader) {
        this.loader.abort();
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.KEY_LOAD_ERROR, fatal: false, frag: this.frag, response: event });
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout() {
      if (this.loader) {
        this.loader.abort();
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.KEY_LOAD_TIMEOUT, fatal: false, frag: this.frag });
    }
  }, {
    key: 'loadprogress',
    value: function loadprogress() {}
  }]);

  return KeyLoader;
}(_eventHandler2.default);

exports.default = KeyLoader;

},{"../errors":20,"../event-handler":21,"../events":22}],29:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _errors = require('../errors');

var _url = require('../utils/url');

var _url2 = _interopRequireDefault(_url);

var _attrList = require('../utils/attr-list');

var _attrList2 = _interopRequireDefault(_attrList);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Playlist Loader
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

//import {logger} from '../utils/logger';

var PlaylistLoader = function (_EventHandler) {
  _inherits(PlaylistLoader, _EventHandler);

  function PlaylistLoader(hls) {
    _classCallCheck(this, PlaylistLoader);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(PlaylistLoader).call(this, hls, _events2.default.MANIFEST_LOADING, _events2.default.LEVEL_LOADING));
  }

  _createClass(PlaylistLoader, [{
    key: 'destroy',
    value: function destroy() {
      if (this.loader) {
        this.loader.destroy();
        this.loader = null;
      }
      this.url = this.id = null;
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onManifestLoading',
    value: function onManifestLoading(data) {
      this.load(data.url, null);
    }
  }, {
    key: 'onLevelLoading',
    value: function onLevelLoading(data) {
      this.load(data.url, data.level, data.id);
    }
  }, {
    key: 'load',
    value: function load(url, id1, id2) {
      var config = this.hls.config,
          retry,
          timeout,
          retryDelay;
      this.url = url;
      this.id = id1;
      this.id2 = id2;
      if (this.id === null) {
        retry = config.manifestLoadingMaxRetry;
        timeout = config.manifestLoadingTimeOut;
        retryDelay = config.manifestLoadingRetryDelay;
      } else {
        retry = config.levelLoadingMaxRetry;
        timeout = config.levelLoadingTimeOut;
        retryDelay = config.levelLoadingRetryDelay;
      }
      this.loader = typeof config.pLoader !== 'undefined' ? new config.pLoader(config) : new config.loader(config);
      this.loader.load(url, '', this.loadsuccess.bind(this), this.loaderror.bind(this), this.loadtimeout.bind(this), timeout, retry, retryDelay);
    }
  }, {
    key: 'resolve',
    value: function resolve(url, baseUrl) {
      return _url2.default.buildAbsoluteURL(baseUrl, url);
    }
  }, {
    key: 'parseMasterPlaylist',
    value: function parseMasterPlaylist(string, baseurl) {
      var levels = [],
          result = void 0;

      // https://regex101.com is your friend
      var re = /#EXT-X-STREAM-INF:([^\n\r]*)[\r\n]+([^\r\n]+)/g;
      while ((result = re.exec(string)) != null) {
        var level = {};

        var attrs = level.attrs = new _attrList2.default(result[1]);
        level.url = this.resolve(result[2], baseurl);

        var resolution = attrs.decimalResolution('RESOLUTION');
        if (resolution) {
          level.width = resolution.width;
          level.height = resolution.height;
        }
        level.bitrate = attrs.decimalInteger('BANDWIDTH');
        level.name = attrs.NAME;

        var codecs = attrs.CODECS;
        if (codecs) {
          codecs = codecs.split(',');
          for (var i = 0; i < codecs.length; i++) {
            var codec = codecs[i];
            if (codec.indexOf('avc1') !== -1) {
              level.videoCodec = this.avc1toavcoti(codec);
            } else {
              level.audioCodec = codec;
            }
          }
        }

        levels.push(level);
      }
      return levels;
    }
  }, {
    key: 'avc1toavcoti',
    value: function avc1toavcoti(codec) {
      var result,
          avcdata = codec.split('.');
      if (avcdata.length > 2) {
        result = avcdata.shift() + '.';
        result += parseInt(avcdata.shift()).toString(16);
        result += ('000' + parseInt(avcdata.shift()).toString(16)).substr(-4);
      } else {
        result = codec;
      }
      return result;
    }
  }, {
    key: 'cloneObj',
    value: function cloneObj(obj) {
      return JSON.parse(JSON.stringify(obj));
    }
  }, {
    key: 'parseLevelPlaylist',
    value: function parseLevelPlaylist(string, baseurl, id) {
      var currentSN = 0,
          totalduration = 0,
          level = { url: baseurl, fragments: [], live: true, startSN: 0 },
          levelkey = { method: null, key: null, iv: null, uri: null },
          cc = 0,
          programDateTime = null,
          frag = null,
          result,
          regexp,
          byteRangeEndOffset,
          byteRangeStartOffset,
          nextTimestamp;

      regexp = /(?:#EXT-X-(MEDIA-SEQUENCE):(\d+))|(?:#EXT-X-(TARGETDURATION):(\d+))|(?:#EXT-X-(KEY):(.*))|(?:#EXT(INF):([\d\.]+)[^\r\n]*([\r\n]+[^#|\r\n]+)?)|(?:#EXT-X-(BYTERANGE):([\d]+[@[\d]*)]*[\r\n]+([^#|\r\n]+)?|(?:#EXT-X-(ENDLIST))|(?:#EXT-X-(DIS)CONTINUITY))|(?:#EXT-X-(PROGRAM-DATE-TIME):(.*))/g;
      while ((result = regexp.exec(string)) !== null) {
        result.shift();
        result = result.filter(function (n) {
          return n !== undefined;
        });
        switch (result[0]) {
          case 'MEDIA-SEQUENCE':
            currentSN = level.startSN = parseInt(result[1]);
            break;
          case 'TARGETDURATION':
            level.targetduration = parseFloat(result[1]);
            break;
          case 'ENDLIST':
            level.live = false;
            break;
          case 'DIS':
            cc++;
            break;
          case 'BYTERANGE':
            var params = result[1].split('@');
            if (params.length === 1) {
              byteRangeStartOffset = byteRangeEndOffset;
            } else {
              byteRangeStartOffset = parseInt(params[1]);
            }
            byteRangeEndOffset = parseInt(params[0]) + byteRangeStartOffset;
            if (frag && !frag.url) {
              frag.byteRangeStartOffset = byteRangeStartOffset;
              frag.byteRangeEndOffset = byteRangeEndOffset;
              frag.url = this.resolve(result[2], baseurl);
            }
            break;
          case 'INF':
            var duration = parseFloat(result[1]);
            if (!isNaN(duration)) {
              var fragdecryptdata,
                  sn = currentSN++;
              if (levelkey.method && levelkey.uri && !levelkey.iv) {
                fragdecryptdata = this.cloneObj(levelkey);
                var uint8View = new Uint8Array(16);
                for (var i = 12; i < 16; i++) {
                  uint8View[i] = sn >> 8 * (15 - i) & 0xff;
                }
                fragdecryptdata.iv = uint8View;
              } else {
                fragdecryptdata = levelkey;
              }
              var url = result[2] ? this.resolve(result[2], baseurl) : null;

              var r = /(\d+)_\d+.ts/;
              var match = r.exec(url);
              var timestamp = match && match[1] ? match[1] : null;

              if (timestamp && nextTimestamp) {
                timestamp = parseInt(timestamp);
                if (timestamp - nextTimestamp > 5000) {
                  cc++;
                }
              }

              nextTimestamp = timestamp + duration * 1000;

              frag = { url: url, duration: duration, start: totalduration, sn: sn, level: id, cc: cc, byteRangeStartOffset: byteRangeStartOffset, byteRangeEndOffset: byteRangeEndOffset, decryptdata: fragdecryptdata, programDateTime: programDateTime };
              level.fragments.push(frag);
              totalduration += duration;
              byteRangeStartOffset = null;
              programDateTime = null;
            }
            break;
          case 'KEY':
            // https://tools.ietf.org/html/draft-pantos-http-live-streaming-08#section-3.4.4
            var decryptparams = result[1];
            var keyAttrs = new _attrList2.default(decryptparams);
            var decryptmethod = keyAttrs.enumeratedString('METHOD'),
                decrypturi = keyAttrs.URI,
                decryptiv = keyAttrs.hexadecimalInteger('IV');
            if (decryptmethod) {
              levelkey = { method: null, key: null, iv: null, uri: null };
              if (decrypturi && decryptmethod === 'AES-128') {
                levelkey.method = decryptmethod;
                // URI to get the key
                levelkey.uri = this.resolve(decrypturi, baseurl);
                levelkey.key = null;
                // Initialization Vector (IV)
                levelkey.iv = decryptiv;
              }
            }
            break;
          case 'PROGRAM-DATE-TIME':
            programDateTime = new Date(Date.parse(result[1]));
            break;
          default:
            break;
        }
      }
      //logger.log('found ' + level.fragments.length + ' fragments');
      if (frag && !frag.url) {
        level.fragments.pop();
        totalduration -= frag.duration;
      }
      level.totalduration = totalduration;
      level.endSN = currentSN - 1;
      return level;
    }
  }, {
    key: 'loadsuccess',
    value: function loadsuccess(event, stats) {
      var target = event.currentTarget,
          string = target.responseText,
          url = target.responseURL,
          id = this.id,
          id2 = this.id2,
          hls = this.hls,
          levels;
      // responseURL not supported on some browsers (it is used to detect URL redirection)
      if (url === undefined) {
        // fallback to initial URL
        url = this.url;
      }
      stats.tload = performance.now();
      stats.mtime = new Date(target.getResponseHeader('Last-Modified'));
      if (string.indexOf('#EXTM3U') === 0) {
        if (string.indexOf('#EXTINF:') > 0) {
          // 1 level playlist
          // if first request, fire manifest loaded event, level will be reloaded afterwards
          // (this is to have a uniform logic for 1 level/multilevel playlists)
          if (this.id === null) {
            hls.trigger(_events2.default.MANIFEST_LOADED, { levels: [{ url: url }], url: url, stats: stats });
          } else {
            var levelDetails = this.parseLevelPlaylist(string, url, id);
            stats.tparsed = performance.now();
            hls.trigger(_events2.default.LEVEL_LOADED, { details: levelDetails, level: id, id: id2, stats: stats });
          }
        } else {
          levels = this.parseMasterPlaylist(string, url);
          // multi level playlist, parse level info
          if (levels.length) {
            hls.trigger(_events2.default.MANIFEST_LOADED, { levels: levels, url: url, stats: stats });
          } else {
            hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.MANIFEST_PARSING_ERROR, fatal: true, url: url, reason: 'no level found in manifest' });
          }
        }
      } else {
        hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: _errors.ErrorDetails.MANIFEST_PARSING_ERROR, fatal: true, url: url, reason: 'no EXTM3U delimiter' });
      }
    }
  }, {
    key: 'loaderror',
    value: function loaderror(event) {
      var details, fatal;
      if (this.id === null) {
        details = _errors.ErrorDetails.MANIFEST_LOAD_ERROR;
        fatal = true;
      } else {
        details = _errors.ErrorDetails.LEVEL_LOAD_ERROR;
        fatal = false;
      }
      if (this.loader) {
        this.loader.abort();
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: details, fatal: fatal, url: this.url, loader: this.loader, response: event.currentTarget, level: this.id, id: this.id2 });
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout() {
      var details, fatal;
      if (this.id === null) {
        details = _errors.ErrorDetails.MANIFEST_LOAD_TIMEOUT;
        fatal = true;
      } else {
        details = _errors.ErrorDetails.LEVEL_LOAD_TIMEOUT;
        fatal = false;
      }
      if (this.loader) {
        this.loader.abort();
      }
      this.hls.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.NETWORK_ERROR, details: details, fatal: fatal, url: this.url, loader: this.loader, level: this.id, id: this.id2 });
    }
  }]);

  return PlaylistLoader;
}(_eventHandler2.default);

exports.default = PlaylistLoader;

},{"../errors":20,"../event-handler":21,"../events":22,"../utils/attr-list":33,"../utils/url":37}],30:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Generate MP4 Box
*/

//import Hex from '../utils/hex';

var MP4 = function () {
  function MP4() {
    _classCallCheck(this, MP4);
  }

  _createClass(MP4, null, [{
    key: 'init',
    value: function init() {
      MP4.types = {
        avc1: [], // codingname
        avcC: [],
        btrt: [],
        dinf: [],
        dref: [],
        esds: [],
        ftyp: [],
        hdlr: [],
        mdat: [],
        mdhd: [],
        mdia: [],
        mfhd: [],
        minf: [],
        moof: [],
        moov: [],
        mp4a: [],
        mvex: [],
        mvhd: [],
        sdtp: [],
        stbl: [],
        stco: [],
        stsc: [],
        stsd: [],
        stsz: [],
        stts: [],
        tfdt: [],
        tfhd: [],
        traf: [],
        trak: [],
        trun: [],
        trex: [],
        tkhd: [],
        vmhd: [],
        smhd: []
      };

      var i;
      for (i in MP4.types) {
        if (MP4.types.hasOwnProperty(i)) {
          MP4.types[i] = [i.charCodeAt(0), i.charCodeAt(1), i.charCodeAt(2), i.charCodeAt(3)];
        }
      }

      var videoHdlr = new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00, // pre_defined
      0x76, 0x69, 0x64, 0x65, // handler_type: 'vide'
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x56, 0x69, 0x64, 0x65, 0x6f, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0x00 // name: 'VideoHandler'
      ]);

      var audioHdlr = new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00, // pre_defined
      0x73, 0x6f, 0x75, 0x6e, // handler_type: 'soun'
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x53, 0x6f, 0x75, 0x6e, 0x64, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0x00 // name: 'SoundHandler'
      ]);

      MP4.HDLR_TYPES = {
        'video': videoHdlr,
        'audio': audioHdlr
      };

      var dref = new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x01, // entry_count
      0x00, 0x00, 0x00, 0x0c, // entry_size
      0x75, 0x72, 0x6c, 0x20, // 'url' type
      0x00, // version 0
      0x00, 0x00, 0x01 // entry_flags
      ]);

      var stco = new Uint8Array([0x00, // version
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00 // entry_count
      ]);

      MP4.STTS = MP4.STSC = MP4.STCO = stco;

      MP4.STSZ = new Uint8Array([0x00, // version
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x00, // sample_size
      0x00, 0x00, 0x00, 0x00]);
      // sample_count
      MP4.VMHD = new Uint8Array([0x00, // version
      0x00, 0x00, 0x01, // flags
      0x00, 0x00, // graphicsmode
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00 // opcolor
      ]);
      MP4.SMHD = new Uint8Array([0x00, // version
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, // balance
      0x00, 0x00 // reserved
      ]);

      MP4.STSD = new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x01]); // entry_count

      var majorBrand = new Uint8Array([105, 115, 111, 109]); // isom
      var avc1Brand = new Uint8Array([97, 118, 99, 49]); // avc1
      var minorVersion = new Uint8Array([0, 0, 0, 1]);

      MP4.FTYP = MP4.box(MP4.types.ftyp, majorBrand, minorVersion, majorBrand, avc1Brand);
      MP4.DINF = MP4.box(MP4.types.dinf, MP4.box(MP4.types.dref, dref));
    }
  }, {
    key: 'box',
    value: function box(type) {
      var payload = Array.prototype.slice.call(arguments, 1),
          size = 8,
          i = payload.length,
          len = i,
          result;
      // calculate the total size we need to allocate
      while (i--) {
        size += payload[i].byteLength;
      }
      result = new Uint8Array(size);
      result[0] = size >> 24 & 0xff;
      result[1] = size >> 16 & 0xff;
      result[2] = size >> 8 & 0xff;
      result[3] = size & 0xff;
      result.set(type, 4);
      // copy the payload into the result
      for (i = 0, size = 8; i < len; i++) {
        // copy payload[i] array @ offset size
        result.set(payload[i], size);
        size += payload[i].byteLength;
      }
      return result;
    }
  }, {
    key: 'hdlr',
    value: function hdlr(type) {
      return MP4.box(MP4.types.hdlr, MP4.HDLR_TYPES[type]);
    }
  }, {
    key: 'mdat',
    value: function mdat(data) {
      return MP4.box(MP4.types.mdat, data);
    }
  }, {
    key: 'mdhd',
    value: function mdhd(timescale, duration) {
      duration *= timescale;
      return MP4.box(MP4.types.mdhd, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x02, // creation_time
      0x00, 0x00, 0x00, 0x03, // modification_time
      timescale >> 24 & 0xFF, timescale >> 16 & 0xFF, timescale >> 8 & 0xFF, timescale & 0xFF, // timescale
      duration >> 24, duration >> 16 & 0xFF, duration >> 8 & 0xFF, duration & 0xFF, // duration
      0x55, 0xc4, // 'und' language (undetermined)
      0x00, 0x00]));
    }
  }, {
    key: 'mdia',
    value: function mdia(track) {
      return MP4.box(MP4.types.mdia, MP4.mdhd(track.timescale, track.duration), MP4.hdlr(track.type), MP4.minf(track));
    }
  }, {
    key: 'mfhd',
    value: function mfhd(sequenceNumber) {
      return MP4.box(MP4.types.mfhd, new Uint8Array([0x00, 0x00, 0x00, 0x00, // flags
      sequenceNumber >> 24, sequenceNumber >> 16 & 0xFF, sequenceNumber >> 8 & 0xFF, sequenceNumber & 0xFF]));
    }
  }, {
    key: 'minf',
    // sequence_number
    value: function minf(track) {
      if (track.type === 'audio') {
        return MP4.box(MP4.types.minf, MP4.box(MP4.types.smhd, MP4.SMHD), MP4.DINF, MP4.stbl(track));
      } else {
        return MP4.box(MP4.types.minf, MP4.box(MP4.types.vmhd, MP4.VMHD), MP4.DINF, MP4.stbl(track));
      }
    }
  }, {
    key: 'moof',
    value: function moof(sn, baseMediaDecodeTime, track) {
      return MP4.box(MP4.types.moof, MP4.mfhd(sn), MP4.traf(track, baseMediaDecodeTime));
    }
    /**
     * @param tracks... (optional) {array} the tracks associated with this movie
     */

  }, {
    key: 'moov',
    value: function moov(tracks) {
      var i = tracks.length,
          boxes = [];

      while (i--) {
        boxes[i] = MP4.trak(tracks[i]);
      }

      return MP4.box.apply(null, [MP4.types.moov, MP4.mvhd(tracks[0].timescale, tracks[0].duration)].concat(boxes).concat(MP4.mvex(tracks)));
    }
  }, {
    key: 'mvex',
    value: function mvex(tracks) {
      var i = tracks.length,
          boxes = [];

      while (i--) {
        boxes[i] = MP4.trex(tracks[i]);
      }
      return MP4.box.apply(null, [MP4.types.mvex].concat(boxes));
    }
  }, {
    key: 'mvhd',
    value: function mvhd(timescale, duration) {
      duration *= timescale;
      var bytes = new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      0x00, 0x00, 0x00, 0x01, // creation_time
      0x00, 0x00, 0x00, 0x02, // modification_time
      timescale >> 24 & 0xFF, timescale >> 16 & 0xFF, timescale >> 8 & 0xFF, timescale & 0xFF, // timescale
      duration >> 24 & 0xFF, duration >> 16 & 0xFF, duration >> 8 & 0xFF, duration & 0xFF, // duration
      0x00, 0x01, 0x00, 0x00, // 1.0 rate
      0x01, 0x00, // 1.0 volume
      0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00, // transformation: unity matrix
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // pre_defined
      0xff, 0xff, 0xff, 0xff // next_track_ID
      ]);
      return MP4.box(MP4.types.mvhd, bytes);
    }
  }, {
    key: 'sdtp',
    value: function sdtp(track) {
      var samples = track.samples || [],
          bytes = new Uint8Array(4 + samples.length),
          flags,
          i;
      // leave the full box header (4 bytes) all zero
      // write the sample table
      for (i = 0; i < samples.length; i++) {
        flags = samples[i].flags;
        bytes[i + 4] = flags.dependsOn << 4 | flags.isDependedOn << 2 | flags.hasRedundancy;
      }

      return MP4.box(MP4.types.sdtp, bytes);
    }
  }, {
    key: 'stbl',
    value: function stbl(track) {
      return MP4.box(MP4.types.stbl, MP4.stsd(track), MP4.box(MP4.types.stts, MP4.STTS), MP4.box(MP4.types.stsc, MP4.STSC), MP4.box(MP4.types.stsz, MP4.STSZ), MP4.box(MP4.types.stco, MP4.STCO));
    }
  }, {
    key: 'avc1',
    value: function avc1(track) {
      var sps = [],
          pps = [],
          i,
          data,
          len;
      // assemble the SPSs

      for (i = 0; i < track.sps.length; i++) {
        data = track.sps[i];
        len = data.byteLength;
        sps.push(len >>> 8 & 0xFF);
        sps.push(len & 0xFF);
        sps = sps.concat(Array.prototype.slice.call(data)); // SPS
      }

      // assemble the PPSs
      for (i = 0; i < track.pps.length; i++) {
        data = track.pps[i];
        len = data.byteLength;
        pps.push(len >>> 8 & 0xFF);
        pps.push(len & 0xFF);
        pps = pps.concat(Array.prototype.slice.call(data));
      }

      var avcc = MP4.box(MP4.types.avcC, new Uint8Array([0x01, // version
      sps[3], // profile
      sps[4], // profile compat
      sps[5], // level
      0xfc | 3, // lengthSizeMinusOne, hard-coded to 4 bytes
      0xE0 | track.sps.length // 3bit reserved (111) + numOfSequenceParameterSets
      ].concat(sps).concat([track.pps.length // numOfPictureParameterSets
      ]).concat(pps))),
          // "PPS"
      width = track.width,
          height = track.height;
      //console.log('avcc:' + Hex.hexDump(avcc));
      return MP4.box(MP4.types.avc1, new Uint8Array([0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, // reserved
      0x00, 0x01, // data_reference_index
      0x00, 0x00, // pre_defined
      0x00, 0x00, // reserved
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // pre_defined
      width >> 8 & 0xFF, width & 0xff, // width
      height >> 8 & 0xFF, height & 0xff, // height
      0x00, 0x48, 0x00, 0x00, // horizresolution
      0x00, 0x48, 0x00, 0x00, // vertresolution
      0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x01, // frame_count
      0x12, 0x64, 0x61, 0x69, 0x6C, //dailymotion/hls.js
      0x79, 0x6D, 0x6F, 0x74, 0x69, 0x6F, 0x6E, 0x2F, 0x68, 0x6C, 0x73, 0x2E, 0x6A, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // compressorname
      0x00, 0x18, // depth = 24
      0x11, 0x11]), // pre_defined = -1
      avcc, MP4.box(MP4.types.btrt, new Uint8Array([0x00, 0x1c, 0x9c, 0x80, // bufferSizeDB
      0x00, 0x2d, 0xc6, 0xc0, // maxBitrate
      0x00, 0x2d, 0xc6, 0xc0])) // avgBitrate
      );
    }
  }, {
    key: 'esds',
    value: function esds(track) {
      var configlen = track.config.length;
      return new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags

      0x03, // descriptor_type
      0x17 + configlen, // length
      0x00, 0x01, //es_id
      0x00, // stream_priority

      0x04, // descriptor_type
      0x0f + configlen, // length
      0x40, //codec : mpeg4_audio
      0x15, // stream_type
      0x00, 0x00, 0x00, // buffer_size
      0x00, 0x00, 0x00, 0x00, // maxBitrate
      0x00, 0x00, 0x00, 0x00, // avgBitrate

      0x05 // descriptor_type
      ].concat([configlen]).concat(track.config).concat([0x06, 0x01, 0x02])); // GASpecificConfig)); // length + audio config descriptor
    }
  }, {
    key: 'mp4a',
    value: function mp4a(track) {
      var audiosamplerate = track.audiosamplerate;
      return MP4.box(MP4.types.mp4a, new Uint8Array([0x00, 0x00, 0x00, // reserved
      0x00, 0x00, 0x00, // reserved
      0x00, 0x01, // data_reference_index
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // reserved
      0x00, track.channelCount, // channelcount
      0x00, 0x10, // sampleSize:16bits
      0x00, 0x00, 0x00, 0x00, // reserved2
      audiosamplerate >> 8 & 0xFF, audiosamplerate & 0xff, //
      0x00, 0x00]), MP4.box(MP4.types.esds, MP4.esds(track)));
    }
  }, {
    key: 'stsd',
    value: function stsd(track) {
      if (track.type === 'audio') {
        return MP4.box(MP4.types.stsd, MP4.STSD, MP4.mp4a(track));
      } else {
        return MP4.box(MP4.types.stsd, MP4.STSD, MP4.avc1(track));
      }
    }
  }, {
    key: 'tkhd',
    value: function tkhd(track) {
      var id = track.id,
          duration = track.duration * track.timescale,
          width = track.width,
          height = track.height;
      return MP4.box(MP4.types.tkhd, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x07, // flags
      0x00, 0x00, 0x00, 0x00, // creation_time
      0x00, 0x00, 0x00, 0x00, // modification_time
      id >> 24 & 0xFF, id >> 16 & 0xFF, id >> 8 & 0xFF, id & 0xFF, // track_ID
      0x00, 0x00, 0x00, 0x00, // reserved
      duration >> 24, duration >> 16 & 0xFF, duration >> 8 & 0xFF, duration & 0xFF, // duration
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // reserved
      0x00, 0x00, // layer
      0x00, 0x00, // alternate_group
      0x00, 0x00, // non-audio track volume
      0x00, 0x00, // reserved
      0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00, // transformation: unity matrix
      width >> 8 & 0xFF, width & 0xFF, 0x00, 0x00, // width
      height >> 8 & 0xFF, height & 0xFF, 0x00, 0x00 // height
      ]));
    }
  }, {
    key: 'traf',
    value: function traf(track, baseMediaDecodeTime) {
      var sampleDependencyTable = MP4.sdtp(track),
          id = track.id;
      return MP4.box(MP4.types.traf, MP4.box(MP4.types.tfhd, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      id >> 24, id >> 16 & 0XFF, id >> 8 & 0XFF, id & 0xFF])), // track_ID
      MP4.box(MP4.types.tfdt, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      baseMediaDecodeTime >> 24, baseMediaDecodeTime >> 16 & 0XFF, baseMediaDecodeTime >> 8 & 0XFF, baseMediaDecodeTime & 0xFF])), // baseMediaDecodeTime
      MP4.trun(track, sampleDependencyTable.length + 16 + // tfhd
      16 + // tfdt
      8 + // traf header
      16 + // mfhd
      8 + // moof header
      8), // mdat header
      sampleDependencyTable);
    }

    /**
     * Generate a track box.
     * @param track {object} a track definition
     * @return {Uint8Array} the track box
     */

  }, {
    key: 'trak',
    value: function trak(track) {
      track.duration = track.duration || 0xffffffff;
      return MP4.box(MP4.types.trak, MP4.tkhd(track), MP4.mdia(track));
    }
  }, {
    key: 'trex',
    value: function trex(track) {
      var id = track.id;
      return MP4.box(MP4.types.trex, new Uint8Array([0x00, // version 0
      0x00, 0x00, 0x00, // flags
      id >> 24, id >> 16 & 0XFF, id >> 8 & 0XFF, id & 0xFF, // track_ID
      0x00, 0x00, 0x00, 0x01, // default_sample_description_index
      0x00, 0x00, 0x00, 0x00, // default_sample_duration
      0x00, 0x00, 0x00, 0x00, // default_sample_size
      0x00, 0x01, 0x00, 0x01 // default_sample_flags
      ]));
    }
  }, {
    key: 'trun',
    value: function trun(track, offset) {
      var samples = track.samples || [],
          len = samples.length,
          arraylen = 12 + 16 * len,
          array = new Uint8Array(arraylen),
          i,
          sample,
          duration,
          size,
          flags,
          cts;
      offset += 8 + arraylen;
      array.set([0x00, // version 0
      0x00, 0x0f, 0x01, // flags
      len >>> 24 & 0xFF, len >>> 16 & 0xFF, len >>> 8 & 0xFF, len & 0xFF, // sample_count
      offset >>> 24 & 0xFF, offset >>> 16 & 0xFF, offset >>> 8 & 0xFF, offset & 0xFF // data_offset
      ], 0);
      for (i = 0; i < len; i++) {
        sample = samples[i];
        duration = sample.duration;
        size = sample.size;
        flags = sample.flags;
        cts = sample.cts;
        array.set([duration >>> 24 & 0xFF, duration >>> 16 & 0xFF, duration >>> 8 & 0xFF, duration & 0xFF, // sample_duration
        size >>> 24 & 0xFF, size >>> 16 & 0xFF, size >>> 8 & 0xFF, size & 0xFF, // sample_size
        flags.isLeading << 2 | flags.dependsOn, flags.isDependedOn << 6 | flags.hasRedundancy << 4 | flags.paddingValue << 1 | flags.isNonSync, flags.degradPrio & 0xF0 << 8, flags.degradPrio & 0x0F, // sample_flags
        cts >>> 24 & 0xFF, cts >>> 16 & 0xFF, cts >>> 8 & 0xFF, cts & 0xFF // sample_composition_time_offset
        ], 12 + 16 * i);
      }
      return MP4.box(MP4.types.trun, array);
    }
  }, {
    key: 'initSegment',
    value: function initSegment(tracks) {
      if (!MP4.types) {
        MP4.init();
      }
      var movie = MP4.moov(tracks),
          result;
      result = new Uint8Array(MP4.FTYP.byteLength + movie.byteLength);
      result.set(MP4.FTYP);
      result.set(movie, MP4.FTYP.byteLength);
      return result;
    }
  }]);

  return MP4;
}();

exports.default = MP4;

},{}],31:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * fMP4 remuxer
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _logger = require('../utils/logger');

var _mp4Generator = require('../remux/mp4-generator');

var _mp4Generator2 = _interopRequireDefault(_mp4Generator);

var _errors = require('../errors');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MP4Remuxer = function () {
  function MP4Remuxer(observer) {
    _classCallCheck(this, MP4Remuxer);

    this.observer = observer;
    this.ISGenerated = false;
    this.PES2MP4SCALEFACTOR = 4;
    this.PES_TIMESCALE = 90000;
    this.MP4_TIMESCALE = this.PES_TIMESCALE / this.PES2MP4SCALEFACTOR;
  }

  _createClass(MP4Remuxer, [{
    key: 'destroy',
    value: function destroy() {}
  }, {
    key: 'insertDiscontinuity',
    value: function insertDiscontinuity() {
      this._initPTS = this._initDTS = this.nextAacPts = this.nextAvcDts = undefined;
    }
  }, {
    key: 'switchLevel',
    value: function switchLevel() {
      this.ISGenerated = false;
    }
  }, {
    key: 'remux',
    value: function remux(audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous) {
      // generate Init Segment if needed
      if (!this.ISGenerated) {
        this.generateIS(audioTrack, videoTrack, timeOffset);
      }
      //logger.log('nb AVC samples:' + videoTrack.samples.length);
      if (videoTrack.samples.length) {
        this.remuxVideo(videoTrack, timeOffset, contiguous);
      }
      //logger.log('nb AAC samples:' + audioTrack.samples.length);
      if (audioTrack.samples.length) {
        this.remuxAudio(audioTrack, timeOffset, contiguous);
      }
      //logger.log('nb ID3 samples:' + audioTrack.samples.length);
      if (id3Track.samples.length) {
        this.remuxID3(id3Track, timeOffset);
      }
      //logger.log('nb ID3 samples:' + audioTrack.samples.length);
      if (textTrack.samples.length) {
        this.remuxText(textTrack, timeOffset);
      }
      //notify end of parsing
      this.observer.trigger(_events2.default.FRAG_PARSED);
    }
  }, {
    key: 'generateIS',
    value: function generateIS(audioTrack, videoTrack, timeOffset) {
      var observer = this.observer,
          audioSamples = audioTrack.samples,
          videoSamples = videoTrack.samples,
          pesTimeScale = this.PES_TIMESCALE,
          tracks = {},
          data = { tracks: tracks, unique: false },
          computePTSDTS = this._initPTS === undefined,
          initPTS,
          initDTS;

      if (computePTSDTS) {
        initPTS = initDTS = Infinity;
      }
      if (audioTrack.config && audioSamples.length) {
        audioTrack.timescale = audioTrack.audiosamplerate;
        // MP4 duration (track duration in seconds multiplied by timescale) is coded on 32 bits
        // we know that each AAC sample contains 1024 frames....
        // in order to avoid overflowing the 32 bit counter for large duration, we use smaller timescale (timescale/gcd)
        // we just need to ensure that AAC sample duration will still be an integer (will be 1024/gcd)
        if (audioTrack.timescale * audioTrack.duration > Math.pow(2, 32)) {
          (function () {
            var greatestCommonDivisor = function greatestCommonDivisor(a, b) {
              if (!b) {
                return a;
              }
              return greatestCommonDivisor(b, a % b);
            };
            audioTrack.timescale = audioTrack.audiosamplerate / greatestCommonDivisor(audioTrack.audiosamplerate, 1024);
          })();
        }
        _logger.logger.log('audio mp4 timescale :' + audioTrack.timescale);
        tracks.audio = {
          container: 'audio/mp4',
          codec: audioTrack.codec,
          initSegment: _mp4Generator2.default.initSegment([audioTrack]),
          metadata: {
            channelCount: audioTrack.channelCount
          }
        };
        if (computePTSDTS) {
          // remember first PTS of this demuxing context. for audio, PTS + DTS ...
          initPTS = initDTS = audioSamples[0].pts - pesTimeScale * timeOffset;
        }
      }

      if (videoTrack.sps && videoTrack.pps && videoSamples.length) {
        videoTrack.timescale = this.MP4_TIMESCALE;
        tracks.video = {
          container: 'video/mp4',
          codec: videoTrack.codec,
          initSegment: _mp4Generator2.default.initSegment([videoTrack]),
          metadata: {
            width: videoTrack.width,
            height: videoTrack.height
          }
        };
        if (computePTSDTS) {
          initPTS = Math.min(initPTS, videoSamples[0].pts - pesTimeScale * timeOffset);
          initDTS = Math.min(initDTS, videoSamples[0].dts - pesTimeScale * timeOffset);
        }
      }

      if (!Object.keys(tracks)) {
        observer.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: false, reason: 'no audio/video samples found' });
      } else {
        observer.trigger(_events2.default.FRAG_PARSING_INIT_SEGMENT, data);
        this.ISGenerated = true;
        if (computePTSDTS) {
          this._initPTS = initPTS;
          this._initDTS = initDTS;
        }
      }
    }
  }, {
    key: 'remuxVideo',
    value: function remuxVideo(track, timeOffset, contiguous) {
      var view,
          offset = 8,
          pesTimeScale = this.PES_TIMESCALE,
          pes2mp4ScaleFactor = this.PES2MP4SCALEFACTOR,
          avcSample,
          mp4Sample,
          mp4SampleLength,
          unit,
          mdat,
          moof,
          firstPTS,
          firstDTS,
          lastDTS,
          pts,
          dts,
          ptsnorm,
          dtsnorm,
          flags,
          samples = [];
      /* concatenate the video data and construct the mdat in place
        (need 8 more bytes to fill length and mpdat type) */
      mdat = new Uint8Array(track.len + 4 * track.nbNalu + 8);
      view = new DataView(mdat.buffer);
      view.setUint32(0, mdat.byteLength);
      mdat.set(_mp4Generator2.default.types.mdat, 4);
      while (track.samples.length) {
        avcSample = track.samples.shift();
        mp4SampleLength = 0;
        // convert NALU bitstream to MP4 format (prepend NALU with size field)
        while (avcSample.units.units.length) {
          unit = avcSample.units.units.shift();
          view.setUint32(offset, unit.data.byteLength);
          offset += 4;
          mdat.set(unit.data, offset);
          offset += unit.data.byteLength;
          mp4SampleLength += 4 + unit.data.byteLength;
        }
        pts = avcSample.pts - this._initDTS;
        dts = avcSample.dts - this._initDTS;
        // ensure DTS is not bigger than PTS
        dts = Math.min(pts, dts);
        //logger.log(`Video/PTS/DTS:${Math.round(pts/90)}/${Math.round(dts/90)}`);
        // if not first AVC sample of video track, normalize PTS/DTS with previous sample value
        // and ensure that sample duration is positive
        if (lastDTS !== undefined) {
          ptsnorm = this._PTSNormalize(pts, lastDTS);
          dtsnorm = this._PTSNormalize(dts, lastDTS);
          var sampleDuration = (dtsnorm - lastDTS) / pes2mp4ScaleFactor;
          if (sampleDuration <= 0) {
            _logger.logger.log('invalid sample duration at PTS/DTS: ' + avcSample.pts + '/' + avcSample.dts + ':' + sampleDuration);
            sampleDuration = 1;
          }
          mp4Sample.duration = sampleDuration;
        } else {
          var nextAvcDts = void 0,
              delta = void 0;
          if (contiguous) {
            nextAvcDts = this.nextAvcDts;
          } else {
            nextAvcDts = timeOffset * pesTimeScale;
          }
          // first AVC sample of video track, normalize PTS/DTS
          ptsnorm = this._PTSNormalize(pts, nextAvcDts);
          dtsnorm = this._PTSNormalize(dts, nextAvcDts);
          delta = Math.round((dtsnorm - nextAvcDts) / 90);
          // if fragment are contiguous, or delta less than 600ms, ensure there is no overlap/hole between fragments
          if (contiguous || Math.abs(delta) < 600) {
            if (delta) {
              if (delta > 1) {
                _logger.logger.log('AVC:' + delta + ' ms hole between fragments detected,filling it');
              } else if (delta < -1) {
                _logger.logger.log('AVC:' + -delta + ' ms overlapping between fragments detected');
              }
              // set DTS to next DTS
              dtsnorm = nextAvcDts;
              // offset PTS as well, ensure that PTS is smaller or equal than new DTS
              ptsnorm = Math.max(ptsnorm - delta, dtsnorm);
              _logger.logger.log('Video/PTS/DTS adjusted: ' + ptsnorm + '/' + dtsnorm + ',delta:' + delta);
            }
          }
          // remember first PTS of our avcSamples, ensure value is positive
          firstPTS = Math.max(0, ptsnorm);
          firstDTS = Math.max(0, dtsnorm);
        }
        //console.log('PTS/DTS/initDTS/normPTS/normDTS/relative PTS : ${avcSample.pts}/${avcSample.dts}/${this._initDTS}/${ptsnorm}/${dtsnorm}/${(avcSample.pts/4294967296).toFixed(3)}');
        mp4Sample = {
          size: mp4SampleLength,
          duration: 0,
          cts: (ptsnorm - dtsnorm) / pes2mp4ScaleFactor,
          flags: {
            isLeading: 0,
            isDependedOn: 0,
            hasRedundancy: 0,
            degradPrio: 0
          }
        };
        flags = mp4Sample.flags;
        if (avcSample.key === true) {
          // the current sample is a key frame
          flags.dependsOn = 2;
          flags.isNonSync = 0;
        } else {
          flags.dependsOn = 1;
          flags.isNonSync = 1;
        }
        samples.push(mp4Sample);
        lastDTS = dtsnorm;
      }
      var lastSampleDuration = 0;
      if (samples.length >= 2) {
        lastSampleDuration = samples[samples.length - 2].duration;
        mp4Sample.duration = lastSampleDuration;
      }
      // next AVC sample DTS should be equal to last sample DTS + last sample duration
      this.nextAvcDts = dtsnorm + lastSampleDuration * pes2mp4ScaleFactor;
      track.len = 0;
      track.nbNalu = 0;
      if (samples.length && navigator.userAgent.toLowerCase().indexOf('chrome') > -1) {
        flags = samples[0].flags;
        // chrome workaround, mark first sample as being a Random Access Point to avoid sourcebuffer append issue
        // https://code.google.com/p/chromium/issues/detail?id=229412
        flags.dependsOn = 2;
        flags.isNonSync = 0;
      }
      track.samples = samples;
      moof = _mp4Generator2.default.moof(track.sequenceNumber++, firstDTS / pes2mp4ScaleFactor, track);
      track.samples = [];
      this.observer.trigger(_events2.default.FRAG_PARSING_DATA, {
        data1: moof,
        data2: mdat,
        startPTS: firstPTS / pesTimeScale,
        endPTS: (ptsnorm + pes2mp4ScaleFactor * lastSampleDuration) / pesTimeScale,
        startDTS: firstDTS / pesTimeScale,
        endDTS: this.nextAvcDts / pesTimeScale,
        type: 'video',
        nb: samples.length
      });
    }
  }, {
    key: 'remuxAudio',
    value: function remuxAudio(track, timeOffset, contiguous) {
      var view,
          offset = 8,
          pesTimeScale = this.PES_TIMESCALE,
          mp4timeScale = track.timescale,
          pes2mp4ScaleFactor = pesTimeScale / mp4timeScale,
          expectedSampleDuration = track.timescale * 1024 / track.audiosamplerate,
          aacSample,
          mp4Sample,
          unit,
          mdat,
          moof,
          firstPTS,
          firstDTS,
          lastDTS,
          pts,
          dts,
          ptsnorm,
          dtsnorm,
          samples = [],
          samples0 = [];

      track.samples.sort(function (a, b) {
        return a.pts - b.pts;
      });
      samples0 = track.samples;

      while (samples0.length) {
        aacSample = samples0.shift();
        unit = aacSample.unit;
        pts = aacSample.pts - this._initDTS;
        dts = aacSample.dts - this._initDTS;
        //logger.log(`Audio/PTS:${Math.round(pts/90)}`);
        // if not first sample
        if (lastDTS !== undefined) {
          ptsnorm = this._PTSNormalize(pts, lastDTS);
          dtsnorm = this._PTSNormalize(dts, lastDTS);
          // let's compute sample duration.
          // sample Duration should be close to expectedSampleDuration
          mp4Sample.duration = (dtsnorm - lastDTS) / pes2mp4ScaleFactor;
          if (Math.abs(mp4Sample.duration - expectedSampleDuration) > expectedSampleDuration / 10) {
            // more than 10% diff between sample duration and expectedSampleDuration .... lets log that
            _logger.logger.log('invalid AAC sample duration at PTS ' + Math.round(pts / 90) + ',should be 1024,found :' + Math.round(mp4Sample.duration * track.audiosamplerate / track.timescale));
          }
          // always adjust sample duration to avoid av sync issue
          mp4Sample.duration = expectedSampleDuration;
          dtsnorm = expectedSampleDuration * pes2mp4ScaleFactor + lastDTS;
        } else {
          var nextAacPts = void 0,
              delta = void 0;
          if (contiguous) {
            nextAacPts = this.nextAacPts;
          } else {
            nextAacPts = timeOffset * pesTimeScale;
          }
          ptsnorm = this._PTSNormalize(pts, nextAacPts);
          dtsnorm = this._PTSNormalize(dts, nextAacPts);
          delta = Math.round(1000 * (ptsnorm - nextAacPts) / pesTimeScale);
          // if fragment are contiguous, or delta less than 600ms, ensure there is no overlap/hole between fragments
          if (contiguous || Math.abs(delta) < 600) {
            // log delta
            if (delta) {
              if (delta > 0) {
                _logger.logger.log(delta + ' ms hole between AAC samples detected,filling it');
                // if we have frame overlap, overlapping for more than half a frame duraion
              } else if (delta < -12) {
                  // drop overlapping audio frames... browser will deal with it
                  _logger.logger.log(-delta + ' ms overlapping between AAC samples detected, drop frame');
                  track.len -= unit.byteLength;
                  continue;
                }
              // set DTS to next DTS
              ptsnorm = dtsnorm = nextAacPts;
            }
          }
          // remember first PTS of our aacSamples, ensure value is positive
          firstPTS = Math.max(0, ptsnorm);
          firstDTS = Math.max(0, dtsnorm);
          if (track.len > 0) {
            /* concatenate the audio data and construct the mdat in place
              (need 8 more bytes to fill length and mdat type) */
            mdat = new Uint8Array(track.len + 8);
            view = new DataView(mdat.buffer);
            view.setUint32(0, mdat.byteLength);
            mdat.set(_mp4Generator2.default.types.mdat, 4);
          } else {
            // no audio samples
            return;
          }
        }
        mdat.set(unit, offset);
        offset += unit.byteLength;
        //console.log('PTS/DTS/initDTS/normPTS/normDTS/relative PTS : ${aacSample.pts}/${aacSample.dts}/${this._initDTS}/${ptsnorm}/${dtsnorm}/${(aacSample.pts/4294967296).toFixed(3)}');
        mp4Sample = {
          size: unit.byteLength,
          cts: 0,
          duration: 0,
          flags: {
            isLeading: 0,
            isDependedOn: 0,
            hasRedundancy: 0,
            degradPrio: 0,
            dependsOn: 1
          }
        };
        samples.push(mp4Sample);
        lastDTS = dtsnorm;
      }
      var lastSampleDuration = 0;
      var nbSamples = samples.length;
      //set last sample duration as being identical to previous sample
      if (nbSamples >= 2) {
        lastSampleDuration = samples[nbSamples - 2].duration;
        mp4Sample.duration = lastSampleDuration;
      }
      if (nbSamples) {
        // next aac sample PTS should be equal to last sample PTS + duration
        this.nextAacPts = ptsnorm + pes2mp4ScaleFactor * lastSampleDuration;
        //logger.log('Audio/PTS/PTSend:' + aacSample.pts.toFixed(0) + '/' + this.nextAacDts.toFixed(0));
        track.len = 0;
        track.samples = samples;
        moof = _mp4Generator2.default.moof(track.sequenceNumber++, firstDTS / pes2mp4ScaleFactor, track);
        track.samples = [];
        this.observer.trigger(_events2.default.FRAG_PARSING_DATA, {
          data1: moof,
          data2: mdat,
          startPTS: firstPTS / pesTimeScale,
          endPTS: this.nextAacPts / pesTimeScale,
          startDTS: firstDTS / pesTimeScale,
          endDTS: (dtsnorm + pes2mp4ScaleFactor * lastSampleDuration) / pesTimeScale,
          type: 'audio',
          nb: nbSamples
        });
      }
    }
  }, {
    key: 'remuxID3',
    value: function remuxID3(track, timeOffset) {
      var length = track.samples.length,
          sample;
      // consume samples
      if (length) {
        for (var index = 0; index < length; index++) {
          sample = track.samples[index];
          // setting id3 pts, dts to relative time
          // using this._initPTS and this._initDTS to calculate relative time
          sample.pts = (sample.pts - this._initPTS) / this.PES_TIMESCALE;
          sample.dts = (sample.dts - this._initDTS) / this.PES_TIMESCALE;
        }
        this.observer.trigger(_events2.default.FRAG_PARSING_METADATA, {
          samples: track.samples
        });
      }

      track.samples = [];
      timeOffset = timeOffset;
    }
  }, {
    key: 'remuxText',
    value: function remuxText(track, timeOffset) {
      track.samples.sort(function (a, b) {
        return a.pts - b.pts;
      });

      var length = track.samples.length,
          sample;
      // consume samples
      if (length) {
        for (var index = 0; index < length; index++) {
          sample = track.samples[index];
          // setting text pts, dts to relative time
          // using this._initPTS and this._initDTS to calculate relative time
          sample.pts = (sample.pts - this._initPTS) / this.PES_TIMESCALE;
        }
        this.observer.trigger(_events2.default.FRAG_PARSING_USERDATA, {
          samples: track.samples
        });
      }

      track.samples = [];
      timeOffset = timeOffset;
    }
  }, {
    key: '_PTSNormalize',
    value: function _PTSNormalize(value, reference) {
      var offset;
      if (reference === undefined) {
        return value;
      }
      if (reference < value) {
        // - 2^33
        offset = -8589934592;
      } else {
        // + 2^33
        offset = 8589934592;
      }
      /* PTS is 33bit (from 0 to 2^33 -1)
        if diff between value and reference is bigger than half of the amplitude (2^32) then it means that
        PTS looping occured. fill the gap */
      while (Math.abs(value - reference) > 4294967296) {
        value += offset;
      }
      return value;
    }
  }, {
    key: 'passthrough',
    get: function get() {
      return false;
    }
  }]);

  return MP4Remuxer;
}();

exports.default = MP4Remuxer;

},{"../errors":20,"../events":22,"../remux/mp4-generator":30,"../utils/logger":36}],32:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * passthrough remuxer
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */


var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var PassThroughRemuxer = function () {
  function PassThroughRemuxer(observer) {
    _classCallCheck(this, PassThroughRemuxer);

    this.observer = observer;
    this.ISGenerated = false;
  }

  _createClass(PassThroughRemuxer, [{
    key: 'destroy',
    value: function destroy() {}
  }, {
    key: 'insertDiscontinuity',
    value: function insertDiscontinuity() {}
  }, {
    key: 'switchLevel',
    value: function switchLevel() {
      this.ISGenerated = false;
    }
  }, {
    key: 'remux',
    value: function remux(audioTrack, videoTrack, id3Track, textTrack, timeOffset, rawData) {
      var observer = this.observer;
      // generate Init Segment if needed
      if (!this.ISGenerated) {
        var tracks = {},
            data = { tracks: tracks, unique: true },
            track = videoTrack,
            codec = track.codec;

        if (codec) {
          data.tracks.video = {
            container: track.container,
            codec: codec,
            metadata: {
              width: track.width,
              height: track.height
            }
          };
        }

        track = audioTrack;
        codec = track.codec;
        if (codec) {
          data.tracks.audio = {
            container: track.container,
            codec: codec,
            metadata: {
              channelCount: track.channelCount
            }
          };
        }
        this.ISGenerated = true;
        observer.trigger(_events2.default.FRAG_PARSING_INIT_SEGMENT, data);
      }
      observer.trigger(_events2.default.FRAG_PARSING_DATA, {
        data1: rawData,
        startPTS: timeOffset,
        startDTS: timeOffset,
        type: 'audiovideo',
        nb: 1
      });
    }
  }, {
    key: 'passthrough',
    get: function get() {
      return true;
    }
  }]);

  return PassThroughRemuxer;
}();

exports.default = PassThroughRemuxer;

},{"../events":22}],33:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// adapted from https://github.com/kanongil/node-m3u8parse/blob/master/attrlist.js

var AttrList = function () {
  function AttrList(attrs) {
    _classCallCheck(this, AttrList);

    if (typeof attrs === 'string') {
      attrs = AttrList.parseAttrList(attrs);
    }
    for (var attr in attrs) {
      if (attrs.hasOwnProperty(attr)) {
        this[attr] = attrs[attr];
      }
    }
  }

  _createClass(AttrList, [{
    key: 'decimalInteger',
    value: function decimalInteger(attrName) {
      var intValue = parseInt(this[attrName], 10);
      if (intValue > Number.MAX_SAFE_INTEGER) {
        return Infinity;
      }
      return intValue;
    }
  }, {
    key: 'hexadecimalInteger',
    value: function hexadecimalInteger(attrName) {
      if (this[attrName]) {
        var stringValue = (this[attrName] || '0x').slice(2);
        stringValue = (stringValue.length & 1 ? '0' : '') + stringValue;

        var value = new Uint8Array(stringValue.length / 2);
        for (var i = 0; i < stringValue.length / 2; i++) {
          value[i] = parseInt(stringValue.slice(i * 2, i * 2 + 2), 16);
        }
        return value;
      } else {
        return null;
      }
    }
  }, {
    key: 'hexadecimalIntegerAsNumber',
    value: function hexadecimalIntegerAsNumber(attrName) {
      var intValue = parseInt(this[attrName], 16);
      if (intValue > Number.MAX_SAFE_INTEGER) {
        return Infinity;
      }
      return intValue;
    }
  }, {
    key: 'decimalFloatingPoint',
    value: function decimalFloatingPoint(attrName) {
      return parseFloat(this[attrName]);
    }
  }, {
    key: 'enumeratedString',
    value: function enumeratedString(attrName) {
      return this[attrName];
    }
  }, {
    key: 'decimalResolution',
    value: function decimalResolution(attrName) {
      var res = /^(\d+)x(\d+)$/.exec(this[attrName]);
      if (res === null) {
        return undefined;
      }
      return {
        width: parseInt(res[1], 10),
        height: parseInt(res[2], 10)
      };
    }
  }], [{
    key: 'parseAttrList',
    value: function parseAttrList(input) {
      var re = /\s*(.+?)\s*=((?:\".*?\")|.*?)(?:,|$)/g;
      var match,
          attrs = {};
      while ((match = re.exec(input)) !== null) {
        var value = match[2],
            quote = '"';

        if (value.indexOf(quote) === 0 && value.lastIndexOf(quote) === value.length - 1) {
          value = value.slice(1, -1);
        }
        attrs[match[1]] = value;
      }
      return attrs;
    }
  }]);

  return AttrList;
}();

exports.default = AttrList;

},{}],34:[function(require,module,exports){
"use strict";

var BinarySearch = {
    /**
     * Searches for an item in an array which matches a certain condition.
     * This requires the condition to only match one item in the array,
     * and for the array to be ordered.
     *
     * @param {Array} list The array to search.
     * @param {Function} comparisonFunction
     *      Called and provided a candidate item as the first argument.
     *      Should return:
     *          > -1 if the item should be located at a lower index than the provided item.
     *          > 1 if the item should be located at a higher index than the provided item.
     *          > 0 if the item is the item you're looking for.
     *
     * @return {*} The object if it is found or null otherwise.
     */
    search: function search(list, comparisonFunction) {
        var minIndex = 0;
        var maxIndex = list.length - 1;
        var currentIndex = null;
        var currentElement = null;

        while (minIndex <= maxIndex) {
            currentIndex = (minIndex + maxIndex) / 2 | 0;
            currentElement = list[currentIndex];

            var comparisonResult = comparisonFunction(currentElement);
            if (comparisonResult > 0) {
                minIndex = currentIndex + 1;
            } else if (comparisonResult < 0) {
                maxIndex = currentIndex - 1;
            } else {
                return currentElement;
            }
        }

        return null;
    }
};

module.exports = BinarySearch;

},{}],35:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/*
 * CEA-708 interpreter
*/

var CEA708Interpreter = function () {
  function CEA708Interpreter() {
    _classCallCheck(this, CEA708Interpreter);
  }

  _createClass(CEA708Interpreter, [{
    key: 'attach',
    value: function attach(media) {
      this.media = media;
      this.display = [];
      this.memory = [];
    }
  }, {
    key: 'detach',
    value: function detach() {
      this.clear();
    }
  }, {
    key: 'destroy',
    value: function destroy() {}
  }, {
    key: '_createCue',
    value: function _createCue() {
      var VTTCue = window.VTTCue || window.TextTrackCue;

      var cue = this.cue = new VTTCue(-1, -1, '');
      cue.text = '';
      cue.pauseOnExit = false;

      // make sure it doesn't show up before it's ready
      cue.startTime = Number.MAX_VALUE;

      // show it 'forever' once we do show it
      // (we'll set the end time once we know it later)
      cue.endTime = Number.MAX_VALUE;

      this.memory.push(cue);
    }
  }, {
    key: 'clear',
    value: function clear() {
      var textTrack = this._textTrack;
      if (textTrack && textTrack.cues) {
        while (textTrack.cues.length > 0) {
          textTrack.removeCue(textTrack.cues[0]);
        }
      }
    }
  }, {
    key: 'push',
    value: function push(timestamp, bytes) {
      if (!this.cue) {
        this._createCue();
      }

      var count = bytes[0] & 31;
      var position = 2;
      var tmpByte, ccbyte1, ccbyte2, ccValid, ccType;

      for (var j = 0; j < count; j++) {
        tmpByte = bytes[position++];
        ccbyte1 = 0x7F & bytes[position++];
        ccbyte2 = 0x7F & bytes[position++];
        ccValid = (4 & tmpByte) === 0 ? false : true;
        ccType = 3 & tmpByte;

        if (ccbyte1 === 0 && ccbyte2 === 0) {
          continue;
        }

        if (ccValid) {
          if (ccType === 0) // || ccType === 1
            {
              // Standard Characters
              if (0x20 & ccbyte1 || 0x40 & ccbyte1) {
                this.cue.text += this._fromCharCode(ccbyte1) + this._fromCharCode(ccbyte2);
              }
              // Special Characters
              else if ((ccbyte1 === 0x11 || ccbyte1 === 0x19) && ccbyte2 >= 0x30 && ccbyte2 <= 0x3F) {
                  // extended chars, e.g. musical note, accents
                  switch (ccbyte2) {
                    case 48:
                      this.cue.text += '®';
                      break;
                    case 49:
                      this.cue.text += '°';
                      break;
                    case 50:
                      this.cue.text += '½';
                      break;
                    case 51:
                      this.cue.text += '¿';
                      break;
                    case 52:
                      this.cue.text += '™';
                      break;
                    case 53:
                      this.cue.text += '¢';
                      break;
                    case 54:
                      this.cue.text += '';
                      break;
                    case 55:
                      this.cue.text += '£';
                      break;
                    case 56:
                      this.cue.text += '♪';
                      break;
                    case 57:
                      this.cue.text += ' ';
                      break;
                    case 58:
                      this.cue.text += 'è';
                      break;
                    case 59:
                      this.cue.text += 'â';
                      break;
                    case 60:
                      this.cue.text += 'ê';
                      break;
                    case 61:
                      this.cue.text += 'î';
                      break;
                    case 62:
                      this.cue.text += 'ô';
                      break;
                    case 63:
                      this.cue.text += 'û';
                      break;
                  }
                }
              if ((ccbyte1 === 0x11 || ccbyte1 === 0x19) && ccbyte2 >= 0x20 && ccbyte2 <= 0x2F) {
                // Mid-row codes: color/underline
                switch (ccbyte2) {
                  case 0x20:
                    // White
                    break;
                  case 0x21:
                    // White Underline
                    break;
                  case 0x22:
                    // Green
                    break;
                  case 0x23:
                    // Green Underline
                    break;
                  case 0x24:
                    // Blue
                    break;
                  case 0x25:
                    // Blue Underline
                    break;
                  case 0x26:
                    // Cyan
                    break;
                  case 0x27:
                    // Cyan Underline
                    break;
                  case 0x28:
                    // Red
                    break;
                  case 0x29:
                    // Red Underline
                    break;
                  case 0x2A:
                    // Yellow
                    break;
                  case 0x2B:
                    // Yellow Underline
                    break;
                  case 0x2C:
                    // Magenta
                    break;
                  case 0x2D:
                    // Magenta Underline
                    break;
                  case 0x2E:
                    // Italics
                    break;
                  case 0x2F:
                    // Italics Underline
                    break;
                }
              }
              if ((ccbyte1 === 0x14 || ccbyte1 === 0x1C) && ccbyte2 >= 0x20 && ccbyte2 <= 0x2F) {
                // Mid-row codes: color/underline
                switch (ccbyte2) {
                  case 0x20:
                    // TODO: shouldn't affect roll-ups...
                    this._clearActiveCues(timestamp);
                    // RCL: Resume Caption Loading
                    // begin pop on
                    break;
                  case 0x21:
                    // BS: Backspace
                    this.cue.text = this.cue.text.substr(0, this.cue.text.length - 1);
                    break;
                  case 0x22:
                    // AOF: reserved (formerly alarm off)
                    break;
                  case 0x23:
                    // AON: reserved (formerly alarm on)
                    break;
                  case 0x24:
                    // DER: Delete to end of row
                    break;
                  case 0x25:
                    // RU2: roll-up 2 rows
                    //this._rollup(2);
                    break;
                  case 0x26:
                    // RU3: roll-up 3 rows
                    //this._rollup(3);
                    break;
                  case 0x27:
                    // RU4: roll-up 4 rows
                    //this._rollup(4);
                    break;
                  case 0x28:
                    // FON: Flash on
                    break;
                  case 0x29:
                    // RDC: Resume direct captioning
                    this._clearActiveCues(timestamp);
                    break;
                  case 0x2A:
                    // TR: Text Restart
                    break;
                  case 0x2B:
                    // RTD: Resume Text Display
                    break;
                  case 0x2C:
                    // EDM: Erase Displayed Memory
                    this._clearActiveCues(timestamp);
                    break;
                  case 0x2D:
                    // CR: Carriage Return
                    // only affects roll-up
                    //this._rollup(1);
                    break;
                  case 0x2E:
                    // ENM: Erase non-displayed memory
                    this._text = '';
                    break;
                  case 0x2F:
                    this._flipMemory(timestamp);
                    // EOC: End of caption
                    // hide any displayed captions and show any hidden one
                    break;
                }
              }
              if ((ccbyte1 === 0x17 || ccbyte1 === 0x1F) && ccbyte2 >= 0x21 && ccbyte2 <= 0x23) {
                // Mid-row codes: color/underline
                switch (ccbyte2) {
                  case 0x21:
                    // TO1: tab offset 1 column
                    break;
                  case 0x22:
                    // TO1: tab offset 2 column
                    break;
                  case 0x23:
                    // TO1: tab offset 3 column
                    break;
                }
              } else {
                // Probably a pre-amble address code
              }
            }
        }
      }
    }
  }, {
    key: '_fromCharCode',
    value: function _fromCharCode(tmpByte) {
      switch (tmpByte) {
        case 42:
          return 'á';

        case 2:
          return 'á';

        case 2:
          return 'é';

        case 4:
          return 'í';

        case 5:
          return 'ó';

        case 6:
          return 'ú';

        case 3:
          return 'ç';

        case 4:
          return '÷';

        case 5:
          return 'Ñ';

        case 6:
          return 'ñ';

        case 7:
          return '█';

        default:
          return String.fromCharCode(tmpByte);
      }
    }
  }, {
    key: '_flipMemory',
    value: function _flipMemory(timestamp) {
      this._clearActiveCues(timestamp);
      this._flushCaptions(timestamp);
    }
  }, {
    key: '_flushCaptions',
    value: function _flushCaptions(timestamp) {
      if (!this._has708) {
        this._textTrack = this.media.addTextTrack('captions', 'English', 'en');
        this._has708 = true;
      }

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = this.memory[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var memoryItem = _step.value;

          memoryItem.startTime = timestamp;
          this._textTrack.addCue(memoryItem);
          this.display.push(memoryItem);
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      this.memory = [];
      this.cue = null;
    }
  }, {
    key: '_clearActiveCues',
    value: function _clearActiveCues(timestamp) {
      var _iteratorNormalCompletion2 = true;
      var _didIteratorError2 = false;
      var _iteratorError2 = undefined;

      try {
        for (var _iterator2 = this.display[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
          var displayItem = _step2.value;

          displayItem.endTime = timestamp;
        }
      } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion2 && _iterator2.return) {
            _iterator2.return();
          }
        } finally {
          if (_didIteratorError2) {
            throw _iteratorError2;
          }
        }
      }

      this.display = [];
    }

    /*  _rollUp(n)
      {
        // TODO: implement roll-up captions
      }
    */

  }, {
    key: '_clearBufferedCues',
    value: function _clearBufferedCues() {
      //remove them all...
    }
  }]);

  return CEA708Interpreter;
}();

exports.default = CEA708Interpreter;

},{}],36:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

function noop() {}

var fakeLogger = {
  trace: noop,
  debug: noop,
  log: noop,
  warn: noop,
  info: noop,
  error: noop
};

var exportedLogger = fakeLogger;

//let lastCallTime;
// function formatMsgWithTimeInfo(type, msg) {
//   const now = Date.now();
//   const diff = lastCallTime ? '+' + (now - lastCallTime) : '0';
//   lastCallTime = now;
//   msg = (new Date(now)).toISOString() + ' | [' +  type + '] > ' + msg + ' ( ' + diff + ' ms )';
//   return msg;
// }

function formatMsg(type, msg) {
  msg = '[' + type + '] > ' + msg;
  return msg;
}

function consolePrintFn(type) {
  var func = window.console[type];
  if (func) {
    return function () {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      if (args[0]) {
        args[0] = formatMsg(type, args[0]);
      }
      func.apply(window.console, args);
    };
  }
  return noop;
}

function exportLoggerFunctions(debugConfig) {
  for (var _len2 = arguments.length, functions = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
    functions[_key2 - 1] = arguments[_key2];
  }

  functions.forEach(function (type) {
    exportedLogger[type] = debugConfig[type] ? debugConfig[type].bind(debugConfig) : consolePrintFn(type);
  });
}

var enableLogs = exports.enableLogs = function enableLogs(debugConfig) {
  if (debugConfig === true || (typeof debugConfig === 'undefined' ? 'undefined' : _typeof(debugConfig)) === 'object') {
    exportLoggerFunctions(debugConfig,
    // Remove out from list here to hard-disable a log-level
    //'trace',
    'debug', 'log', 'info', 'warn', 'error');
    // Some browsers don't allow to use bind on console object anyway
    // fallback to default if needed
    try {
      exportedLogger.log();
    } catch (e) {
      exportedLogger = fakeLogger;
    }
  } else {
    exportedLogger = fakeLogger;
  }
};

var logger = exports.logger = exportedLogger;

},{}],37:[function(require,module,exports){
'use strict';

var URLHelper = {

  // build an absolute URL from a relative one using the provided baseURL
  // if relativeURL is an absolute URL it will be returned as is.
  buildAbsoluteURL: function buildAbsoluteURL(baseURL, relativeURL) {
    // remove any remaining space and CRLF
    relativeURL = relativeURL.trim();
    if (/^[a-z]+:/i.test(relativeURL)) {
      // complete url, not relative
      return relativeURL;
    }

    var relativeURLQuery = null;
    var relativeURLHash = null;

    var relativeURLHashSplit = /^([^#]*)(.*)$/.exec(relativeURL);
    if (relativeURLHashSplit) {
      relativeURLHash = relativeURLHashSplit[2];
      relativeURL = relativeURLHashSplit[1];
    }
    var relativeURLQuerySplit = /^([^\?]*)(.*)$/.exec(relativeURL);
    if (relativeURLQuerySplit) {
      relativeURLQuery = relativeURLQuerySplit[2];
      relativeURL = relativeURLQuerySplit[1];
    }

    var baseURLHashSplit = /^([^#]*)(.*)$/.exec(baseURL);
    if (baseURLHashSplit) {
      baseURL = baseURLHashSplit[1];
    }
    var baseURLQuerySplit = /^([^\?]*)(.*)$/.exec(baseURL);
    if (baseURLQuerySplit) {
      baseURL = baseURLQuerySplit[1];
    }

    var baseURLDomainSplit = /^((([a-z]+):)?\/\/[a-z0-9\.\-_~]+(:[0-9]+)?\/)(.*)$/i.exec(baseURL);
    var baseURLProtocol = baseURLDomainSplit[3];
    var baseURLDomain = baseURLDomainSplit[1];
    var baseURLPath = baseURLDomainSplit[5];

    var builtURL = null;
    if (/^\/\//.test(relativeURL)) {
      builtURL = baseURLProtocol + '://' + URLHelper.buildAbsolutePath('', relativeURL.substring(2));
    } else if (/^\//.test(relativeURL)) {
      builtURL = baseURLDomain + URLHelper.buildAbsolutePath('', relativeURL.substring(1));
    } else {
      builtURL = URLHelper.buildAbsolutePath(baseURLDomain + baseURLPath, relativeURL);
    }

    // put the query and hash parts back
    if (relativeURLQuery) {
      builtURL += relativeURLQuery;
    }
    if (relativeURLHash) {
      builtURL += relativeURLHash;
    }
    return builtURL;
  },

  // build an absolute path using the provided basePath
  // adapted from https://developer.mozilla.org/en-US/docs/Web/API/document/cookie#Using_relative_URLs_in_the_path_parameter
  // this does not handle the case where relativePath is "/" or "//". These cases should be handled outside this.
  buildAbsolutePath: function buildAbsolutePath(basePath, relativePath) {
    var sRelPath = relativePath;
    var nUpLn,
        sDir = '',
        sPath = basePath.replace(/[^\/]*$/, sRelPath.replace(/(\/|^)(?:\.?\/+)+/g, '$1'));
    for (var nEnd, nStart = 0; nEnd = sPath.indexOf('/../', nStart), nEnd > -1; nStart = nEnd + nUpLn) {
      nUpLn = /^\/(?:\.\.\/)*/.exec(sPath.slice(nEnd))[0].length;
      sDir = (sDir + sPath.substring(nStart, nEnd)).replace(new RegExp('(?:\\\/+[^\\\/]*){0,' + (nUpLn - 1) / 3 + '}$'), '/');
    }
    return sDir + sPath.substr(nStart);
  }
};

module.exports = URLHelper;

},{}],38:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /**
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      * XHR based logger
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */

var _logger = require('../utils/logger');

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var XhrLoader = function () {
  function XhrLoader(config) {
    _classCallCheck(this, XhrLoader);

    if (config && config.xhrSetup) {
      this.xhrSetup = config.xhrSetup;
    }
  }

  _createClass(XhrLoader, [{
    key: 'destroy',
    value: function destroy() {
      this.abort();
      this.loader = null;
    }
  }, {
    key: 'abort',
    value: function abort() {
      var loader = this.loader,
          timeoutHandle = this.timeoutHandle;
      if (loader && loader.readyState !== 4) {
        this.stats.aborted = true;
        loader.abort();
      }
      if (timeoutHandle) {
        window.clearTimeout(timeoutHandle);
      }
    }
  }, {
    key: 'load',
    value: function load(url, responseType, onSuccess, onError, onTimeout, timeout, maxRetry, retryDelay) {
      var onProgress = arguments.length <= 8 || arguments[8] === undefined ? null : arguments[8];
      var frag = arguments.length <= 9 || arguments[9] === undefined ? null : arguments[9];

      this.url = url;
      if (frag && !isNaN(frag.byteRangeStartOffset) && !isNaN(frag.byteRangeEndOffset)) {
        this.byteRange = frag.byteRangeStartOffset + '-' + (frag.byteRangeEndOffset - 1);
      }
      this.responseType = responseType;
      this.onSuccess = onSuccess;
      this.onProgress = onProgress;
      this.onTimeout = onTimeout;
      this.onError = onError;
      this.stats = { trequest: performance.now(), retry: 0 };
      this.timeout = timeout;
      this.maxRetry = maxRetry;
      this.retryDelay = retryDelay;
      this.loadInternal();
    }
  }, {
    key: 'loadInternal',
    value: function loadInternal() {
      var xhr;

      if (typeof XDomainRequest !== 'undefined') {
        xhr = this.loader = new XDomainRequest();
      } else {
        xhr = this.loader = new XMLHttpRequest();
      }

      xhr.onloadend = this.loadend.bind(this);
      xhr.onprogress = this.loadprogress.bind(this);

      xhr.open('GET', this.url, true);
      if (this.byteRange) {
        xhr.setRequestHeader('Range', 'bytes=' + this.byteRange);
      }
      xhr.responseType = this.responseType;
      this.stats.tfirst = null;
      this.stats.loaded = 0;
      if (this.xhrSetup) {
        this.xhrSetup(xhr, this.url);
      }
      this.timeoutHandle = window.setTimeout(this.loadtimeout.bind(this), this.timeout);
      xhr.send();
    }
  }, {
    key: 'loadend',
    value: function loadend(event) {
      var xhr = event.currentTarget,
          status = xhr.status,
          stats = this.stats;
      // don't proceed if xhr has been aborted
      if (!stats.aborted) {
        // http status between 200 to 299 are all successful
        if (status >= 200 && status < 300) {
          window.clearTimeout(this.timeoutHandle);
          stats.tload = performance.now();
          this.onSuccess(event, stats);
        } else {
          // error ...
          if (stats.retry < this.maxRetry) {
            _logger.logger.warn(status + ' while loading ' + this.url + ', retrying in ' + this.retryDelay + '...');
            this.destroy();
            window.setTimeout(this.loadInternal.bind(this), this.retryDelay);
            // exponential backoff
            this.retryDelay = Math.min(2 * this.retryDelay, 64000);
            stats.retry++;
          } else {
            window.clearTimeout(this.timeoutHandle);
            _logger.logger.error(status + ' while loading ' + this.url);
            this.onError(event);
          }
        }
      }
    }
  }, {
    key: 'loadtimeout',
    value: function loadtimeout(event) {
      _logger.logger.warn('timeout while loading ' + this.url);
      this.onTimeout(event, this.stats);
    }
  }, {
    key: 'loadprogress',
    value: function loadprogress(event) {
      var stats = this.stats;
      if (stats.tfirst === null) {
        stats.tfirst = performance.now();
      }
      stats.loaded = event.loaded;
      if (this.onProgress) {
        this.onProgress(event, stats);
      }
    }
  }]);

  return XhrLoader;
}();

exports.default = XhrLoader;

},{"../utils/logger":36}]},{},[26])(26)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZXZlbnRzL2V2ZW50cy5qcyIsIm5vZGVfbW9kdWxlcy93ZWJ3b3JraWZ5L2luZGV4LmpzIiwic3JjL2NvbnRyb2xsZXIvYWJyLWNvbnRyb2xsZXIuanMiLCJzcmMvY29udHJvbGxlci9idWZmZXItY29udHJvbGxlci5qcyIsInNyYy9jb250cm9sbGVyL2NhcC1sZXZlbC1jb250cm9sbGVyLmpzIiwic3JjL2NvbnRyb2xsZXIvbGV2ZWwtY29udHJvbGxlci5qcyIsInNyYy9jb250cm9sbGVyL3N0cmVhbS1jb250cm9sbGVyLmpzIiwic3JjL2NvbnRyb2xsZXIvdGltZWxpbmUtY29udHJvbGxlci5qcyIsInNyYy9jcnlwdC9hZXMuanMiLCJzcmMvY3J5cHQvYWVzMTI4LWRlY3J5cHRlci5qcyIsInNyYy9jcnlwdC9kZWNyeXB0ZXIuanMiLCJzcmMvZGVtdXgvYWFjZGVtdXhlci5qcyIsInNyYy9kZW11eC9hZHRzLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXItaW5saW5lLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXItd29ya2VyLmpzIiwic3JjL2RlbXV4L2RlbXV4ZXIuanMiLCJzcmMvZGVtdXgvZXhwLWdvbG9tYi5qcyIsInNyYy9kZW11eC9pZDMuanMiLCJzcmMvZGVtdXgvdHNkZW11eGVyLmpzIiwic3JjL2Vycm9ycy5qcyIsInNyYy9ldmVudC1oYW5kbGVyLmpzIiwic3JjL2V2ZW50cy5qcyIsInNyYy9oZWxwZXIvYnVmZmVyLWhlbHBlci5qcyIsInNyYy9oZWxwZXIvbGV2ZWwtaGVscGVyLmpzIiwic3JjL2hscy5qcyIsInNyYy9pbmRleC5qcyIsInNyYy9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyLmpzIiwic3JjL2xvYWRlci9rZXktbG9hZGVyLmpzIiwic3JjL2xvYWRlci9wbGF5bGlzdC1sb2FkZXIuanMiLCJzcmMvcmVtdXgvbXA0LWdlbmVyYXRvci5qcyIsInNyYy9yZW11eC9tcDQtcmVtdXhlci5qcyIsInNyYy9yZW11eC9wYXNzdGhyb3VnaC1yZW11eGVyLmpzIiwic3JjL3V0aWxzL2F0dHItbGlzdC5qcyIsInNyYy91dGlscy9iaW5hcnktc2VhcmNoLmpzIiwic3JjL3V0aWxzL2NlYS03MDgtaW50ZXJwcmV0ZXIuanMiLCJzcmMvdXRpbHMvbG9nZ2VyLmpzIiwic3JjL3V0aWxzL3VybC5qcyIsInNyYy91dGlscy94aHItbG9hZGVyLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNB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QjtBQUcvQixtQkFBTyxVQUFQLENBQWtCLEtBQUssWUFBTCxDQUFrQixJQUFsQixDQUF1QixJQUF2QixDQUFsQixFQUFnRCxLQUFLLFVBQUwsQ0FBaEQ7O0FBSCtCLGdCQUsvQixDQUFLLFVBQUwsR0FBa0IsS0FBSyxHQUFMLENBQVMsSUFBSSxLQUFLLFVBQUwsRUFBaUIsS0FBOUIsQ0FBbEIsQ0FMK0I7QUFNL0Isa0JBQU0sS0FBTixHQU4rQjtXQUFqQyxNQU9PO0FBQ0wsbUJBQU8sWUFBUCxDQUFvQixLQUFLLGFBQUwsQ0FBcEIsQ0FESztBQUVMLDJCQUFPLEtBQVAsQ0FBZ0IsNkJBQXdCLEtBQUssR0FBTCxDQUF4QyxDQUZLO0FBR0wsaUJBQUssT0FBTCxDQUFhLEtBQWIsRUFISztXQVBQO1NBTkE7T0FGSjs7OztnQ0F3QlUsT0FBTztBQUNqQixxQkFBTyxJQUFQLDRCQUFxQyxLQUFLLEdBQUwsQ0FBckMsQ0FEaUI7QUFFakIsV0FBSyxTQUFMLENBQWUsS0FBZixFQUFzQixLQUFLLEtBQUwsQ0FBdEIsQ0FGaUI7Ozs7aUNBS04sT0FBTztBQUNsQixVQUFJLFFBQVEsS0FBSyxLQUFMLENBRE07QUFFbEIsVUFBSSxNQUFNLE1BQU4sS0FBaUIsSUFBakIsRUFBdUI7QUFDekIsY0FBTSxNQUFOLEdBQWUsWUFBWSxHQUFaLEVBQWYsQ0FEeUI7T0FBM0I7QUFHQSxZQUFNLE1BQU4sR0FBZSxNQUFNLE1BQU4sQ0FMRztBQU1sQixVQUFJLEtBQUssVUFBTCxFQUFpQjtBQUNuQixhQUFLLFVBQUwsQ0FBZ0IsS0FBaEIsRUFBdUIsS0FBdkIsRUFEbUI7T0FBckI7Ozs7U0E1R0U7OztrQkFrSFMiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbmZ1bmN0aW9uIEV2ZW50RW1pdHRlcigpIHtcbiAgdGhpcy5fZXZlbnRzID0gdGhpcy5fZXZlbnRzIHx8IHt9O1xuICB0aGlzLl9tYXhMaXN0ZW5lcnMgPSB0aGlzLl9tYXhMaXN0ZW5lcnMgfHwgdW5kZWZpbmVkO1xufVxubW9kdWxlLmV4cG9ydHMgPSBFdmVudEVtaXR0ZXI7XG5cbi8vIEJhY2t3YXJkcy1jb21wYXQgd2l0aCBub2RlIDAuMTAueFxuRXZlbnRFbWl0dGVyLkV2ZW50RW1pdHRlciA9IEV2ZW50RW1pdHRlcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fZXZlbnRzID0gdW5kZWZpbmVkO1xuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5fbWF4TGlzdGVuZXJzID0gdW5kZWZpbmVkO1xuXG4vLyBCeSBkZWZhdWx0IEV2ZW50RW1pdHRlcnMgd2lsbCBwcmludCBhIHdhcm5pbmcgaWYgbW9yZSB0aGFuIDEwIGxpc3RlbmVycyBhcmVcbi8vIGFkZGVkIHRvIGl0LiBUaGlzIGlzIGEgdXNlZnVsIGRlZmF1bHQgd2hpY2ggaGVscHMgZmluZGluZyBtZW1vcnkgbGVha3MuXG5FdmVudEVtaXR0ZXIuZGVmYXVsdE1heExpc3RlbmVycyA9IDEwO1xuXG4vLyBPYnZpb3VzbHkgbm90IGFsbCBFbWl0dGVycyBzaG91bGQgYmUgbGltaXRlZCB0byAxMC4gVGhpcyBmdW5jdGlvbiBhbGxvd3Ncbi8vIHRoYXQgdG8gYmUgaW5jcmVhc2VkLiBTZXQgdG8gemVybyBmb3IgdW5saW1pdGVkLlxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5zZXRNYXhMaXN0ZW5lcnMgPSBmdW5jdGlvbihuKSB7XG4gIGlmICghaXNOdW1iZXIobikgfHwgbiA8IDAgfHwgaXNOYU4obikpXG4gICAgdGhyb3cgVHlwZUVycm9yKCduIG11c3QgYmUgYSBwb3NpdGl2ZSBudW1iZXInKTtcbiAgdGhpcy5fbWF4TGlzdGVuZXJzID0gbjtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmVtaXQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIHZhciBlciwgaGFuZGxlciwgbGVuLCBhcmdzLCBpLCBsaXN0ZW5lcnM7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMpXG4gICAgdGhpcy5fZXZlbnRzID0ge307XG5cbiAgLy8gSWYgdGhlcmUgaXMgbm8gJ2Vycm9yJyBldmVudCBsaXN0ZW5lciB0aGVuIHRocm93LlxuICBpZiAodHlwZSA9PT0gJ2Vycm9yJykge1xuICAgIGlmICghdGhpcy5fZXZlbnRzLmVycm9yIHx8XG4gICAgICAgIChpc09iamVjdCh0aGlzLl9ldmVudHMuZXJyb3IpICYmICF0aGlzLl9ldmVudHMuZXJyb3IubGVuZ3RoKSkge1xuICAgICAgZXIgPSBhcmd1bWVudHNbMV07XG4gICAgICBpZiAoZXIgaW5zdGFuY2VvZiBFcnJvcikge1xuICAgICAgICB0aHJvdyBlcjsgLy8gVW5oYW5kbGVkICdlcnJvcicgZXZlbnRcbiAgICAgIH1cbiAgICAgIHRocm93IFR5cGVFcnJvcignVW5jYXVnaHQsIHVuc3BlY2lmaWVkIFwiZXJyb3JcIiBldmVudC4nKTtcbiAgICB9XG4gIH1cblxuICBoYW5kbGVyID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuXG4gIGlmIChpc1VuZGVmaW5lZChoYW5kbGVyKSlcbiAgICByZXR1cm4gZmFsc2U7XG5cbiAgaWYgKGlzRnVuY3Rpb24oaGFuZGxlcikpIHtcbiAgICBzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcbiAgICAgIC8vIGZhc3QgY2FzZXNcbiAgICAgIGNhc2UgMTpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgMjpcbiAgICAgICAgaGFuZGxlci5jYWxsKHRoaXMsIGFyZ3VtZW50c1sxXSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAzOlxuICAgICAgICBoYW5kbGVyLmNhbGwodGhpcywgYXJndW1lbnRzWzFdLCBhcmd1bWVudHNbMl0pO1xuICAgICAgICBicmVhaztcbiAgICAgIC8vIHNsb3dlclxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgICAgIGhhbmRsZXIuYXBwbHkodGhpcywgYXJncyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KGhhbmRsZXIpKSB7XG4gICAgYXJncyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG4gICAgbGlzdGVuZXJzID0gaGFuZGxlci5zbGljZSgpO1xuICAgIGxlbiA9IGxpc3RlbmVycy5sZW5ndGg7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKVxuICAgICAgbGlzdGVuZXJzW2ldLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICB9XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmFkZExpc3RlbmVyID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgdmFyIG07XG5cbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuXG4gIC8vIFRvIGF2b2lkIHJlY3Vyc2lvbiBpbiB0aGUgY2FzZSB0aGF0IHR5cGUgPT09IFwibmV3TGlzdGVuZXJcIiEgQmVmb3JlXG4gIC8vIGFkZGluZyBpdCB0byB0aGUgbGlzdGVuZXJzLCBmaXJzdCBlbWl0IFwibmV3TGlzdGVuZXJcIi5cbiAgaWYgKHRoaXMuX2V2ZW50cy5uZXdMaXN0ZW5lcilcbiAgICB0aGlzLmVtaXQoJ25ld0xpc3RlbmVyJywgdHlwZSxcbiAgICAgICAgICAgICAgaXNGdW5jdGlvbihsaXN0ZW5lci5saXN0ZW5lcikgP1xuICAgICAgICAgICAgICBsaXN0ZW5lci5saXN0ZW5lciA6IGxpc3RlbmVyKTtcblxuICBpZiAoIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAvLyBPcHRpbWl6ZSB0aGUgY2FzZSBvZiBvbmUgbGlzdGVuZXIuIERvbid0IG5lZWQgdGhlIGV4dHJhIGFycmF5IG9iamVjdC5cbiAgICB0aGlzLl9ldmVudHNbdHlwZV0gPSBsaXN0ZW5lcjtcbiAgZWxzZSBpZiAoaXNPYmplY3QodGhpcy5fZXZlbnRzW3R5cGVdKSlcbiAgICAvLyBJZiB3ZSd2ZSBhbHJlYWR5IGdvdCBhbiBhcnJheSwganVzdCBhcHBlbmQuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdLnB1c2gobGlzdGVuZXIpO1xuICBlbHNlXG4gICAgLy8gQWRkaW5nIHRoZSBzZWNvbmQgZWxlbWVudCwgbmVlZCB0byBjaGFuZ2UgdG8gYXJyYXkuXG4gICAgdGhpcy5fZXZlbnRzW3R5cGVdID0gW3RoaXMuX2V2ZW50c1t0eXBlXSwgbGlzdGVuZXJdO1xuXG4gIC8vIENoZWNrIGZvciBsaXN0ZW5lciBsZWFrXG4gIGlmIChpc09iamVjdCh0aGlzLl9ldmVudHNbdHlwZV0pICYmICF0aGlzLl9ldmVudHNbdHlwZV0ud2FybmVkKSB7XG4gICAgaWYgKCFpc1VuZGVmaW5lZCh0aGlzLl9tYXhMaXN0ZW5lcnMpKSB7XG4gICAgICBtID0gdGhpcy5fbWF4TGlzdGVuZXJzO1xuICAgIH0gZWxzZSB7XG4gICAgICBtID0gRXZlbnRFbWl0dGVyLmRlZmF1bHRNYXhMaXN0ZW5lcnM7XG4gICAgfVxuXG4gICAgaWYgKG0gJiYgbSA+IDAgJiYgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCA+IG0pIHtcbiAgICAgIHRoaXMuX2V2ZW50c1t0eXBlXS53YXJuZWQgPSB0cnVlO1xuICAgICAgY29uc29sZS5lcnJvcignKG5vZGUpIHdhcm5pbmc6IHBvc3NpYmxlIEV2ZW50RW1pdHRlciBtZW1vcnkgJyArXG4gICAgICAgICAgICAgICAgICAgICdsZWFrIGRldGVjdGVkLiAlZCBsaXN0ZW5lcnMgYWRkZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAnVXNlIGVtaXR0ZXIuc2V0TWF4TGlzdGVuZXJzKCkgdG8gaW5jcmVhc2UgbGltaXQuJyxcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fZXZlbnRzW3R5cGVdLmxlbmd0aCk7XG4gICAgICBpZiAodHlwZW9mIGNvbnNvbGUudHJhY2UgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgLy8gbm90IHN1cHBvcnRlZCBpbiBJRSAxMFxuICAgICAgICBjb25zb2xlLnRyYWNlKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLm9uID0gRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5hZGRMaXN0ZW5lcjtcblxuRXZlbnRFbWl0dGVyLnByb3RvdHlwZS5vbmNlID0gZnVuY3Rpb24odHlwZSwgbGlzdGVuZXIpIHtcbiAgaWYgKCFpc0Z1bmN0aW9uKGxpc3RlbmVyKSlcbiAgICB0aHJvdyBUeXBlRXJyb3IoJ2xpc3RlbmVyIG11c3QgYmUgYSBmdW5jdGlvbicpO1xuXG4gIHZhciBmaXJlZCA9IGZhbHNlO1xuXG4gIGZ1bmN0aW9uIGcoKSB7XG4gICAgdGhpcy5yZW1vdmVMaXN0ZW5lcih0eXBlLCBnKTtcblxuICAgIGlmICghZmlyZWQpIHtcbiAgICAgIGZpcmVkID0gdHJ1ZTtcbiAgICAgIGxpc3RlbmVyLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgfVxuICB9XG5cbiAgZy5saXN0ZW5lciA9IGxpc3RlbmVyO1xuICB0aGlzLm9uKHR5cGUsIGcpO1xuXG4gIHJldHVybiB0aGlzO1xufTtcblxuLy8gZW1pdHMgYSAncmVtb3ZlTGlzdGVuZXInIGV2ZW50IGlmZiB0aGUgbGlzdGVuZXIgd2FzIHJlbW92ZWRcbkV2ZW50RW1pdHRlci5wcm90b3R5cGUucmVtb3ZlTGlzdGVuZXIgPSBmdW5jdGlvbih0eXBlLCBsaXN0ZW5lcikge1xuICB2YXIgbGlzdCwgcG9zaXRpb24sIGxlbmd0aCwgaTtcblxuICBpZiAoIWlzRnVuY3Rpb24obGlzdGVuZXIpKVxuICAgIHRocm93IFR5cGVFcnJvcignbGlzdGVuZXIgbXVzdCBiZSBhIGZ1bmN0aW9uJyk7XG5cbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXR1cm4gdGhpcztcblxuICBsaXN0ID0gdGhpcy5fZXZlbnRzW3R5cGVdO1xuICBsZW5ndGggPSBsaXN0Lmxlbmd0aDtcbiAgcG9zaXRpb24gPSAtMTtcblxuICBpZiAobGlzdCA9PT0gbGlzdGVuZXIgfHxcbiAgICAgIChpc0Z1bmN0aW9uKGxpc3QubGlzdGVuZXIpICYmIGxpc3QubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgaWYgKHRoaXMuX2V2ZW50cy5yZW1vdmVMaXN0ZW5lcilcbiAgICAgIHRoaXMuZW1pdCgncmVtb3ZlTGlzdGVuZXInLCB0eXBlLCBsaXN0ZW5lcik7XG5cbiAgfSBlbHNlIGlmIChpc09iamVjdChsaXN0KSkge1xuICAgIGZvciAoaSA9IGxlbmd0aDsgaS0tID4gMDspIHtcbiAgICAgIGlmIChsaXN0W2ldID09PSBsaXN0ZW5lciB8fFxuICAgICAgICAgIChsaXN0W2ldLmxpc3RlbmVyICYmIGxpc3RbaV0ubGlzdGVuZXIgPT09IGxpc3RlbmVyKSkge1xuICAgICAgICBwb3NpdGlvbiA9IGk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwb3NpdGlvbiA8IDApXG4gICAgICByZXR1cm4gdGhpcztcblxuICAgIGlmIChsaXN0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgbGlzdC5sZW5ndGggPSAwO1xuICAgICAgZGVsZXRlIHRoaXMuX2V2ZW50c1t0eXBlXTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGlzdC5zcGxpY2UocG9zaXRpb24sIDEpO1xuICAgIH1cblxuICAgIGlmICh0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpXG4gICAgICB0aGlzLmVtaXQoJ3JlbW92ZUxpc3RlbmVyJywgdHlwZSwgbGlzdGVuZXIpO1xuICB9XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLnJlbW92ZUFsbExpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIGtleSwgbGlzdGVuZXJzO1xuXG4gIGlmICghdGhpcy5fZXZlbnRzKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIC8vIG5vdCBsaXN0ZW5pbmcgZm9yIHJlbW92ZUxpc3RlbmVyLCBubyBuZWVkIHRvIGVtaXRcbiAgaWYgKCF0aGlzLl9ldmVudHMucmVtb3ZlTGlzdGVuZXIpIHtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMClcbiAgICAgIHRoaXMuX2V2ZW50cyA9IHt9O1xuICAgIGVsc2UgaWYgKHRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICAgIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvLyBlbWl0IHJlbW92ZUxpc3RlbmVyIGZvciBhbGwgbGlzdGVuZXJzIG9uIGFsbCBldmVudHNcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDApIHtcbiAgICBmb3IgKGtleSBpbiB0aGlzLl9ldmVudHMpIHtcbiAgICAgIGlmIChrZXkgPT09ICdyZW1vdmVMaXN0ZW5lcicpIGNvbnRpbnVlO1xuICAgICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoa2V5KTtcbiAgICB9XG4gICAgdGhpcy5yZW1vdmVBbGxMaXN0ZW5lcnMoJ3JlbW92ZUxpc3RlbmVyJyk7XG4gICAgdGhpcy5fZXZlbnRzID0ge307XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICBsaXN0ZW5lcnMgPSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgaWYgKGlzRnVuY3Rpb24obGlzdGVuZXJzKSkge1xuICAgIHRoaXMucmVtb3ZlTGlzdGVuZXIodHlwZSwgbGlzdGVuZXJzKTtcbiAgfSBlbHNlIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAvLyBMSUZPIG9yZGVyXG4gICAgd2hpbGUgKGxpc3RlbmVycy5sZW5ndGgpXG4gICAgICB0aGlzLnJlbW92ZUxpc3RlbmVyKHR5cGUsIGxpc3RlbmVyc1tsaXN0ZW5lcnMubGVuZ3RoIC0gMV0pO1xuICB9XG4gIGRlbGV0ZSB0aGlzLl9ldmVudHNbdHlwZV07XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVycyA9IGZ1bmN0aW9uKHR5cGUpIHtcbiAgdmFyIHJldDtcbiAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIXRoaXMuX2V2ZW50c1t0eXBlXSlcbiAgICByZXQgPSBbXTtcbiAgZWxzZSBpZiAoaXNGdW5jdGlvbih0aGlzLl9ldmVudHNbdHlwZV0pKVxuICAgIHJldCA9IFt0aGlzLl9ldmVudHNbdHlwZV1dO1xuICBlbHNlXG4gICAgcmV0ID0gdGhpcy5fZXZlbnRzW3R5cGVdLnNsaWNlKCk7XG4gIHJldHVybiByZXQ7XG59O1xuXG5FdmVudEVtaXR0ZXIucHJvdG90eXBlLmxpc3RlbmVyQ291bnQgPSBmdW5jdGlvbih0eXBlKSB7XG4gIGlmICh0aGlzLl9ldmVudHMpIHtcbiAgICB2YXIgZXZsaXN0ZW5lciA9IHRoaXMuX2V2ZW50c1t0eXBlXTtcblxuICAgIGlmIChpc0Z1bmN0aW9uKGV2bGlzdGVuZXIpKVxuICAgICAgcmV0dXJuIDE7XG4gICAgZWxzZSBpZiAoZXZsaXN0ZW5lcilcbiAgICAgIHJldHVybiBldmxpc3RlbmVyLmxlbmd0aDtcbiAgfVxuICByZXR1cm4gMDtcbn07XG5cbkV2ZW50RW1pdHRlci5saXN0ZW5lckNvdW50ID0gZnVuY3Rpb24oZW1pdHRlciwgdHlwZSkge1xuICByZXR1cm4gZW1pdHRlci5saXN0ZW5lckNvdW50KHR5cGUpO1xufTtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ29iamVjdCcgJiYgYXJnICE9PSBudWxsO1xufVxuXG5mdW5jdGlvbiBpc1VuZGVmaW5lZChhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gdm9pZCAwO1xufVxuIiwidmFyIGJ1bmRsZUZuID0gYXJndW1lbnRzWzNdO1xudmFyIHNvdXJjZXMgPSBhcmd1bWVudHNbNF07XG52YXIgY2FjaGUgPSBhcmd1bWVudHNbNV07XG5cbnZhciBzdHJpbmdpZnkgPSBKU09OLnN0cmluZ2lmeTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICB2YXIga2V5cyA9IFtdO1xuICAgIHZhciB3a2V5O1xuICAgIHZhciBjYWNoZUtleXMgPSBPYmplY3Qua2V5cyhjYWNoZSk7XG5cbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNhY2hlS2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdmFyIGtleSA9IGNhY2hlS2V5c1tpXTtcbiAgICAgICAgdmFyIGV4cCA9IGNhY2hlW2tleV0uZXhwb3J0cztcbiAgICAgICAgLy8gVXNpbmcgYmFiZWwgYXMgYSB0cmFuc3BpbGVyIHRvIHVzZSBlc21vZHVsZSwgdGhlIGV4cG9ydCB3aWxsIGFsd2F5c1xuICAgICAgICAvLyBiZSBhbiBvYmplY3Qgd2l0aCB0aGUgZGVmYXVsdCBleHBvcnQgYXMgYSBwcm9wZXJ0eSBvZiBpdC4gVG8gZW5zdXJlXG4gICAgICAgIC8vIHRoZSBleGlzdGluZyBhcGkgYW5kIGJhYmVsIGVzbW9kdWxlIGV4cG9ydHMgYXJlIGJvdGggc3VwcG9ydGVkIHdlXG4gICAgICAgIC8vIGNoZWNrIGZvciBib3RoXG4gICAgICAgIGlmIChleHAgPT09IGZuIHx8IGV4cC5kZWZhdWx0ID09PSBmbikge1xuICAgICAgICAgICAgd2tleSA9IGtleTtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCF3a2V5KSB7XG4gICAgICAgIHdrZXkgPSBNYXRoLmZsb29yKE1hdGgucG93KDE2LCA4KSAqIE1hdGgucmFuZG9tKCkpLnRvU3RyaW5nKDE2KTtcbiAgICAgICAgdmFyIHdjYWNoZSA9IHt9O1xuICAgICAgICBmb3IgKHZhciBpID0gMCwgbCA9IGNhY2hlS2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIHZhciBrZXkgPSBjYWNoZUtleXNbaV07XG4gICAgICAgICAgICB3Y2FjaGVba2V5XSA9IGtleTtcbiAgICAgICAgfVxuICAgICAgICBzb3VyY2VzW3drZXldID0gW1xuICAgICAgICAgICAgRnVuY3Rpb24oWydyZXF1aXJlJywnbW9kdWxlJywnZXhwb3J0cyddLCAnKCcgKyBmbiArICcpKHNlbGYpJyksXG4gICAgICAgICAgICB3Y2FjaGVcbiAgICAgICAgXTtcbiAgICB9XG4gICAgdmFyIHNrZXkgPSBNYXRoLmZsb29yKE1hdGgucG93KDE2LCA4KSAqIE1hdGgucmFuZG9tKCkpLnRvU3RyaW5nKDE2KTtcblxuICAgIHZhciBzY2FjaGUgPSB7fTsgc2NhY2hlW3drZXldID0gd2tleTtcbiAgICBzb3VyY2VzW3NrZXldID0gW1xuICAgICAgICBGdW5jdGlvbihbJ3JlcXVpcmUnXSwgKFxuICAgICAgICAgICAgLy8gdHJ5IHRvIGNhbGwgZGVmYXVsdCBpZiBkZWZpbmVkIHRvIGFsc28gc3VwcG9ydCBiYWJlbCBlc21vZHVsZVxuICAgICAgICAgICAgLy8gZXhwb3J0c1xuICAgICAgICAgICAgJ3ZhciBmID0gcmVxdWlyZSgnICsgc3RyaW5naWZ5KHdrZXkpICsgJyk7JyArXG4gICAgICAgICAgICAnKGYuZGVmYXVsdCA/IGYuZGVmYXVsdCA6IGYpKHNlbGYpOydcbiAgICAgICAgKSksXG4gICAgICAgIHNjYWNoZVxuICAgIF07XG5cbiAgICB2YXIgc3JjID0gJygnICsgYnVuZGxlRm4gKyAnKSh7J1xuICAgICAgICArIE9iamVjdC5rZXlzKHNvdXJjZXMpLm1hcChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgICByZXR1cm4gc3RyaW5naWZ5KGtleSkgKyAnOlsnXG4gICAgICAgICAgICAgICAgKyBzb3VyY2VzW2tleV1bMF1cbiAgICAgICAgICAgICAgICArICcsJyArIHN0cmluZ2lmeShzb3VyY2VzW2tleV1bMV0pICsgJ10nXG4gICAgICAgICAgICA7XG4gICAgICAgIH0pLmpvaW4oJywnKVxuICAgICAgICArICd9LHt9LFsnICsgc3RyaW5naWZ5KHNrZXkpICsgJ10pJ1xuICAgIDtcblxuICAgIHZhciBVUkwgPSB3aW5kb3cuVVJMIHx8IHdpbmRvdy53ZWJraXRVUkwgfHwgd2luZG93Lm1velVSTCB8fCB3aW5kb3cubXNVUkw7XG5cbiAgICByZXR1cm4gbmV3IFdvcmtlcihVUkwuY3JlYXRlT2JqZWN0VVJMKFxuICAgICAgICBuZXcgQmxvYihbc3JjXSwgeyB0eXBlOiAndGV4dC9qYXZhc2NyaXB0JyB9KVxuICAgICkpO1xufTtcbiIsIi8qXG4gKiBzaW1wbGUgQUJSIENvbnRyb2xsZXJcbiAqICAtIGNvbXB1dGUgbmV4dCBsZXZlbCBiYXNlZCBvbiBsYXN0IGZyYWdtZW50IGJ3IGhldXJpc3RpY3NcbiAqICAtIGltcGxlbWVudCBhbiBhYmFuZG9uIHJ1bGVzIHRyaWdnZXJlZCBpZiB3ZSBoYXZlIGxlc3MgdGhhbiAyIGZyYWcgYnVmZmVyZWQgYW5kIGlmIGNvbXB1dGVkIGJ3IHNob3dzIHRoYXQgd2UgcmlzayBidWZmZXIgc3RhbGxpbmdcbiAqL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQgQnVmZmVySGVscGVyIGZyb20gJy4uL2hlbHBlci9idWZmZXItaGVscGVyJztcbmltcG9ydCB7RXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5cbmNsYXNzIEFickNvbnRyb2xsZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscywgRXZlbnQuRlJBR19MT0FESU5HLFxuICAgICAgICAgICAgICAgRXZlbnQuRlJBR19MT0FEX1BST0dSRVNTLFxuICAgICAgICAgICAgICAgRXZlbnQuRlJBR19MT0FERUQsXG4gICAgICAgICAgICAgICBFdmVudC5FUlJPUik7XG4gICAgdGhpcy5sYXN0ZmV0Y2hsZXZlbCA9IDA7XG4gICAgdGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9IC0xO1xuICAgIHRoaXMuX25leHRBdXRvTGV2ZWwgPSAtMTtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0aGlzLm9uQ2hlY2sgPSB0aGlzLmFiYW5kb25SdWxlc0NoZWNrLmJpbmQodGhpcyk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuY2xlYXJUaW1lcigpO1xuICAgIEV2ZW50SGFuZGxlci5wcm90b3R5cGUuZGVzdHJveS5jYWxsKHRoaXMpO1xuICB9XG5cbiAgb25GcmFnTG9hZGluZyhkYXRhKSB7XG4gICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMub25DaGVjaywgMTAwKTtcbiAgICB0aGlzLmZyYWdDdXJyZW50ID0gZGF0YS5mcmFnO1xuICB9XG5cbiAgb25GcmFnTG9hZFByb2dyZXNzKGRhdGEpIHtcbiAgICB2YXIgc3RhdHMgPSBkYXRhLnN0YXRzO1xuICAgIC8vIG9ubHkgdXBkYXRlIHN0YXRzIGlmIGZpcnN0IGZyYWcgbG9hZGluZ1xuICAgIC8vIGlmIHNhbWUgZnJhZyBpcyBsb2FkZWQgbXVsdGlwbGUgdGltZXMsIGl0IG1pZ2h0IGJlIGluIGJyb3dzZXIgY2FjaGUsIGFuZCBsb2FkZWQgcXVpY2tseVxuICAgIC8vIGFuZCBsZWFkaW5nIHRvIHdyb25nIGJ3IGVzdGltYXRpb25cbiAgICBpZiAoc3RhdHMuYWJvcnRlZCA9PT0gdW5kZWZpbmVkICYmIGRhdGEuZnJhZy5sb2FkQ291bnRlciA9PT0gMSkge1xuICAgICAgdGhpcy5sYXN0ZmV0Y2hkdXJhdGlvbiA9IChwZXJmb3JtYW5jZS5ub3coKSAtIHN0YXRzLnRyZXF1ZXN0KSAvIDEwMDA7XG4gICAgICB0aGlzLmxhc3RmZXRjaGxldmVsID0gZGF0YS5mcmFnLmxldmVsO1xuICAgICAgdGhpcy5sYXN0YncgPSAoc3RhdHMubG9hZGVkICogOCkgLyB0aGlzLmxhc3RmZXRjaGR1cmF0aW9uO1xuICAgICAgLy9jb25zb2xlLmxvZyhgZmV0Y2hEdXJhdGlvbjoke3RoaXMubGFzdGZldGNoZHVyYXRpb259LGJ3OiR7KHRoaXMubGFzdGJ3LzEwMDApLnRvRml4ZWQoMCl9LyR7c3RhdHMuYWJvcnRlZH1gKTtcbiAgICB9XG4gIH1cblxuICBhYmFuZG9uUnVsZXNDaGVjaygpIHtcbiAgICAvKlxuICAgICAgbW9uaXRvciBmcmFnbWVudCByZXRyaWV2YWwgdGltZS4uLlxuICAgICAgd2UgY29tcHV0ZSBleHBlY3RlZCB0aW1lIG9mIGFycml2YWwgb2YgdGhlIGNvbXBsZXRlIGZyYWdtZW50LlxuICAgICAgd2UgY29tcGFyZSBpdCB0byBleHBlY3RlZCB0aW1lIG9mIGJ1ZmZlciBzdGFydmF0aW9uXG4gICAgKi9cbiAgICBsZXQgaGxzID0gdGhpcy5obHMsIHYgPSBobHMubWVkaWEsZnJhZyA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgLyogb25seSBtb25pdG9yIGZyYWcgcmV0cmlldmFsIHRpbWUgaWZcbiAgICAodmlkZW8gbm90IHBhdXNlZCBPUiBmaXJzdCBmcmFnbWVudCBiZWluZyBsb2FkZWQocmVhZHkgc3RhdGUgPT09IEhBVkVfTk9USElORyA9IDApKSBBTkQgYXV0b3N3aXRjaGluZyBlbmFibGVkIEFORCBub3QgbG93ZXN0IGxldmVsICg9PiBtZWFucyB0aGF0IHdlIGhhdmUgc2V2ZXJhbCBsZXZlbHMpICovXG4gICAgaWYgKHYgJiYgKCF2LnBhdXNlZCB8fCAhdi5yZWFkeVN0YXRlKSAmJiBmcmFnLmF1dG9MZXZlbCAmJiBmcmFnLmxldmVsKSB7XG4gICAgICBsZXQgcmVxdWVzdERlbGF5ID0gcGVyZm9ybWFuY2Uubm93KCkgLSBmcmFnLnRyZXF1ZXN0O1xuICAgICAgLy8gbW9uaXRvciBmcmFnbWVudCBsb2FkIHByb2dyZXNzIGFmdGVyIGhhbGYgb2YgZXhwZWN0ZWQgZnJhZ21lbnQgZHVyYXRpb24sdG8gc3RhYmlsaXplIGJpdHJhdGVcbiAgICAgIGlmIChyZXF1ZXN0RGVsYXkgPiAoNTAwICogZnJhZy5kdXJhdGlvbikpIHtcbiAgICAgICAgbGV0IGxvYWRSYXRlID0gTWF0aC5tYXgoMSxmcmFnLmxvYWRlZCAqIDEwMDAgLyByZXF1ZXN0RGVsYXkpOyAvLyBieXRlL3M7IGF0IGxlYXN0IDEgYnl0ZS9zIHRvIGF2b2lkIGRpdmlzaW9uIGJ5IHplcm9cbiAgICAgICAgaWYgKGZyYWcuZXhwZWN0ZWRMZW4gPCBmcmFnLmxvYWRlZCkge1xuICAgICAgICAgIGZyYWcuZXhwZWN0ZWRMZW4gPSBmcmFnLmxvYWRlZDtcbiAgICAgICAgfVxuICAgICAgICBsZXQgcG9zID0gdi5jdXJyZW50VGltZTtcbiAgICAgICAgbGV0IGZyYWdMb2FkZWREZWxheSA9IChmcmFnLmV4cGVjdGVkTGVuIC0gZnJhZy5sb2FkZWQpIC8gbG9hZFJhdGU7XG4gICAgICAgIGxldCBidWZmZXJTdGFydmF0aW9uRGVsYXkgPSBCdWZmZXJIZWxwZXIuYnVmZmVySW5mbyh2LHBvcyxobHMuY29uZmlnLm1heEJ1ZmZlckhvbGUpLmVuZCAtIHBvcztcbiAgICAgICAgLy8gY29uc2lkZXIgZW1lcmdlbmN5IHN3aXRjaCBkb3duIG9ubHkgaWYgd2UgaGF2ZSBsZXNzIHRoYW4gMiBmcmFnIGJ1ZmZlcmVkIEFORFxuICAgICAgICAvLyB0aW1lIHRvIGZpbmlzaCBsb2FkaW5nIGN1cnJlbnQgZnJhZ21lbnQgaXMgYmlnZ2VyIHRoYW4gYnVmZmVyIHN0YXJ2YXRpb24gZGVsYXlcbiAgICAgICAgLy8gaWUgaWYgd2UgcmlzayBidWZmZXIgc3RhcnZhdGlvbiBpZiBidyBkb2VzIG5vdCBpbmNyZWFzZSBxdWlja2x5XG4gICAgICAgIGlmIChidWZmZXJTdGFydmF0aW9uRGVsYXkgPCAyKmZyYWcuZHVyYXRpb24gJiYgZnJhZ0xvYWRlZERlbGF5ID4gYnVmZmVyU3RhcnZhdGlvbkRlbGF5KSB7XG4gICAgICAgICAgbGV0IGZyYWdMZXZlbE5leHRMb2FkZWREZWxheSwgbmV4dExvYWRMZXZlbDtcbiAgICAgICAgICAvLyBsZXRzIGl0ZXJhdGUgdGhyb3VnaCBsb3dlciBsZXZlbCBhbmQgdHJ5IHRvIGZpbmQgdGhlIGJpZ2dlc3Qgb25lIHRoYXQgY291bGQgYXZvaWQgcmVidWZmZXJpbmdcbiAgICAgICAgICAvLyB3ZSBzdGFydCBmcm9tIGN1cnJlbnQgbGV2ZWwgLSAxIGFuZCB3ZSBzdGVwIGRvd24gLCB1bnRpbCB3ZSBmaW5kIGEgbWF0Y2hpbmcgbGV2ZWxcbiAgICAgICAgICBmb3IgKG5leHRMb2FkTGV2ZWwgPSBmcmFnLmxldmVsIC0gMSA7IG5leHRMb2FkTGV2ZWwgPj0wIDsgbmV4dExvYWRMZXZlbC0tKSB7XG4gICAgICAgICAgICAvLyBjb21wdXRlIHRpbWUgdG8gbG9hZCBuZXh0IGZyYWdtZW50IGF0IGxvd2VyIGxldmVsXG4gICAgICAgICAgICAvLyAwLjggOiBjb25zaWRlciBvbmx5IDgwJSBvZiBjdXJyZW50IGJ3IHRvIGJlIGNvbnNlcnZhdGl2ZVxuICAgICAgICAgICAgLy8gOCA9IGJpdHMgcGVyIGJ5dGUgKGJwcy9CcHMpXG4gICAgICAgICAgICBmcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXkgPSBmcmFnLmR1cmF0aW9uICogaGxzLmxldmVsc1tuZXh0TG9hZExldmVsXS5iaXRyYXRlIC8gKDggKiAwLjggKiBsb2FkUmF0ZSk7XG4gICAgICAgICAgICBsb2dnZXIubG9nKGBmcmFnTG9hZGVkRGVsYXkvYnVmZmVyU3RhcnZhdGlvbkRlbGF5L2ZyYWdMZXZlbE5leHRMb2FkZWREZWxheVske25leHRMb2FkTGV2ZWx9XSA6JHtmcmFnTG9hZGVkRGVsYXkudG9GaXhlZCgxKX0vJHtidWZmZXJTdGFydmF0aW9uRGVsYXkudG9GaXhlZCgxKX0vJHtmcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXkudG9GaXhlZCgxKX1gKTtcbiAgICAgICAgICAgIGlmIChmcmFnTGV2ZWxOZXh0TG9hZGVkRGVsYXkgPCBidWZmZXJTdGFydmF0aW9uRGVsYXkpIHtcbiAgICAgICAgICAgICAgLy8gd2UgZm91bmQgYSBsb3dlciBsZXZlbCB0aGF0IGJlIHJlYnVmZmVyaW5nIGZyZWUgd2l0aCBjdXJyZW50IGVzdGltYXRlZCBidyAhXG4gICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBvbmx5IGVtZXJnZW5jeSBzd2l0Y2ggZG93biBpZiBpdCB0YWtlcyBsZXNzIHRpbWUgdG8gbG9hZCBuZXcgZnJhZ21lbnQgYXQgbG93ZXN0IGxldmVsIGluc3RlYWRcbiAgICAgICAgICAvLyBvZiBmaW5pc2hpbmcgbG9hZGluZyBjdXJyZW50IG9uZSAuLi5cbiAgICAgICAgICBpZiAoZnJhZ0xldmVsTmV4dExvYWRlZERlbGF5IDwgZnJhZ0xvYWRlZERlbGF5KSB7XG4gICAgICAgICAgICAvLyBlbnN1cmUgbmV4dExvYWRMZXZlbCBpcyBub3QgbmVnYXRpdmVcbiAgICAgICAgICAgIG5leHRMb2FkTGV2ZWwgPSBNYXRoLm1heCgwLG5leHRMb2FkTGV2ZWwpO1xuICAgICAgICAgICAgLy8gZm9yY2UgbmV4dCBsb2FkIGxldmVsIGluIGF1dG8gbW9kZVxuICAgICAgICAgICAgaGxzLm5leHRMb2FkTGV2ZWwgPSBuZXh0TG9hZExldmVsO1xuICAgICAgICAgICAgLy8gYWJvcnQgZnJhZ21lbnQgbG9hZGluZyAuLi5cbiAgICAgICAgICAgIGxvZ2dlci53YXJuKGBsb2FkaW5nIHRvbyBzbG93LCBhYm9ydCBmcmFnbWVudCBsb2FkaW5nIGFuZCBzd2l0Y2ggdG8gbGV2ZWwgJHtuZXh0TG9hZExldmVsfWApO1xuICAgICAgICAgICAgLy9hYm9ydCBmcmFnbWVudCBsb2FkaW5nXG4gICAgICAgICAgICBmcmFnLmxvYWRlci5hYm9ydCgpO1xuICAgICAgICAgICAgdGhpcy5jbGVhclRpbWVyKCk7XG4gICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5GUkFHX0xPQURfRU1FUkdFTkNZX0FCT1JURUQsIHtmcmFnOiBmcmFnfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgb25GcmFnTG9hZGVkKCkge1xuICAgIC8vIHN0b3AgbW9uaXRvcmluZyBidyBvbmNlIGZyYWcgbG9hZGVkXG4gICAgdGhpcy5jbGVhclRpbWVyKCk7XG4gIH1cblxuICBvbkVycm9yKGRhdGEpIHtcbiAgICAvLyBzdG9wIHRpbWVyIGluIGNhc2Ugb2YgZnJhZyBsb2FkaW5nIGVycm9yXG4gICAgc3dpdGNoKGRhdGEuZGV0YWlscykge1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQ6XG4gICAgICAgIHRoaXMuY2xlYXJUaW1lcigpO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gY2xlYXJUaW1lcigpIHtcbiAgICBpZiAodGhpcy50aW1lcikge1xuICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgIH1cbiB9XG5cbiAgLyoqIFJldHVybiB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBnZXQgYXV0b0xldmVsQ2FwcGluZygpIHtcbiAgICByZXR1cm4gdGhpcy5fYXV0b0xldmVsQ2FwcGluZztcbiAgfVxuXG4gIC8qKiBzZXQgdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgc2V0IGF1dG9MZXZlbENhcHBpbmcobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gbmV3TGV2ZWw7XG4gIH1cblxuICBnZXQgbmV4dEF1dG9MZXZlbCgpIHtcbiAgICB2YXIgbGFzdGJ3ID0gdGhpcy5sYXN0YncsIGhscyA9IHRoaXMuaGxzLGFkanVzdGVkYncsIGksIG1heEF1dG9MZXZlbDtcbiAgICBpZiAodGhpcy5fYXV0b0xldmVsQ2FwcGluZyA9PT0gLTEpIHtcbiAgICAgIG1heEF1dG9MZXZlbCA9IGhscy5sZXZlbHMubGVuZ3RoIC0gMTtcbiAgICB9IGVsc2Uge1xuICAgICAgbWF4QXV0b0xldmVsID0gdGhpcy5fYXV0b0xldmVsQ2FwcGluZztcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fbmV4dEF1dG9MZXZlbCAhPT0gLTEpIHtcbiAgICAgIHZhciBuZXh0TGV2ZWwgPSBNYXRoLm1pbih0aGlzLl9uZXh0QXV0b0xldmVsLG1heEF1dG9MZXZlbCk7XG4gICAgICBpZiAobmV4dExldmVsID09PSB0aGlzLmxhc3RmZXRjaGxldmVsKSB7XG4gICAgICAgIHRoaXMuX25leHRBdXRvTGV2ZWwgPSAtMTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBuZXh0TGV2ZWw7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gZm9sbG93IGFsZ29yaXRobSBjYXB0dXJlZCBmcm9tIHN0YWdlZnJpZ2h0IDpcbiAgICAvLyBodHRwczovL2FuZHJvaWQuZ29vZ2xlc291cmNlLmNvbS9wbGF0Zm9ybS9mcmFtZXdvcmtzL2F2LysvbWFzdGVyL21lZGlhL2xpYnN0YWdlZnJpZ2h0L2h0dHBsaXZlL0xpdmVTZXNzaW9uLmNwcFxuICAgIC8vIFBpY2sgdGhlIGhpZ2hlc3QgYmFuZHdpZHRoIHN0cmVhbSBiZWxvdyBvciBlcXVhbCB0byBlc3RpbWF0ZWQgYmFuZHdpZHRoLlxuICAgIGZvciAoaSA9IDA7IGkgPD0gbWF4QXV0b0xldmVsOyBpKyspIHtcbiAgICAvLyBjb25zaWRlciBvbmx5IDgwJSBvZiB0aGUgYXZhaWxhYmxlIGJhbmR3aWR0aCwgYnV0IGlmIHdlIGFyZSBzd2l0Y2hpbmcgdXAsXG4gICAgLy8gYmUgZXZlbiBtb3JlIGNvbnNlcnZhdGl2ZSAoNzAlKSB0byBhdm9pZCBvdmVyZXN0aW1hdGluZyBhbmQgaW1tZWRpYXRlbHlcbiAgICAvLyBzd2l0Y2hpbmcgYmFjay5cbiAgICAgIGlmIChpIDw9IHRoaXMubGFzdGZldGNobGV2ZWwpIHtcbiAgICAgICAgYWRqdXN0ZWRidyA9IDAuOCAqIGxhc3RidztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFkanVzdGVkYncgPSAwLjcgKiBsYXN0Ync7XG4gICAgICB9XG4gICAgICBpZiAoYWRqdXN0ZWRidyA8IGhscy5sZXZlbHNbaV0uYml0cmF0ZSkge1xuICAgICAgICByZXR1cm4gTWF0aC5tYXgoMCwgaSAtIDEpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gaSAtIDE7XG4gIH1cblxuICBzZXQgbmV4dEF1dG9MZXZlbChuZXh0TGV2ZWwpIHtcbiAgICB0aGlzLl9uZXh0QXV0b0xldmVsID0gbmV4dExldmVsO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFickNvbnRyb2xsZXI7XG5cbiIsIi8qXG4gKiBCdWZmZXIgQ29udHJvbGxlclxuKi9cblxuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuXG5jbGFzcyBCdWZmZXJDb250cm9sbGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsXG4gICAgICBFdmVudC5NRURJQV9BVFRBQ0hJTkcsXG4gICAgICBFdmVudC5NRURJQV9ERVRBQ0hJTkcsXG4gICAgICBFdmVudC5CVUZGRVJfUkVTRVQsXG4gICAgICBFdmVudC5CVUZGRVJfQVBQRU5ESU5HLFxuICAgICAgRXZlbnQuQlVGRkVSX0NPREVDUyxcbiAgICAgIEV2ZW50LkJVRkZFUl9FT1MsXG4gICAgICBFdmVudC5CVUZGRVJfRkxVU0hJTkcpO1xuXG4gICAgLy8gU291cmNlIEJ1ZmZlciBsaXN0ZW5lcnNcbiAgICB0aGlzLm9uc2J1ZSA9IHRoaXMub25TQlVwZGF0ZUVuZC5iaW5kKHRoaXMpO1xuICAgIHRoaXMub25zYmUgID0gdGhpcy5vblNCVXBkYXRlRXJyb3IuYmluZCh0aGlzKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gIH1cblxuICBvbk1lZGlhQXR0YWNoaW5nKGRhdGEpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhID0gZGF0YS5tZWRpYTtcbiAgICAvLyBzZXR1cCB0aGUgbWVkaWEgc291cmNlXG4gICAgdmFyIG1zID0gdGhpcy5tZWRpYVNvdXJjZSA9IG5ldyBNZWRpYVNvdXJjZSgpO1xuICAgIC8vTWVkaWEgU291cmNlIGxpc3RlbmVyc1xuICAgIHRoaXMub25tc28gPSB0aGlzLm9uTWVkaWFTb3VyY2VPcGVuLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1zZSA9IHRoaXMub25NZWRpYVNvdXJjZUVuZGVkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbm1zYyA9IHRoaXMub25NZWRpYVNvdXJjZUNsb3NlLmJpbmQodGhpcyk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsIHRoaXMub25tc28pO1xuICAgIG1zLmFkZEV2ZW50TGlzdGVuZXIoJ3NvdXJjZWVuZGVkJywgdGhpcy5vbm1zZSk7XG4gICAgbXMuYWRkRXZlbnRMaXN0ZW5lcignc291cmNlY2xvc2UnLCB0aGlzLm9ubXNjKTtcbiAgICAvLyBsaW5rIHZpZGVvIGFuZCBtZWRpYSBTb3VyY2VcbiAgICBtZWRpYS5zcmMgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKG1zKTtcbiAgfVxuXG4gIG9uTWVkaWFEZXRhY2hpbmcoKSB7XG4gICAgdmFyIG1zID0gdGhpcy5tZWRpYVNvdXJjZTtcbiAgICBpZiAobXMpIHtcbiAgICAgIGlmIChtcy5yZWFkeVN0YXRlID09PSAnb3BlbicpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAvLyBlbmRPZlN0cmVhbSBjb3VsZCB0cmlnZ2VyIGV4Y2VwdGlvbiBpZiBhbnkgc291cmNlYnVmZmVyIGlzIGluIHVwZGF0aW5nIHN0YXRlXG4gICAgICAgICAgLy8gd2UgZG9uJ3QgcmVhbGx5IGNhcmUgYWJvdXQgY2hlY2tpbmcgc291cmNlYnVmZmVyIHN0YXRlIGhlcmUsXG4gICAgICAgICAgLy8gYXMgd2UgYXJlIGFueXdheSBkZXRhY2hpbmcgdGhlIE1lZGlhU291cmNlXG4gICAgICAgICAgLy8gbGV0J3MganVzdCBhdm9pZCB0aGlzIGV4Y2VwdGlvbiB0byBwcm9wYWdhdGVcbiAgICAgICAgICBtcy5lbmRPZlN0cmVhbSgpO1xuICAgICAgICB9IGNhdGNoKGVycikge1xuICAgICAgICAgIGxvZ2dlci53YXJuKGBvbk1lZGlhRGV0YWNoaW5nOiR7ZXJyLm1lc3NhZ2V9IHdoaWxlIGNhbGxpbmcgZW5kT2ZTdHJlYW1gKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlb3BlbicsIHRoaXMub25tc28pO1xuICAgICAgbXMucmVtb3ZlRXZlbnRMaXN0ZW5lcignc291cmNlZW5kZWQnLCB0aGlzLm9ubXNlKTtcbiAgICAgIG1zLnJlbW92ZUV2ZW50TGlzdGVuZXIoJ3NvdXJjZWNsb3NlJywgdGhpcy5vbm1zYyk7XG4gICAgICAvLyB1bmxpbmsgTWVkaWFTb3VyY2UgZnJvbSB2aWRlbyB0YWdcbiAgICAgIHRoaXMubWVkaWEuc3JjID0gJyc7XG4gICAgICB0aGlzLm1lZGlhLnJlbW92ZUF0dHJpYnV0ZSgnc3JjJyk7XG4gICAgICB0aGlzLm1lZGlhU291cmNlID0gbnVsbDtcbiAgICAgIHRoaXMubWVkaWEgPSBudWxsO1xuICAgICAgdGhpcy5wZW5kaW5nVHJhY2tzID0gbnVsbDtcbiAgICAgIHRoaXMuc291cmNlQnVmZmVyID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5vbm1zbyA9IHRoaXMub25tc2UgPSB0aGlzLm9ubXNjID0gbnVsbDtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50Lk1FRElBX0RFVEFDSEVEKTtcbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VPcGVuKCkge1xuICAgIGxvZ2dlci5sb2coJ21lZGlhIHNvdXJjZSBvcGVuZWQnKTtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50Lk1FRElBX0FUVEFDSEVELCB7IG1lZGlhIDogdGhpcy5tZWRpYSB9KTtcbiAgICAvLyBvbmNlIHJlY2VpdmVkLCBkb24ndCBsaXN0ZW4gYW55bW9yZSB0byBzb3VyY2VvcGVuIGV2ZW50XG4gICAgdGhpcy5tZWRpYVNvdXJjZS5yZW1vdmVFdmVudExpc3RlbmVyKCdzb3VyY2VvcGVuJywgdGhpcy5vbm1zbyk7XG4gICAgLy8gaWYgYW55IGJ1ZmZlciBjb2RlY3MgcGVuZGluZywgdHJlYXQgaXQgaGVyZS5cbiAgICB2YXIgcGVuZGluZ1RyYWNrcyA9IHRoaXMucGVuZGluZ1RyYWNrcztcbiAgICBpZiAocGVuZGluZ1RyYWNrcykge1xuICAgICAgdGhpcy5vbkJ1ZmZlckNvZGVjcyhwZW5kaW5nVHJhY2tzKTtcbiAgICAgIHRoaXMucGVuZGluZ1RyYWNrcyA9IG51bGw7XG4gICAgICB0aGlzLmRvQXBwZW5kaW5nKCk7XG4gICAgfVxuICB9XG5cbiAgb25NZWRpYVNvdXJjZUNsb3NlKCkge1xuICAgIGxvZ2dlci5sb2coJ21lZGlhIHNvdXJjZSBjbG9zZWQnKTtcbiAgfVxuXG4gIG9uTWVkaWFTb3VyY2VFbmRlZCgpIHtcbiAgICBsb2dnZXIubG9nKCdtZWRpYSBzb3VyY2UgZW5kZWQnKTtcbiAgfVxuXG5cbiAgb25TQlVwZGF0ZUVuZCgpIHtcblxuICAgIGlmICh0aGlzLl9uZWVkc0ZsdXNoKSB7XG4gICAgICB0aGlzLmRvRmx1c2goKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fbmVlZHNFb3MpIHtcbiAgICAgIHRoaXMub25CdWZmZXJFb3MoKTtcbiAgICB9XG5cbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9BUFBFTkRFRCk7XG5cbiAgICB0aGlzLmRvQXBwZW5kaW5nKCk7XG4gIH1cblxuICBvblNCVXBkYXRlRXJyb3IoZXZlbnQpIHtcbiAgICBsb2dnZXIuZXJyb3IoYHNvdXJjZUJ1ZmZlciBlcnJvcjoke2V2ZW50fWApO1xuICAgIC8vIGFjY29yZGluZyB0byBodHRwOi8vd3d3LnczLm9yZy9UUi9tZWRpYS1zb3VyY2UvI3NvdXJjZWJ1ZmZlci1hcHBlbmQtZXJyb3JcbiAgICAvLyB0aGlzIGVycm9yIG1pZ2h0IG5vdCBhbHdheXMgYmUgZmF0YWwgKGl0IGlzIGZhdGFsIGlmIGRlY29kZSBlcnJvciBpcyBzZXQsIGluIHRoYXQgY2FzZVxuICAgIC8vIGl0IHdpbGwgYmUgZm9sbG93ZWQgYnkgYSBtZWRpYUVsZW1lbnQgZXJyb3IgLi4uKVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuQlVGRkVSX0FQUEVORElOR19FUlJPUiwgZmF0YWw6IGZhbHNlfSk7XG4gICAgLy8gd2UgZG9uJ3QgbmVlZCB0byBkbyBtb3JlIHRoYW4gdGhhdCwgYXMgYWNjb3JkaW4gdG8gdGhlIHNwZWMsIHVwZGF0ZWVuZCB3aWxsIGJlIGZpcmVkIGp1c3QgYWZ0ZXJcbiAgfVxuXG4gIG9uQnVmZmVyUmVzZXQoKSB7XG4gICAgdmFyIHNvdXJjZUJ1ZmZlciA9IHRoaXMuc291cmNlQnVmZmVyO1xuICAgIGlmIChzb3VyY2VCdWZmZXIpIHtcbiAgICAgIGZvcih2YXIgdHlwZSBpbiBzb3VyY2VCdWZmZXIpIHtcbiAgICAgICAgdmFyIHNiID0gc291cmNlQnVmZmVyW3R5cGVdO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHRoaXMubWVkaWFTb3VyY2UucmVtb3ZlU291cmNlQnVmZmVyKHNiKTtcbiAgICAgICAgICBzYi5yZW1vdmVFdmVudExpc3RlbmVyKCd1cGRhdGVlbmQnLCB0aGlzLm9uc2J1ZSk7XG4gICAgICAgICAgc2IucmVtb3ZlRXZlbnRMaXN0ZW5lcignZXJyb3InLCB0aGlzLm9uc2JlKTtcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5zb3VyY2VCdWZmZXIgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLmZsdXNoUmFuZ2UgPSBbXTtcbiAgICB0aGlzLmFwcGVuZGVkID0gMDtcbiAgfVxuXG4gIG9uQnVmZmVyQ29kZWNzKHRyYWNrcykge1xuICAgIHZhciBzYix0cmFja05hbWUsdHJhY2ssIGNvZGVjLCBtaW1lVHlwZTtcblxuICAgIGlmICghdGhpcy5tZWRpYSkge1xuICAgICAgdGhpcy5wZW5kaW5nVHJhY2tzID0gdHJhY2tzO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghdGhpcy5zb3VyY2VCdWZmZXIpIHtcbiAgICAgIHZhciBzb3VyY2VCdWZmZXIgPSB7fSwgbWVkaWFTb3VyY2UgPSB0aGlzLm1lZGlhU291cmNlO1xuICAgICAgZm9yICh0cmFja05hbWUgaW4gdHJhY2tzKSB7XG4gICAgICAgIHRyYWNrID0gdHJhY2tzW3RyYWNrTmFtZV07XG4gICAgICAgIC8vIHVzZSBsZXZlbENvZGVjIGFzIGZpcnN0IHByaW9yaXR5XG4gICAgICAgIGNvZGVjID0gdHJhY2subGV2ZWxDb2RlYyB8fCB0cmFjay5jb2RlYztcbiAgICAgICAgbWltZVR5cGUgPSBgJHt0cmFjay5jb250YWluZXJ9O2NvZGVjcz0ke2NvZGVjfWA7XG4gICAgICAgIGxvZ2dlci5sb2coYGNyZWF0aW5nIHNvdXJjZUJ1ZmZlciB3aXRoIG1pbWVUeXBlOiR7bWltZVR5cGV9YCk7XG4gICAgICAgIHNiID0gc291cmNlQnVmZmVyW3RyYWNrTmFtZV0gPSBtZWRpYVNvdXJjZS5hZGRTb3VyY2VCdWZmZXIobWltZVR5cGUpO1xuICAgICAgICBzYi5hZGRFdmVudExpc3RlbmVyKCd1cGRhdGVlbmQnLCB0aGlzLm9uc2J1ZSk7XG4gICAgICAgIHNiLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgdGhpcy5vbnNiZSk7XG4gICAgICB9XG4gICAgICB0aGlzLnNvdXJjZUJ1ZmZlciA9IHNvdXJjZUJ1ZmZlcjtcbiAgICB9XG4gIH1cblxuICBvbkJ1ZmZlckFwcGVuZGluZyhkYXRhKSB7XG4gICAgaWYgKCF0aGlzLnNlZ21lbnRzKSB7XG4gICAgICB0aGlzLnNlZ21lbnRzID0gWyBkYXRhIF07XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuc2VnbWVudHMucHVzaChkYXRhKTtcbiAgICB9XG4gICAgdGhpcy5kb0FwcGVuZGluZygpO1xuICB9XG5cbiAgb25CdWZmZXJBcHBlbmRGYWlsKGRhdGEpIHtcbiAgICBsb2dnZXIuZXJyb3IoYHNvdXJjZUJ1ZmZlciBlcnJvcjoke2RhdGEuZXZlbnR9YCk7XG4gICAgLy8gYWNjb3JkaW5nIHRvIGh0dHA6Ly93d3cudzMub3JnL1RSL21lZGlhLXNvdXJjZS8jc291cmNlYnVmZmVyLWFwcGVuZC1lcnJvclxuICAgIC8vIHRoaXMgZXJyb3IgbWlnaHQgbm90IGFsd2F5cyBiZSBmYXRhbCAoaXQgaXMgZmF0YWwgaWYgZGVjb2RlIGVycm9yIGlzIHNldCwgaW4gdGhhdCBjYXNlXG4gICAgLy8gaXQgd2lsbCBiZSBmb2xsb3dlZCBieSBhIG1lZGlhRWxlbWVudCBlcnJvciAuLi4pXG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5CVUZGRVJfQVBQRU5ESU5HX0VSUk9SLCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZ0N1cnJlbnR9KTtcbiAgfVxuXG4gIG9uQnVmZmVyRW9zKCkge1xuICAgIHZhciBzYiA9IHRoaXMuc291cmNlQnVmZmVyLCBtZWRpYVNvdXJjZSA9IHRoaXMubWVkaWFTb3VyY2U7XG4gICAgaWYgKCFtZWRpYVNvdXJjZSB8fCBtZWRpYVNvdXJjZS5yZWFkeVN0YXRlICE9PSAnb3BlbicpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKCEoKHNiLmF1ZGlvICYmIHNiLmF1ZGlvLnVwZGF0aW5nKSB8fCAoc2IudmlkZW8gJiYgc2IudmlkZW8udXBkYXRpbmcpKSkge1xuICAgICAgbG9nZ2VyLmxvZygnYWxsIG1lZGlhIGRhdGEgYXZhaWxhYmxlLCBzaWduYWwgZW5kT2ZTdHJlYW0oKSB0byBNZWRpYVNvdXJjZSBhbmQgc3RvcCBsb2FkaW5nIGZyYWdtZW50Jyk7XG4gICAgICAvL05vdGlmeSB0aGUgbWVkaWEgZWxlbWVudCB0aGF0IGl0IG5vdyBoYXMgYWxsIG9mIHRoZSBtZWRpYSBkYXRhXG4gICAgICBtZWRpYVNvdXJjZS5lbmRPZlN0cmVhbSgpO1xuICAgICAgdGhpcy5fbmVlZHNFb3MgPSBmYWxzZTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fbmVlZHNFb3MgPSB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIG9uQnVmZmVyRmx1c2hpbmcoZGF0YSkge1xuICAgIHRoaXMuZmx1c2hSYW5nZS5wdXNoKHtzdGFydDogZGF0YS5zdGFydE9mZnNldCwgZW5kOiBkYXRhLmVuZE9mZnNldH0pO1xuICAgIC8vIGF0dGVtcHQgZmx1c2ggaW1tZWRpYXRseVxuICAgIHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyID0gMDtcbiAgICB0aGlzLmRvRmx1c2goKTtcbiAgfVxuXG4gIGRvRmx1c2goKSB7XG4gICAgLy8gbG9vcCB0aHJvdWdoIGFsbCBidWZmZXIgcmFuZ2VzIHRvIGZsdXNoXG4gICAgd2hpbGUodGhpcy5mbHVzaFJhbmdlLmxlbmd0aCkge1xuICAgICAgdmFyIHJhbmdlID0gdGhpcy5mbHVzaFJhbmdlWzBdO1xuICAgICAgLy8gZmx1c2hCdWZmZXIgd2lsbCBhYm9ydCBhbnkgYnVmZmVyIGFwcGVuZCBpbiBwcm9ncmVzcyBhbmQgZmx1c2ggQXVkaW8vVmlkZW8gQnVmZmVyXG4gICAgICBpZiAodGhpcy5mbHVzaEJ1ZmZlcihyYW5nZS5zdGFydCwgcmFuZ2UuZW5kKSkge1xuICAgICAgICAvLyByYW5nZSBmbHVzaGVkLCByZW1vdmUgZnJvbSBmbHVzaCBhcnJheVxuICAgICAgICB0aGlzLmZsdXNoUmFuZ2Uuc2hpZnQoKTtcbiAgICAgICAgdGhpcy5mbHVzaEJ1ZmZlckNvdW50ZXIgPSAwO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fbmVlZHNGbHVzaCA9IHRydWU7XG4gICAgICAgIC8vIGF2b2lkIGxvb3BpbmcsIHdhaXQgZm9yIFNCIHVwZGF0ZSBlbmQgdG8gcmV0cmlnZ2VyIGEgZmx1c2hcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAodGhpcy5mbHVzaFJhbmdlLmxlbmd0aCA9PT0gMCkge1xuICAgICAgLy8gZXZlcnl0aGluZyBmbHVzaGVkXG4gICAgICB0aGlzLl9uZWVkc0ZsdXNoID0gZmFsc2U7XG5cbiAgICAgIC8vIGxldCdzIHJlY29tcHV0ZSB0aGlzLmFwcGVuZGVkLCB3aGljaCBpcyB1c2VkIHRvIGF2b2lkIGZsdXNoIGxvb3BpbmdcbiAgICAgIHZhciBhcHBlbmRlZCA9IDA7XG4gICAgICB2YXIgc291cmNlQnVmZmVyID0gdGhpcy5zb3VyY2VCdWZmZXI7XG4gICAgICBpZiAoc291cmNlQnVmZmVyKSB7XG4gICAgICAgIGZvciAodmFyIHR5cGUgaW4gc291cmNlQnVmZmVyKSB7XG4gICAgICAgICAgYXBwZW5kZWQgKz0gc291cmNlQnVmZmVyW3R5cGVdLmJ1ZmZlcmVkLmxlbmd0aDtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdGhpcy5hcHBlbmRlZCA9IGFwcGVuZGVkO1xuICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfRkxVU0hFRCk7XG4gICAgfVxuICB9XG5cbiAgZG9BcHBlbmRpbmcoKSB7XG4gICAgdmFyIGhscyA9IHRoaXMuaGxzLCBzb3VyY2VCdWZmZXIgPSB0aGlzLnNvdXJjZUJ1ZmZlciwgc2VnbWVudHMgPSB0aGlzLnNlZ21lbnRzO1xuICAgIGlmIChzb3VyY2VCdWZmZXIpIHtcbiAgICAgIGlmICh0aGlzLm1lZGlhLmVycm9yKSB7XG4gICAgICAgIHNlZ21lbnRzID0gW107XG4gICAgICAgIGxvZ2dlci5lcnJvcigndHJ5aW5nIHRvIGFwcGVuZCBhbHRob3VnaCBhIG1lZGlhIGVycm9yIG9jY3VyZWQsIGZsdXNoIHNlZ21lbnQgYW5kIGFib3J0Jyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGZvciAodmFyIHR5cGUgaW4gc291cmNlQnVmZmVyKSB7XG4gICAgICAgIGlmIChzb3VyY2VCdWZmZXJbdHlwZV0udXBkYXRpbmcpIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ3NiIHVwZGF0ZSBpbiBwcm9ncmVzcycpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKHNlZ21lbnRzLmxlbmd0aCkge1xuICAgICAgICB2YXIgc2VnbWVudCA9IHNlZ21lbnRzLnNoaWZ0KCk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKGBhcHBlbmRpbmcgJHtzZWdtZW50LnR5cGV9IFNCLCBzaXplOiR7c2VnbWVudC5kYXRhLmxlbmd0aH0pO1xuICAgICAgICAgIHNvdXJjZUJ1ZmZlcltzZWdtZW50LnR5cGVdLmFwcGVuZEJ1ZmZlcihzZWdtZW50LmRhdGEpO1xuICAgICAgICAgIHRoaXMuYXBwZW5kRXJyb3IgPSAwO1xuICAgICAgICAgIHRoaXMuYXBwZW5kZWQrKztcbiAgICAgICAgfSBjYXRjaChlcnIpIHtcbiAgICAgICAgICAvLyBpbiBjYXNlIGFueSBlcnJvciBvY2N1cmVkIHdoaWxlIGFwcGVuZGluZywgcHV0IGJhY2sgc2VnbWVudCBpbiBzZWdtZW50cyB0YWJsZVxuICAgICAgICAgIGxvZ2dlci5lcnJvcihgZXJyb3Igd2hpbGUgdHJ5aW5nIHRvIGFwcGVuZCBidWZmZXI6JHtlcnIubWVzc2FnZX1gKTtcbiAgICAgICAgICBzZWdtZW50cy51bnNoaWZ0KHNlZ21lbnQpO1xuICAgICAgICAgIHZhciBldmVudCA9IHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SfTtcbiAgICAgICAgICBpZihlcnIuY29kZSAhPT0gMjIpIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmFwcGVuZEVycm9yKSB7XG4gICAgICAgICAgICAgIHRoaXMuYXBwZW5kRXJyb3IrKztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMuYXBwZW5kRXJyb3IgPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZXZlbnQuZGV0YWlscyA9IEVycm9yRGV0YWlscy5CVUZGRVJfQVBQRU5EX0VSUk9SO1xuICAgICAgICAgICAgZXZlbnQuZnJhZyA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgICAgICAgICAvKiB3aXRoIFVIRCBjb250ZW50LCB3ZSBjb3VsZCBnZXQgbG9vcCBvZiBxdW90YSBleGNlZWRlZCBlcnJvciB1bnRpbFxuICAgICAgICAgICAgICBicm93c2VyIGlzIGFibGUgdG8gZXZpY3Qgc29tZSBkYXRhIGZyb20gc291cmNlYnVmZmVyLiByZXRyeWluZyBoZWxwIHJlY292ZXJpbmcgdGhpc1xuICAgICAgICAgICAgKi9cbiAgICAgICAgICAgIGlmICh0aGlzLmFwcGVuZEVycm9yID4gaGxzLmNvbmZpZy5hcHBlbmRFcnJvck1heFJldHJ5KSB7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYGZhaWwgJHtobHMuY29uZmlnLmFwcGVuZEVycm9yTWF4UmV0cnl9IHRpbWVzIHRvIGFwcGVuZCBzZWdtZW50IGluIHNvdXJjZUJ1ZmZlcmApO1xuICAgICAgICAgICAgICBzZWdtZW50cyA9IFtdO1xuICAgICAgICAgICAgICBldmVudC5mYXRhbCA9IHRydWU7XG4gICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCBldmVudCk7XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGV2ZW50LmZhdGFsID0gZmFsc2U7XG4gICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCBldmVudCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFF1b3RhRXhjZWVkZWRFcnJvcjogaHR0cDovL3d3dy53My5vcmcvVFIvaHRtbDUvaW5mcmFzdHJ1Y3R1cmUuaHRtbCNxdW90YWV4Y2VlZGVkZXJyb3JcbiAgICAgICAgICAgIC8vIGxldCdzIHN0b3AgYXBwZW5kaW5nIGFueSBzZWdtZW50cywgYW5kIHJlcG9ydCBCVUZGRVJfRlVMTF9FUlJPUiBlcnJvclxuICAgICAgICAgICAgc2VnbWVudHMgPSBbXTtcbiAgICAgICAgICAgIGV2ZW50LmRldGFpbHMgPSBFcnJvckRldGFpbHMuQlVGRkVSX0ZVTExfRVJST1I7XG4gICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUixldmVudCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLypcbiAgICBmbHVzaCBzcGVjaWZpZWQgYnVmZmVyZWQgcmFuZ2UsXG4gICAgcmV0dXJuIHRydWUgb25jZSByYW5nZSBoYXMgYmVlbiBmbHVzaGVkLlxuICAgIGFzIHNvdXJjZUJ1ZmZlci5yZW1vdmUoKSBpcyBhc3luY2hyb25vdXMsIGZsdXNoQnVmZmVyIHdpbGwgYmUgcmV0cmlnZ2VyZWQgb24gc291cmNlQnVmZmVyIHVwZGF0ZSBlbmRcbiAgKi9cbiAgZmx1c2hCdWZmZXIoc3RhcnRPZmZzZXQsIGVuZE9mZnNldCkge1xuICAgIHZhciBzYiwgaSwgYnVmU3RhcnQsIGJ1ZkVuZCwgZmx1c2hTdGFydCwgZmx1c2hFbmQ7XG4gICAgLy9sb2dnZXIubG9nKCdmbHVzaEJ1ZmZlcixwb3Mvc3RhcnQvZW5kOiAnICsgdGhpcy5tZWRpYS5jdXJyZW50VGltZSArICcvJyArIHN0YXJ0T2Zmc2V0ICsgJy8nICsgZW5kT2Zmc2V0KTtcbiAgICAvLyBzYWZlZ3VhcmQgdG8gYXZvaWQgaW5maW5pdGUgbG9vcGluZyA6IGRvbid0IHRyeSB0byBmbHVzaCBtb3JlIHRoYW4gdGhlIG5iIG9mIGFwcGVuZGVkIHNlZ21lbnRzXG4gICAgaWYgKHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyIDwgdGhpcy5hcHBlbmRlZCAmJiB0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgZm9yICh2YXIgdHlwZSBpbiB0aGlzLnNvdXJjZUJ1ZmZlcikge1xuICAgICAgICBzYiA9IHRoaXMuc291cmNlQnVmZmVyW3R5cGVdO1xuICAgICAgICBpZiAoIXNiLnVwZGF0aW5nKSB7XG4gICAgICAgICAgZm9yIChpID0gMDsgaSA8IHNiLmJ1ZmZlcmVkLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgICBidWZTdGFydCA9IHNiLmJ1ZmZlcmVkLnN0YXJ0KGkpO1xuICAgICAgICAgICAgYnVmRW5kID0gc2IuYnVmZmVyZWQuZW5kKGkpO1xuICAgICAgICAgICAgLy8gd29ya2Fyb3VuZCBmaXJlZm94IG5vdCBhYmxlIHRvIHByb3Blcmx5IGZsdXNoIG11bHRpcGxlIGJ1ZmZlcmVkIHJhbmdlLlxuICAgICAgICAgICAgaWYgKG5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKS5pbmRleE9mKCdmaXJlZm94JykgIT09IC0xICYmIGVuZE9mZnNldCA9PT0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZKSB7XG4gICAgICAgICAgICAgIGZsdXNoU3RhcnQgPSBzdGFydE9mZnNldDtcbiAgICAgICAgICAgICAgZmx1c2hFbmQgPSBlbmRPZmZzZXQ7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBmbHVzaFN0YXJ0ID0gTWF0aC5tYXgoYnVmU3RhcnQsIHN0YXJ0T2Zmc2V0KTtcbiAgICAgICAgICAgICAgZmx1c2hFbmQgPSBNYXRoLm1pbihidWZFbmQsIGVuZE9mZnNldCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvKiBzb21ldGltZXMgc291cmNlYnVmZmVyLnJlbW92ZSgpIGRvZXMgbm90IGZsdXNoXG4gICAgICAgICAgICAgICB0aGUgZXhhY3QgZXhwZWN0ZWQgdGltZSByYW5nZS5cbiAgICAgICAgICAgICAgIHRvIGF2b2lkIHJvdW5kaW5nIGlzc3Vlcy9pbmZpbml0ZSBsb29wLFxuICAgICAgICAgICAgICAgb25seSBmbHVzaCBidWZmZXIgcmFuZ2Ugb2YgbGVuZ3RoIGdyZWF0ZXIgdGhhbiA1MDBtcy5cbiAgICAgICAgICAgICovXG4gICAgICAgICAgICBpZiAoTWF0aC5taW4oZmx1c2hFbmQsYnVmRW5kKSAtIGZsdXNoU3RhcnQgPiAwLjUgKSB7XG4gICAgICAgICAgICAgIHRoaXMuZmx1c2hCdWZmZXJDb3VudGVyKys7XG4gICAgICAgICAgICAgIGxvZ2dlci5sb2coYGZsdXNoICR7dHlwZX0gWyR7Zmx1c2hTdGFydH0sJHtmbHVzaEVuZH1dLCBvZiBbJHtidWZTdGFydH0sJHtidWZFbmR9XSwgcG9zOiR7dGhpcy5tZWRpYS5jdXJyZW50VGltZX1gKTtcbiAgICAgICAgICAgICAgc2IucmVtb3ZlKGZsdXNoU3RhcnQsIGZsdXNoRW5kKTtcbiAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ2Fib3J0ICcgKyB0eXBlICsgJyBhcHBlbmQgaW4gcHJvZ3Jlc3MnKTtcbiAgICAgICAgICAvLyB0aGlzIHdpbGwgYWJvcnQgYW55IGFwcGVuZGluZyBpbiBwcm9ncmVzc1xuICAgICAgICAgIC8vc2IuYWJvcnQoKTtcbiAgICAgICAgICBsb2dnZXIud2FybignY2Fubm90IGZsdXNoLCBzYiB1cGRhdGluZyBpbiBwcm9ncmVzcycpO1xuICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBsb2dnZXIud2FybignYWJvcnQgZmx1c2hpbmcgdG9vIG1hbnkgcmV0cmllcycpO1xuICAgIH1cbiAgICBsb2dnZXIubG9nKCdidWZmZXIgZmx1c2hlZCcpO1xuICAgIC8vIGV2ZXJ5dGhpbmcgZmx1c2hlZCAhXG4gICAgcmV0dXJuIHRydWU7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQnVmZmVyQ29udHJvbGxlcjtcbiIsIi8qXG4gKiBjYXAgc3RyZWFtIGxldmVsIHRvIG1lZGlhIHNpemUgZGltZW5zaW9uIGNvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcblxuY2xhc3MgQ2FwTGV2ZWxDb250cm9sbGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblx0Y29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLFxuICAgICAgRXZlbnQuTUVESUFfQVRUQUNISU5HLFxuICAgICAgRXZlbnQuTUFOSUZFU1RfUEFSU0VEKTsgICBcblx0fVxuXHRcblx0ZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5obHMuY29uZmlnLmNhcExldmVsVG9QbGF5ZXJTaXplKSB7XG4gICAgICB0aGlzLm1lZGlhID0gbnVsbDtcbiAgICAgIHRoaXMuYXV0b0xldmVsQ2FwcGluZyA9IE51bWJlci5QT1NJVElWRV9JTkZJTklUWTtcbiAgICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgICAgIHRoaXMudGltZXIgPSBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXHQgIFxuXHRvbk1lZGlhQXR0YWNoaW5nKGRhdGEpIHtcbiAgICB0aGlzLm1lZGlhID0gZGF0YS5tZWRpYSBpbnN0YW5jZW9mIEhUTUxWaWRlb0VsZW1lbnQgPyBkYXRhLm1lZGlhIDogbnVsbDsgIFxuICB9XG5cbiAgb25NYW5pZmVzdFBhcnNlZChkYXRhKSB7XG4gICAgaWYgKHRoaXMuaGxzLmNvbmZpZy5jYXBMZXZlbFRvUGxheWVyU2l6ZSkge1xuICAgICAgdGhpcy5hdXRvTGV2ZWxDYXBwaW5nID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuICAgICAgdGhpcy5sZXZlbHMgPSBkYXRhLmxldmVscztcbiAgICAgIHRoaXMuaGxzLmZpcnN0TGV2ZWwgPSB0aGlzLmdldE1heExldmVsKGRhdGEuZmlyc3RMZXZlbCk7XG4gICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgdGhpcy50aW1lciA9IHNldEludGVydmFsKHRoaXMuZGV0ZWN0UGxheWVyU2l6ZS5iaW5kKHRoaXMpLCAxMDAwKTtcbiAgICAgIHRoaXMuZGV0ZWN0UGxheWVyU2l6ZSgpO1xuICAgIH1cbiAgfVxuICBcbiAgZGV0ZWN0UGxheWVyU2l6ZSgpIHtcbiAgICBpZiAodGhpcy5tZWRpYSkge1xuICAgICAgbGV0IGxldmVsc0xlbmd0aCA9IHRoaXMubGV2ZWxzID8gdGhpcy5sZXZlbHMubGVuZ3RoIDogMDtcbiAgICAgIGlmIChsZXZlbHNMZW5ndGgpIHtcbiAgICAgICAgdGhpcy5obHMuYXV0b0xldmVsQ2FwcGluZyA9IHRoaXMuZ2V0TWF4TGV2ZWwobGV2ZWxzTGVuZ3RoIC0gMSk7XG4gICAgICAgIGlmICh0aGlzLmhscy5hdXRvTGV2ZWxDYXBwaW5nID4gdGhpcy5hdXRvTGV2ZWxDYXBwaW5nKSB7XG4gICAgICAgICAgLy8gaWYgYXV0byBsZXZlbCBjYXBwaW5nIGhhcyBhIGhpZ2hlciB2YWx1ZSBmb3IgdGhlIHByZXZpb3VzIG9uZSwgZmx1c2ggdGhlIGJ1ZmZlciB1c2luZyBuZXh0TGV2ZWxTd2l0Y2hcbiAgICAgICAgICAvLyB1c3VhbGx5IGhhcHBlbiB3aGVuIHRoZSB1c2VyIGdvIHRvIHRoZSBmdWxsc2NyZWVuIG1vZGUuXG4gICAgICAgICAgdGhpcy5obHMuc3RyZWFtQ29udHJvbGxlci5uZXh0TGV2ZWxTd2l0Y2goKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmF1dG9MZXZlbENhcHBpbmcgPSB0aGlzLmhscy5hdXRvTGV2ZWxDYXBwaW5nOyAgICAgICAgXG4gICAgICB9ICBcbiAgICB9XG4gIH1cbiAgXG4gIC8qXG4gICogcmV0dXJucyBsZXZlbCBzaG91bGQgYmUgdGhlIG9uZSB3aXRoIHRoZSBkaW1lbnNpb25zIGVxdWFsIG9yIGdyZWF0ZXIgdGhhbiB0aGUgbWVkaWEgKHBsYXllcikgZGltZW5zaW9ucyAoc28gdGhlIHZpZGVvIHdpbGwgYmUgZG93bnNjYWxlZClcbiAgKi9cbiAgZ2V0TWF4TGV2ZWwoY2FwTGV2ZWxJbmRleCkge1xuICAgIGxldCByZXN1bHQsXG4gICAgICAgIGksXG4gICAgICAgIGxldmVsLFxuICAgICAgICBtV2lkdGggPSB0aGlzLm1lZGlhV2lkdGgsXG4gICAgICAgIG1IZWlnaHQgPSB0aGlzLm1lZGlhSGVpZ2h0LFxuICAgICAgICBsV2lkdGggPSAwLFxuICAgICAgICBsSGVpZ2h0ID0gMDtcbiAgICAgICAgXG4gICAgZm9yIChpID0gMDsgaSA8PSBjYXBMZXZlbEluZGV4OyBpKyspIHtcbiAgICAgIGxldmVsID0gdGhpcy5sZXZlbHNbaV07XG4gICAgICByZXN1bHQgPSBpO1xuICAgICAgbFdpZHRoID0gbGV2ZWwud2lkdGg7XG4gICAgICBsSGVpZ2h0ID0gbGV2ZWwuaGVpZ2h0O1xuICAgICAgaWYgKG1XaWR0aCA8PSBsV2lkdGggfHwgbUhlaWdodCA8PSBsSGVpZ2h0KSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH0gIFxuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cbiAgXG4gIGdldCBjb250ZW50U2NhbGVGYWN0b3IoKSB7XG4gICAgbGV0IHBpeGVsUmF0aW8gPSAxO1xuICAgIHRyeSB7XG4gICAgICBwaXhlbFJhdGlvID0gIHdpbmRvdy5kZXZpY2VQaXhlbFJhdGlvO1xuICAgIH0gY2F0Y2goZSkge31cbiAgICByZXR1cm4gcGl4ZWxSYXRpbztcbiAgfVxuICBcbiAgZ2V0IG1lZGlhV2lkdGgoKSB7XG4gICAgbGV0IHdpZHRoO1xuICAgIGlmICh0aGlzLm1lZGlhKSB7XG4gICAgICB3aWR0aCA9IHRoaXMubWVkaWEud2lkdGggfHwgdGhpcy5tZWRpYS5jbGllbnRXaWR0aCB8fCB0aGlzLm1lZGlhLm9mZnNldFdpZHRoO1xuICAgICAgd2lkdGggKj0gdGhpcy5jb250ZW50U2NhbGVGYWN0b3I7XG4gICAgfVxuICAgIHJldHVybiB3aWR0aDtcbiAgfVxuICBcbiAgZ2V0IG1lZGlhSGVpZ2h0KCkge1xuICAgIGxldCBoZWlnaHQ7XG4gICAgaWYgKHRoaXMubWVkaWEpIHtcbiAgICAgIGhlaWdodCA9IHRoaXMubWVkaWEuaGVpZ2h0IHx8IHRoaXMubWVkaWEuY2xpZW50SGVpZ2h0IHx8IHRoaXMubWVkaWEub2Zmc2V0SGVpZ2h0O1xuICAgICAgaGVpZ2h0ICo9IHRoaXMuY29udGVudFNjYWxlRmFjdG9yOyBcbiAgICB9XG4gICAgcmV0dXJuIGhlaWdodDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBDYXBMZXZlbENvbnRyb2xsZXI7IiwiLypcbiAqIExldmVsIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIExldmVsQ29udHJvbGxlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLFxuICAgICAgRXZlbnQuTUFOSUZFU1RfTE9BREVELFxuICAgICAgRXZlbnQuTEVWRUxfTE9BREVELFxuICAgICAgRXZlbnQuRVJST1IpO1xuICAgIHRoaXMub250aWNrID0gdGhpcy50aWNrLmJpbmQodGhpcyk7XG4gICAgdGhpcy5fbWFudWFsTGV2ZWwgPSB0aGlzLl9hdXRvTGV2ZWxDYXBwaW5nID0gLTE7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLnRpbWVyKSB7XG4gICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgfVxuICAgIHRoaXMuX21hbnVhbExldmVsID0gLTE7XG4gIH1cblxuICBzdGFydExvYWQoKSB7XG4gICAgdGhpcy5jYW5sb2FkID0gdHJ1ZTtcbiAgICAvLyBzcGVlZCB1cCBsaXZlIHBsYXlsaXN0IHJlZnJlc2ggaWYgdGltZXIgZXhpc3RzXG4gICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH1cbiAgfVxuXG4gIHN0b3BMb2FkKCkge1xuICAgIHRoaXMuY2FubG9hZCA9IGZhbHNlO1xuICB9XG5cbiAgb25NYW5pZmVzdExvYWRlZChkYXRhKSB7XG4gICAgdmFyIGxldmVsczAgPSBbXSwgbGV2ZWxzID0gW10sIGJpdHJhdGVTdGFydCwgaSwgYml0cmF0ZVNldCA9IHt9LCB2aWRlb0NvZGVjRm91bmQgPSBmYWxzZSwgYXVkaW9Db2RlY0ZvdW5kID0gZmFsc2UsIGhscyA9IHRoaXMuaGxzO1xuXG4gICAgLy8gcmVncm91cCByZWR1bmRhbnQgbGV2ZWwgdG9nZXRoZXJcbiAgICBkYXRhLmxldmVscy5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgIGlmKGxldmVsLnZpZGVvQ29kZWMpIHtcbiAgICAgICAgdmlkZW9Db2RlY0ZvdW5kID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIGlmKGxldmVsLmF1ZGlvQ29kZWMpIHtcbiAgICAgICAgYXVkaW9Db2RlY0ZvdW5kID0gdHJ1ZTtcbiAgICAgIH1cbiAgICAgIHZhciByZWR1bmRhbnRMZXZlbElkID0gYml0cmF0ZVNldFtsZXZlbC5iaXRyYXRlXTtcbiAgICAgIGlmIChyZWR1bmRhbnRMZXZlbElkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgYml0cmF0ZVNldFtsZXZlbC5iaXRyYXRlXSA9IGxldmVsczAubGVuZ3RoO1xuICAgICAgICBsZXZlbC51cmwgPSBbbGV2ZWwudXJsXTtcbiAgICAgICAgbGV2ZWwudXJsSWQgPSAwO1xuICAgICAgICBsZXZlbHMwLnB1c2gobGV2ZWwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV2ZWxzMFtyZWR1bmRhbnRMZXZlbElkXS51cmwucHVzaChsZXZlbC51cmwpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgLy8gcmVtb3ZlIGF1ZGlvLW9ubHkgbGV2ZWwgaWYgd2UgYWxzbyBoYXZlIGxldmVscyB3aXRoIGF1ZGlvK3ZpZGVvIGNvZGVjcyBzaWduYWxsZWRcbiAgICBpZih2aWRlb0NvZGVjRm91bmQgJiYgYXVkaW9Db2RlY0ZvdW5kKSB7XG4gICAgICBsZXZlbHMwLmZvckVhY2gobGV2ZWwgPT4ge1xuICAgICAgICBpZihsZXZlbC52aWRlb0NvZGVjKSB7XG4gICAgICAgICAgbGV2ZWxzLnB1c2gobGV2ZWwpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV2ZWxzID0gbGV2ZWxzMDtcbiAgICB9XG5cbiAgICAvLyBvbmx5IGtlZXAgbGV2ZWwgd2l0aCBzdXBwb3J0ZWQgYXVkaW8vdmlkZW8gY29kZWNzXG4gICAgbGV2ZWxzID0gbGV2ZWxzLmZpbHRlcihmdW5jdGlvbihsZXZlbCkge1xuICAgICAgdmFyIGNoZWNrU3VwcG9ydGVkQXVkaW8gPSBmdW5jdGlvbihjb2RlYykgeyByZXR1cm4gTWVkaWFTb3VyY2UuaXNUeXBlU3VwcG9ydGVkKGBhdWRpby9tcDQ7Y29kZWNzPSR7Y29kZWN9YCk7fTtcbiAgICAgIHZhciBjaGVja1N1cHBvcnRlZFZpZGVvID0gZnVuY3Rpb24oY29kZWMpIHsgcmV0dXJuIE1lZGlhU291cmNlLmlzVHlwZVN1cHBvcnRlZChgdmlkZW8vbXA0O2NvZGVjcz0ke2NvZGVjfWApO307XG4gICAgICB2YXIgYXVkaW9Db2RlYyA9IGxldmVsLmF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMgPSBsZXZlbC52aWRlb0NvZGVjO1xuXG4gICAgICByZXR1cm4gKCFhdWRpb0NvZGVjIHx8IGNoZWNrU3VwcG9ydGVkQXVkaW8oYXVkaW9Db2RlYykpICYmXG4gICAgICAgICAgICAgKCF2aWRlb0NvZGVjIHx8IGNoZWNrU3VwcG9ydGVkVmlkZW8odmlkZW9Db2RlYykpO1xuICAgIH0pO1xuXG4gICAgaWYobGV2ZWxzLmxlbmd0aCkge1xuICAgICAgLy8gc3RhcnQgYml0cmF0ZSBpcyB0aGUgZmlyc3QgYml0cmF0ZSBvZiB0aGUgbWFuaWZlc3RcbiAgICAgIGJpdHJhdGVTdGFydCA9IGxldmVsc1swXS5iaXRyYXRlO1xuICAgICAgLy8gc29ydCBsZXZlbCBvbiBiaXRyYXRlXG4gICAgICBsZXZlbHMuc29ydChmdW5jdGlvbiAoYSwgYikge1xuICAgICAgICByZXR1cm4gYS5iaXRyYXRlIC0gYi5iaXRyYXRlO1xuICAgICAgfSk7XG4gICAgICB0aGlzLl9sZXZlbHMgPSBsZXZlbHM7XG4gICAgICAvLyBmaW5kIGluZGV4IG9mIGZpcnN0IGxldmVsIGluIHNvcnRlZCBsZXZlbHNcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBsZXZlbHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKGxldmVsc1tpXS5iaXRyYXRlID09PSBiaXRyYXRlU3RhcnQpIHtcbiAgICAgICAgICB0aGlzLl9maXJzdExldmVsID0gaTtcbiAgICAgICAgICBsb2dnZXIubG9nKGBtYW5pZmVzdCBsb2FkZWQsJHtsZXZlbHMubGVuZ3RofSBsZXZlbChzKSBmb3VuZCwgZmlyc3QgYml0cmF0ZToke2JpdHJhdGVTdGFydH1gKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfUEFSU0VELCB7bGV2ZWxzOiB0aGlzLl9sZXZlbHMsIGZpcnN0TGV2ZWw6IHRoaXMuX2ZpcnN0TGV2ZWwsIHN0YXRzOiBkYXRhLnN0YXRzfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLk1BTklGRVNUX0lOQ09NUEFUSUJMRV9DT0RFQ1NfRVJST1IsIGZhdGFsOiB0cnVlLCB1cmw6IGhscy51cmwsIHJlYXNvbjogJ25vIGxldmVsIHdpdGggY29tcGF0aWJsZSBjb2RlY3MgZm91bmQgaW4gbWFuaWZlc3QnfSk7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfVxuXG4gIGdldCBsZXZlbHMoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xldmVscztcbiAgfVxuXG4gIGdldCBsZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5fbGV2ZWw7XG4gIH1cblxuICBzZXQgbGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBpZiAodGhpcy5fbGV2ZWwgIT09IG5ld0xldmVsIHx8IHRoaXMuX2xldmVsc1tuZXdMZXZlbF0uZGV0YWlscyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnNldExldmVsSW50ZXJuYWwobmV3TGV2ZWwpO1xuICAgIH1cbiAgfVxuXG4gc2V0TGV2ZWxJbnRlcm5hbChuZXdMZXZlbCkge1xuICAgIC8vIGNoZWNrIGlmIGxldmVsIGlkeCBpcyB2YWxpZFxuICAgIGlmIChuZXdMZXZlbCA+PSAwICYmIG5ld0xldmVsIDwgdGhpcy5fbGV2ZWxzLmxlbmd0aCkge1xuICAgICAgLy8gc3RvcHBpbmcgbGl2ZSByZWxvYWRpbmcgdGltZXIgaWYgYW55XG4gICAgICBpZiAodGhpcy50aW1lcikge1xuICAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgICB9XG4gICAgICB0aGlzLl9sZXZlbCA9IG5ld0xldmVsO1xuICAgICAgbG9nZ2VyLmxvZyhgc3dpdGNoaW5nIHRvIGxldmVsICR7bmV3TGV2ZWx9YCk7XG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX1NXSVRDSCwge2xldmVsOiBuZXdMZXZlbH0pO1xuICAgICAgdmFyIGxldmVsID0gdGhpcy5fbGV2ZWxzW25ld0xldmVsXTtcbiAgICAgICAvLyBjaGVjayBpZiB3ZSBuZWVkIHRvIGxvYWQgcGxheWxpc3QgZm9yIHRoaXMgbGV2ZWxcbiAgICAgIGlmIChsZXZlbC5kZXRhaWxzID09PSB1bmRlZmluZWQgfHwgbGV2ZWwuZGV0YWlscy5saXZlID09PSB0cnVlKSB7XG4gICAgICAgIC8vIGxldmVsIG5vdCByZXRyaWV2ZWQgeWV0LCBvciBsaXZlIHBsYXlsaXN0IHdlIG5lZWQgdG8gKHJlKWxvYWQgaXRcbiAgICAgICAgbG9nZ2VyLmxvZyhgKHJlKWxvYWRpbmcgcGxheWxpc3QgZm9yIGxldmVsICR7bmV3TGV2ZWx9YCk7XG4gICAgICAgIHZhciB1cmxJZCA9IGxldmVsLnVybElkO1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURJTkcsIHt1cmw6IGxldmVsLnVybFt1cmxJZF0sIGxldmVsOiBuZXdMZXZlbCwgaWQ6IHVybElkfSk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGludmFsaWQgbGV2ZWwgaWQgZ2l2ZW4sIHRyaWdnZXIgZXJyb3JcbiAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5PVEhFUl9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkxFVkVMX1NXSVRDSF9FUlJPUiwgbGV2ZWw6IG5ld0xldmVsLCBmYXRhbDogZmFsc2UsIHJlYXNvbjogJ2ludmFsaWQgbGV2ZWwgaWR4J30pO1xuICAgIH1cbiB9XG5cbiAgZ2V0IG1hbnVhbExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9tYW51YWxMZXZlbDtcbiAgfVxuXG4gIHNldCBtYW51YWxMZXZlbChuZXdMZXZlbCkge1xuICAgIHRoaXMuX21hbnVhbExldmVsID0gbmV3TGV2ZWw7XG4gICAgaWYgKG5ld0xldmVsICE9PSAtMSkge1xuICAgICAgdGhpcy5sZXZlbCA9IG5ld0xldmVsO1xuICAgIH1cbiAgfVxuXG4gIGdldCBmaXJzdExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLl9maXJzdExldmVsO1xuICB9XG5cbiAgc2V0IGZpcnN0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9maXJzdExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICBnZXQgc3RhcnRMZXZlbCgpIHtcbiAgICBpZiAodGhpcy5fc3RhcnRMZXZlbCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZmlyc3RMZXZlbDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuX3N0YXJ0TGV2ZWw7XG4gICAgfVxuICB9XG5cbiAgc2V0IHN0YXJ0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICB0aGlzLl9zdGFydExldmVsID0gbmV3TGV2ZWw7XG4gIH1cblxuICBvbkVycm9yKGRhdGEpIHtcbiAgICBpZihkYXRhLmZhdGFsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIGRldGFpbHMgPSBkYXRhLmRldGFpbHMsIGhscyA9IHRoaXMuaGxzLCBsZXZlbElkLCBsZXZlbDtcbiAgICAvLyB0cnkgdG8gcmVjb3ZlciBub3QgZmF0YWwgZXJyb3JzXG4gICAgc3dpdGNoKGRldGFpbHMpIHtcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9USU1FT1VUOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT09QX0xPQURJTkdfRVJST1I6XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5LRVlfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLktFWV9MT0FEX1RJTUVPVVQ6XG4gICAgICAgICBsZXZlbElkID0gZGF0YS5mcmFnLmxldmVsO1xuICAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5MRVZFTF9MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9USU1FT1VUOlxuICAgICAgICBsZXZlbElkID0gZGF0YS5sZXZlbDtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgLyogdHJ5IHRvIHN3aXRjaCB0byBhIHJlZHVuZGFudCBzdHJlYW0gaWYgYW55IGF2YWlsYWJsZS5cbiAgICAgKiBpZiBubyByZWR1bmRhbnQgc3RyZWFtIGF2YWlsYWJsZSwgZW1lcmdlbmN5IHN3aXRjaCBkb3duIChpZiBpbiBhdXRvIG1vZGUgYW5kIGN1cnJlbnQgbGV2ZWwgbm90IDApXG4gICAgICogb3RoZXJ3aXNlLCB3ZSBjYW5ub3QgcmVjb3ZlciB0aGlzIG5ldHdvcmsgZXJyb3IgLi4uXG4gICAgICogZG9uJ3QgcmFpc2UgRlJBR19MT0FEX0VSUk9SIGFuZCBGUkFHX0xPQURfVElNRU9VVCBhcyBmYXRhbCwgYXMgaXQgaXMgaGFuZGxlZCBieSBtZWRpYUNvbnRyb2xsZXJcbiAgICAgKi9cbiAgICBpZiAobGV2ZWxJZCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBsZXZlbCA9IHRoaXMuX2xldmVsc1tsZXZlbElkXTtcbiAgICAgIGlmIChsZXZlbC51cmxJZCA8IChsZXZlbC51cmwubGVuZ3RoIC0gMSkpIHtcbiAgICAgICAgbGV2ZWwudXJsSWQrKztcbiAgICAgICAgbGV2ZWwuZGV0YWlscyA9IHVuZGVmaW5lZDtcbiAgICAgICAgbG9nZ2VyLndhcm4oYGxldmVsIGNvbnRyb2xsZXIsJHtkZXRhaWxzfSBmb3IgbGV2ZWwgJHtsZXZlbElkfTogc3dpdGNoaW5nIHRvIHJlZHVuZGFudCBzdHJlYW0gaWQgJHtsZXZlbC51cmxJZH1gKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIHdlIGNvdWxkIHRyeSB0byByZWNvdmVyIGlmIGluIGF1dG8gbW9kZSBhbmQgY3VycmVudCBsZXZlbCBub3QgbG93ZXN0IGxldmVsICgwKVxuICAgICAgICBsZXQgcmVjb3ZlcmFibGUgPSAoKHRoaXMuX21hbnVhbExldmVsID09PSAtMSkgJiYgbGV2ZWxJZCk7XG4gICAgICAgIGlmIChyZWNvdmVyYWJsZSkge1xuICAgICAgICAgIGxvZ2dlci53YXJuKGBsZXZlbCBjb250cm9sbGVyLCR7ZGV0YWlsc306IGVtZXJnZW5jeSBzd2l0Y2gtZG93biBmb3IgbmV4dCBmcmFnbWVudGApO1xuICAgICAgICAgIGhscy5hYnJDb250cm9sbGVyLm5leHRBdXRvTGV2ZWwgPSAwO1xuICAgICAgICB9IGVsc2UgaWYobGV2ZWwgJiYgbGV2ZWwuZGV0YWlscyAmJiBsZXZlbC5kZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgbGV2ZWwgY29udHJvbGxlciwke2RldGFpbHN9IG9uIGxpdmUgc3RyZWFtLCBkaXNjYXJkYCk7XG4gICAgICAgIC8vIEZSQUdfTE9BRF9FUlJPUiBhbmQgRlJBR19MT0FEX1RJTUVPVVQgYXJlIGhhbmRsZWQgYnkgbWVkaWFDb250cm9sbGVyXG4gICAgICAgIH0gZWxzZSBpZiAoZGV0YWlscyAhPT0gRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUiAmJiBkZXRhaWxzICE9PSBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQpIHtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYGNhbm5vdCByZWNvdmVyICR7ZGV0YWlsc30gZXJyb3JgKTtcbiAgICAgICAgICB0aGlzLl9sZXZlbCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICAvLyBzdG9wcGluZyBsaXZlIHJlbG9hZGluZyB0aW1lciBpZiBhbnlcbiAgICAgICAgICBpZiAodGhpcy50aW1lcikge1xuICAgICAgICAgICAgY2xlYXJJbnRlcnZhbCh0aGlzLnRpbWVyKTtcbiAgICAgICAgICAgIHRoaXMudGltZXIgPSBudWxsO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyByZWRpc3BhdGNoIHNhbWUgZXJyb3IgYnV0IHdpdGggZmF0YWwgc2V0IHRvIHRydWVcbiAgICAgICAgICBkYXRhLmZhdGFsID0gdHJ1ZTtcbiAgICAgICAgICBobHMudHJpZ2dlcihldmVudCwgZGF0YSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBvbkxldmVsTG9hZGVkKGRhdGEpIHtcbiAgICAvLyBjaGVjayBpZiBjdXJyZW50IHBsYXlsaXN0IGlzIGEgbGl2ZSBwbGF5bGlzdFxuICAgIGlmIChkYXRhLmRldGFpbHMubGl2ZSAmJiAhdGhpcy50aW1lcikge1xuICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCB3ZSB3aWxsIGhhdmUgdG8gcmVsb2FkIGl0IHBlcmlvZGljYWxseVxuICAgICAgLy8gc2V0IHJlbG9hZCBwZXJpb2QgdG8gcGxheWxpc3QgdGFyZ2V0IGR1cmF0aW9uXG4gICAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwodGhpcy5vbnRpY2ssIDEwMDAgKiBkYXRhLmRldGFpbHMudGFyZ2V0ZHVyYXRpb24pO1xuICAgIH1cbiAgICBpZiAoIWRhdGEuZGV0YWlscy5saXZlICYmIHRoaXMudGltZXIpIHtcbiAgICAgIC8vIHBsYXlsaXN0IGlzIG5vdCBsaXZlIGFuZCB0aW1lciBpcyBhcm1lZCA6IHN0b3BwaW5nIGl0XG4gICAgICBjbGVhckludGVydmFsKHRoaXMudGltZXIpO1xuICAgICAgdGhpcy50aW1lciA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgdGljaygpIHtcbiAgICB2YXIgbGV2ZWxJZCA9IHRoaXMuX2xldmVsO1xuICAgIGlmIChsZXZlbElkICE9PSB1bmRlZmluZWQgJiYgdGhpcy5jYW5sb2FkKSB7XG4gICAgICB2YXIgbGV2ZWwgPSB0aGlzLl9sZXZlbHNbbGV2ZWxJZF0sIHVybElkID0gbGV2ZWwudXJsSWQ7XG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkxFVkVMX0xPQURJTkcsIHt1cmw6IGxldmVsLnVybFt1cmxJZF0sIGxldmVsOiBsZXZlbElkLCBpZDogdXJsSWR9KTtcbiAgICB9XG4gIH1cblxuICBnZXQgbmV4dExvYWRMZXZlbCgpIHtcbiAgICBpZiAodGhpcy5fbWFudWFsTGV2ZWwgIT09IC0xKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbWFudWFsTGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgcmV0dXJuIHRoaXMuaGxzLmFickNvbnRyb2xsZXIubmV4dEF1dG9MZXZlbDtcbiAgICB9XG4gIH1cblxuICBzZXQgbmV4dExvYWRMZXZlbChuZXh0TGV2ZWwpIHtcbiAgICB0aGlzLmxldmVsID0gbmV4dExldmVsO1xuICAgIGlmICh0aGlzLl9tYW51YWxMZXZlbCA9PT0gLTEpIHtcbiAgICAgIHRoaXMuaGxzLmFickNvbnRyb2xsZXIubmV4dEF1dG9MZXZlbCA9IG5leHRMZXZlbDtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgTGV2ZWxDb250cm9sbGVyO1xuXG4iLCIvKlxuICogU3RyZWFtIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBEZW11eGVyIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXInO1xuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5pbXBvcnQgRXZlbnRIYW5kbGVyIGZyb20gJy4uL2V2ZW50LWhhbmRsZXInO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgQmluYXJ5U2VhcmNoIGZyb20gJy4uL3V0aWxzL2JpbmFyeS1zZWFyY2gnO1xuaW1wb3J0IEJ1ZmZlckhlbHBlciBmcm9tICcuLi9oZWxwZXIvYnVmZmVyLWhlbHBlcic7XG5pbXBvcnQgTGV2ZWxIZWxwZXIgZnJvbSAnLi4vaGVscGVyL2xldmVsLWhlbHBlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY29uc3QgU3RhdGUgPSB7XG4gIFNUT1BQRUQgOiAnU1RPUFBFRCcsXG4gIFNUQVJUSU5HIDogJ1NUQVJUSU5HJyxcbiAgSURMRSA6ICdJRExFJyxcbiAgUEFVU0VEIDogJ1BBVVNFRCcsXG4gIEtFWV9MT0FESU5HIDogJ0tFWV9MT0FESU5HJyxcbiAgRlJBR19MT0FESU5HIDogJ0ZSQUdfTE9BRElORycsXG4gIEZSQUdfTE9BRElOR19XQUlUSU5HX1JFVFJZIDogJ0ZSQUdfTE9BRElOR19XQUlUSU5HX1JFVFJZJyxcbiAgV0FJVElOR19MRVZFTCA6ICdXQUlUSU5HX0xFVkVMJyxcbiAgUEFSU0lORyA6ICdQQVJTSU5HJyxcbiAgUEFSU0VEIDogJ1BBUlNFRCcsXG4gIEVOREVEIDogJ0VOREVEJyxcbiAgRVJST1IgOiAnRVJST1InXG59O1xuXG5jbGFzcyBTdHJlYW1Db250cm9sbGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsXG4gICAgICBFdmVudC5NRURJQV9BVFRBQ0hFRCxcbiAgICAgIEV2ZW50Lk1FRElBX0RFVEFDSElORyxcbiAgICAgIEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsXG4gICAgICBFdmVudC5NQU5JRkVTVF9QQVJTRUQsXG4gICAgICBFdmVudC5MRVZFTF9MT0FERUQsXG4gICAgICBFdmVudC5LRVlfTE9BREVELFxuICAgICAgRXZlbnQuRlJBR19MT0FERUQsXG4gICAgICBFdmVudC5GUkFHX0xPQURfRU1FUkdFTkNZX0FCT1JURUQsXG4gICAgICBFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5ULFxuICAgICAgRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsXG4gICAgICBFdmVudC5GUkFHX1BBUlNFRCxcbiAgICAgIEV2ZW50LkVSUk9SLFxuICAgICAgRXZlbnQuQlVGRkVSX0FQUEVOREVELFxuICAgICAgRXZlbnQuQlVGRkVSX0ZMVVNIRUQpO1xuXG4gICAgdGhpcy5jb25maWcgPSBobHMuY29uZmlnO1xuICAgIHRoaXMuYXVkaW9Db2RlY1N3YXAgPSBmYWxzZTtcbiAgICB0aGlzLnRpY2tzID0gMDtcbiAgICB0aGlzLm9udGljayA9IHRoaXMudGljay5iaW5kKHRoaXMpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICB0aGlzLnN0b3BMb2FkKCk7XG4gICAgaWYgKHRoaXMudGltZXIpIHtcbiAgICAgIGNsZWFySW50ZXJ2YWwodGhpcy50aW1lcik7XG4gICAgICB0aGlzLnRpbWVyID0gbnVsbDtcbiAgICB9XG4gICAgRXZlbnRIYW5kbGVyLnByb3RvdHlwZS5kZXN0cm95LmNhbGwodGhpcyk7XG4gICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlNUT1BQRUQ7XG4gIH1cblxuICBzdGFydExvYWQoc3RhcnRQb3NpdGlvbj0wKSB7XG4gICAgaWYgKHRoaXMubGV2ZWxzKSB7XG4gICAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhLCBsYXN0Q3VycmVudFRpbWUgPSB0aGlzLmxhc3RDdXJyZW50VGltZTtcbiAgICAgIHRoaXMuc3RvcExvYWQoKTtcbiAgICAgIHRoaXMuZGVtdXhlciA9IG5ldyBEZW11eGVyKHRoaXMuaGxzKTtcbiAgICAgIGlmICghdGhpcy50aW1lcikge1xuICAgICAgICB0aGlzLnRpbWVyID0gc2V0SW50ZXJ2YWwodGhpcy5vbnRpY2ssIDEwMCk7XG4gICAgICB9XG4gICAgICB0aGlzLmxldmVsID0gLTE7XG4gICAgICB0aGlzLmZyYWdMb2FkRXJyb3IgPSAwO1xuICAgICAgaWYgKG1lZGlhICYmIGxhc3RDdXJyZW50VGltZSkge1xuICAgICAgICBsb2dnZXIubG9nKGBjb25maWd1cmUgc3RhcnRQb3NpdGlvbiBAJHtsYXN0Q3VycmVudFRpbWV9YCk7XG4gICAgICAgIGlmICghdGhpcy5sYXN0UGF1c2VkKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZygncmVzdW1pbmcgdmlkZW8nKTtcbiAgICAgICAgICBtZWRpYS5wbGF5KCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxhc3RDdXJyZW50VGltZSA9IHRoaXMuc3RhcnRQb3NpdGlvbiA/IHRoaXMuc3RhcnRQb3NpdGlvbiA6IHN0YXJ0UG9zaXRpb247XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5TVEFSVElORztcbiAgICAgIH1cbiAgICAgIHRoaXMubmV4dExvYWRQb3NpdGlvbiA9IHRoaXMuc3RhcnRQb3NpdGlvbiA9IHRoaXMubGFzdEN1cnJlbnRUaW1lO1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGxvZ2dlci53YXJuKCdjYW5ub3Qgc3RhcnQgbG9hZGluZyBhcyBtYW5pZmVzdCBub3QgcGFyc2VkIHlldCcpO1xuICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlNUT1BQRUQ7XG4gICAgfVxuICB9XG5cbiAgc3RvcExvYWQoKSB7XG4gICAgdmFyIGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgIGlmIChmcmFnKSB7XG4gICAgICBpZiAoZnJhZy5sb2FkZXIpIHtcbiAgICAgICAgZnJhZy5sb2FkZXIuYWJvcnQoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLmZyYWdQcmV2aW91cyA9IG51bGw7XG4gICAgaWYgKHRoaXMuZGVtdXhlcikge1xuICAgICAgdGhpcy5kZW11eGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMuZGVtdXhlciA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5TVE9QUEVEO1xuICB9XG5cbiAgdGljaygpIHtcbiAgICB0aGlzLnRpY2tzKys7XG4gICAgaWYgKHRoaXMudGlja3MgPT09IDEpIHtcbiAgICAgIHRoaXMuZG9UaWNrKCk7XG4gICAgICBpZiAodGhpcy50aWNrcyA+IDEpIHtcbiAgICAgICAgc2V0VGltZW91dCh0aGlzLnRpY2ssIDEpO1xuICAgICAgfVxuICAgICAgdGhpcy50aWNrcyA9IDA7XG4gICAgfVxuICB9XG5cbiAgZG9UaWNrKCkge1xuICAgIHZhciBwb3MsIGxldmVsLCBsZXZlbERldGFpbHMsIGhscyA9IHRoaXMuaGxzLCBjb25maWcgPSBobHMuY29uZmlnO1xuICAgIC8vbG9nZ2VyLmxvZyh0aGlzLnN0YXRlKTtcbiAgICBzd2l0Y2godGhpcy5zdGF0ZSkge1xuICAgICAgY2FzZSBTdGF0ZS5FUlJPUjpcbiAgICAgICAgLy9kb24ndCBkbyBhbnl0aGluZyBpbiBlcnJvciBzdGF0ZSB0byBhdm9pZCBicmVha2luZyBmdXJ0aGVyIC4uLlxuICAgICAgY2FzZSBTdGF0ZS5QQVVTRUQ6XG4gICAgICAgIC8vZG9uJ3QgZG8gYW55dGhpbmcgaW4gcGF1c2VkIHN0YXRlIGVpdGhlciAuLi5cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLlNUQVJUSU5HOlxuICAgICAgICAvLyBkZXRlcm1pbmUgbG9hZCBsZXZlbFxuICAgICAgICB0aGlzLnN0YXJ0TGV2ZWwgPSBobHMuc3RhcnRMZXZlbDtcbiAgICAgICAgaWYgKHRoaXMuc3RhcnRMZXZlbCA9PT0gLTEpIHtcbiAgICAgICAgICAvLyAtMSA6IGd1ZXNzIHN0YXJ0IExldmVsIGJ5IGRvaW5nIGEgYml0cmF0ZSB0ZXN0IGJ5IGxvYWRpbmcgZmlyc3QgZnJhZ21lbnQgb2YgbG93ZXN0IHF1YWxpdHkgbGV2ZWxcbiAgICAgICAgICB0aGlzLnN0YXJ0TGV2ZWwgPSAwO1xuICAgICAgICAgIHRoaXMuZnJhZ0JpdHJhdGVUZXN0ID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgICAvLyBzZXQgbmV3IGxldmVsIHRvIHBsYXlsaXN0IGxvYWRlciA6IHRoaXMgd2lsbCB0cmlnZ2VyIHN0YXJ0IGxldmVsIGxvYWRcbiAgICAgICAgdGhpcy5sZXZlbCA9IGhscy5uZXh0TG9hZExldmVsID0gdGhpcy5zdGFydExldmVsO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuV0FJVElOR19MRVZFTDtcbiAgICAgICAgdGhpcy5sb2FkZWRtZXRhZGF0YSA9IGZhbHNlO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuSURMRTpcbiAgICAgICAgLy8gaWYgdmlkZW8gbm90IGF0dGFjaGVkIEFORFxuICAgICAgICAvLyBzdGFydCBmcmFnbWVudCBhbHJlYWR5IHJlcXVlc3RlZCBPUiBzdGFydCBmcmFnIHByZWZldGNoIGRpc2FibGVcbiAgICAgICAgLy8gZXhpdCBsb29wXG4gICAgICAgIC8vID0+IGlmIG1lZGlhIG5vdCBhdHRhY2hlZCBidXQgc3RhcnQgZnJhZyBwcmVmZXRjaCBpcyBlbmFibGVkIGFuZCBzdGFydCBmcmFnIG5vdCByZXF1ZXN0ZWQgeWV0LCB3ZSB3aWxsIG5vdCBleGl0IGxvb3BcbiAgICAgICAgaWYgKCF0aGlzLm1lZGlhICYmXG4gICAgICAgICAgKHRoaXMuc3RhcnRGcmFnUmVxdWVzdGVkIHx8ICFjb25maWcuc3RhcnRGcmFnUHJlZmV0Y2gpKSB7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZGV0ZXJtaW5lIG5leHQgY2FuZGlkYXRlIGZyYWdtZW50IHRvIGJlIGxvYWRlZCwgYmFzZWQgb24gY3VycmVudCBwb3NpdGlvbiBhbmRcbiAgICAgICAgLy8gIGVuZCBvZiBidWZmZXIgcG9zaXRpb25cbiAgICAgICAgLy8gIGVuc3VyZSA2MHMgb2YgYnVmZmVyIHVwZnJvbnRcbiAgICAgICAgLy8gaWYgd2UgaGF2ZSBub3QgeWV0IGxvYWRlZCBhbnkgZnJhZ21lbnQsIHN0YXJ0IGxvYWRpbmcgZnJvbSBzdGFydCBwb3NpdGlvblxuICAgICAgICBpZiAodGhpcy5sb2FkZWRtZXRhZGF0YSkge1xuICAgICAgICAgIHBvcyA9IHRoaXMubWVkaWEuY3VycmVudFRpbWU7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcG9zID0gdGhpcy5uZXh0TG9hZFBvc2l0aW9uO1xuICAgICAgICB9XG4gICAgICAgIC8vIGRldGVybWluZSBuZXh0IGxvYWQgbGV2ZWxcbiAgICAgICAgaWYgKHRoaXMuc3RhcnRGcmFnUmVxdWVzdGVkID09PSBmYWxzZSkge1xuICAgICAgICAgIGxldmVsID0gdGhpcy5zdGFydExldmVsO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIHdlIGFyZSBub3QgYXQgcGxheWJhY2sgc3RhcnQsIGdldCBuZXh0IGxvYWQgbGV2ZWwgZnJvbSBsZXZlbCBDb250cm9sbGVyXG4gICAgICAgICAgbGV2ZWwgPSBobHMubmV4dExvYWRMZXZlbDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgYnVmZmVySW5mbyA9IEJ1ZmZlckhlbHBlci5idWZmZXJJbmZvKHRoaXMubWVkaWEscG9zLGNvbmZpZy5tYXhCdWZmZXJIb2xlKSxcbiAgICAgICAgICAgIGJ1ZmZlckxlbiA9IGJ1ZmZlckluZm8ubGVuLFxuICAgICAgICAgICAgYnVmZmVyRW5kID0gYnVmZmVySW5mby5lbmQsXG4gICAgICAgICAgICBmcmFnUHJldmlvdXMgPSB0aGlzLmZyYWdQcmV2aW91cyxcbiAgICAgICAgICAgIG1heEJ1ZkxlbjtcbiAgICAgICAgLy8gY29tcHV0ZSBtYXggQnVmZmVyIExlbmd0aCB0aGF0IHdlIGNvdWxkIGdldCBmcm9tIHRoaXMgbG9hZCBsZXZlbCwgYmFzZWQgb24gbGV2ZWwgYml0cmF0ZS4gZG9uJ3QgYnVmZmVyIG1vcmUgdGhhbiA2MCBNQiBhbmQgbW9yZSB0aGFuIDMwc1xuICAgICAgICBpZiAoKHRoaXMubGV2ZWxzW2xldmVsXSkuaGFzT3duUHJvcGVydHkoJ2JpdHJhdGUnKSkge1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IE1hdGgubWF4KDggKiBjb25maWcubWF4QnVmZmVyU2l6ZSAvIHRoaXMubGV2ZWxzW2xldmVsXS5iaXRyYXRlLCBjb25maWcubWF4QnVmZmVyTGVuZ3RoKTtcbiAgICAgICAgICBtYXhCdWZMZW4gPSBNYXRoLm1pbihtYXhCdWZMZW4sIGNvbmZpZy5tYXhNYXhCdWZmZXJMZW5ndGgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG1heEJ1ZkxlbiA9IGNvbmZpZy5tYXhCdWZmZXJMZW5ndGg7XG4gICAgICAgIH1cbiAgICAgICAgLy8gaWYgYnVmZmVyIGxlbmd0aCBpcyBsZXNzIHRoYW4gbWF4QnVmTGVuIHRyeSB0byBsb2FkIGEgbmV3IGZyYWdtZW50XG4gICAgICAgIGlmIChidWZmZXJMZW4gPCBtYXhCdWZMZW4pIHtcbiAgICAgICAgICAvLyBzZXQgbmV4dCBsb2FkIGxldmVsIDogdGhpcyB3aWxsIHRyaWdnZXIgYSBwbGF5bGlzdCBsb2FkIGlmIG5lZWRlZFxuICAgICAgICAgIGhscy5uZXh0TG9hZExldmVsID0gbGV2ZWw7XG4gICAgICAgICAgdGhpcy5sZXZlbCA9IGxldmVsO1xuICAgICAgICAgIGxldmVsRGV0YWlscyA9IHRoaXMubGV2ZWxzW2xldmVsXS5kZXRhaWxzO1xuICAgICAgICAgIC8vIGlmIGxldmVsIGluZm8gbm90IHJldHJpZXZlZCB5ZXQsIHN3aXRjaCBzdGF0ZSBhbmQgd2FpdCBmb3IgbGV2ZWwgcmV0cmlldmFsXG4gICAgICAgICAgLy8gaWYgbGl2ZSBwbGF5bGlzdCwgZW5zdXJlIHRoYXQgbmV3IHBsYXlsaXN0IGhhcyBiZWVuIHJlZnJlc2hlZCB0byBhdm9pZCBsb2FkaW5nL3RyeSB0byBsb2FkXG4gICAgICAgICAgLy8gYSB1c2VsZXNzIGFuZCBvdXRkYXRlZCBmcmFnbWVudCAodGhhdCBtaWdodCBldmVuIGludHJvZHVjZSBsb2FkIGVycm9yIGlmIGl0IGlzIGFscmVhZHkgb3V0IG9mIHRoZSBsaXZlIHBsYXlsaXN0KVxuICAgICAgICAgIGlmICh0eXBlb2YgbGV2ZWxEZXRhaWxzID09PSAndW5kZWZpbmVkJyB8fCBsZXZlbERldGFpbHMubGl2ZSAmJiB0aGlzLmxldmVsTGFzdExvYWRlZCAhPT0gbGV2ZWwpIHtcbiAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5XQUlUSU5HX0xFVkVMO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGZpbmQgZnJhZ21lbnQgaW5kZXgsIGNvbnRpZ3VvdXMgd2l0aCBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uXG4gICAgICAgICAgbGV0IGZyYWdtZW50cyA9IGxldmVsRGV0YWlscy5mcmFnbWVudHMsXG4gICAgICAgICAgICAgIGZyYWdMZW4gPSBmcmFnbWVudHMubGVuZ3RoLFxuICAgICAgICAgICAgICBzdGFydCA9IGZyYWdtZW50c1swXS5zdGFydCxcbiAgICAgICAgICAgICAgZW5kID0gZnJhZ21lbnRzW2ZyYWdMZW4tMV0uc3RhcnQgKyBmcmFnbWVudHNbZnJhZ0xlbi0xXS5kdXJhdGlvbixcbiAgICAgICAgICAgICAgZnJhZztcblxuICAgICAgICAgICAgLy8gaW4gY2FzZSBvZiBsaXZlIHBsYXlsaXN0IHdlIG5lZWQgdG8gZW5zdXJlIHRoYXQgcmVxdWVzdGVkIHBvc2l0aW9uIGlzIG5vdCBsb2NhdGVkIGJlZm9yZSBwbGF5bGlzdCBzdGFydFxuICAgICAgICAgIGlmIChsZXZlbERldGFpbHMubGl2ZSkge1xuICAgICAgICAgICAgLy8gY2hlY2sgaWYgcmVxdWVzdGVkIHBvc2l0aW9uIGlzIHdpdGhpbiBzZWVrYWJsZSBib3VuZGFyaWVzIDpcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgc3RhcnQvcG9zL2J1ZkVuZC9zZWVraW5nOiR7c3RhcnQudG9GaXhlZCgzKX0vJHtwb3MudG9GaXhlZCgzKX0vJHtidWZmZXJFbmQudG9GaXhlZCgzKX0vJHt0aGlzLm1lZGlhLnNlZWtpbmd9YCk7XG4gICAgICAgICAgICBsZXQgbWF4TGF0ZW5jeSA9IGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uICE9PSB1bmRlZmluZWQgPyBjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbiA6IGNvbmZpZy5saXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnQqbGV2ZWxEZXRhaWxzLnRhcmdldGR1cmF0aW9uO1xuXG4gICAgICAgICAgICBpZiAoYnVmZmVyRW5kIDwgTWF0aC5tYXgoc3RhcnQsIGVuZCAtIG1heExhdGVuY3kpKSB7XG4gICAgICAgICAgICAgICAgbGV0IHRhcmdldExhdGVuY3kgPSBjb25maWcubGl2ZVN5bmNEdXJhdGlvbiAhPT0gdW5kZWZpbmVkID8gY29uZmlnLmxpdmVTeW5jRHVyYXRpb24gOiBjb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50ICogbGV2ZWxEZXRhaWxzLnRhcmdldGR1cmF0aW9uO1xuICAgICAgICAgICAgICAgIHRoaXMuc2Vla0FmdGVyQnVmZmVyZWQgPSBzdGFydCArIE1hdGgubWF4KDAsIGxldmVsRGV0YWlscy50b3RhbGR1cmF0aW9uIC0gdGFyZ2V0TGF0ZW5jeSk7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgYnVmZmVyIGVuZDogJHtidWZmZXJFbmR9IGlzIGxvY2F0ZWQgdG9vIGZhciBmcm9tIHRoZSBlbmQgb2YgbGl2ZSBzbGlkaW5nIHBsYXlsaXN0LCBtZWRpYSBwb3NpdGlvbiB3aWxsIGJlIHJlc2V0ZWQgdG86ICR7dGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZC50b0ZpeGVkKDMpfWApO1xuICAgICAgICAgICAgICAgIGJ1ZmZlckVuZCA9IHRoaXMuc2Vla0FmdGVyQnVmZmVyZWQ7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5zdGFydEZyYWdSZXF1ZXN0ZWQgJiYgIWxldmVsRGV0YWlscy5QVFNLbm93bikge1xuICAgICAgICAgICAgICAvKiB3ZSBhcmUgc3dpdGNoaW5nIGxldmVsIG9uIGxpdmUgcGxheWxpc3QsIGJ1dCB3ZSBkb24ndCBoYXZlIGFueSBQVFMgaW5mbyBmb3IgdGhhdCBxdWFsaXR5IGxldmVsIC4uLlxuICAgICAgICAgICAgICAgICB0cnkgdG8gbG9hZCBmcmFnIG1hdGNoaW5nIHdpdGggbmV4dCBTTi5cbiAgICAgICAgICAgICAgICAgZXZlbiBpZiBTTiBhcmUgbm90IHN5bmNocm9uaXplZCBiZXR3ZWVuIHBsYXlsaXN0cywgbG9hZGluZyB0aGlzIGZyYWcgd2lsbCBoZWxwIHVzXG4gICAgICAgICAgICAgICAgIGNvbXB1dGUgcGxheWxpc3Qgc2xpZGluZyBhbmQgZmluZCB0aGUgcmlnaHQgb25lIGFmdGVyIGluIGNhc2UgaXQgd2FzIG5vdCB0aGUgcmlnaHQgY29uc2VjdXRpdmUgb25lICovXG4gICAgICAgICAgICAgIGlmIChmcmFnUHJldmlvdXMpIHtcbiAgICAgICAgICAgICAgICB2YXIgdGFyZ2V0U04gPSBmcmFnUHJldmlvdXMuc24gKyAxO1xuICAgICAgICAgICAgICAgIGlmICh0YXJnZXRTTiA+PSBsZXZlbERldGFpbHMuc3RhcnRTTiAmJiB0YXJnZXRTTiA8PSBsZXZlbERldGFpbHMuZW5kU04pIHtcbiAgICAgICAgICAgICAgICAgIGZyYWcgPSBmcmFnbWVudHNbdGFyZ2V0U04gLSBsZXZlbERldGFpbHMuc3RhcnRTTl07XG4gICAgICAgICAgICAgICAgICBsb2dnZXIubG9nKGBsaXZlIHBsYXlsaXN0LCBzd2l0Y2hpbmcgcGxheWxpc3QsIGxvYWQgZnJhZyB3aXRoIG5leHQgU046ICR7ZnJhZy5zbn1gKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWYgKCFmcmFnKSB7XG4gICAgICAgICAgICAgICAgLyogd2UgaGF2ZSBubyBpZGVhIGFib3V0IHdoaWNoIGZyYWdtZW50IHNob3VsZCBiZSBsb2FkZWQuXG4gICAgICAgICAgICAgICAgICAgc28gbGV0J3MgbG9hZCBtaWQgZnJhZ21lbnQuIGl0IHdpbGwgaGVscCBjb21wdXRpbmcgcGxheWxpc3Qgc2xpZGluZyBhbmQgZmluZCB0aGUgcmlnaHQgb25lXG4gICAgICAgICAgICAgICAgKi9cbiAgICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzW01hdGgubWluKGZyYWdMZW4gLSAxLCBNYXRoLnJvdW5kKGZyYWdMZW4gLyAyKSldO1xuICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYGxpdmUgcGxheWxpc3QsIHN3aXRjaGluZyBwbGF5bGlzdCwgdW5rbm93biwgbG9hZCBtaWRkbGUgZnJhZyA6ICR7ZnJhZy5zbn1gKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBWb0QgcGxheWxpc3Q6IGlmIGJ1ZmZlckVuZCBiZWZvcmUgc3RhcnQgb2YgcGxheWxpc3QsIGxvYWQgZmlyc3QgZnJhZ21lbnRcbiAgICAgICAgICAgIGlmIChidWZmZXJFbmQgPCBzdGFydCkge1xuICAgICAgICAgICAgICBmcmFnID0gZnJhZ21lbnRzWzBdO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIWZyYWcpIHtcbiAgICAgICAgICAgIGxldCBmb3VuZEZyYWc7XG4gICAgICAgICAgICBsZXQgbWF4RnJhZ0xvb2tVcFRvbGVyYW5jZSA9IGNvbmZpZy5tYXhGcmFnTG9va1VwVG9sZXJhbmNlO1xuICAgICAgICAgICAgaWYgKGJ1ZmZlckVuZCA8IGVuZCkge1xuICAgICAgICAgICAgICBpZiAoYnVmZmVyRW5kID4gZW5kIC0gbWF4RnJhZ0xvb2tVcFRvbGVyYW5jZSkge1xuICAgICAgICAgICAgICAgIG1heEZyYWdMb29rVXBUb2xlcmFuY2UgPSAwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZvdW5kRnJhZyA9IEJpbmFyeVNlYXJjaC5zZWFyY2goZnJhZ21lbnRzLCAoY2FuZGlkYXRlKSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gb2Zmc2V0IHNob3VsZCBiZSB3aXRoaW4gZnJhZ21lbnQgYm91bmRhcnkgLSBjb25maWcubWF4RnJhZ0xvb2tVcFRvbGVyYW5jZVxuICAgICAgICAgICAgICAgIC8vIHRoaXMgaXMgdG8gY29wZSB3aXRoIHNpdHVhdGlvbnMgbGlrZVxuICAgICAgICAgICAgICAgIC8vIGJ1ZmZlckVuZCA9IDkuOTkxXG4gICAgICAgICAgICAgICAgLy8gZnJhZ1vDmF0gOiBbMCwxMF1cbiAgICAgICAgICAgICAgICAvLyBmcmFnWzFdIDogWzEwLDIwXVxuICAgICAgICAgICAgICAgIC8vIGJ1ZmZlckVuZCBpcyB3aXRoaW4gZnJhZ1swXSByYW5nZSAuLi4gYWx0aG91Z2ggd2hhdCB3ZSBhcmUgZXhwZWN0aW5nIGlzIHRvIHJldHVybiBmcmFnWzFdIGhlcmVcbiAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgICAgICAgIGZyYWcgc3RhcnQgICAgICAgICAgICAgICBmcmFnIHN0YXJ0K2R1cmF0aW9uXG4gICAgICAgICAgICAgICAgICAgIC8vICAgICAgICAgICAgICAgICAgfC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tfFxuICAgICAgICAgICAgICAgICAgICAvLyAgICAgICAgICAgICAgPC0tLT4gICAgICAgICAgICAgICAgICAgICAgICAgPC0tLT5cbiAgICAgICAgICAgICAgICAgICAgLy8gIC4uLi0tLS0tLS0tPjwtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLT48LS0tLS0tLS0tLi4uLlxuICAgICAgICAgICAgICAgICAgICAvLyBwcmV2aW91cyBmcmFnICAgICAgICAgbWF0Y2hpbmcgZnJhZ21lbnQgICAgICAgICBuZXh0IGZyYWdcbiAgICAgICAgICAgICAgICAgICAgLy8gIHJldHVybiAtMSAgICAgICAgICAgICByZXR1cm4gMCAgICAgICAgICAgICAgICAgcmV0dXJuIDFcbiAgICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coYGxldmVsL3NuL3N0YXJ0L2VuZC9idWZFbmQ6JHtsZXZlbH0vJHtjYW5kaWRhdGUuc259LyR7Y2FuZGlkYXRlLnN0YXJ0fS8keyhjYW5kaWRhdGUuc3RhcnQrY2FuZGlkYXRlLmR1cmF0aW9uKX0vJHtidWZmZXJFbmR9YCk7XG4gICAgICAgICAgICAgICAgaWYgKChjYW5kaWRhdGUuc3RhcnQgKyBjYW5kaWRhdGUuZHVyYXRpb24gLSBtYXhGcmFnTG9va1VwVG9sZXJhbmNlKSA8PSBidWZmZXJFbmQpIHtcbiAgICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBlbHNlIGlmIChjYW5kaWRhdGUuc3RhcnQgLSBtYXhGcmFnTG9va1VwVG9sZXJhbmNlID4gYnVmZmVyRW5kKSB7XG4gICAgICAgICAgICAgICAgICByZXR1cm4gLTE7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIHJlYWNoIGVuZCBvZiBwbGF5bGlzdFxuICAgICAgICAgICAgICBmb3VuZEZyYWcgPSBmcmFnbWVudHNbZnJhZ0xlbi0xXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChmb3VuZEZyYWcpIHtcbiAgICAgICAgICAgICAgZnJhZyA9IGZvdW5kRnJhZztcbiAgICAgICAgICAgICAgc3RhcnQgPSBmb3VuZEZyYWcuc3RhcnQ7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmluZCBTTiBtYXRjaGluZyB3aXRoIHBvczonICsgIGJ1ZmZlckVuZCArICc6JyArIGZyYWcuc24pO1xuICAgICAgICAgICAgICBpZiAoZnJhZ1ByZXZpb3VzICYmIGZyYWcubGV2ZWwgPT09IGZyYWdQcmV2aW91cy5sZXZlbCAmJiBmcmFnLnNuID09PSBmcmFnUHJldmlvdXMuc24pIHtcbiAgICAgICAgICAgICAgICBpZiAoZnJhZy5zbiA8IGxldmVsRGV0YWlscy5lbmRTTikge1xuICAgICAgICAgICAgICAgICAgZnJhZyA9IGZyYWdtZW50c1tmcmFnLnNuICsgMSAtIGxldmVsRGV0YWlscy5zdGFydFNOXTtcbiAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYFNOIGp1c3QgbG9hZGVkLCBsb2FkIG5leHQgb25lOiAke2ZyYWcuc259YCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIC8vIGhhdmUgd2UgcmVhY2hlZCBlbmQgb2YgVk9EIHBsYXlsaXN0ID9cbiAgICAgICAgICAgICAgICAgIGlmICghbGV2ZWxEZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfRU9TKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkVOREVEO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgZnJhZyA9IG51bGw7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmKGZyYWcpIHtcbiAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnICAgICAgbG9hZGluZyBmcmFnICcgKyBpICsnLHBvcy9idWZFbmQ6JyArIHBvcy50b0ZpeGVkKDMpICsgJy8nICsgYnVmZmVyRW5kLnRvRml4ZWQoMykpO1xuICAgICAgICAgICAgaWYgKChmcmFnLmRlY3J5cHRkYXRhLnVyaSAhPSBudWxsKSAmJiAoZnJhZy5kZWNyeXB0ZGF0YS5rZXkgPT0gbnVsbCkpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgTG9hZGluZyBrZXkgZm9yICR7ZnJhZy5zbn0gb2YgWyR7bGV2ZWxEZXRhaWxzLnN0YXJ0U059ICwke2xldmVsRGV0YWlscy5lbmRTTn1dLGxldmVsICR7bGV2ZWx9YCk7XG4gICAgICAgICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5LRVlfTE9BRElORztcbiAgICAgICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuS0VZX0xPQURJTkcsIHtmcmFnOiBmcmFnfSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBMb2FkaW5nICR7ZnJhZy5zbn0gb2YgWyR7bGV2ZWxEZXRhaWxzLnN0YXJ0U059ICwke2xldmVsRGV0YWlscy5lbmRTTn1dLGxldmVsICR7bGV2ZWx9LCBjdXJyZW50VGltZToke3Bvc30sYnVmZmVyRW5kOiR7YnVmZmVyRW5kLnRvRml4ZWQoMyl9YCk7XG4gICAgICAgICAgICAgIGZyYWcuYXV0b0xldmVsID0gaGxzLmF1dG9MZXZlbEVuYWJsZWQ7XG4gICAgICAgICAgICAgIGlmICh0aGlzLmxldmVscy5sZW5ndGggPiAxKSB7XG4gICAgICAgICAgICAgICAgZnJhZy5leHBlY3RlZExlbiA9IE1hdGgucm91bmQoZnJhZy5kdXJhdGlvbiAqIHRoaXMubGV2ZWxzW2xldmVsXS5iaXRyYXRlIC8gOCk7XG4gICAgICAgICAgICAgICAgZnJhZy50cmVxdWVzdCA9IHBlcmZvcm1hbmNlLm5vdygpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIC8vIGVuc3VyZSB0aGF0IHdlIGFyZSBub3QgcmVsb2FkaW5nIHRoZSBzYW1lIGZyYWdtZW50cyBpbiBsb29wIC4uLlxuICAgICAgICAgICAgICBpZiAodGhpcy5mcmFnTG9hZElkeCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5mcmFnTG9hZElkeCsrO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRoaXMuZnJhZ0xvYWRJZHggPSAwO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmIChmcmFnLmxvYWRDb3VudGVyKSB7XG4gICAgICAgICAgICAgICAgZnJhZy5sb2FkQ291bnRlcisrO1xuICAgICAgICAgICAgICAgIGxldCBtYXhUaHJlc2hvbGQgPSBjb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgICAgICAgICAgICAgIC8vIGlmIHRoaXMgZnJhZyBoYXMgYWxyZWFkeSBiZWVuIGxvYWRlZCAzIHRpbWVzLCBhbmQgaWYgaXQgaGFzIGJlZW4gcmVsb2FkZWQgcmVjZW50bHlcbiAgICAgICAgICAgICAgICBpZiAoZnJhZy5sb2FkQ291bnRlciA+IG1heFRocmVzaG9sZCAmJiAoTWF0aC5hYnModGhpcy5mcmFnTG9hZElkeCAtIGZyYWcubG9hZElkeCkgPCBtYXhUaHJlc2hvbGQpKSB7XG4gICAgICAgICAgICAgICAgICBobHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5GUkFHX0xPT1BfTE9BRElOR19FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiBmcmFnfSk7XG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZyYWcubG9hZENvdW50ZXIgPSAxO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZyYWcubG9hZElkeCA9IHRoaXMuZnJhZ0xvYWRJZHg7XG4gICAgICAgICAgICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBmcmFnO1xuICAgICAgICAgICAgICB0aGlzLnN0YXJ0RnJhZ1JlcXVlc3RlZCA9IHRydWU7XG4gICAgICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRElORywge2ZyYWc6IGZyYWd9KTtcbiAgICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkZSQUdfTE9BRElORztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLldBSVRJTkdfTEVWRUw6XG4gICAgICAgIGxldmVsID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF07XG4gICAgICAgIC8vIGNoZWNrIGlmIHBsYXlsaXN0IGlzIGFscmVhZHkgbG9hZGVkXG4gICAgICAgIGlmIChsZXZlbCAmJiBsZXZlbC5kZXRhaWxzKSB7XG4gICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICAgIH1cbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIFN0YXRlLkZSQUdfTE9BRElOR19XQUlUSU5HX1JFVFJZOlxuICAgICAgICB2YXIgbm93ID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgIHZhciByZXRyeURhdGUgPSB0aGlzLnJldHJ5RGF0ZTtcbiAgICAgICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYTtcbiAgICAgICAgdmFyIGlzU2Vla2luZyA9IG1lZGlhICYmIG1lZGlhLnNlZWtpbmc7XG4gICAgICAgIC8vIGlmIGN1cnJlbnQgdGltZSBpcyBndCB0aGFuIHJldHJ5RGF0ZSwgb3IgaWYgbWVkaWEgc2Vla2luZyBsZXQncyBzd2l0Y2ggdG8gSURMRSBzdGF0ZSB0byByZXRyeSBsb2FkaW5nXG4gICAgICAgIGlmKCFyZXRyeURhdGUgfHwgKG5vdyA+PSByZXRyeURhdGUpIHx8IGlzU2Vla2luZykge1xuICAgICAgICAgIGxvZ2dlci5sb2coYG1lZGlhQ29udHJvbGxlcjogcmV0cnlEYXRlIHJlYWNoZWQsIHN3aXRjaCBiYWNrIHRvIElETEUgc3RhdGVgKTtcbiAgICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgU3RhdGUuU1RPUFBFRDpcbiAgICAgIGNhc2UgU3RhdGUuRlJBR19MT0FESU5HOlxuICAgICAgY2FzZSBTdGF0ZS5QQVJTSU5HOlxuICAgICAgY2FzZSBTdGF0ZS5QQVJTRUQ6XG4gICAgICBjYXNlIFN0YXRlLkVOREVEOlxuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGJyZWFrO1xuICAgIH1cbiAgICAvLyBjaGVjayBidWZmZXJcbiAgICB0aGlzLl9jaGVja0J1ZmZlcigpO1xuICAgIC8vIGNoZWNrL3VwZGF0ZSBjdXJyZW50IGZyYWdtZW50XG4gICAgdGhpcy5fY2hlY2tGcmFnbWVudENoYW5nZWQoKTtcbiAgfVxuXG5cblxuXG4gIGdldEJ1ZmZlclJhbmdlKHBvc2l0aW9uKSB7XG4gICAgdmFyIGksIHJhbmdlLFxuICAgICAgICBidWZmZXJSYW5nZSA9IHRoaXMuYnVmZmVyUmFuZ2U7XG4gICAgaWYgKGJ1ZmZlclJhbmdlKSB7XG4gICAgICBmb3IgKGkgPSBidWZmZXJSYW5nZS5sZW5ndGggLSAxOyBpID49MDsgaS0tKSB7XG4gICAgICAgIHJhbmdlID0gYnVmZmVyUmFuZ2VbaV07XG4gICAgICAgIGlmIChwb3NpdGlvbiA+PSByYW5nZS5zdGFydCAmJiBwb3NpdGlvbiA8PSByYW5nZS5lbmQpIHtcbiAgICAgICAgICByZXR1cm4gcmFuZ2U7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBnZXQgY3VycmVudExldmVsKCkge1xuICAgIGlmICh0aGlzLm1lZGlhKSB7XG4gICAgICB2YXIgcmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMubWVkaWEuY3VycmVudFRpbWUpO1xuICAgICAgaWYgKHJhbmdlKSB7XG4gICAgICAgIHJldHVybiByYW5nZS5mcmFnLmxldmVsO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gLTE7XG4gIH1cblxuICBnZXQgbmV4dEJ1ZmZlclJhbmdlKCkge1xuICAgIGlmICh0aGlzLm1lZGlhKSB7XG4gICAgICAvLyBmaXJzdCBnZXQgZW5kIHJhbmdlIG9mIGN1cnJlbnQgZnJhZ21lbnRcbiAgICAgIHJldHVybiB0aGlzLmZvbGxvd2luZ0J1ZmZlclJhbmdlKHRoaXMuZ2V0QnVmZmVyUmFuZ2UodGhpcy5tZWRpYS5jdXJyZW50VGltZSkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBmb2xsb3dpbmdCdWZmZXJSYW5nZShyYW5nZSkge1xuICAgIGlmIChyYW5nZSkge1xuICAgICAgLy8gdHJ5IHRvIGdldCByYW5nZSBvZiBuZXh0IGZyYWdtZW50ICg1MDBtcyBhZnRlciB0aGlzIHJhbmdlKVxuICAgICAgcmV0dXJuIHRoaXMuZ2V0QnVmZmVyUmFuZ2UocmFuZ2UuZW5kICsgMC41KTtcbiAgICB9XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICBnZXQgbmV4dExldmVsKCkge1xuICAgIHZhciByYW5nZSA9IHRoaXMubmV4dEJ1ZmZlclJhbmdlO1xuICAgIGlmIChyYW5nZSkge1xuICAgICAgcmV0dXJuIHJhbmdlLmZyYWcubGV2ZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAtMTtcbiAgICB9XG4gIH1cblxuICBpc0J1ZmZlcmVkKHBvc2l0aW9uKSB7XG4gICAgdmFyIHYgPSB0aGlzLm1lZGlhLCBidWZmZXJlZCA9IHYuYnVmZmVyZWQ7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBidWZmZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHBvc2l0aW9uID49IGJ1ZmZlcmVkLnN0YXJ0KGkpICYmIHBvc2l0aW9uIDw9IGJ1ZmZlcmVkLmVuZChpKSkge1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgX2NoZWNrRnJhZ21lbnRDaGFuZ2VkKCkge1xuICAgIHZhciByYW5nZUN1cnJlbnQsIGN1cnJlbnRUaW1lLCB2aWRlbyA9IHRoaXMubWVkaWE7XG4gICAgaWYgKHZpZGVvICYmIHZpZGVvLnNlZWtpbmcgPT09IGZhbHNlKSB7XG4gICAgICBjdXJyZW50VGltZSA9IHZpZGVvLmN1cnJlbnRUaW1lO1xuICAgICAgLyogaWYgdmlkZW8gZWxlbWVudCBpcyBpbiBzZWVrZWQgc3RhdGUsIGN1cnJlbnRUaW1lIGNhbiBvbmx5IGluY3JlYXNlLlxuICAgICAgICAoYXNzdW1pbmcgdGhhdCBwbGF5YmFjayByYXRlIGlzIHBvc2l0aXZlIC4uLilcbiAgICAgICAgQXMgc29tZXRpbWVzIGN1cnJlbnRUaW1lIGp1bXBzIGJhY2sgdG8gemVybyBhZnRlciBhXG4gICAgICAgIG1lZGlhIGRlY29kZSBlcnJvciwgY2hlY2sgdGhpcywgdG8gYXZvaWQgc2Vla2luZyBiYWNrIHRvXG4gICAgICAgIHdyb25nIHBvc2l0aW9uIGFmdGVyIGEgbWVkaWEgZGVjb2RlIGVycm9yXG4gICAgICAqL1xuICAgICAgaWYoY3VycmVudFRpbWUgPiB2aWRlby5wbGF5YmFja1JhdGUqdGhpcy5sYXN0Q3VycmVudFRpbWUpIHtcbiAgICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSBjdXJyZW50VGltZTtcbiAgICAgIH1cbiAgICAgIGlmICh0aGlzLmlzQnVmZmVyZWQoY3VycmVudFRpbWUpKSB7XG4gICAgICAgIHJhbmdlQ3VycmVudCA9IHRoaXMuZ2V0QnVmZmVyUmFuZ2UoY3VycmVudFRpbWUpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmlzQnVmZmVyZWQoY3VycmVudFRpbWUgKyAwLjEpKSB7XG4gICAgICAgIC8qIGVuc3VyZSB0aGF0IEZSQUdfQ0hBTkdFRCBldmVudCBpcyB0cmlnZ2VyZWQgYXQgc3RhcnR1cCxcbiAgICAgICAgICB3aGVuIGZpcnN0IHZpZGVvIGZyYW1lIGlzIGRpc3BsYXllZCBhbmQgcGxheWJhY2sgaXMgcGF1c2VkLlxuICAgICAgICAgIGFkZCBhIHRvbGVyYW5jZSBvZiAxMDBtcywgaW4gY2FzZSBjdXJyZW50IHBvc2l0aW9uIGlzIG5vdCBidWZmZXJlZCxcbiAgICAgICAgICBjaGVjayBpZiBjdXJyZW50IHBvcysxMDBtcyBpcyBidWZmZXJlZCBhbmQgdXNlIHRoYXQgYnVmZmVyIHJhbmdlXG4gICAgICAgICAgZm9yIEZSQUdfQ0hBTkdFRCBldmVudCByZXBvcnRpbmcgKi9cbiAgICAgICAgcmFuZ2VDdXJyZW50ID0gdGhpcy5nZXRCdWZmZXJSYW5nZShjdXJyZW50VGltZSArIDAuMSk7XG4gICAgICB9XG4gICAgICBpZiAocmFuZ2VDdXJyZW50KSB7XG4gICAgICAgIHZhciBmcmFnUGxheWluZyA9IHJhbmdlQ3VycmVudC5mcmFnO1xuICAgICAgICBpZiAoZnJhZ1BsYXlpbmcgIT09IHRoaXMuZnJhZ1BsYXlpbmcpIHtcbiAgICAgICAgICB0aGlzLmZyYWdQbGF5aW5nID0gZnJhZ1BsYXlpbmc7XG4gICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX0NIQU5HRUQsIHtmcmFnOiBmcmFnUGxheWluZ30pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLypcbiAgICBvbiBpbW1lZGlhdGUgbGV2ZWwgc3dpdGNoIDpcbiAgICAgLSBwYXVzZSBwbGF5YmFjayBpZiBwbGF5aW5nXG4gICAgIC0gY2FuY2VsIGFueSBwZW5kaW5nIGxvYWQgcmVxdWVzdFxuICAgICAtIGFuZCB0cmlnZ2VyIGEgYnVmZmVyIGZsdXNoXG4gICovXG4gIGltbWVkaWF0ZUxldmVsU3dpdGNoKCkge1xuICAgIGxvZ2dlci5sb2coJ2ltbWVkaWF0ZUxldmVsU3dpdGNoJyk7XG4gICAgaWYgKCF0aGlzLmltbWVkaWF0ZVN3aXRjaCkge1xuICAgICAgdGhpcy5pbW1lZGlhdGVTd2l0Y2ggPSB0cnVlO1xuICAgICAgdGhpcy5wcmV2aW91c2x5UGF1c2VkID0gdGhpcy5tZWRpYS5wYXVzZWQ7XG4gICAgICB0aGlzLm1lZGlhLnBhdXNlKCk7XG4gICAgfVxuICAgIHZhciBmcmFnQ3VycmVudCA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgaWYgKGZyYWdDdXJyZW50ICYmIGZyYWdDdXJyZW50LmxvYWRlcikge1xuICAgICAgZnJhZ0N1cnJlbnQubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuZnJhZ0N1cnJlbnQgPSBudWxsO1xuICAgIC8vIGZsdXNoIGV2ZXJ5dGhpbmdcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9GTFVTSElORywge3N0YXJ0T2Zmc2V0OiAwLCBlbmRPZmZzZXQ6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWX0pO1xuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVVTRUQ7XG4gICAgLy8gaW5jcmVhc2UgZnJhZ21lbnQgbG9hZCBJbmRleCB0byBhdm9pZCBmcmFnIGxvb3AgbG9hZGluZyBlcnJvciBhZnRlciBidWZmZXIgZmx1c2hcbiAgICB0aGlzLmZyYWdMb2FkSWR4ICs9IDIgKiB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ7XG4gICAgLy8gc3BlZWQgdXAgc3dpdGNoaW5nLCB0cmlnZ2VyIHRpbWVyIGZ1bmN0aW9uXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICAvKlxuICAgICBvbiBpbW1lZGlhdGUgbGV2ZWwgc3dpdGNoIGVuZCwgYWZ0ZXIgbmV3IGZyYWdtZW50IGhhcyBiZWVuIGJ1ZmZlcmVkIDpcbiAgICAgIC0gbnVkZ2UgdmlkZW8gZGVjb2RlciBieSBzbGlnaHRseSBhZGp1c3RpbmcgdmlkZW8gY3VycmVudFRpbWVcbiAgICAgIC0gcmVzdW1lIHRoZSBwbGF5YmFjayBpZiBuZWVkZWRcbiAgKi9cbiAgaW1tZWRpYXRlTGV2ZWxTd2l0Y2hFbmQoKSB7XG4gICAgdGhpcy5pbW1lZGlhdGVTd2l0Y2ggPSBmYWxzZTtcbiAgICB0aGlzLm1lZGlhLmN1cnJlbnRUaW1lIC09IDAuMDAwMTtcbiAgICBpZiAoIXRoaXMucHJldmlvdXNseVBhdXNlZCkge1xuICAgICAgdGhpcy5tZWRpYS5wbGF5KCk7XG4gICAgfVxuICB9XG5cbiAgbmV4dExldmVsU3dpdGNoKCkge1xuICAgIC8qIHRyeSB0byBzd2l0Y2ggQVNBUCB3aXRob3V0IGJyZWFraW5nIHZpZGVvIHBsYXliYWNrIDpcbiAgICAgICBpbiBvcmRlciB0byBlbnN1cmUgc21vb3RoIGJ1dCBxdWljayBsZXZlbCBzd2l0Y2hpbmcsXG4gICAgICB3ZSBuZWVkIHRvIGZpbmQgdGhlIG5leHQgZmx1c2hhYmxlIGJ1ZmZlciByYW5nZVxuICAgICAgd2Ugc2hvdWxkIHRha2UgaW50byBhY2NvdW50IG5ldyBzZWdtZW50IGZldGNoIHRpbWVcbiAgICAqL1xuICAgIHZhciBmZXRjaGRlbGF5LCBjdXJyZW50UmFuZ2UsIG5leHRSYW5nZTtcbiAgICBjdXJyZW50UmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMubWVkaWEuY3VycmVudFRpbWUpO1xuICAgIGlmIChjdXJyZW50UmFuZ2UgJiYgY3VycmVudFJhbmdlLnN0YXJ0ID4gMSkge1xuICAgIC8vIGZsdXNoIGJ1ZmZlciBwcmVjZWRpbmcgY3VycmVudCBmcmFnbWVudCAoZmx1c2ggdW50aWwgY3VycmVudCBmcmFnbWVudCBzdGFydCBvZmZzZXQpXG4gICAgLy8gbWludXMgMXMgdG8gYXZvaWQgdmlkZW8gZnJlZXppbmcsIHRoYXQgY291bGQgaGFwcGVuIGlmIHdlIGZsdXNoIGtleWZyYW1lIG9mIGN1cnJlbnQgdmlkZW8gLi4uXG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9GTFVTSElORywge3N0YXJ0T2Zmc2V0OiAwLCBlbmRPZmZzZXQ6IGN1cnJlbnRSYW5nZS5zdGFydCAtIDF9KTtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5QQVVTRUQ7XG4gICAgfVxuICAgIGlmICghdGhpcy5tZWRpYS5wYXVzZWQpIHtcbiAgICAgIC8vIGFkZCBhIHNhZmV0eSBkZWxheSBvZiAxc1xuICAgICAgdmFyIG5leHRMZXZlbElkID0gdGhpcy5obHMubmV4dExvYWRMZXZlbCxuZXh0TGV2ZWwgPSB0aGlzLmxldmVsc1tuZXh0TGV2ZWxJZF0sIGZyYWdMYXN0S2JwcyA9IHRoaXMuZnJhZ0xhc3RLYnBzO1xuICAgICAgaWYgKGZyYWdMYXN0S2JwcyAmJiB0aGlzLmZyYWdDdXJyZW50KSB7XG4gICAgICAgIGZldGNoZGVsYXkgPSB0aGlzLmZyYWdDdXJyZW50LmR1cmF0aW9uICogbmV4dExldmVsLmJpdHJhdGUgLyAoMTAwMCAqIGZyYWdMYXN0S2JwcykgKyAxO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmV0Y2hkZWxheSA9IDA7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGZldGNoZGVsYXkgPSAwO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ2ZldGNoZGVsYXk6JytmZXRjaGRlbGF5KTtcbiAgICAvLyBmaW5kIGJ1ZmZlciByYW5nZSB0aGF0IHdpbGwgYmUgcmVhY2hlZCBvbmNlIG5ldyBmcmFnbWVudCB3aWxsIGJlIGZldGNoZWRcbiAgICBuZXh0UmFuZ2UgPSB0aGlzLmdldEJ1ZmZlclJhbmdlKHRoaXMubWVkaWEuY3VycmVudFRpbWUgKyBmZXRjaGRlbGF5KTtcbiAgICBpZiAobmV4dFJhbmdlKSB7XG4gICAgICAvLyB3ZSBjYW4gZmx1c2ggYnVmZmVyIHJhbmdlIGZvbGxvd2luZyB0aGlzIG9uZSB3aXRob3V0IHN0YWxsaW5nIHBsYXliYWNrXG4gICAgICBuZXh0UmFuZ2UgPSB0aGlzLmZvbGxvd2luZ0J1ZmZlclJhbmdlKG5leHRSYW5nZSk7XG4gICAgICBpZiAobmV4dFJhbmdlKSB7XG4gICAgICAgIC8vIGZsdXNoIHBvc2l0aW9uIGlzIHRoZSBzdGFydCBwb3NpdGlvbiBvZiB0aGlzIG5ldyBidWZmZXJcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfRkxVU0hJTkcsIHtzdGFydE9mZnNldDogbmV4dFJhbmdlLnN0YXJ0LCBlbmRPZmZzZXQ6IE51bWJlci5QT1NJVElWRV9JTkZJTklUWX0pO1xuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuUEFVU0VEO1xuICAgICAgICAvLyBpZiB3ZSBhcmUgaGVyZSwgd2UgY2FuIGFsc28gY2FuY2VsIGFueSBsb2FkaW5nL2RlbXV4aW5nIGluIHByb2dyZXNzLCBhcyB0aGV5IGFyZSB1c2VsZXNzXG4gICAgICAgIHZhciBmcmFnQ3VycmVudCA9IHRoaXMuZnJhZ0N1cnJlbnQ7XG4gICAgICAgIGlmIChmcmFnQ3VycmVudCAmJiBmcmFnQ3VycmVudC5sb2FkZXIpIHtcbiAgICAgICAgICBmcmFnQ3VycmVudC5sb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmZyYWdDdXJyZW50ID0gbnVsbDtcbiAgICAgICAgLy8gaW5jcmVhc2UgZnJhZ21lbnQgbG9hZCBJbmRleCB0byBhdm9pZCBmcmFnIGxvb3AgbG9hZGluZyBlcnJvciBhZnRlciBidWZmZXIgZmx1c2hcbiAgICAgICAgdGhpcy5mcmFnTG9hZElkeCArPSAyICogdGhpcy5jb25maWcuZnJhZ0xvYWRpbmdMb29wVGhyZXNob2xkO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIG9uTWVkaWFBdHRhY2hlZChkYXRhKSB7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYSA9IGRhdGEubWVkaWE7XG4gICAgdGhpcy5vbnZzZWVraW5nID0gdGhpcy5vbk1lZGlhU2Vla2luZy5iaW5kKHRoaXMpO1xuICAgIHRoaXMub252c2Vla2VkID0gdGhpcy5vbk1lZGlhU2Vla2VkLmJpbmQodGhpcyk7XG4gICAgdGhpcy5vbnZlbmRlZCA9IHRoaXMub25NZWRpYUVuZGVkLmJpbmQodGhpcyk7XG4gICAgbWVkaWEuYWRkRXZlbnRMaXN0ZW5lcignc2Vla2luZycsIHRoaXMub252c2Vla2luZyk7XG4gICAgbWVkaWEuYWRkRXZlbnRMaXN0ZW5lcignc2Vla2VkJywgdGhpcy5vbnZzZWVrZWQpO1xuICAgIG1lZGlhLmFkZEV2ZW50TGlzdGVuZXIoJ2VuZGVkJywgdGhpcy5vbnZlbmRlZCk7XG4gICAgaWYodGhpcy5sZXZlbHMgJiYgdGhpcy5jb25maWcuYXV0b1N0YXJ0TG9hZCkge1xuICAgICAgdGhpcy5obHMuc3RhcnRMb2FkKCk7XG4gICAgfVxuICB9XG5cbiAgb25NZWRpYURldGFjaGluZygpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhO1xuICAgIGlmIChtZWRpYSAmJiBtZWRpYS5lbmRlZCkge1xuICAgICAgbG9nZ2VyLmxvZygnTVNFIGRldGFjaGluZyBhbmQgdmlkZW8gZW5kZWQsIHJlc2V0IHN0YXJ0UG9zaXRpb24nKTtcbiAgICAgIHRoaXMuc3RhcnRQb3NpdGlvbiA9IHRoaXMubGFzdEN1cnJlbnRUaW1lID0gMDtcbiAgICB9XG5cbiAgICAvLyByZXNldCBmcmFnbWVudCBsb2FkaW5nIGNvdW50ZXIgb24gTVNFIGRldGFjaGluZyB0byBhdm9pZCByZXBvcnRpbmcgRlJBR19MT09QX0xPQURJTkdfRVJST1IgYWZ0ZXIgZXJyb3IgcmVjb3ZlcnlcbiAgICB2YXIgbGV2ZWxzID0gdGhpcy5sZXZlbHM7XG4gICAgaWYgKGxldmVscykge1xuICAgICAgLy8gcmVzZXQgZnJhZ21lbnQgbG9hZCBjb3VudGVyXG4gICAgICAgIGxldmVscy5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgICAgICBpZihsZXZlbC5kZXRhaWxzKSB7XG4gICAgICAgICAgICBsZXZlbC5kZXRhaWxzLmZyYWdtZW50cy5mb3JFYWNoKGZyYWdtZW50ID0+IHtcbiAgICAgICAgICAgICAgZnJhZ21lbnQubG9hZENvdW50ZXIgPSB1bmRlZmluZWQ7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICAgLy8gcmVtb3ZlIHZpZGVvIGxpc3RlbmVyc1xuICAgIGlmIChtZWRpYSkge1xuICAgICAgbWVkaWEucmVtb3ZlRXZlbnRMaXN0ZW5lcignc2Vla2luZycsIHRoaXMub252c2Vla2luZyk7XG4gICAgICBtZWRpYS5yZW1vdmVFdmVudExpc3RlbmVyKCdzZWVrZWQnLCB0aGlzLm9udnNlZWtlZCk7XG4gICAgICBtZWRpYS5yZW1vdmVFdmVudExpc3RlbmVyKCdlbmRlZCcsIHRoaXMub252ZW5kZWQpO1xuICAgICAgdGhpcy5vbnZzZWVraW5nID0gdGhpcy5vbnZzZWVrZWQgID0gdGhpcy5vbnZlbmRlZCA9IG51bGw7XG4gICAgfVxuICAgIHRoaXMubWVkaWEgPSBudWxsO1xuICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSBmYWxzZTtcbiAgICB0aGlzLnN0b3BMb2FkKCk7XG4gIH1cblxuICBvbk1lZGlhU2Vla2luZygpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuRlJBR19MT0FESU5HKSB7XG4gICAgICAvLyBjaGVjayBpZiBjdXJyZW50bHkgbG9hZGVkIGZyYWdtZW50IGlzIGluc2lkZSBidWZmZXIuXG4gICAgICAvL2lmIG91dHNpZGUsIGNhbmNlbCBmcmFnbWVudCBsb2FkaW5nLCBvdGhlcndpc2UgZG8gbm90aGluZ1xuICAgICAgaWYgKEJ1ZmZlckhlbHBlci5idWZmZXJJbmZvKHRoaXMubWVkaWEsdGhpcy5tZWRpYS5jdXJyZW50VGltZSx0aGlzLmNvbmZpZy5tYXhCdWZmZXJIb2xlKS5sZW4gPT09IDApIHtcbiAgICAgICAgbG9nZ2VyLmxvZygnc2Vla2luZyBvdXRzaWRlIG9mIGJ1ZmZlciB3aGlsZSBmcmFnbWVudCBsb2FkIGluIHByb2dyZXNzLCBjYW5jZWwgZnJhZ21lbnQgbG9hZCcpO1xuICAgICAgICB2YXIgZnJhZ0N1cnJlbnQgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgICAgICBpZiAoZnJhZ0N1cnJlbnQpIHtcbiAgICAgICAgICBpZiAoZnJhZ0N1cnJlbnQubG9hZGVyKSB7XG4gICAgICAgICAgICBmcmFnQ3VycmVudC5sb2FkZXIuYWJvcnQoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdGhpcy5mcmFnQ3VycmVudCA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5mcmFnUHJldmlvdXMgPSBudWxsO1xuICAgICAgICAvLyBzd2l0Y2ggdG8gSURMRSBzdGF0ZSB0byBsb2FkIG5ldyBmcmFnbWVudFxuICAgICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKHRoaXMuc3RhdGUgPT09IFN0YXRlLkVOREVEKSB7XG4gICAgICAgIC8vIHN3aXRjaCB0byBJRExFIHN0YXRlIHRvIGNoZWNrIGZvciBwb3RlbnRpYWwgbmV3IGZyYWdtZW50XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgIH1cbiAgICBpZiAodGhpcy5tZWRpYSkge1xuICAgICAgdGhpcy5sYXN0Q3VycmVudFRpbWUgPSB0aGlzLm1lZGlhLmN1cnJlbnRUaW1lO1xuICAgIH1cbiAgICAvLyBhdm9pZCByZXBvcnRpbmcgZnJhZ21lbnQgbG9vcCBsb2FkaW5nIGVycm9yIGluIGNhc2UgdXNlciBpcyBzZWVraW5nIHNldmVyYWwgdGltZXMgb24gc2FtZSBwb3NpdGlvblxuICAgIGlmICh0aGlzLmZyYWdMb2FkSWR4ICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMuZnJhZ0xvYWRJZHggKz0gMiAqIHRoaXMuY29uZmlnLmZyYWdMb2FkaW5nTG9vcFRocmVzaG9sZDtcbiAgICB9XG4gICAgLy8gdGljayB0byBzcGVlZCB1cCBwcm9jZXNzaW5nXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbk1lZGlhU2Vla2VkKCkge1xuICAgIC8vIHRpY2sgdG8gc3BlZWQgdXAgRlJBR01FTlRfUExBWUlORyB0cmlnZ2VyaW5nXG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbk1lZGlhRW5kZWQoKSB7XG4gICAgbG9nZ2VyLmxvZygnbWVkaWEgZW5kZWQnKTtcbiAgICAvLyByZXNldCBzdGFydFBvc2l0aW9uIGFuZCBsYXN0Q3VycmVudFRpbWUgdG8gcmVzdGFydCBwbGF5YmFjayBAIHN0cmVhbSBiZWdpbm5pbmdcbiAgICB0aGlzLnN0YXJ0UG9zaXRpb24gPSB0aGlzLmxhc3RDdXJyZW50VGltZSA9IDA7XG4gIH1cblxuXG4gIG9uTWFuaWZlc3RMb2FkaW5nKCkge1xuICAgIC8vIHJlc2V0IGJ1ZmZlciBvbiBtYW5pZmVzdCBsb2FkaW5nXG4gICAgbG9nZ2VyLmxvZygndHJpZ2dlciBCVUZGRVJfUkVTRVQnKTtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9SRVNFVCk7XG4gICAgdGhpcy5idWZmZXJSYW5nZSA9IFtdO1xuICAgIHRoaXMuc3RhbGxlZCA9IGZhbHNlO1xuICB9XG5cbiAgb25NYW5pZmVzdFBhcnNlZChkYXRhKSB7XG4gICAgdmFyIGFhYyA9IGZhbHNlLCBoZWFhYyA9IGZhbHNlLCBjb2RlYztcbiAgICBkYXRhLmxldmVscy5mb3JFYWNoKGxldmVsID0+IHtcbiAgICAgIC8vIGRldGVjdCBpZiB3ZSBoYXZlIGRpZmZlcmVudCBraW5kIG9mIGF1ZGlvIGNvZGVjcyB1c2VkIGFtb25nc3QgcGxheWxpc3RzXG4gICAgICBjb2RlYyA9IGxldmVsLmF1ZGlvQ29kZWM7XG4gICAgICBpZiAoY29kZWMpIHtcbiAgICAgICAgaWYgKGNvZGVjLmluZGV4T2YoJ21wNGEuNDAuMicpICE9PSAtMSkge1xuICAgICAgICAgIGFhYyA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGNvZGVjLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PSAtMSkge1xuICAgICAgICAgIGhlYWFjID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIHRoaXMuYXVkaW9Db2RlY1N3aXRjaCA9IChhYWMgJiYgaGVhYWMpO1xuICAgIGlmICh0aGlzLmF1ZGlvQ29kZWNTd2l0Y2gpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2JvdGggQUFDL0hFLUFBQyBhdWRpbyBmb3VuZCBpbiBsZXZlbHM7IGRlY2xhcmluZyBsZXZlbCBjb2RlYyBhcyBIRS1BQUMnKTtcbiAgICB9XG4gICAgdGhpcy5sZXZlbHMgPSBkYXRhLmxldmVscztcbiAgICB0aGlzLnN0YXJ0TGV2ZWxMb2FkZWQgPSBmYWxzZTtcbiAgICB0aGlzLnN0YXJ0RnJhZ1JlcXVlc3RlZCA9IGZhbHNlO1xuICAgIGlmICh0aGlzLmNvbmZpZy5hdXRvU3RhcnRMb2FkKSB7XG4gICAgICB0aGlzLmhscy5zdGFydExvYWQoKTtcbiAgICB9XG4gIH1cblxuICBvbkxldmVsTG9hZGVkKGRhdGEpIHtcbiAgICB2YXIgbmV3RGV0YWlscyA9IGRhdGEuZGV0YWlscyxcbiAgICAgICAgbmV3TGV2ZWxJZCA9IGRhdGEubGV2ZWwsXG4gICAgICAgIGN1ckxldmVsID0gdGhpcy5sZXZlbHNbbmV3TGV2ZWxJZF0sXG4gICAgICAgIGR1cmF0aW9uID0gbmV3RGV0YWlscy50b3RhbGR1cmF0aW9uLFxuICAgICAgICBzbGlkaW5nID0gMDtcblxuICAgIGxvZ2dlci5sb2coYGxldmVsICR7bmV3TGV2ZWxJZH0gbG9hZGVkIFske25ld0RldGFpbHMuc3RhcnRTTn0sJHtuZXdEZXRhaWxzLmVuZFNOfV0sZHVyYXRpb246JHtkdXJhdGlvbn1gKTtcbiAgICB0aGlzLmxldmVsTGFzdExvYWRlZCA9IG5ld0xldmVsSWQ7XG5cbiAgICBpZiAobmV3RGV0YWlscy5saXZlKSB7XG4gICAgICB2YXIgY3VyRGV0YWlscyA9IGN1ckxldmVsLmRldGFpbHM7XG4gICAgICBpZiAoY3VyRGV0YWlscykge1xuICAgICAgICAvLyB3ZSBhbHJlYWR5IGhhdmUgZGV0YWlscyBmb3IgdGhhdCBsZXZlbCwgbWVyZ2UgdGhlbVxuICAgICAgICBMZXZlbEhlbHBlci5tZXJnZURldGFpbHMoY3VyRGV0YWlscyxuZXdEZXRhaWxzKTtcbiAgICAgICAgc2xpZGluZyA9IG5ld0RldGFpbHMuZnJhZ21lbnRzWzBdLnN0YXJ0O1xuICAgICAgICBpZiAobmV3RGV0YWlscy5QVFNLbm93bikge1xuICAgICAgICAgIGxvZ2dlci5sb2coYGxpdmUgcGxheWxpc3Qgc2xpZGluZzoke3NsaWRpbmcudG9GaXhlZCgzKX1gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBsb2dnZXIubG9nKCdsaXZlIHBsYXlsaXN0IC0gb3V0ZGF0ZWQgUFRTLCB1bmtub3duIHNsaWRpbmcnKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbmV3RGV0YWlscy5QVFNLbm93biA9IGZhbHNlO1xuICAgICAgICBsb2dnZXIubG9nKCdsaXZlIHBsYXlsaXN0IC0gZmlyc3QgbG9hZCwgdW5rbm93biBzbGlkaW5nJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG5ld0RldGFpbHMuUFRTS25vd24gPSBmYWxzZTtcbiAgICB9XG4gICAgLy8gb3ZlcnJpZGUgbGV2ZWwgaW5mb1xuICAgIGN1ckxldmVsLmRldGFpbHMgPSBuZXdEZXRhaWxzO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfVVBEQVRFRCwgeyBkZXRhaWxzOiBuZXdEZXRhaWxzLCBsZXZlbDogbmV3TGV2ZWxJZCB9KTtcblxuICAgIC8vIGNvbXB1dGUgc3RhcnQgcG9zaXRpb25cbiAgICBpZiAodGhpcy5zdGFydEZyYWdSZXF1ZXN0ZWQgPT09IGZhbHNlKSB7XG4gICAgICAvLyBpZiBsaXZlIHBsYXlsaXN0LCBzZXQgc3RhcnQgcG9zaXRpb24gdG8gYmUgZnJhZ21lbnQgTi10aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uQ291bnQgKHVzdWFsbHkgMylcbiAgICAgIGlmIChuZXdEZXRhaWxzLmxpdmUpIHtcbiAgICAgICAgbGV0IHRhcmdldExhdGVuY3kgPSB0aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uICE9PSB1bmRlZmluZWQgPyB0aGlzLmNvbmZpZy5saXZlU3luY0R1cmF0aW9uIDogdGhpcy5jb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50ICogbmV3RGV0YWlscy50YXJnZXRkdXJhdGlvbjtcbiAgICAgICAgdGhpcy5zdGFydFBvc2l0aW9uID0gTWF0aC5tYXgoMCwgc2xpZGluZyArIGR1cmF0aW9uIC0gdGFyZ2V0TGF0ZW5jeSk7XG4gICAgICB9XG4gICAgICB0aGlzLm5leHRMb2FkUG9zaXRpb24gPSB0aGlzLnN0YXJ0UG9zaXRpb247XG4gICAgfVxuICAgIC8vIG9ubHkgc3dpdGNoIGJhdGNrIHRvIElETEUgc3RhdGUgaWYgd2Ugd2VyZSB3YWl0aW5nIGZvciBsZXZlbCB0byBzdGFydCBkb3dubG9hZGluZyBhIG5ldyBmcmFnbWVudFxuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5XQUlUSU5HX0xFVkVMKSB7XG4gICAgICB0aGlzLnN0YXRlID0gU3RhdGUuSURMRTtcbiAgICB9XG4gICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbktleUxvYWRlZCgpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuS0VZX0xPQURJTkcpIHtcbiAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25GcmFnTG9hZGVkKGRhdGEpIHtcbiAgICB2YXIgZnJhZ0N1cnJlbnQgPSB0aGlzLmZyYWdDdXJyZW50O1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5GUkFHX0xPQURJTkcgJiZcbiAgICAgICAgZnJhZ0N1cnJlbnQgJiZcbiAgICAgICAgZGF0YS5mcmFnLmxldmVsID09PSBmcmFnQ3VycmVudC5sZXZlbCAmJlxuICAgICAgICBkYXRhLmZyYWcuc24gPT09IGZyYWdDdXJyZW50LnNuKSB7XG4gICAgICBpZiAodGhpcy5mcmFnQml0cmF0ZVRlc3QgPT09IHRydWUpIHtcbiAgICAgICAgLy8gc3dpdGNoIGJhY2sgdG8gSURMRSBzdGF0ZSAuLi4gd2UganVzdCBsb2FkZWQgYSBmcmFnbWVudCB0byBkZXRlcm1pbmUgYWRlcXVhdGUgc3RhcnQgYml0cmF0ZSBhbmQgaW5pdGlhbGl6ZSBhdXRvc3dpdGNoIGFsZ29cbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgICAgIHRoaXMuZnJhZ0JpdHJhdGVUZXN0ID0gZmFsc2U7XG4gICAgICAgIGRhdGEuc3RhdHMudHBhcnNlZCA9IGRhdGEuc3RhdHMudGJ1ZmZlcmVkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19CVUZGRVJFRCwge3N0YXRzOiBkYXRhLnN0YXRzLCBmcmFnOiBmcmFnQ3VycmVudH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLlBBUlNJTkc7XG4gICAgICAgIC8vIHRyYW5zbXV4IHRoZSBNUEVHLVRTIGRhdGEgdG8gSVNPLUJNRkYgc2VnbWVudHNcbiAgICAgICAgdGhpcy5zdGF0cyA9IGRhdGEuc3RhdHM7XG4gICAgICAgIHZhciBjdXJyZW50TGV2ZWwgPSB0aGlzLmxldmVsc1t0aGlzLmxldmVsXSxcbiAgICAgICAgICAgIGRldGFpbHMgPSBjdXJyZW50TGV2ZWwuZGV0YWlscyxcbiAgICAgICAgICAgIGR1cmF0aW9uID0gZGV0YWlscy50b3RhbGR1cmF0aW9uLFxuICAgICAgICAgICAgc3RhcnQgPSBmcmFnQ3VycmVudC5zdGFydCxcbiAgICAgICAgICAgIGxldmVsID0gZnJhZ0N1cnJlbnQubGV2ZWwsXG4gICAgICAgICAgICBzbiA9IGZyYWdDdXJyZW50LnNuLFxuICAgICAgICAgICAgYXVkaW9Db2RlYyA9IGN1cnJlbnRMZXZlbC5hdWRpb0NvZGVjIHx8IHRoaXMuY29uZmlnLmRlZmF1bHRBdWRpb0NvZGVjO1xuICAgICAgICBpZih0aGlzLmF1ZGlvQ29kZWNTd2FwKSB7XG4gICAgICAgICAgbG9nZ2VyLmxvZygnc3dhcHBpbmcgcGxheWxpc3QgYXVkaW8gY29kZWMnKTtcbiAgICAgICAgICBpZihhdWRpb0NvZGVjID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSB0aGlzLmxhc3RBdWRpb0NvZGVjO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZihhdWRpb0NvZGVjKSB7XG4gICAgICAgICAgICBpZihhdWRpb0NvZGVjLmluZGV4T2YoJ21wNGEuNDAuNScpICE9PS0xKSB7XG4gICAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC4yJztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5wZW5kaW5nQXBwZW5kaW5nID0gMDtcbiAgICAgICAgbG9nZ2VyLmxvZyhgRGVtdXhpbmcgJHtzbn0gb2YgWyR7ZGV0YWlscy5zdGFydFNOfSAsJHtkZXRhaWxzLmVuZFNOfV0sbGV2ZWwgJHtsZXZlbH1gKTtcbiAgICAgICAgdGhpcy5kZW11eGVyLnB1c2goZGF0YS5wYXlsb2FkLCBhdWRpb0NvZGVjLCBjdXJyZW50TGV2ZWwudmlkZW9Db2RlYywgc3RhcnQsIGZyYWdDdXJyZW50LmNjLCBsZXZlbCwgc24sIGR1cmF0aW9uLCBmcmFnQ3VycmVudC5kZWNyeXB0ZGF0YSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuZnJhZ0xvYWRFcnJvciA9IDA7XG4gIH1cblxuICBvbkZyYWdQYXJzaW5nSW5pdFNlZ21lbnQoZGF0YSkge1xuICAgIGlmICh0aGlzLnN0YXRlID09PSBTdGF0ZS5QQVJTSU5HKSB7XG4gICAgICB2YXIgdHJhY2tzID0gZGF0YS50cmFja3MsIHRyYWNrTmFtZSwgdHJhY2s7XG5cbiAgICAgIC8vIGluY2x1ZGUgbGV2ZWxDb2RlYyBpbiBhdWRpbyBhbmQgdmlkZW8gdHJhY2tzXG4gICAgICB0cmFjayA9IHRyYWNrcy5hdWRpbztcbiAgICAgIGlmKHRyYWNrKSB7XG4gICAgICAgIHZhciBhdWRpb0NvZGVjID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0uYXVkaW9Db2RlYyxcbiAgICAgICAgICAgIHVhID0gbmF2aWdhdG9yLnVzZXJBZ2VudC50b0xvd2VyQ2FzZSgpO1xuICAgICAgICBpZihhdWRpb0NvZGVjICYmIHRoaXMuYXVkaW9Db2RlY1N3YXApIHtcbiAgICAgICAgICBsb2dnZXIubG9nKCdzd2FwcGluZyBwbGF5bGlzdCBhdWRpbyBjb2RlYycpO1xuICAgICAgICAgIGlmKGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC41JykgIT09LTEpIHtcbiAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC4yJztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXVkaW9Db2RlYyA9ICdtcDRhLjQwLjUnO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyBpbiBjYXNlIEFBQyBhbmQgSEUtQUFDIGF1ZGlvIGNvZGVjcyBhcmUgc2lnbmFsbGVkIGluIG1hbmlmZXN0XG4gICAgICAgIC8vIGZvcmNlIEhFLUFBQyAsIGFzIGl0IHNlZW1zIHRoYXQgbW9zdCBicm93c2VycyBwcmVmZXJzIHRoYXQgd2F5LFxuICAgICAgICAvLyBleGNlcHQgZm9yIG1vbm8gc3RyZWFtcyBPUiBvbiBGRlxuICAgICAgICAvLyB0aGVzZSBjb25kaXRpb25zIG1pZ2h0IG5lZWQgdG8gYmUgcmV2aWV3ZWQgLi4uXG4gICAgICAgIGlmICh0aGlzLmF1ZGlvQ29kZWNTd2l0Y2gpIHtcbiAgICAgICAgICAgIC8vIGRvbid0IGZvcmNlIEhFLUFBQyBpZiBtb25vIHN0cmVhbVxuICAgICAgICAgICBpZih0cmFjay5tZXRhZGF0YS5jaGFubmVsQ291bnQgIT09IDEgJiZcbiAgICAgICAgICAgIC8vIGRvbid0IGZvcmNlIEhFLUFBQyBpZiBmaXJlZm94XG4gICAgICAgICAgICB1YS5pbmRleE9mKCdmaXJlZm94JykgPT09IC0xKSB7XG4gICAgICAgICAgICAgIGF1ZGlvQ29kZWMgPSAnbXA0YS40MC41JztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gSEUtQUFDIGlzIGJyb2tlbiBvbiBBbmRyb2lkLCBhbHdheXMgc2lnbmFsIGF1ZGlvIGNvZGVjIGFzIEFBQyBldmVuIGlmIHZhcmlhbnQgbWFuaWZlc3Qgc3RhdGVzIG90aGVyd2lzZVxuICAgICAgICBpZih1YS5pbmRleE9mKCdhbmRyb2lkJykgIT09IC0xKSB7XG4gICAgICAgICAgYXVkaW9Db2RlYyA9ICdtcDRhLjQwLjInO1xuICAgICAgICAgIGxvZ2dlci5sb2coYEFuZHJvaWQ6IGZvcmNlIGF1ZGlvIGNvZGVjIHRvYCArIGF1ZGlvQ29kZWMpO1xuICAgICAgICB9XG4gICAgICAgIHRyYWNrLmxldmVsQ29kZWMgPSBhdWRpb0NvZGVjO1xuICAgICAgfVxuICAgICAgdHJhY2sgPSB0cmFja3MudmlkZW87XG4gICAgICBpZih0cmFjaykge1xuICAgICAgICB0cmFjay5sZXZlbENvZGVjID0gdGhpcy5sZXZlbHNbdGhpcy5sZXZlbF0udmlkZW9Db2RlYztcbiAgICAgIH1cblxuICAgICAgLy8gaWYgcmVtdXhlciBzcGVjaWZ5IHRoYXQgYSB1bmlxdWUgdHJhY2sgbmVlZHMgdG8gZ2VuZXJhdGVkLFxuICAgICAgLy8gbGV0J3MgbWVyZ2UgYWxsIHRyYWNrcyB0b2dldGhlclxuICAgICAgaWYgKGRhdGEudW5pcXVlKSB7XG4gICAgICAgIHZhciBtZXJnZWRUcmFjayA9IHtcbiAgICAgICAgICAgIGNvZGVjIDogJycsXG4gICAgICAgICAgICBsZXZlbENvZGVjIDogJydcbiAgICAgICAgICB9O1xuICAgICAgICBmb3IgKHRyYWNrTmFtZSBpbiBkYXRhLnRyYWNrcykge1xuICAgICAgICAgIHRyYWNrID0gdHJhY2tzW3RyYWNrTmFtZV07XG4gICAgICAgICAgbWVyZ2VkVHJhY2suY29udGFpbmVyID0gdHJhY2suY29udGFpbmVyO1xuICAgICAgICAgIGlmIChtZXJnZWRUcmFjay5jb2RlYykge1xuICAgICAgICAgICAgbWVyZ2VkVHJhY2suY29kZWMgKz0gICcsJztcbiAgICAgICAgICAgIG1lcmdlZFRyYWNrLmxldmVsQ29kZWMgKz0gICcsJztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYodHJhY2suY29kZWMpIHtcbiAgICAgICAgICAgIG1lcmdlZFRyYWNrLmNvZGVjICs9ICB0cmFjay5jb2RlYztcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHRyYWNrLmxldmVsQ29kZWMpIHtcbiAgICAgICAgICAgIG1lcmdlZFRyYWNrLmxldmVsQ29kZWMgKz0gIHRyYWNrLmxldmVsQ29kZWM7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHRyYWNrcyA9IHsgYXVkaW92aWRlbyA6IG1lcmdlZFRyYWNrIH07XG4gICAgICB9XG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9DT0RFQ1MsdHJhY2tzKTtcbiAgICAgIC8vIGxvb3AgdGhyb3VnaCB0cmFja3MgdGhhdCBhcmUgZ29pbmcgdG8gYmUgcHJvdmlkZWQgdG8gYnVmZmVyQ29udHJvbGxlclxuICAgICAgZm9yICh0cmFja05hbWUgaW4gdHJhY2tzKSB7XG4gICAgICAgIHRyYWNrID0gdHJhY2tzW3RyYWNrTmFtZV07XG4gICAgICAgIGxvZ2dlci5sb2coYHRyYWNrOiR7dHJhY2tOYW1lfSxjb250YWluZXI6JHt0cmFjay5jb250YWluZXJ9LGNvZGVjc1tsZXZlbC9wYXJzZWRdPVske3RyYWNrLmxldmVsQ29kZWN9LyR7dHJhY2suY29kZWN9XWApO1xuICAgICAgICB2YXIgaW5pdFNlZ21lbnQgPSB0cmFjay5pbml0U2VnbWVudDtcbiAgICAgICAgaWYgKGluaXRTZWdtZW50KSB7XG4gICAgICAgICAgdGhpcy5wZW5kaW5nQXBwZW5kaW5nKys7XG4gICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5CVUZGRVJfQVBQRU5ESU5HLCB7dHlwZTogdHJhY2tOYW1lLCBkYXRhOiBpbml0U2VnbWVudH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICAgIHRoaXMudGljaygpO1xuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ1BhcnNpbmdEYXRhKGRhdGEpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuUEFSU0lORykge1xuICAgICAgdGhpcy50cGFyc2UyID0gRGF0ZS5ub3coKTtcbiAgICAgIHZhciBsZXZlbCA9IHRoaXMubGV2ZWxzW3RoaXMubGV2ZWxdLFxuICAgICAgICAgIGZyYWcgPSB0aGlzLmZyYWdDdXJyZW50O1xuXG4gICAgICBsb2dnZXIubG9nKGBwYXJzZWQgJHtkYXRhLnR5cGV9LFBUUzpbJHtkYXRhLnN0YXJ0UFRTLnRvRml4ZWQoMyl9LCR7ZGF0YS5lbmRQVFMudG9GaXhlZCgzKX1dLERUUzpbJHtkYXRhLnN0YXJ0RFRTLnRvRml4ZWQoMyl9LyR7ZGF0YS5lbmREVFMudG9GaXhlZCgzKX1dLG5iOiR7ZGF0YS5uYn1gKTtcblxuICAgICAgdmFyIGRyaWZ0ID0gTGV2ZWxIZWxwZXIudXBkYXRlRnJhZ1BUUyhsZXZlbC5kZXRhaWxzLGZyYWcuc24sZGF0YS5zdGFydFBUUyxkYXRhLmVuZFBUUyksXG4gICAgICAgICAgaGxzID0gdGhpcy5obHM7XG4gICAgICBobHMudHJpZ2dlcihFdmVudC5MRVZFTF9QVFNfVVBEQVRFRCwge2RldGFpbHM6IGxldmVsLmRldGFpbHMsIGxldmVsOiB0aGlzLmxldmVsLCBkcmlmdDogZHJpZnR9KTtcblxuICAgICAgW2RhdGEuZGF0YTEsIGRhdGEuZGF0YTJdLmZvckVhY2goYnVmZmVyID0+IHtcbiAgICAgICAgaWYgKGJ1ZmZlcikge1xuICAgICAgICAgIHRoaXMucGVuZGluZ0FwcGVuZGluZysrO1xuICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkJVRkZFUl9BUFBFTkRJTkcsIHt0eXBlOiBkYXRhLnR5cGUsIGRhdGE6IGJ1ZmZlcn0pO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgdGhpcy5uZXh0TG9hZFBvc2l0aW9uID0gZGF0YS5lbmRQVFM7XG4gICAgICB0aGlzLmJ1ZmZlclJhbmdlLnB1c2goe3R5cGU6IGRhdGEudHlwZSwgc3RhcnQ6IGRhdGEuc3RhcnRQVFMsIGVuZDogZGF0YS5lbmRQVFMsIGZyYWc6IGZyYWd9KTtcblxuICAgICAgLy90cmlnZ2VyIGhhbmRsZXIgcmlnaHQgbm93XG4gICAgICB0aGlzLnRpY2soKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nZ2VyLndhcm4oYG5vdCBpbiBQQVJTSU5HIHN0YXRlIGJ1dCAke3RoaXMuc3RhdGV9LCBpZ25vcmluZyBGUkFHX1BBUlNJTkdfREFUQSBldmVudGApO1xuICAgIH1cbiAgfVxuXG4gIG9uRnJhZ1BhcnNlZCgpIHtcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuUEFSU0lORykge1xuICAgICAgdGhpcy5zdGF0cy50cGFyc2VkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICB0aGlzLnN0YXRlID0gU3RhdGUuUEFSU0VEO1xuICAgICAgdGhpcy5fY2hlY2tBcHBlbmRlZFBhcnNlZCgpO1xuICAgIH1cbiAgfVxuXG4gIG9uQnVmZmVyQXBwZW5kZWQoKSB7XG4gICAgc3dpdGNoICh0aGlzLnN0YXRlKSB7XG4gICAgICBjYXNlIFN0YXRlLlBBUlNJTkc6XG4gICAgICBjYXNlIFN0YXRlLlBBUlNFRDpcbiAgICAgICAgdGhpcy5wZW5kaW5nQXBwZW5kaW5nLS07XG4gICAgICAgIHRoaXMuX2NoZWNrQXBwZW5kZWRQYXJzZWQoKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBkZWZhdWx0OlxuICAgICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICBfY2hlY2tBcHBlbmRlZFBhcnNlZCgpIHtcbiAgICAvL3RyaWdnZXIgaGFuZGxlciByaWdodCBub3dcbiAgICBpZiAodGhpcy5zdGF0ZSA9PT0gU3RhdGUuUEFSU0VEICYmIHRoaXMucGVuZGluZ0FwcGVuZGluZyA9PT0gMCkgIHtcbiAgICAgIHZhciBmcmFnID0gdGhpcy5mcmFnQ3VycmVudCwgc3RhdHMgPSB0aGlzLnN0YXRzO1xuICAgICAgaWYgKGZyYWcpIHtcbiAgICAgICAgdGhpcy5mcmFnUHJldmlvdXMgPSBmcmFnO1xuICAgICAgICBzdGF0cy50YnVmZmVyZWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgdGhpcy5mcmFnTGFzdEticHMgPSBNYXRoLnJvdW5kKDggKiBzdGF0cy5sZW5ndGggLyAoc3RhdHMudGJ1ZmZlcmVkIC0gc3RhdHMudGZpcnN0KSk7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19CVUZGRVJFRCwge3N0YXRzOiBzdGF0cywgZnJhZzogZnJhZ30pO1xuICAgICAgICBsb2dnZXIubG9nKGBtZWRpYSBidWZmZXJlZCA6ICR7dGhpcy50aW1lUmFuZ2VzVG9TdHJpbmcodGhpcy5tZWRpYS5idWZmZXJlZCl9YCk7XG4gICAgICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgICAgfVxuICAgICAgdGhpcy50aWNrKCk7XG4gICAgfVxuICB9XG5cbiAgb25FcnJvcihkYXRhKSB7XG4gICAgc3dpdGNoKGRhdGEuZGV0YWlscykge1xuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQ6XG4gICAgICAgIGlmKCFkYXRhLmZhdGFsKSB7XG4gICAgICAgICAgdmFyIGxvYWRFcnJvciA9IHRoaXMuZnJhZ0xvYWRFcnJvcjtcbiAgICAgICAgICBpZihsb2FkRXJyb3IpIHtcbiAgICAgICAgICAgIGxvYWRFcnJvcisrO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2FkRXJyb3I9MTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKGxvYWRFcnJvciA8PSB0aGlzLmNvbmZpZy5mcmFnTG9hZGluZ01heFJldHJ5KSB7XG4gICAgICAgICAgICB0aGlzLmZyYWdMb2FkRXJyb3IgPSBsb2FkRXJyb3I7XG4gICAgICAgICAgICAvLyByZXNldCBsb2FkIGNvdW50ZXIgdG8gYXZvaWQgZnJhZyBsb29wIGxvYWRpbmcgZXJyb3JcbiAgICAgICAgICAgIGRhdGEuZnJhZy5sb2FkQ291bnRlciA9IDA7XG4gICAgICAgICAgICAvLyBleHBvbmVudGlhbCBiYWNrb2ZmIGNhcHBlZCB0byA2NHNcbiAgICAgICAgICAgIHZhciBkZWxheSA9IE1hdGgubWluKE1hdGgucG93KDIsbG9hZEVycm9yLTEpKnRoaXMuY29uZmlnLmZyYWdMb2FkaW5nUmV0cnlEZWxheSw2NDAwMCk7XG4gICAgICAgICAgICBsb2dnZXIud2FybihgbWVkaWFDb250cm9sbGVyOiBmcmFnIGxvYWRpbmcgZmFpbGVkLCByZXRyeSBpbiAke2RlbGF5fSBtc2ApO1xuICAgICAgICAgICAgdGhpcy5yZXRyeURhdGUgPSBwZXJmb3JtYW5jZS5ub3coKSArIGRlbGF5O1xuICAgICAgICAgICAgLy8gcmV0cnkgbG9hZGluZyBzdGF0ZVxuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkZSQUdfTE9BRElOR19XQUlUSU5HX1JFVFJZO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsb2dnZXIuZXJyb3IoYG1lZGlhQ29udHJvbGxlcjogJHtkYXRhLmRldGFpbHN9IHJlYWNoZXMgbWF4IHJldHJ5LCByZWRpc3BhdGNoIGFzIGZhdGFsIC4uLmApO1xuICAgICAgICAgICAgLy8gcmVkaXNwYXRjaCBzYW1lIGVycm9yIGJ1dCB3aXRoIGZhdGFsIHNldCB0byB0cnVlXG4gICAgICAgICAgICBkYXRhLmZhdGFsID0gdHJ1ZTtcbiAgICAgICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIGRhdGEpO1xuICAgICAgICAgICAgdGhpcy5zdGF0ZSA9IFN0YXRlLkVSUk9SO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9FUlJPUjpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfVElNRU9VVDpcbiAgICAgIGNhc2UgRXJyb3JEZXRhaWxzLktFWV9MT0FEX0VSUk9SOlxuICAgICAgY2FzZSBFcnJvckRldGFpbHMuS0VZX0xPQURfVElNRU9VVDpcbiAgICAgICAgLy8gaWYgZmF0YWwgZXJyb3IsIHN0b3AgcHJvY2Vzc2luZywgb3RoZXJ3aXNlIG1vdmUgdG8gSURMRSB0byByZXRyeSBsb2FkaW5nXG4gICAgICAgIGxvZ2dlci53YXJuKGBtZWRpYUNvbnRyb2xsZXI6ICR7ZGF0YS5kZXRhaWxzfSB3aGlsZSBsb2FkaW5nIGZyYWcsc3dpdGNoIHRvICR7ZGF0YS5mYXRhbCA/ICdFUlJPUicgOiAnSURMRSd9IHN0YXRlIC4uLmApO1xuICAgICAgICB0aGlzLnN0YXRlID0gZGF0YS5mYXRhbCA/IFN0YXRlLkVSUk9SIDogU3RhdGUuSURMRTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlIEVycm9yRGV0YWlscy5CVUZGRVJfRlVMTF9FUlJPUjpcbiAgICAgICAgLy8gdHJpZ2dlciBhIHNtb290aCBsZXZlbCBzd2l0Y2ggdG8gZW1wdHkgYnVmZmVyc1xuICAgICAgICAvLyBhbHNvIHJlZHVjZSBtYXggYnVmZmVyIGxlbmd0aCBhcyBpdCBtaWdodCBiZSB0b28gaGlnaC4gd2UgZG8gdGhpcyB0byBhdm9pZCBsb29wIGZsdXNoaW5nIC4uLlxuICAgICAgICB0aGlzLmNvbmZpZy5tYXhNYXhCdWZmZXJMZW5ndGgvPTI7XG4gICAgICAgIGxvZ2dlci53YXJuKGByZWR1Y2UgbWF4IGJ1ZmZlciBsZW5ndGggdG8gJHt0aGlzLmNvbmZpZy5tYXhNYXhCdWZmZXJMZW5ndGh9cyBhbmQgdHJpZ2dlciBhIG5leHRMZXZlbFN3aXRjaCB0byBmbHVzaCBvbGQgYnVmZmVyIGFuZCBmaXggUXVvdGFFeGNlZWRlZEVycm9yYCk7XG4gICAgICAgIHRoaXMubmV4dExldmVsU3dpdGNoKCk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbl9jaGVja0J1ZmZlcigpIHtcbiAgICB2YXIgbWVkaWEgPSB0aGlzLm1lZGlhO1xuICAgIGlmKG1lZGlhKSB7XG4gICAgICAvLyBjb21wYXJlIHJlYWR5U3RhdGVcbiAgICAgIHZhciByZWFkeVN0YXRlID0gbWVkaWEucmVhZHlTdGF0ZTtcbiAgICAgIC8vIGlmIHJlYWR5IHN0YXRlIGRpZmZlcmVudCBmcm9tIEhBVkVfTk9USElORyAobnVtZXJpYyB2YWx1ZSAwKSwgd2UgYXJlIGFsbG93ZWQgdG8gc2Vla1xuICAgICAgaWYocmVhZHlTdGF0ZSkge1xuICAgICAgICB2YXIgdGFyZ2V0U2Vla1Bvc2l0aW9uLCBjdXJyZW50VGltZTtcbiAgICAgICAgLy8gaWYgc2VlayBhZnRlciBidWZmZXJlZCBkZWZpbmVkLCBsZXQncyBzZWVrIGlmIHdpdGhpbiBhY2NlcHRhYmxlIHJhbmdlXG4gICAgICAgIHZhciBzZWVrQWZ0ZXJCdWZmZXJlZCA9IHRoaXMuc2Vla0FmdGVyQnVmZmVyZWQ7XG4gICAgICAgIGlmKHNlZWtBZnRlckJ1ZmZlcmVkKSB7XG4gICAgICAgICAgaWYobWVkaWEuZHVyYXRpb24gPj0gc2Vla0FmdGVyQnVmZmVyZWQpIHtcbiAgICAgICAgICAgIHRhcmdldFNlZWtQb3NpdGlvbiA9IHNlZWtBZnRlckJ1ZmZlcmVkO1xuICAgICAgICAgICAgdGhpcy5zZWVrQWZ0ZXJCdWZmZXJlZCA9IHVuZGVmaW5lZDtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY3VycmVudFRpbWUgPSBtZWRpYS5jdXJyZW50VGltZTtcbiAgICAgICAgICB2YXIgbG9hZGVkbWV0YWRhdGEgPSB0aGlzLmxvYWRlZG1ldGFkYXRhO1xuXG4gICAgICAgICAgLy8gYWRqdXN0IGN1cnJlbnRUaW1lIHRvIHN0YXJ0IHBvc2l0aW9uIG9uIGxvYWRlZCBtZXRhZGF0YVxuICAgICAgICAgIGlmKCFsb2FkZWRtZXRhZGF0YSAmJiBtZWRpYS5idWZmZXJlZC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHRoaXMubG9hZGVkbWV0YWRhdGEgPSB0cnVlO1xuICAgICAgICAgICAgLy8gb25seSBhZGp1c3QgY3VycmVudFRpbWUgaWYgbm90IGVxdWFsIHRvIDBcbiAgICAgICAgICAgIGlmICghY3VycmVudFRpbWUgJiYgY3VycmVudFRpbWUgIT09IHRoaXMuc3RhcnRQb3NpdGlvbikge1xuICAgICAgICAgICAgICB0YXJnZXRTZWVrUG9zaXRpb24gPSB0aGlzLnN0YXJ0UG9zaXRpb247XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh0YXJnZXRTZWVrUG9zaXRpb24pIHtcbiAgICAgICAgICBjdXJyZW50VGltZSA9IHRhcmdldFNlZWtQb3NpdGlvbjtcbiAgICAgICAgICBsb2dnZXIubG9nKGB0YXJnZXQgc2VlayBwb3NpdGlvbjoke3RhcmdldFNlZWtQb3NpdGlvbn1gKTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgYnVmZmVySW5mbyA9IEJ1ZmZlckhlbHBlci5idWZmZXJJbmZvKG1lZGlhLGN1cnJlbnRUaW1lLDApLFxuICAgICAgICAgICAgZXhwZWN0ZWRQbGF5aW5nID0gIShtZWRpYS5wYXVzZWQgfHwgbWVkaWEuZW5kZWQgfHwgbWVkaWEuc2Vla2luZyB8fCByZWFkeVN0YXRlIDwgMiksXG4gICAgICAgICAgICBqdW1wVGhyZXNob2xkID0gMC40LCAvLyB0b2xlcmFuY2UgbmVlZGVkIGFzIHNvbWUgYnJvd3NlcnMgc3RhbGxzIHBsYXliYWNrIGJlZm9yZSByZWFjaGluZyBidWZmZXJlZCByYW5nZSBlbmRcbiAgICAgICAgICAgIHBsYXloZWFkTW92aW5nID0gY3VycmVudFRpbWUgPiBtZWRpYS5wbGF5YmFja1JhdGUqdGhpcy5sYXN0Q3VycmVudFRpbWU7XG5cbiAgICAgICAgaWYgKHRoaXMuc3RhbGxlZCAmJiBwbGF5aGVhZE1vdmluZykge1xuICAgICAgICAgIHRoaXMuc3RhbGxlZCA9IGZhbHNlO1xuICAgICAgICAgIGxvZ2dlci5sb2coYHBsYXliYWNrIG5vdCBzdHVjayBhbnltb3JlIEAke2N1cnJlbnRUaW1lfWApO1xuICAgICAgICB9XG4gICAgICAgIC8vIGNoZWNrIGJ1ZmZlciB1cGZyb250XG4gICAgICAgIC8vIGlmIGxlc3MgdGhhbiAyMDBtcyBpcyBidWZmZXJlZCwgYW5kIG1lZGlhIGlzIGV4cGVjdGVkIHRvIHBsYXkgYnV0IHBsYXloZWFkIGlzIG5vdCBtb3ZpbmcsXG4gICAgICAgIC8vIGFuZCB3ZSBoYXZlIGEgbmV3IGJ1ZmZlciByYW5nZSBhdmFpbGFibGUgdXBmcm9udCwgbGV0J3Mgc2VlayB0byB0aGF0IG9uZVxuICAgICAgICBpZihidWZmZXJJbmZvLmxlbiA8PSBqdW1wVGhyZXNob2xkKSB7XG4gICAgICAgICAgaWYocGxheWhlYWRNb3ZpbmcgfHwgIWV4cGVjdGVkUGxheWluZykge1xuICAgICAgICAgICAgLy8gcGxheWhlYWQgbW92aW5nIG9yIG1lZGlhIG5vdCBwbGF5aW5nXG4gICAgICAgICAgICBqdW1wVGhyZXNob2xkID0gMDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gcGxheWhlYWQgbm90IG1vdmluZyBBTkQgbWVkaWEgZXhwZWN0ZWQgdG8gcGxheVxuICAgICAgICAgICAgaWYoIXRoaXMuc3RhbGxlZCkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBwbGF5YmFjayBzZWVtcyBzdHVjayBAJHtjdXJyZW50VGltZX1gKTtcbiAgICAgICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5CVUZGRVJfU1RBTExFRF9FUlJPUiwgZmF0YWw6IGZhbHNlfSk7XG4gICAgICAgICAgICAgIHRoaXMuc3RhbGxlZCA9IHRydWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vIGlmIHdlIGFyZSBiZWxvdyB0aHJlc2hvbGQsIHRyeSB0byBqdW1wIGlmIG5leHQgYnVmZmVyIHJhbmdlIGlzIGNsb3NlXG4gICAgICAgICAgaWYoYnVmZmVySW5mby5sZW4gPD0ganVtcFRocmVzaG9sZCkge1xuICAgICAgICAgICAgLy8gbm8gYnVmZmVyIGF2YWlsYWJsZSBAIGN1cnJlbnRUaW1lLCBjaGVjayBpZiBuZXh0IGJ1ZmZlciBpcyBjbG9zZSAod2l0aGluIGEgY29uZmlnLm1heFNlZWtIb2xlIHNlY29uZCByYW5nZSlcbiAgICAgICAgICAgIHZhciBuZXh0QnVmZmVyU3RhcnQgPSBidWZmZXJJbmZvLm5leHRTdGFydCwgZGVsdGEgPSBuZXh0QnVmZmVyU3RhcnQtY3VycmVudFRpbWU7XG4gICAgICAgICAgICBpZihuZXh0QnVmZmVyU3RhcnQgJiZcbiAgICAgICAgICAgICAgIChkZWx0YSA8IHRoaXMuY29uZmlnLm1heFNlZWtIb2xlKSAmJlxuICAgICAgICAgICAgICAgKGRlbHRhID4gMCkgICYmXG4gICAgICAgICAgICAgICAhbWVkaWEuc2Vla2luZykge1xuICAgICAgICAgICAgICAvLyBuZXh0IGJ1ZmZlciBpcyBjbG9zZSAhIGFkanVzdCBjdXJyZW50VGltZSB0byBuZXh0QnVmZmVyU3RhcnRcbiAgICAgICAgICAgICAgLy8gdGhpcyB3aWxsIGVuc3VyZSBlZmZlY3RpdmUgdmlkZW8gZGVjb2RpbmdcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgYWRqdXN0IGN1cnJlbnRUaW1lIGZyb20gJHttZWRpYS5jdXJyZW50VGltZX0gdG8gbmV4dCBidWZmZXJlZCBAICR7bmV4dEJ1ZmZlclN0YXJ0fWApO1xuICAgICAgICAgICAgICBtZWRpYS5jdXJyZW50VGltZSA9IG5leHRCdWZmZXJTdGFydDtcbiAgICAgICAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5CVUZGRVJfU0VFS19PVkVSX0hPTEUsIGZhdGFsOiBmYWxzZX0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAodGFyZ2V0U2Vla1Bvc2l0aW9uICYmIG1lZGlhLmN1cnJlbnRUaW1lICE9PSB0YXJnZXRTZWVrUG9zaXRpb24pIHtcbiAgICAgICAgICAgIGxvZ2dlci5sb2coYGFkanVzdCBjdXJyZW50VGltZSBmcm9tICR7bWVkaWEuY3VycmVudFRpbWV9IHRvICR7dGFyZ2V0U2Vla1Bvc2l0aW9ufWApO1xuICAgICAgICAgICAgbWVkaWEuY3VycmVudFRpbWUgPSB0YXJnZXRTZWVrUG9zaXRpb247XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgb25GcmFnTG9hZEVtZXJnZW5jeUFib3J0ZWQoKSB7XG4gICAgdGhpcy5zdGF0ZSA9IFN0YXRlLklETEU7XG4gICAgdGhpcy50aWNrKCk7XG4gIH1cblxuICBvbkJ1ZmZlckZsdXNoZWQoKSB7XG4gICAgLyogYWZ0ZXIgc3VjY2Vzc2Z1bCBidWZmZXIgZmx1c2hpbmcsIHJlYnVpbGQgYnVmZmVyIFJhbmdlIGFycmF5XG4gICAgICBsb29wIHRocm91Z2ggZXhpc3RpbmcgYnVmZmVyIHJhbmdlIGFuZCBjaGVjayBpZlxuICAgICAgY29ycmVzcG9uZGluZyByYW5nZSBpcyBzdGlsbCBidWZmZXJlZC4gb25seSBwdXNoIHRvIG5ldyBhcnJheSBhbHJlYWR5IGJ1ZmZlcmVkIHJhbmdlXG4gICAgKi9cbiAgICB2YXIgbmV3UmFuZ2UgPSBbXSxyYW5nZSxpO1xuICAgIGZvciAoaSA9IDA7IGkgPCB0aGlzLmJ1ZmZlclJhbmdlLmxlbmd0aDsgaSsrKSB7XG4gICAgICByYW5nZSA9IHRoaXMuYnVmZmVyUmFuZ2VbaV07XG4gICAgICBpZiAodGhpcy5pc0J1ZmZlcmVkKChyYW5nZS5zdGFydCArIHJhbmdlLmVuZCkgLyAyKSkge1xuICAgICAgICBuZXdSYW5nZS5wdXNoKHJhbmdlKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5idWZmZXJSYW5nZSA9IG5ld1JhbmdlO1xuXG4gICAgLy8gaGFuZGxlIGVuZCBvZiBpbW1lZGlhdGUgc3dpdGNoaW5nIGlmIG5lZWRlZFxuICAgIGlmICh0aGlzLmltbWVkaWF0ZVN3aXRjaCkge1xuICAgICAgdGhpcy5pbW1lZGlhdGVMZXZlbFN3aXRjaEVuZCgpO1xuICAgIH1cbiAgICAvLyBtb3ZlIHRvIElETEUgb25jZSBmbHVzaCBjb21wbGV0ZS4gdGhpcyBzaG91bGQgdHJpZ2dlciBuZXcgZnJhZ21lbnQgbG9hZGluZ1xuICAgIHRoaXMuc3RhdGUgPSBTdGF0ZS5JRExFO1xuICAgIC8vIHJlc2V0IHJlZmVyZW5jZSB0byBmcmFnXG4gICAgdGhpcy5mcmFnUHJldmlvdXMgPSBudWxsO1xuICB9XG5cbiAgc3dhcEF1ZGlvQ29kZWMoKSB7XG4gICAgdGhpcy5hdWRpb0NvZGVjU3dhcCA9ICF0aGlzLmF1ZGlvQ29kZWNTd2FwO1xuICB9XG5cbiAgdGltZVJhbmdlc1RvU3RyaW5nKHIpIHtcbiAgICB2YXIgbG9nID0gJycsIGxlbiA9IHIubGVuZ3RoO1xuICAgIGZvciAodmFyIGk9MDsgaTxsZW47IGkrKykge1xuICAgICAgbG9nICs9ICdbJyArIHIuc3RhcnQoaSkgKyAnLCcgKyByLmVuZChpKSArICddJztcbiAgICB9XG4gICAgcmV0dXJuIGxvZztcbiAgfVxufVxuZXhwb3J0IGRlZmF1bHQgU3RyZWFtQ29udHJvbGxlcjtcblxuIiwiLypcbiAqIFRpbWVsaW5lIENvbnRyb2xsZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcbmltcG9ydCBDRUE3MDhJbnRlcnByZXRlciBmcm9tICcuLi91dGlscy9jZWEtNzA4LWludGVycHJldGVyJztcblxuY2xhc3MgVGltZWxpbmVDb250cm9sbGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsIEV2ZW50Lk1FRElBX0FUVEFDSElORyxcbiAgICAgICAgICAgICAgICBFdmVudC5NRURJQV9ERVRBQ0hJTkcsXG4gICAgICAgICAgICAgICAgRXZlbnQuRlJBR19QQVJTSU5HX1VTRVJEQVRBLFxuICAgICAgICAgICAgICAgIEV2ZW50Lk1BTklGRVNUX0xPQURJTkcsXG4gICAgICAgICAgICAgICAgRXZlbnQuRlJBR19MT0FERUQpO1xuXG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy5jb25maWcgPSBobHMuY29uZmlnO1xuXG4gICAgaWYgKHRoaXMuY29uZmlnLmVuYWJsZUNFQTcwOENhcHRpb25zKVxuICAgIHtcbiAgICAgIHRoaXMuY2VhNzA4SW50ZXJwcmV0ZXIgPSBuZXcgQ0VBNzA4SW50ZXJwcmV0ZXIoKTtcbiAgICB9XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIEV2ZW50SGFuZGxlci5wcm90b3R5cGUuZGVzdHJveS5jYWxsKHRoaXMpO1xuICB9XG5cbiAgb25NZWRpYUF0dGFjaGluZyhkYXRhKSB7XG4gICAgdmFyIG1lZGlhID0gdGhpcy5tZWRpYSA9IGRhdGEubWVkaWE7XG4gICAgdGhpcy5jZWE3MDhJbnRlcnByZXRlci5hdHRhY2gobWVkaWEpO1xuICB9XG5cbiAgb25NZWRpYURldGFjaGluZygpIHtcbiAgICB0aGlzLmNlYTcwOEludGVycHJldGVyLmRldGFjaCgpO1xuICB9XG5cbiAgb25NYW5pZmVzdExvYWRpbmcoKVxuICB7XG4gICAgdGhpcy5sYXN0UHRzID0gTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZO1xuICB9XG5cbiAgb25GcmFnTG9hZGVkKGRhdGEpXG4gIHtcbiAgICB2YXIgcHRzID0gZGF0YS5mcmFnLnN0YXJ0OyAvL051bWJlci5QT1NJVElWRV9JTkZJTklUWTtcblxuICAgIC8vIGlmIHRoaXMgaXMgYSBmcmFnIGZvciBhIHByZXZpb3VzbHkgbG9hZGVkIHRpbWVyYW5nZSwgcmVtb3ZlIGFsbCBjYXB0aW9uc1xuICAgIC8vIFRPRE86IGNvbnNpZGVyIGp1c3QgcmVtb3ZpbmcgY2FwdGlvbnMgZm9yIHRoZSB0aW1lcmFuZ2VcbiAgICBpZiAocHRzIDw9IHRoaXMubGFzdFB0cylcbiAgICB7XG4gICAgICB0aGlzLmNlYTcwOEludGVycHJldGVyLmNsZWFyKCk7XG4gICAgfVxuXG4gICAgdGhpcy5sYXN0UHRzID0gcHRzO1xuICB9XG5cbiAgb25GcmFnUGFyc2luZ1VzZXJkYXRhKGRhdGEpIHtcbiAgICAvLyBwdXNoIGFsbCBvZiB0aGUgQ0VBLTcwOCBtZXNzYWdlcyBpbnRvIHRoZSBpbnRlcnByZXRlclxuICAgIC8vIGltbWVkaWF0ZWx5LiBJdCB3aWxsIGNyZWF0ZSB0aGUgcHJvcGVyIHRpbWVzdGFtcHMgYmFzZWQgb24gb3VyIFBUUyB2YWx1ZVxuICAgIGZvciAodmFyIGk9MDsgaTxkYXRhLnNhbXBsZXMubGVuZ3RoOyBpKyspXG4gICAge1xuICAgICAgdGhpcy5jZWE3MDhJbnRlcnByZXRlci5wdXNoKGRhdGEuc2FtcGxlc1tpXS5wdHMsIGRhdGEuc2FtcGxlc1tpXS5ieXRlcyk7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFRpbWVsaW5lQ29udHJvbGxlcjtcbiIsIi8qXG4gKlxuICogVGhpcyBmaWxlIGNvbnRhaW5zIGFuIGFkYXB0YXRpb24gb2YgdGhlIEFFUyBkZWNyeXB0aW9uIGFsZ29yaXRobVxuICogZnJvbSB0aGUgU3RhbmRmb3JkIEphdmFzY3JpcHQgQ3J5cHRvZ3JhcGh5IExpYnJhcnkuIFRoYXQgd29yayBpc1xuICogY292ZXJlZCBieSB0aGUgZm9sbG93aW5nIGNvcHlyaWdodCBhbmQgcGVybWlzc2lvbnMgbm90aWNlOlxuICpcbiAqIENvcHlyaWdodCAyMDA5LTIwMTAgRW1pbHkgU3RhcmssIE1pa2UgSGFtYnVyZywgRGFuIEJvbmVoLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXRcbiAqIG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmVcbiAqIG1ldDpcbiAqXG4gKiAxLiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodFxuICogICAgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuICpcbiAqIDIuIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmVcbiAqICAgIGNvcHlyaWdodCBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nXG4gKiAgICBkaXNjbGFpbWVyIGluIHRoZSBkb2N1bWVudGF0aW9uIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWRcbiAqICAgIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cbiAqXG4gKiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEIEJZIFRIRSBBVVRIT1JTIGBgQVMgSVMnJyBBTkQgQU5ZIEVYUFJFU1MgT1JcbiAqIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEXG4gKiBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkQgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFXG4gKiBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCA8Q09QWVJJR0hUIEhPTERFUj4gT1IgQ09OVFJJQlVUT1JTIEJFXG4gKiBMSUFCTEUgRk9SIEFOWSBESVJFQ1QsIElORElSRUNULCBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SXG4gKiBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRlxuICogU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsIE9SIFBST0ZJVFM7IE9SXG4gKiBCVVNJTkVTUyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTiBBTlkgVEhFT1JZIE9GIExJQUJJTElUWSxcbiAqIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElORyBORUdMSUdFTkNFXG4gKiBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTIFNPRlRXQVJFLCBFVkVOXG4gKiBJRiBBRFZJU0VEIE9GIFRIRSBQT1NTSUJJTElUWSBPRiBTVUNIIERBTUFHRS5cbiAqXG4gKiBUaGUgdmlld3MgYW5kIGNvbmNsdXNpb25zIGNvbnRhaW5lZCBpbiB0aGUgc29mdHdhcmUgYW5kIGRvY3VtZW50YXRpb25cbiAqIGFyZSB0aG9zZSBvZiB0aGUgYXV0aG9ycyBhbmQgc2hvdWxkIG5vdCBiZSBpbnRlcnByZXRlZCBhcyByZXByZXNlbnRpbmdcbiAqIG9mZmljaWFsIHBvbGljaWVzLCBlaXRoZXIgZXhwcmVzc2VkIG9yIGltcGxpZWQsIG9mIHRoZSBhdXRob3JzLlxuICovXG5jbGFzcyBBRVMge1xuXG4gIC8qKlxuICAgKiBTY2hlZHVsZSBvdXQgYW4gQUVTIGtleSBmb3IgYm90aCBlbmNyeXB0aW9uIGFuZCBkZWNyeXB0aW9uLiBUaGlzXG4gICAqIGlzIGEgbG93LWxldmVsIGNsYXNzLiBVc2UgYSBjaXBoZXIgbW9kZSB0byBkbyBidWxrIGVuY3J5cHRpb24uXG4gICAqXG4gICAqIEBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0ga2V5IHtBcnJheX0gVGhlIGtleSBhcyBhbiBhcnJheSBvZiA0LCA2IG9yIDggd29yZHMuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihrZXkpIHtcbiAgICAvKipcbiAgICAgKiBUaGUgZXhwYW5kZWQgUy1ib3ggYW5kIGludmVyc2UgUy1ib3ggdGFibGVzLiBUaGVzZSB3aWxsIGJlIGNvbXB1dGVkXG4gICAgICogb24gdGhlIGNsaWVudCBzbyB0aGF0IHdlIGRvbid0IGhhdmUgdG8gc2VuZCB0aGVtIGRvd24gdGhlIHdpcmUuXG4gICAgICpcbiAgICAgKiBUaGVyZSBhcmUgdHdvIHRhYmxlcywgX3RhYmxlc1swXSBpcyBmb3IgZW5jcnlwdGlvbiBhbmRcbiAgICAgKiBfdGFibGVzWzFdIGlzIGZvciBkZWNyeXB0aW9uLlxuICAgICAqXG4gICAgICogVGhlIGZpcnN0IDQgc3ViLXRhYmxlcyBhcmUgdGhlIGV4cGFuZGVkIFMtYm94IHdpdGggTWl4Q29sdW1ucy4gVGhlXG4gICAgICogbGFzdCAoX3RhYmxlc1swMV1bNF0pIGlzIHRoZSBTLWJveCBpdHNlbGYuXG4gICAgICpcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIHRoaXMuX3RhYmxlcyA9IFtbW10sW10sW10sW10sW11dLFtbXSxbXSxbXSxbXSxbXV1dO1xuXG4gICAgdGhpcy5fcHJlY29tcHV0ZSgpO1xuXG4gICAgdmFyIGksIGosIHRtcCxcbiAgICBlbmNLZXksIGRlY0tleSxcbiAgICBzYm94ID0gdGhpcy5fdGFibGVzWzBdWzRdLCBkZWNUYWJsZSA9IHRoaXMuX3RhYmxlc1sxXSxcbiAgICBrZXlMZW4gPSBrZXkubGVuZ3RoLCByY29uID0gMTtcblxuICAgIGlmIChrZXlMZW4gIT09IDQgJiYga2V5TGVuICE9PSA2ICYmIGtleUxlbiAhPT0gOCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGFlcyBrZXkgc2l6ZT0nICsga2V5TGVuKTtcbiAgICB9XG5cbiAgICBlbmNLZXkgPSBrZXkuc2xpY2UoMCk7XG4gICAgZGVjS2V5ID0gW107XG4gICAgdGhpcy5fa2V5ID0gW2VuY0tleSwgZGVjS2V5XTtcblxuICAgIC8vIHNjaGVkdWxlIGVuY3J5cHRpb24ga2V5c1xuICAgIGZvciAoaSA9IGtleUxlbjsgaSA8IDQgKiBrZXlMZW4gKyAyODsgaSsrKSB7XG4gICAgICB0bXAgPSBlbmNLZXlbaS0xXTtcblxuICAgICAgLy8gYXBwbHkgc2JveFxuICAgICAgaWYgKGkla2V5TGVuID09PSAwIHx8IChrZXlMZW4gPT09IDggJiYgaSVrZXlMZW4gPT09IDQpKSB7XG4gICAgICAgIHRtcCA9IHNib3hbdG1wPj4+MjRdPDwyNCBeIHNib3hbdG1wPj4xNiYyNTVdPDwxNiBeIHNib3hbdG1wPj44JjI1NV08PDggXiBzYm94W3RtcCYyNTVdO1xuXG4gICAgICAgIC8vIHNoaWZ0IHJvd3MgYW5kIGFkZCByY29uXG4gICAgICAgIGlmIChpJWtleUxlbiA9PT0gMCkge1xuICAgICAgICAgIHRtcCA9IHRtcDw8OCBeIHRtcD4+PjI0IF4gcmNvbjw8MjQ7XG4gICAgICAgICAgcmNvbiA9IHJjb248PDEgXiAocmNvbj4+NykqMjgzO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGVuY0tleVtpXSA9IGVuY0tleVtpLWtleUxlbl0gXiB0bXA7XG4gICAgfVxuXG4gICAgLy8gc2NoZWR1bGUgZGVjcnlwdGlvbiBrZXlzXG4gICAgZm9yIChqID0gMDsgaTsgaisrLCBpLS0pIHtcbiAgICAgIHRtcCA9IGVuY0tleVtqJjMgPyBpIDogaSAtIDRdO1xuICAgICAgaWYgKGk8PTQgfHwgajw0KSB7XG4gICAgICAgIGRlY0tleVtqXSA9IHRtcDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGRlY0tleVtqXSA9IGRlY1RhYmxlWzBdW3Nib3hbdG1wPj4+MjQgICAgICBdXSBeXG4gICAgICAgICAgZGVjVGFibGVbMV1bc2JveFt0bXA+PjE2ICAmIDI1NV1dIF5cbiAgICAgICAgICBkZWNUYWJsZVsyXVtzYm94W3RtcD4+OCAgICYgMjU1XV0gXlxuICAgICAgICAgIGRlY1RhYmxlWzNdW3Nib3hbdG1wICAgICAgJiAyNTVdXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRXhwYW5kIHRoZSBTLWJveCB0YWJsZXMuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcHJlY29tcHV0ZSgpIHtcbiAgICB2YXIgZW5jVGFibGUgPSB0aGlzLl90YWJsZXNbMF0sIGRlY1RhYmxlID0gdGhpcy5fdGFibGVzWzFdLFxuICAgIHNib3ggPSBlbmNUYWJsZVs0XSwgc2JveEludiA9IGRlY1RhYmxlWzRdLFxuICAgIGksIHgsIHhJbnYsIGQ9W10sIHRoPVtdLCB4MiwgeDQsIHg4LCBzLCB0RW5jLCB0RGVjO1xuXG4gICAgLy8gQ29tcHV0ZSBkb3VibGUgYW5kIHRoaXJkIHRhYmxlc1xuICAgIGZvciAoaSA9IDA7IGkgPCAyNTY7IGkrKykge1xuICAgICAgdGhbKCBkW2ldID0gaTw8MSBeIChpPj43KSoyODMgKV5pXT1pO1xuICAgIH1cblxuICAgIGZvciAoeCA9IHhJbnYgPSAwOyAhc2JveFt4XTsgeCBePSB4MiB8fCAxLCB4SW52ID0gdGhbeEludl0gfHwgMSkge1xuICAgICAgLy8gQ29tcHV0ZSBzYm94XG4gICAgICBzID0geEludiBeIHhJbnY8PDEgXiB4SW52PDwyIF4geEludjw8MyBeIHhJbnY8PDQ7XG4gICAgICBzID0gcz4+OCBeIHMmMjU1IF4gOTk7XG4gICAgICBzYm94W3hdID0gcztcbiAgICAgIHNib3hJbnZbc10gPSB4O1xuXG4gICAgICAvLyBDb21wdXRlIE1peENvbHVtbnNcbiAgICAgIHg4ID0gZFt4NCA9IGRbeDIgPSBkW3hdXV07XG4gICAgICB0RGVjID0geDgqMHgxMDEwMTAxIF4geDQqMHgxMDAwMSBeIHgyKjB4MTAxIF4geCoweDEwMTAxMDA7XG4gICAgICB0RW5jID0gZFtzXSoweDEwMSBeIHMqMHgxMDEwMTAwO1xuXG4gICAgICBmb3IgKGkgPSAwOyBpIDwgNDsgaSsrKSB7XG4gICAgICAgIGVuY1RhYmxlW2ldW3hdID0gdEVuYyA9IHRFbmM8PDI0IF4gdEVuYz4+Pjg7XG4gICAgICAgIGRlY1RhYmxlW2ldW3NdID0gdERlYyA9IHREZWM8PDI0IF4gdERlYz4+Pjg7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gQ29tcGFjdGlmeS4gQ29uc2lkZXJhYmxlIHNwZWVkdXAgb24gRmlyZWZveC5cbiAgICBmb3IgKGkgPSAwOyBpIDwgNTsgaSsrKSB7XG4gICAgICBlbmNUYWJsZVtpXSA9IGVuY1RhYmxlW2ldLnNsaWNlKDApO1xuICAgICAgZGVjVGFibGVbaV0gPSBkZWNUYWJsZVtpXS5zbGljZSgwKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogRGVjcnlwdCAxNiBieXRlcywgc3BlY2lmaWVkIGFzIGZvdXIgMzItYml0IHdvcmRzLlxuICAgKiBAcGFyYW0gZW5jcnlwdGVkMCB7bnVtYmVyfSB0aGUgZmlyc3Qgd29yZCB0byBkZWNyeXB0XG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQxIHtudW1iZXJ9IHRoZSBzZWNvbmQgd29yZCB0byBkZWNyeXB0XG4gICAqIEBwYXJhbSBlbmNyeXB0ZWQyIHtudW1iZXJ9IHRoZSB0aGlyZCB3b3JkIHRvIGRlY3J5cHRcbiAgICogQHBhcmFtIGVuY3J5cHRlZDMge251bWJlcn0gdGhlIGZvdXJ0aCB3b3JkIHRvIGRlY3J5cHRcbiAgICogQHBhcmFtIG91dCB7SW50MzJBcnJheX0gdGhlIGFycmF5IHRvIHdyaXRlIHRoZSBkZWNyeXB0ZWQgd29yZHNcbiAgICogaW50b1xuICAgKiBAcGFyYW0gb2Zmc2V0IHtudW1iZXJ9IHRoZSBvZmZzZXQgaW50byB0aGUgb3V0cHV0IGFycmF5IHRvIHN0YXJ0XG4gICAqIHdyaXRpbmcgcmVzdWx0c1xuICAgKiBAcmV0dXJuIHtBcnJheX0gVGhlIHBsYWludGV4dC5cbiAgICovXG4gIGRlY3J5cHQoZW5jcnlwdGVkMCwgZW5jcnlwdGVkMSwgZW5jcnlwdGVkMiwgZW5jcnlwdGVkMywgb3V0LCBvZmZzZXQpIHtcbiAgICB2YXIga2V5ID0gdGhpcy5fa2V5WzFdLFxuICAgIC8vIHN0YXRlIHZhcmlhYmxlcyBhLGIsYyxkIGFyZSBsb2FkZWQgd2l0aCBwcmUtd2hpdGVuZWQgZGF0YVxuICAgIGEgPSBlbmNyeXB0ZWQwIF4ga2V5WzBdLFxuICAgIGIgPSBlbmNyeXB0ZWQzIF4ga2V5WzFdLFxuICAgIGMgPSBlbmNyeXB0ZWQyIF4ga2V5WzJdLFxuICAgIGQgPSBlbmNyeXB0ZWQxIF4ga2V5WzNdLFxuICAgIGEyLCBiMiwgYzIsXG5cbiAgICBuSW5uZXJSb3VuZHMgPSBrZXkubGVuZ3RoIC8gNCAtIDIsIC8vIGtleS5sZW5ndGggPT09IDIgP1xuICAgIGksXG4gICAga0luZGV4ID0gNCxcbiAgICB0YWJsZSA9IHRoaXMuX3RhYmxlc1sxXSxcblxuICAgIC8vIGxvYWQgdXAgdGhlIHRhYmxlc1xuICAgIHRhYmxlMCAgICA9IHRhYmxlWzBdLFxuICAgIHRhYmxlMSAgICA9IHRhYmxlWzFdLFxuICAgIHRhYmxlMiAgICA9IHRhYmxlWzJdLFxuICAgIHRhYmxlMyAgICA9IHRhYmxlWzNdLFxuICAgIHNib3ggID0gdGFibGVbNF07XG5cbiAgICAvLyBJbm5lciByb3VuZHMuIENyaWJiZWQgZnJvbSBPcGVuU1NMLlxuICAgIGZvciAoaSA9IDA7IGkgPCBuSW5uZXJSb3VuZHM7IGkrKykge1xuICAgICAgYTIgPSB0YWJsZTBbYT4+PjI0XSBeIHRhYmxlMVtiPj4xNiAmIDI1NV0gXiB0YWJsZTJbYz4+OCAmIDI1NV0gXiB0YWJsZTNbZCAmIDI1NV0gXiBrZXlba0luZGV4XTtcbiAgICAgIGIyID0gdGFibGUwW2I+Pj4yNF0gXiB0YWJsZTFbYz4+MTYgJiAyNTVdIF4gdGFibGUyW2Q+PjggJiAyNTVdIF4gdGFibGUzW2EgJiAyNTVdIF4ga2V5W2tJbmRleCArIDFdO1xuICAgICAgYzIgPSB0YWJsZTBbYz4+PjI0XSBeIHRhYmxlMVtkPj4xNiAmIDI1NV0gXiB0YWJsZTJbYT4+OCAmIDI1NV0gXiB0YWJsZTNbYiAmIDI1NV0gXiBrZXlba0luZGV4ICsgMl07XG4gICAgICBkICA9IHRhYmxlMFtkPj4+MjRdIF4gdGFibGUxW2E+PjE2ICYgMjU1XSBeIHRhYmxlMltiPj44ICYgMjU1XSBeIHRhYmxlM1tjICYgMjU1XSBeIGtleVtrSW5kZXggKyAzXTtcbiAgICAgIGtJbmRleCArPSA0O1xuICAgICAgYT1hMjsgYj1iMjsgYz1jMjtcbiAgICB9XG5cbiAgICAvLyBMYXN0IHJvdW5kLlxuICAgIGZvciAoaSA9IDA7IGkgPCA0OyBpKyspIHtcbiAgICAgIG91dFsoMyAmIC1pKSArIG9mZnNldF0gPVxuICAgICAgICBzYm94W2E+Pj4yNCAgICAgIF08PDI0IF5cbiAgICAgICAgc2JveFtiPj4xNiAgJiAyNTVdPDwxNiBeXG4gICAgICAgIHNib3hbYz4+OCAgICYgMjU1XTw8OCAgXlxuICAgICAgICBzYm94W2QgICAgICAmIDI1NV0gICAgIF5cbiAgICAgICAga2V5W2tJbmRleCsrXTtcbiAgICAgIGEyPWE7IGE9YjsgYj1jOyBjPWQ7IGQ9YTI7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEFFUztcbiIsIi8qXG4gKlxuICogVGhpcyBmaWxlIGNvbnRhaW5zIGFuIGFkYXB0YXRpb24gb2YgdGhlIEFFUyBkZWNyeXB0aW9uIGFsZ29yaXRobVxuICogZnJvbSB0aGUgU3RhbmRmb3JkIEphdmFzY3JpcHQgQ3J5cHRvZ3JhcGh5IExpYnJhcnkuIFRoYXQgd29yayBpc1xuICogY292ZXJlZCBieSB0aGUgZm9sbG93aW5nIGNvcHlyaWdodCBhbmQgcGVybWlzc2lvbnMgbm90aWNlOlxuICpcbiAqIENvcHlyaWdodCAyMDA5LTIwMTAgRW1pbHkgU3RhcmssIE1pa2UgSGFtYnVyZywgRGFuIEJvbmVoLlxuICogQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqXG4gKiBSZWRpc3RyaWJ1dGlvbiBhbmQgdXNlIGluIHNvdXJjZSBhbmQgYmluYXJ5IGZvcm1zLCB3aXRoIG9yIHdpdGhvdXRcbiAqIG1vZGlmaWNhdGlvbiwgYXJlIHBlcm1pdHRlZCBwcm92aWRlZCB0aGF0IHRoZSBmb2xsb3dpbmcgY29uZGl0aW9ucyBhcmVcbiAqIG1ldDpcbiAqXG4gKiAxLiBSZWRpc3RyaWJ1dGlvbnMgb2Ygc291cmNlIGNvZGUgbXVzdCByZXRhaW4gdGhlIGFib3ZlIGNvcHlyaWdodFxuICogICAgbm90aWNlLCB0aGlzIGxpc3Qgb2YgY29uZGl0aW9ucyBhbmQgdGhlIGZvbGxvd2luZyBkaXNjbGFpbWVyLlxuICpcbiAqIDIuIFJlZGlzdHJpYnV0aW9ucyBpbiBiaW5hcnkgZm9ybSBtdXN0IHJlcHJvZHVjZSB0aGUgYWJvdmVcbiAqICAgIGNvcHlyaWdodCBub3RpY2UsIHRoaXMgbGlzdCBvZiBjb25kaXRpb25zIGFuZCB0aGUgZm9sbG93aW5nXG4gKiAgICBkaXNjbGFpbWVyIGluIHRoZSBkb2N1bWVudGF0aW9uIGFuZC9vciBvdGhlciBtYXRlcmlhbHMgcHJvdmlkZWRcbiAqICAgIHdpdGggdGhlIGRpc3RyaWJ1dGlvbi5cbiAqXG4gKiBUSElTIFNPRlRXQVJFIElTIFBST1ZJREVEIEJZIFRIRSBBVVRIT1JTIGBgQVMgSVMnJyBBTkQgQU5ZIEVYUFJFU1MgT1JcbiAqIElNUExJRUQgV0FSUkFOVElFUywgSU5DTFVESU5HLCBCVVQgTk9UIExJTUlURUQgVE8sIFRIRSBJTVBMSUVEXG4gKiBXQVJSQU5USUVTIE9GIE1FUkNIQU5UQUJJTElUWSBBTkQgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQVJFXG4gKiBESVNDTEFJTUVELiBJTiBOTyBFVkVOVCBTSEFMTCA8Q09QWVJJR0hUIEhPTERFUj4gT1IgQ09OVFJJQlVUT1JTIEJFXG4gKiBMSUFCTEUgRk9SIEFOWSBESVJFQ1QsIElORElSRUNULCBJTkNJREVOVEFMLCBTUEVDSUFMLCBFWEVNUExBUlksIE9SXG4gKiBDT05TRVFVRU5USUFMIERBTUFHRVMgKElOQ0xVRElORywgQlVUIE5PVCBMSU1JVEVEIFRPLCBQUk9DVVJFTUVOVCBPRlxuICogU1VCU1RJVFVURSBHT09EUyBPUiBTRVJWSUNFUzsgTE9TUyBPRiBVU0UsIERBVEEsIE9SIFBST0ZJVFM7IE9SXG4gKiBCVVNJTkVTUyBJTlRFUlJVUFRJT04pIEhPV0VWRVIgQ0FVU0VEIEFORCBPTiBBTlkgVEhFT1JZIE9GIExJQUJJTElUWSxcbiAqIFdIRVRIRVIgSU4gQ09OVFJBQ1QsIFNUUklDVCBMSUFCSUxJVFksIE9SIFRPUlQgKElOQ0xVRElORyBORUdMSUdFTkNFXG4gKiBPUiBPVEhFUldJU0UpIEFSSVNJTkcgSU4gQU5ZIFdBWSBPVVQgT0YgVEhFIFVTRSBPRiBUSElTIFNPRlRXQVJFLCBFVkVOXG4gKiBJRiBBRFZJU0VEIE9GIFRIRSBQT1NTSUJJTElUWSBPRiBTVUNIIERBTUFHRS5cbiAqXG4gKiBUaGUgdmlld3MgYW5kIGNvbmNsdXNpb25zIGNvbnRhaW5lZCBpbiB0aGUgc29mdHdhcmUgYW5kIGRvY3VtZW50YXRpb25cbiAqIGFyZSB0aG9zZSBvZiB0aGUgYXV0aG9ycyBhbmQgc2hvdWxkIG5vdCBiZSBpbnRlcnByZXRlZCBhcyByZXByZXNlbnRpbmdcbiAqIG9mZmljaWFsIHBvbGljaWVzLCBlaXRoZXIgZXhwcmVzc2VkIG9yIGltcGxpZWQsIG9mIHRoZSBhdXRob3JzLlxuICovXG5cbmltcG9ydCBBRVMgZnJvbSAnLi9hZXMnO1xuXG5jbGFzcyBBRVMxMjhEZWNyeXB0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKGtleSwgaW5pdFZlY3Rvcikge1xuICAgIHRoaXMua2V5ID0ga2V5O1xuICAgIHRoaXMuaXYgPSBpbml0VmVjdG9yO1xuICB9XG5cbiAgLyoqXG4gICAqIENvbnZlcnQgbmV0d29yay1vcmRlciAoYmlnLWVuZGlhbikgYnl0ZXMgaW50byB0aGVpciBsaXR0bGUtZW5kaWFuXG4gICAqIHJlcHJlc2VudGF0aW9uLlxuICAgKi9cbiAgbnRvaCh3b3JkKSB7XG4gICAgcmV0dXJuICh3b3JkIDw8IDI0KSB8XG4gICAgICAoKHdvcmQgJiAweGZmMDApIDw8IDgpIHxcbiAgICAgICgod29yZCAmIDB4ZmYwMDAwKSA+PiA4KSB8XG4gICAgICAod29yZCA+Pj4gMjQpO1xuICB9XG5cblxuICAvKipcbiAgICogRGVjcnlwdCBieXRlcyB1c2luZyBBRVMtMTI4IHdpdGggQ0JDIGFuZCBQS0NTIzcgcGFkZGluZy5cbiAgICogQHBhcmFtIGVuY3J5cHRlZCB7VWludDhBcnJheX0gdGhlIGVuY3J5cHRlZCBieXRlc1xuICAgKiBAcGFyYW0ga2V5IHtVaW50MzJBcnJheX0gdGhlIGJ5dGVzIG9mIHRoZSBkZWNyeXB0aW9uIGtleVxuICAgKiBAcGFyYW0gaW5pdFZlY3RvciB7VWludDMyQXJyYXl9IHRoZSBpbml0aWFsaXphdGlvbiB2ZWN0b3IgKElWKSB0b1xuICAgKiB1c2UgZm9yIHRoZSBmaXJzdCByb3VuZCBvZiBDQkMuXG4gICAqIEByZXR1cm4ge1VpbnQ4QXJyYXl9IHRoZSBkZWNyeXB0ZWQgYnl0ZXNcbiAgICpcbiAgICogQHNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0FkdmFuY2VkX0VuY3J5cHRpb25fU3RhbmRhcmRcbiAgICogQHNlZSBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0Jsb2NrX2NpcGhlcl9tb2RlX29mX29wZXJhdGlvbiNDaXBoZXJfQmxvY2tfQ2hhaW5pbmdfLjI4Q0JDLjI5XG4gICAqIEBzZWUgaHR0cHM6Ly90b29scy5pZXRmLm9yZy9odG1sL3JmYzIzMTVcbiAgICovXG4gIGRvRGVjcnlwdChlbmNyeXB0ZWQsIGtleSwgaW5pdFZlY3Rvcikge1xuICAgIHZhclxuICAgICAgLy8gd29yZC1sZXZlbCBhY2Nlc3MgdG8gdGhlIGVuY3J5cHRlZCBieXRlc1xuICAgICAgZW5jcnlwdGVkMzIgPSBuZXcgSW50MzJBcnJheShlbmNyeXB0ZWQuYnVmZmVyLCBlbmNyeXB0ZWQuYnl0ZU9mZnNldCwgZW5jcnlwdGVkLmJ5dGVMZW5ndGggPj4gMiksXG5cbiAgICBkZWNpcGhlciA9IG5ldyBBRVMoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoa2V5KSksXG5cbiAgICAvLyBieXRlIGFuZCB3b3JkLWxldmVsIGFjY2VzcyBmb3IgdGhlIGRlY3J5cHRlZCBvdXRwdXRcbiAgICBkZWNyeXB0ZWQgPSBuZXcgVWludDhBcnJheShlbmNyeXB0ZWQuYnl0ZUxlbmd0aCksXG4gICAgZGVjcnlwdGVkMzIgPSBuZXcgSW50MzJBcnJheShkZWNyeXB0ZWQuYnVmZmVyKSxcblxuICAgIC8vIHRlbXBvcmFyeSB2YXJpYWJsZXMgZm9yIHdvcmtpbmcgd2l0aCB0aGUgSVYsIGVuY3J5cHRlZCwgYW5kXG4gICAgLy8gZGVjcnlwdGVkIGRhdGFcbiAgICBpbml0MCwgaW5pdDEsIGluaXQyLCBpbml0MyxcbiAgICBlbmNyeXB0ZWQwLCBlbmNyeXB0ZWQxLCBlbmNyeXB0ZWQyLCBlbmNyeXB0ZWQzLFxuXG4gICAgLy8gaXRlcmF0aW9uIHZhcmlhYmxlXG4gICAgd29yZEl4O1xuXG4gICAgLy8gcHVsbCBvdXQgdGhlIHdvcmRzIG9mIHRoZSBJViB0byBlbnN1cmUgd2UgZG9uJ3QgbW9kaWZ5IHRoZVxuICAgIC8vIHBhc3NlZC1pbiByZWZlcmVuY2UgYW5kIGVhc2llciBhY2Nlc3NcbiAgICBpbml0MCA9IH5+aW5pdFZlY3RvclswXTtcbiAgICBpbml0MSA9IH5+aW5pdFZlY3RvclsxXTtcbiAgICBpbml0MiA9IH5+aW5pdFZlY3RvclsyXTtcbiAgICBpbml0MyA9IH5+aW5pdFZlY3RvclszXTtcblxuICAgIC8vIGRlY3J5cHQgZm91ciB3b3JkIHNlcXVlbmNlcywgYXBwbHlpbmcgY2lwaGVyLWJsb2NrIGNoYWluaW5nIChDQkMpXG4gICAgLy8gdG8gZWFjaCBkZWNyeXB0ZWQgYmxvY2tcbiAgICBmb3IgKHdvcmRJeCA9IDA7IHdvcmRJeCA8IGVuY3J5cHRlZDMyLmxlbmd0aDsgd29yZEl4ICs9IDQpIHtcbiAgICAgIC8vIGNvbnZlcnQgYmlnLWVuZGlhbiAobmV0d29yayBvcmRlcikgd29yZHMgaW50byBsaXR0bGUtZW5kaWFuXG4gICAgICAvLyAoamF2YXNjcmlwdCBvcmRlcilcbiAgICAgIGVuY3J5cHRlZDAgPSB+fnRoaXMubnRvaChlbmNyeXB0ZWQzMlt3b3JkSXhdKTtcbiAgICAgIGVuY3J5cHRlZDEgPSB+fnRoaXMubnRvaChlbmNyeXB0ZWQzMlt3b3JkSXggKyAxXSk7XG4gICAgICBlbmNyeXB0ZWQyID0gfn50aGlzLm50b2goZW5jcnlwdGVkMzJbd29yZEl4ICsgMl0pO1xuICAgICAgZW5jcnlwdGVkMyA9IH5+dGhpcy5udG9oKGVuY3J5cHRlZDMyW3dvcmRJeCArIDNdKTtcblxuICAgICAgLy8gZGVjcnlwdCB0aGUgYmxvY2tcbiAgICAgIGRlY2lwaGVyLmRlY3J5cHQoZW5jcnlwdGVkMCxcbiAgICAgICAgICBlbmNyeXB0ZWQxLFxuICAgICAgICAgIGVuY3J5cHRlZDIsXG4gICAgICAgICAgZW5jcnlwdGVkMyxcbiAgICAgICAgICBkZWNyeXB0ZWQzMixcbiAgICAgICAgICB3b3JkSXgpO1xuXG4gICAgICAvLyBYT1Igd2l0aCB0aGUgSVYsIGFuZCByZXN0b3JlIG5ldHdvcmsgYnl0ZS1vcmRlciB0byBvYnRhaW4gdGhlXG4gICAgICAvLyBwbGFpbnRleHRcbiAgICAgIGRlY3J5cHRlZDMyW3dvcmRJeF0gICAgID0gdGhpcy5udG9oKGRlY3J5cHRlZDMyW3dvcmRJeF0gXiBpbml0MCk7XG4gICAgICBkZWNyeXB0ZWQzMlt3b3JkSXggKyAxXSA9IHRoaXMubnRvaChkZWNyeXB0ZWQzMlt3b3JkSXggKyAxXSBeIGluaXQxKTtcbiAgICAgIGRlY3J5cHRlZDMyW3dvcmRJeCArIDJdID0gdGhpcy5udG9oKGRlY3J5cHRlZDMyW3dvcmRJeCArIDJdIF4gaW5pdDIpO1xuICAgICAgZGVjcnlwdGVkMzJbd29yZEl4ICsgM10gPSB0aGlzLm50b2goZGVjcnlwdGVkMzJbd29yZEl4ICsgM10gXiBpbml0Myk7XG5cbiAgICAgIC8vIHNldHVwIHRoZSBJViBmb3IgdGhlIG5leHQgcm91bmRcbiAgICAgIGluaXQwID0gZW5jcnlwdGVkMDtcbiAgICAgIGluaXQxID0gZW5jcnlwdGVkMTtcbiAgICAgIGluaXQyID0gZW5jcnlwdGVkMjtcbiAgICAgIGluaXQzID0gZW5jcnlwdGVkMztcbiAgICB9XG5cbiAgICByZXR1cm4gZGVjcnlwdGVkO1xuICB9XG5cbiAgbG9jYWxEZWNyeXB0KGVuY3J5cHRlZCwga2V5LCBpbml0VmVjdG9yLCBkZWNyeXB0ZWQpIHtcbiAgICB2YXIgYnl0ZXMgPSB0aGlzLmRvRGVjcnlwdChlbmNyeXB0ZWQsXG4gICAgICAgIGtleSxcbiAgICAgICAgaW5pdFZlY3Rvcik7XG4gICAgZGVjcnlwdGVkLnNldChieXRlcywgZW5jcnlwdGVkLmJ5dGVPZmZzZXQpO1xuICB9XG5cbiAgZGVjcnlwdChlbmNyeXB0ZWQpIHtcbiAgICB2YXJcbiAgICAgIHN0ZXAgPSA0ICogODAwMCxcbiAgICAvL2VuY3J5cHRlZDMyID0gbmV3IEludDMyQXJyYXkoZW5jcnlwdGVkLmJ1ZmZlciksXG4gICAgZW5jcnlwdGVkMzIgPSBuZXcgSW50MzJBcnJheShlbmNyeXB0ZWQpLFxuICAgIGRlY3J5cHRlZCA9IG5ldyBVaW50OEFycmF5KGVuY3J5cHRlZC5ieXRlTGVuZ3RoKSxcbiAgICBpID0gMDtcblxuICAgIC8vIHNwbGl0IHVwIHRoZSBlbmNyeXB0aW9uIGpvYiBhbmQgZG8gdGhlIGluZGl2aWR1YWwgY2h1bmtzIGFzeW5jaHJvbm91c2x5XG4gICAgdmFyIGtleSA9IHRoaXMua2V5O1xuICAgIHZhciBpbml0VmVjdG9yID0gdGhpcy5pdjtcbiAgICB0aGlzLmxvY2FsRGVjcnlwdChlbmNyeXB0ZWQzMi5zdWJhcnJheShpLCBpICsgc3RlcCksIGtleSwgaW5pdFZlY3RvciwgZGVjcnlwdGVkKTtcblxuICAgIGZvciAoaSA9IHN0ZXA7IGkgPCBlbmNyeXB0ZWQzMi5sZW5ndGg7IGkgKz0gc3RlcCkge1xuICAgICAgaW5pdFZlY3RvciA9IG5ldyBVaW50MzJBcnJheShbXG4gICAgICAgICAgdGhpcy5udG9oKGVuY3J5cHRlZDMyW2kgLSA0XSksXG4gICAgICAgICAgdGhpcy5udG9oKGVuY3J5cHRlZDMyW2kgLSAzXSksXG4gICAgICAgICAgdGhpcy5udG9oKGVuY3J5cHRlZDMyW2kgLSAyXSksXG4gICAgICAgICAgdGhpcy5udG9oKGVuY3J5cHRlZDMyW2kgLSAxXSlcbiAgICAgIF0pO1xuICAgICAgdGhpcy5sb2NhbERlY3J5cHQoZW5jcnlwdGVkMzIuc3ViYXJyYXkoaSwgaSArIHN0ZXApLCBrZXksIGluaXRWZWN0b3IsIGRlY3J5cHRlZCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIGRlY3J5cHRlZDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBBRVMxMjhEZWNyeXB0ZXI7XG4iLCIvKlxuICogQUVTMTI4IGRlY3J5cHRpb24uXG4gKi9cblxuaW1wb3J0IEFFUzEyOERlY3J5cHRlciBmcm9tICcuL2FlczEyOC1kZWNyeXB0ZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgRGVjcnlwdGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICB0aGlzLmhscyA9IGhscztcbiAgICB0cnkge1xuICAgICAgY29uc3QgYnJvd3NlckNyeXB0byA9IHdpbmRvdyA/IHdpbmRvdy5jcnlwdG8gOiBjcnlwdG87XG4gICAgICB0aGlzLnN1YnRsZSA9IGJyb3dzZXJDcnlwdG8uc3VidGxlIHx8IGJyb3dzZXJDcnlwdG8ud2Via2l0U3VidGxlO1xuICAgICAgdGhpcy5kaXNhYmxlV2ViQ3J5cHRvID0gIXRoaXMuc3VidGxlO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRoaXMuZGlzYWJsZVdlYkNyeXB0byA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgfVxuXG4gIGRlY3J5cHQoZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spIHtcbiAgICBpZiAodGhpcy5kaXNhYmxlV2ViQ3J5cHRvICYmIHRoaXMuaGxzLmNvbmZpZy5lbmFibGVTb2Z0d2FyZUFFUykge1xuICAgICAgdGhpcy5kZWNyeXB0QnlTb2Z0d2FyZShkYXRhLCBrZXksIGl2LCBjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZGVjcnlwdEJ5V2ViQ3J5cHRvKGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICB9XG4gIH1cblxuICBkZWNyeXB0QnlXZWJDcnlwdG8oZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spIHtcbiAgICBsb2dnZXIubG9nKCdkZWNyeXB0aW5nIGJ5IFdlYkNyeXB0byBBUEknKTtcblxuICAgIHRoaXMuc3VidGxlLmltcG9ydEtleSgncmF3Jywga2V5LCB7IG5hbWUgOiAnQUVTLUNCQycsIGxlbmd0aCA6IDEyOCB9LCBmYWxzZSwgWydkZWNyeXB0J10pLlxuICAgICAgdGhlbigoaW1wb3J0ZWRLZXkpID0+IHtcbiAgICAgICAgdGhpcy5zdWJ0bGUuZGVjcnlwdCh7IG5hbWUgOiAnQUVTLUNCQycsIGl2IDogaXYuYnVmZmVyIH0sIGltcG9ydGVkS2V5LCBkYXRhKS5cbiAgICAgICAgICB0aGVuKGNhbGxiYWNrKS5cbiAgICAgICAgICBjYXRjaCAoKGVycikgPT4ge1xuICAgICAgICAgICAgdGhpcy5vbldlYkNyeXB0b0Vycm9yKGVyciwgZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spO1xuICAgICAgICAgIH0pO1xuICAgICAgfSkuXG4gICAgY2F0Y2ggKChlcnIpID0+IHtcbiAgICAgIHRoaXMub25XZWJDcnlwdG9FcnJvcihlcnIsIGRhdGEsIGtleSwgaXYsIGNhbGxiYWNrKTtcbiAgICB9KTtcbiAgfVxuXG4gIGRlY3J5cHRCeVNvZnR3YXJlKGRhdGEsIGtleTgsIGl2OCwgY2FsbGJhY2spIHtcbiAgICBsb2dnZXIubG9nKCdkZWNyeXB0aW5nIGJ5IEphdmFTY3JpcHQgSW1wbGVtZW50YXRpb24nKTtcblxuICAgIHZhciB2aWV3ID0gbmV3IERhdGFWaWV3KGtleTguYnVmZmVyKTtcbiAgICB2YXIga2V5ID0gbmV3IFVpbnQzMkFycmF5KFtcbiAgICAgICAgdmlldy5nZXRVaW50MzIoMCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDQpLFxuICAgICAgICB2aWV3LmdldFVpbnQzMig4KSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoMTIpXG4gICAgXSk7XG5cbiAgICB2aWV3ID0gbmV3IERhdGFWaWV3KGl2OC5idWZmZXIpO1xuICAgIHZhciBpdiA9IG5ldyBVaW50MzJBcnJheShbXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDApLFxuICAgICAgICB2aWV3LmdldFVpbnQzMig0KSxcbiAgICAgICAgdmlldy5nZXRVaW50MzIoOCksXG4gICAgICAgIHZpZXcuZ2V0VWludDMyKDEyKVxuICAgIF0pO1xuXG4gICAgdmFyIGRlY3J5cHRlciA9IG5ldyBBRVMxMjhEZWNyeXB0ZXIoa2V5LCBpdik7XG4gICAgY2FsbGJhY2soZGVjcnlwdGVyLmRlY3J5cHQoZGF0YSkuYnVmZmVyKTtcbiAgfVxuXG4gIG9uV2ViQ3J5cHRvRXJyb3IoZXJyLCBkYXRhLCBrZXksIGl2LCBjYWxsYmFjaykge1xuICAgIGlmICh0aGlzLmhscy5jb25maWcuZW5hYmxlU29mdHdhcmVBRVMpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2Rpc2FibGluZyB0byB1c2UgV2ViQ3J5cHRvIEFQSScpO1xuICAgICAgdGhpcy5kaXNhYmxlV2ViQ3J5cHRvID0gdHJ1ZTtcbiAgICAgIHRoaXMuZGVjcnlwdEJ5U29mdHdhcmUoZGF0YSwga2V5LCBpdiwgY2FsbGJhY2spO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGxvZ2dlci5lcnJvcihgZGVjcnlwdGluZyBlcnJvciA6ICR7ZXJyLm1lc3NhZ2V9YCk7XG4gICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZSA6IEVycm9yVHlwZXMuTUVESUFfRVJST1IsIGRldGFpbHMgOiBFcnJvckRldGFpbHMuRlJBR19ERUNSWVBUX0VSUk9SLCBmYXRhbCA6IHRydWUsIHJlYXNvbiA6IGVyci5tZXNzYWdlfSk7XG4gICAgfVxuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgRGVjcnlwdGVyO1xuIiwiLyoqXG4gKiBBQUMgZGVtdXhlclxuICovXG5pbXBvcnQgQURUUyBmcm9tICcuL2FkdHMnO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgSUQzIGZyb20gJy4uL2RlbXV4L2lkMyc7XG5cbiBjbGFzcyBBQUNEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcihvYnNlcnZlcixyZW11eGVyQ2xhc3MpIHtcbiAgICB0aGlzLm9ic2VydmVyID0gb2JzZXJ2ZXI7XG4gICAgdGhpcy5yZW11eGVyQ2xhc3MgPSByZW11eGVyQ2xhc3M7XG4gICAgdGhpcy5yZW11eGVyID0gbmV3IHRoaXMucmVtdXhlckNsYXNzKG9ic2VydmVyKTtcbiAgICB0aGlzLl9hYWNUcmFjayA9IHtjb250YWluZXIgOiAnYXVkaW8vYWR0cycsIHR5cGU6ICdhdWRpbycsIGlkIDotMSwgc2VxdWVuY2VOdW1iZXI6IDAsIHNhbXBsZXMgOiBbXSwgbGVuIDogMH07XG4gIH1cblxuICBzdGF0aWMgcHJvYmUoZGF0YSkge1xuICAgIC8vIGNoZWNrIGlmIGRhdGEgY29udGFpbnMgSUQzIHRpbWVzdGFtcCBhbmQgQURUUyBzeW5jIHdvcmNcbiAgICB2YXIgaWQzID0gbmV3IElEMyhkYXRhKSwgb2Zmc2V0LGxlbjtcbiAgICBpZihpZDMuaGFzVGltZVN0YW1wKSB7XG4gICAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgICAgZm9yIChvZmZzZXQgPSBpZDMubGVuZ3RoLCBsZW4gPSBkYXRhLmxlbmd0aDsgb2Zmc2V0IDwgbGVuIC0gMTsgb2Zmc2V0KyspIHtcbiAgICAgICAgaWYgKChkYXRhW29mZnNldF0gPT09IDB4ZmYpICYmIChkYXRhW29mZnNldCsxXSAmIDB4ZjApID09PSAweGYwKSB7XG4gICAgICAgICAgLy9sb2dnZXIubG9nKCdBRFRTIHN5bmMgd29yZCBmb3VuZCAhJyk7XG4gICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cblxuICAvLyBmZWVkIGluY29taW5nIGRhdGEgdG8gdGhlIGZyb250IG9mIHRoZSBwYXJzaW5nIHBpcGVsaW5lXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pIHtcbiAgICB2YXIgdHJhY2sgPSB0aGlzLl9hYWNUcmFjayxcbiAgICAgICAgaWQzID0gbmV3IElEMyhkYXRhKSxcbiAgICAgICAgcHRzID0gOTAqaWQzLnRpbWVTdGFtcCxcbiAgICAgICAgY29uZmlnLCBmcmFtZUxlbmd0aCwgZnJhbWVEdXJhdGlvbiwgZnJhbWVJbmRleCwgb2Zmc2V0LCBoZWFkZXJMZW5ndGgsIHN0YW1wLCBsZW4sIGFhY1NhbXBsZTtcbiAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgIGZvciAob2Zmc2V0ID0gaWQzLmxlbmd0aCwgbGVuID0gZGF0YS5sZW5ndGg7IG9mZnNldCA8IGxlbiAtIDE7IG9mZnNldCsrKSB7XG4gICAgICBpZiAoKGRhdGFbb2Zmc2V0XSA9PT0gMHhmZikgJiYgKGRhdGFbb2Zmc2V0KzFdICYgMHhmMCkgPT09IDB4ZjApIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCF0cmFjay5hdWRpb3NhbXBsZXJhdGUpIHtcbiAgICAgIGNvbmZpZyA9IEFEVFMuZ2V0QXVkaW9Db25maWcodGhpcy5vYnNlcnZlcixkYXRhLCBvZmZzZXQsIGF1ZGlvQ29kZWMpO1xuICAgICAgdHJhY2suY29uZmlnID0gY29uZmlnLmNvbmZpZztcbiAgICAgIHRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSA9IGNvbmZpZy5zYW1wbGVyYXRlO1xuICAgICAgdHJhY2suY2hhbm5lbENvdW50ID0gY29uZmlnLmNoYW5uZWxDb3VudDtcbiAgICAgIHRyYWNrLmNvZGVjID0gY29uZmlnLmNvZGVjO1xuICAgICAgdHJhY2suZHVyYXRpb24gPSBkdXJhdGlvbjtcbiAgICAgIGxvZ2dlci5sb2coYHBhcnNlZCBjb2RlYzoke3RyYWNrLmNvZGVjfSxyYXRlOiR7Y29uZmlnLnNhbXBsZXJhdGV9LG5iIGNoYW5uZWw6JHtjb25maWcuY2hhbm5lbENvdW50fWApO1xuICAgIH1cbiAgICBmcmFtZUluZGV4ID0gMDtcbiAgICBmcmFtZUR1cmF0aW9uID0gMTAyNCAqIDkwMDAwIC8gdHJhY2suYXVkaW9zYW1wbGVyYXRlO1xuICAgIHdoaWxlICgob2Zmc2V0ICsgNSkgPCBsZW4pIHtcbiAgICAgIC8vIFRoZSBwcm90ZWN0aW9uIHNraXAgYml0IHRlbGxzIHVzIGlmIHdlIGhhdmUgMiBieXRlcyBvZiBDUkMgZGF0YSBhdCB0aGUgZW5kIG9mIHRoZSBBRFRTIGhlYWRlclxuICAgICAgaGVhZGVyTGVuZ3RoID0gKCEhKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDAxKSA/IDcgOiA5KTtcbiAgICAgIC8vIHJldHJpZXZlIGZyYW1lIHNpemVcbiAgICAgIGZyYW1lTGVuZ3RoID0gKChkYXRhW29mZnNldCArIDNdICYgMHgwMykgPDwgMTEpIHxcbiAgICAgICAgICAgICAgICAgICAgIChkYXRhW29mZnNldCArIDRdIDw8IDMpIHxcbiAgICAgICAgICAgICAgICAgICAgKChkYXRhW29mZnNldCArIDVdICYgMHhFMCkgPj4+IDUpO1xuICAgICAgZnJhbWVMZW5ndGggIC09IGhlYWRlckxlbmd0aDtcbiAgICAgIC8vc3RhbXAgPSBwZXMucHRzO1xuXG4gICAgICBpZiAoKGZyYW1lTGVuZ3RoID4gMCkgJiYgKChvZmZzZXQgKyBoZWFkZXJMZW5ndGggKyBmcmFtZUxlbmd0aCkgPD0gbGVuKSkge1xuICAgICAgICBzdGFtcCA9IHB0cyArIGZyYW1lSW5kZXggKiBmcmFtZUR1cmF0aW9uO1xuICAgICAgICAvL2xvZ2dlci5sb2coYEFBQyBmcmFtZSwgb2Zmc2V0L2xlbmd0aC90b3RhbC9wdHM6JHtvZmZzZXQraGVhZGVyTGVuZ3RofS8ke2ZyYW1lTGVuZ3RofS8ke2RhdGEuYnl0ZUxlbmd0aH0vJHsoc3RhbXAvOTApLnRvRml4ZWQoMCl9YCk7XG4gICAgICAgIGFhY1NhbXBsZSA9IHt1bml0OiBkYXRhLnN1YmFycmF5KG9mZnNldCArIGhlYWRlckxlbmd0aCwgb2Zmc2V0ICsgaGVhZGVyTGVuZ3RoICsgZnJhbWVMZW5ndGgpLCBwdHM6IHN0YW1wLCBkdHM6IHN0YW1wfTtcbiAgICAgICAgdHJhY2suc2FtcGxlcy5wdXNoKGFhY1NhbXBsZSk7XG4gICAgICAgIHRyYWNrLmxlbiArPSBmcmFtZUxlbmd0aDtcbiAgICAgICAgb2Zmc2V0ICs9IGZyYW1lTGVuZ3RoICsgaGVhZGVyTGVuZ3RoO1xuICAgICAgICBmcmFtZUluZGV4Kys7XG4gICAgICAgIC8vIGxvb2sgZm9yIEFEVFMgaGVhZGVyICgweEZGRngpXG4gICAgICAgIGZvciAoIDsgb2Zmc2V0IDwgKGxlbiAtIDEpOyBvZmZzZXQrKykge1xuICAgICAgICAgIGlmICgoZGF0YVtvZmZzZXRdID09PSAweGZmKSAmJiAoKGRhdGFbb2Zmc2V0ICsgMV0gJiAweGYwKSA9PT0gMHhmMCkpIHtcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMucmVtdXhlci5yZW11eCh0aGlzLl9hYWNUcmFjayx7c2FtcGxlcyA6IFtdfSwge3NhbXBsZXMgOiBbIHsgcHRzOiBwdHMsIGR0cyA6IHB0cywgdW5pdCA6IGlkMy5wYXlsb2FkfSBdfSwgeyBzYW1wbGVzOiBbXSB9LCB0aW1lT2Zmc2V0KTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBBQUNEZW11eGVyO1xuIiwiLyoqXG4gKiAgQURUUyBwYXJzZXIgaGVscGVyXG4gKi9cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbiBjbGFzcyBBRFRTIHtcblxuICBzdGF0aWMgZ2V0QXVkaW9Db25maWcob2JzZXJ2ZXIsIGRhdGEsIG9mZnNldCwgYXVkaW9Db2RlYykge1xuICAgIHZhciBhZHRzT2JqZWN0VHlwZSwgLy8gOmludFxuICAgICAgICBhZHRzU2FtcGxlaW5nSW5kZXgsIC8vIDppbnRcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4LCAvLyA6aW50XG4gICAgICAgIGFkdHNDaGFuZWxDb25maWcsIC8vIDppbnRcbiAgICAgICAgY29uZmlnLFxuICAgICAgICB1c2VyQWdlbnQgPSBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCksXG4gICAgICAgIGFkdHNTYW1wbGVpbmdSYXRlcyA9IFtcbiAgICAgICAgICAgIDk2MDAwLCA4ODIwMCxcbiAgICAgICAgICAgIDY0MDAwLCA0ODAwMCxcbiAgICAgICAgICAgIDQ0MTAwLCAzMjAwMCxcbiAgICAgICAgICAgIDI0MDAwLCAyMjA1MCxcbiAgICAgICAgICAgIDE2MDAwLCAxMjAwMCxcbiAgICAgICAgICAgIDExMDI1LCA4MDAwLFxuICAgICAgICAgICAgNzM1MF07XG4gICAgLy8gYnl0ZSAyXG4gICAgYWR0c09iamVjdFR5cGUgPSAoKGRhdGFbb2Zmc2V0ICsgMl0gJiAweEMwKSA+Pj4gNikgKyAxO1xuICAgIGFkdHNTYW1wbGVpbmdJbmRleCA9ICgoZGF0YVtvZmZzZXQgKyAyXSAmIDB4M0MpID4+PiAyKTtcbiAgICBpZihhZHRzU2FtcGxlaW5nSW5kZXggPiBhZHRzU2FtcGxlaW5nUmF0ZXMubGVuZ3RoLTEpIHtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogdHJ1ZSwgcmVhc29uOiBgaW52YWxpZCBBRFRTIHNhbXBsaW5nIGluZGV4OiR7YWR0c1NhbXBsZWluZ0luZGV4fWB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgYWR0c0NoYW5lbENvbmZpZyA9ICgoZGF0YVtvZmZzZXQgKyAyXSAmIDB4MDEpIDw8IDIpO1xuICAgIC8vIGJ5dGUgM1xuICAgIGFkdHNDaGFuZWxDb25maWcgfD0gKChkYXRhW29mZnNldCArIDNdICYgMHhDMCkgPj4+IDYpO1xuICAgIGxvZ2dlci5sb2coYG1hbmlmZXN0IGNvZGVjOiR7YXVkaW9Db2RlY30sQURUUyBkYXRhOnR5cGU6JHthZHRzT2JqZWN0VHlwZX0sc2FtcGxlaW5nSW5kZXg6JHthZHRzU2FtcGxlaW5nSW5kZXh9WyR7YWR0c1NhbXBsZWluZ1JhdGVzW2FkdHNTYW1wbGVpbmdJbmRleF19SHpdLGNoYW5uZWxDb25maWc6JHthZHRzQ2hhbmVsQ29uZmlnfWApO1xuICAgIC8vIGZpcmVmb3g6IGZyZXEgbGVzcyB0aGFuIDI0a0h6ID0gQUFDIFNCUiAoSEUtQUFDKVxuICAgIGlmICh1c2VyQWdlbnQuaW5kZXhPZignZmlyZWZveCcpICE9PSAtMSkge1xuICAgICAgaWYgKGFkdHNTYW1wbGVpbmdJbmRleCA+PSA2KSB7XG4gICAgICAgIGFkdHNPYmplY3RUeXBlID0gNTtcbiAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDQpO1xuICAgICAgICAvLyBIRS1BQUMgdXNlcyBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pICwgaGlnaCBmcmVxdWVuY2llcyBhcmUgY29uc3RydWN0ZWQgZnJvbSBsb3cgZnJlcXVlbmNpZXNcbiAgICAgICAgLy8gdGhlcmUgaXMgYSBmYWN0b3IgMiBiZXR3ZWVuIGZyYW1lIHNhbXBsZSByYXRlIGFuZCBvdXRwdXQgc2FtcGxlIHJhdGVcbiAgICAgICAgLy8gbXVsdGlwbHkgZnJlcXVlbmN5IGJ5IDIgKHNlZSB0YWJsZSBiZWxvdywgZXF1aXZhbGVudCB0byBzdWJzdHJhY3QgMylcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4IC0gMztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFkdHNPYmplY3RUeXBlID0gMjtcbiAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDIpO1xuICAgICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgICB9XG4gICAgICAvLyBBbmRyb2lkIDogYWx3YXlzIHVzZSBBQUNcbiAgICB9IGVsc2UgaWYgKHVzZXJBZ2VudC5pbmRleE9mKCdhbmRyb2lkJykgIT09IC0xKSB7XG4gICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICBjb25maWcgPSBuZXcgQXJyYXkoMik7XG4gICAgICBhZHRzRXh0ZW5zaW9uU2FtcGxlaW5nSW5kZXggPSBhZHRzU2FtcGxlaW5nSW5kZXg7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8qICBmb3Igb3RoZXIgYnJvd3NlcnMgKGNocm9tZSAuLi4pXG4gICAgICAgICAgYWx3YXlzIGZvcmNlIGF1ZGlvIHR5cGUgdG8gYmUgSEUtQUFDIFNCUiwgYXMgc29tZSBicm93c2VycyBkbyBub3Qgc3VwcG9ydCBhdWRpbyBjb2RlYyBzd2l0Y2ggcHJvcGVybHkgKGxpa2UgQ2hyb21lIC4uLilcbiAgICAgICovXG4gICAgICBhZHRzT2JqZWN0VHlwZSA9IDU7XG4gICAgICBjb25maWcgPSBuZXcgQXJyYXkoNCk7XG4gICAgICAvLyBpZiAobWFuaWZlc3QgY29kZWMgaXMgSEUtQUFDIG9yIEhFLUFBQ3YyKSBPUiAobWFuaWZlc3QgY29kZWMgbm90IHNwZWNpZmllZCBBTkQgZnJlcXVlbmN5IGxlc3MgdGhhbiAyNGtIeilcbiAgICAgIGlmICgoYXVkaW9Db2RlYyAmJiAoKGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC4yOScpICE9PSAtMSkgfHxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKGF1ZGlvQ29kZWMuaW5kZXhPZignbXA0YS40MC41JykgIT09IC0xKSkpIHx8XG4gICAgICAgICAgKCFhdWRpb0NvZGVjICYmIGFkdHNTYW1wbGVpbmdJbmRleCA+PSA2KSkge1xuICAgICAgICAvLyBIRS1BQUMgdXNlcyBTQlIgKFNwZWN0cmFsIEJhbmQgUmVwbGljYXRpb24pICwgaGlnaCBmcmVxdWVuY2llcyBhcmUgY29uc3RydWN0ZWQgZnJvbSBsb3cgZnJlcXVlbmNpZXNcbiAgICAgICAgLy8gdGhlcmUgaXMgYSBmYWN0b3IgMiBiZXR3ZWVuIGZyYW1lIHNhbXBsZSByYXRlIGFuZCBvdXRwdXQgc2FtcGxlIHJhdGVcbiAgICAgICAgLy8gbXVsdGlwbHkgZnJlcXVlbmN5IGJ5IDIgKHNlZSB0YWJsZSBiZWxvdywgZXF1aXZhbGVudCB0byBzdWJzdHJhY3QgMylcbiAgICAgICAgYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ID0gYWR0c1NhbXBsZWluZ0luZGV4IC0gMztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGlmIChtYW5pZmVzdCBjb2RlYyBpcyBBQUMpIEFORCAoZnJlcXVlbmN5IGxlc3MgdGhhbiAyNGtIeiBBTkQgbmIgY2hhbm5lbCBpcyAxKSBPUiAobWFuaWZlc3QgY29kZWMgbm90IHNwZWNpZmllZCBhbmQgbW9ubyBhdWRpbylcbiAgICAgICAgLy8gQ2hyb21lIGZhaWxzIHRvIHBsYXkgYmFjayB3aXRoIGxvdyBmcmVxdWVuY3kgQUFDIExDIG1vbm8gd2hlbiBpbml0aWFsaXplZCB3aXRoIEhFLUFBQy4gIFRoaXMgaXMgbm90IGEgcHJvYmxlbSB3aXRoIHN0ZXJlby5cbiAgICAgICAgaWYgKGF1ZGlvQ29kZWMgJiYgYXVkaW9Db2RlYy5pbmRleE9mKCdtcDRhLjQwLjInKSAhPT0gLTEgJiYgKGFkdHNTYW1wbGVpbmdJbmRleCA+PSA2ICYmIGFkdHNDaGFuZWxDb25maWcgPT09IDEpIHx8XG4gICAgICAgICAgICAoIWF1ZGlvQ29kZWMgJiYgYWR0c0NoYW5lbENvbmZpZyA9PT0gMSkpIHtcbiAgICAgICAgICBhZHRzT2JqZWN0VHlwZSA9IDI7XG4gICAgICAgICAgY29uZmlnID0gbmV3IEFycmF5KDIpO1xuICAgICAgICB9XG4gICAgICAgIGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCA9IGFkdHNTYW1wbGVpbmdJbmRleDtcbiAgICAgIH1cbiAgICB9XG4gICAgLyogcmVmZXIgdG8gaHR0cDovL3dpa2kubXVsdGltZWRpYS5jeC9pbmRleC5waHA/dGl0bGU9TVBFRy00X0F1ZGlvI0F1ZGlvX1NwZWNpZmljX0NvbmZpZ1xuICAgICAgICBJU08gMTQ0OTYtMyAoQUFDKS5wZGYgLSBUYWJsZSAxLjEzIOKAlCBTeW50YXggb2YgQXVkaW9TcGVjaWZpY0NvbmZpZygpXG4gICAgICBBdWRpbyBQcm9maWxlIC8gQXVkaW8gT2JqZWN0IFR5cGVcbiAgICAgIDA6IE51bGxcbiAgICAgIDE6IEFBQyBNYWluXG4gICAgICAyOiBBQUMgTEMgKExvdyBDb21wbGV4aXR5KVxuICAgICAgMzogQUFDIFNTUiAoU2NhbGFibGUgU2FtcGxlIFJhdGUpXG4gICAgICA0OiBBQUMgTFRQIChMb25nIFRlcm0gUHJlZGljdGlvbilcbiAgICAgIDU6IFNCUiAoU3BlY3RyYWwgQmFuZCBSZXBsaWNhdGlvbilcbiAgICAgIDY6IEFBQyBTY2FsYWJsZVxuICAgICBzYW1wbGluZyBmcmVxXG4gICAgICAwOiA5NjAwMCBIelxuICAgICAgMTogODgyMDAgSHpcbiAgICAgIDI6IDY0MDAwIEh6XG4gICAgICAzOiA0ODAwMCBIelxuICAgICAgNDogNDQxMDAgSHpcbiAgICAgIDU6IDMyMDAwIEh6XG4gICAgICA2OiAyNDAwMCBIelxuICAgICAgNzogMjIwNTAgSHpcbiAgICAgIDg6IDE2MDAwIEh6XG4gICAgICA5OiAxMjAwMCBIelxuICAgICAgMTA6IDExMDI1IEh6XG4gICAgICAxMTogODAwMCBIelxuICAgICAgMTI6IDczNTAgSHpcbiAgICAgIDEzOiBSZXNlcnZlZFxuICAgICAgMTQ6IFJlc2VydmVkXG4gICAgICAxNTogZnJlcXVlbmN5IGlzIHdyaXR0ZW4gZXhwbGljdGx5XG4gICAgICBDaGFubmVsIENvbmZpZ3VyYXRpb25zXG4gICAgICBUaGVzZSBhcmUgdGhlIGNoYW5uZWwgY29uZmlndXJhdGlvbnM6XG4gICAgICAwOiBEZWZpbmVkIGluIEFPVCBTcGVjaWZjIENvbmZpZ1xuICAgICAgMTogMSBjaGFubmVsOiBmcm9udC1jZW50ZXJcbiAgICAgIDI6IDIgY2hhbm5lbHM6IGZyb250LWxlZnQsIGZyb250LXJpZ2h0XG4gICAgKi9cbiAgICAvLyBhdWRpb09iamVjdFR5cGUgPSBwcm9maWxlID0+IHByb2ZpbGUsIHRoZSBNUEVHLTQgQXVkaW8gT2JqZWN0IFR5cGUgbWludXMgMVxuICAgIGNvbmZpZ1swXSA9IGFkdHNPYmplY3RUeXBlIDw8IDM7XG4gICAgLy8gc2FtcGxpbmdGcmVxdWVuY3lJbmRleFxuICAgIGNvbmZpZ1swXSB8PSAoYWR0c1NhbXBsZWluZ0luZGV4ICYgMHgwRSkgPj4gMTtcbiAgICBjb25maWdbMV0gfD0gKGFkdHNTYW1wbGVpbmdJbmRleCAmIDB4MDEpIDw8IDc7XG4gICAgLy8gY2hhbm5lbENvbmZpZ3VyYXRpb25cbiAgICBjb25maWdbMV0gfD0gYWR0c0NoYW5lbENvbmZpZyA8PCAzO1xuICAgIGlmIChhZHRzT2JqZWN0VHlwZSA9PT0gNSkge1xuICAgICAgLy8gYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4XG4gICAgICBjb25maWdbMV0gfD0gKGFkdHNFeHRlbnNpb25TYW1wbGVpbmdJbmRleCAmIDB4MEUpID4+IDE7XG4gICAgICBjb25maWdbMl0gPSAoYWR0c0V4dGVuc2lvblNhbXBsZWluZ0luZGV4ICYgMHgwMSkgPDwgNztcbiAgICAgIC8vIGFkdHNPYmplY3RUeXBlIChmb3JjZSB0byAyLCBjaHJvbWUgaXMgY2hlY2tpbmcgdGhhdCBvYmplY3QgdHlwZSBpcyBsZXNzIHRoYW4gNSA/Pz9cbiAgICAgIC8vICAgIGh0dHBzOi8vY2hyb21pdW0uZ29vZ2xlc291cmNlLmNvbS9jaHJvbWl1bS9zcmMuZ2l0LysvbWFzdGVyL21lZGlhL2Zvcm1hdHMvbXA0L2FhYy5jY1xuICAgICAgY29uZmlnWzJdIHw9IDIgPDwgMjtcbiAgICAgIGNvbmZpZ1szXSA9IDA7XG4gICAgfVxuICAgIHJldHVybiB7Y29uZmlnOiBjb25maWcsIHNhbXBsZXJhdGU6IGFkdHNTYW1wbGVpbmdSYXRlc1thZHRzU2FtcGxlaW5nSW5kZXhdLCBjaGFubmVsQ291bnQ6IGFkdHNDaGFuZWxDb25maWcsIGNvZGVjOiAoJ21wNGEuNDAuJyArIGFkdHNPYmplY3RUeXBlKX07XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgQURUUztcbiIsIi8qICBpbmxpbmUgZGVtdXhlci5cbiAqICAgcHJvYmUgZnJhZ21lbnRzIGFuZCBpbnN0YW50aWF0ZSBhcHByb3ByaWF0ZSBkZW11eGVyIGRlcGVuZGluZyBvbiBjb250ZW50IHR5cGUgKFRTRGVtdXhlciwgQUFDRGVtdXhlciwgLi4uKVxuICovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5pbXBvcnQgQUFDRGVtdXhlciBmcm9tICcuLi9kZW11eC9hYWNkZW11eGVyJztcbmltcG9ydCBUU0RlbXV4ZXIgZnJvbSAnLi4vZGVtdXgvdHNkZW11eGVyJztcbmltcG9ydCBNUDRSZW11eGVyIGZyb20gJy4uL3JlbXV4L21wNC1yZW11eGVyJztcbmltcG9ydCBQYXNzVGhyb3VnaFJlbXV4ZXIgZnJvbSAnLi4vcmVtdXgvcGFzc3Rocm91Z2gtcmVtdXhlcic7XG5cbmNsYXNzIERlbXV4ZXJJbmxpbmUge1xuXG4gIGNvbnN0cnVjdG9yKGhscyx0eXBlU3VwcG9ydGVkKSB7XG4gICAgdGhpcy5obHMgPSBobHM7XG4gICAgdGhpcy50eXBlU3VwcG9ydGVkID0gdHlwZVN1cHBvcnRlZDtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdmFyIGRlbXV4ZXIgPSB0aGlzLmRlbXV4ZXI7XG4gICAgaWYgKGRlbXV4ZXIpIHtcbiAgICAgIGRlbXV4ZXIuZGVzdHJveSgpO1xuICAgIH1cbiAgfVxuXG4gIHB1c2goZGF0YSwgYXVkaW9Db2RlYywgdmlkZW9Db2RlYywgdGltZU9mZnNldCwgY2MsIGxldmVsLCBzbiwgZHVyYXRpb24pIHtcbiAgICB2YXIgZGVtdXhlciA9IHRoaXMuZGVtdXhlcjtcbiAgICBpZiAoIWRlbXV4ZXIpIHtcbiAgICAgIHZhciBobHMgPSB0aGlzLmhscztcbiAgICAgIC8vIHByb2JlIGZvciBjb250ZW50IHR5cGVcbiAgICAgIGlmIChUU0RlbXV4ZXIucHJvYmUoZGF0YSkpIHtcbiAgICAgICAgaWYgKHRoaXMudHlwZVN1cHBvcnRlZC5tcDJ0ID09PSB0cnVlKSB7XG4gICAgICAgICAgZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIoaGxzLFBhc3NUaHJvdWdoUmVtdXhlcik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVtdXhlciA9IG5ldyBUU0RlbXV4ZXIoaGxzLE1QNFJlbXV4ZXIpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYoQUFDRGVtdXhlci5wcm9iZShkYXRhKSkge1xuICAgICAgICBkZW11eGVyID0gbmV3IEFBQ0RlbXV4ZXIoaGxzLE1QNFJlbXV4ZXIpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHJlYXNvbjogJ25vIGRlbXV4IG1hdGNoaW5nIHdpdGggY29udGVudCBmb3VuZCd9KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5kZW11eGVyID0gZGVtdXhlcjtcbiAgICB9XG4gICAgZGVtdXhlci5wdXNoKGRhdGEsYXVkaW9Db2RlYyx2aWRlb0NvZGVjLHRpbWVPZmZzZXQsY2MsbGV2ZWwsc24sZHVyYXRpb24pO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IERlbXV4ZXJJbmxpbmU7XG4iLCIvKiBkZW11eGVyIHdlYiB3b3JrZXIuXG4gKiAgLSBsaXN0ZW4gdG8gd29ya2VyIG1lc3NhZ2UsIGFuZCB0cmlnZ2VyIERlbXV4ZXJJbmxpbmUgdXBvbiByZWNlcHRpb24gb2YgRnJhZ21lbnRzLlxuICogIC0gcHJvdmlkZXMgTVA0IEJveGVzIGJhY2sgdG8gbWFpbiB0aHJlYWQgdXNpbmcgW3RyYW5zZmVyYWJsZSBvYmplY3RzXShodHRwczovL2RldmVsb3BlcnMuZ29vZ2xlLmNvbS93ZWIvdXBkYXRlcy8yMDExLzEyL1RyYW5zZmVyYWJsZS1PYmplY3RzLUxpZ2h0bmluZy1GYXN0KSBpbiBvcmRlciB0byBtaW5pbWl6ZSBtZXNzYWdlIHBhc3Npbmcgb3ZlcmhlYWQuXG4gKi9cblxuIGltcG9ydCBEZW11eGVySW5saW5lIGZyb20gJy4uL2RlbXV4L2RlbXV4ZXItaW5saW5lJztcbiBpbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbiBpbXBvcnQgRXZlbnRFbWl0dGVyIGZyb20gJ2V2ZW50cyc7XG5cbnZhciBEZW11eGVyV29ya2VyID0gZnVuY3Rpb24gKHNlbGYpIHtcbiAgLy8gb2JzZXJ2ZXIgc2V0dXBcbiAgdmFyIG9ic2VydmVyID0gbmV3IEV2ZW50RW1pdHRlcigpO1xuICBvYnNlcnZlci50cmlnZ2VyID0gZnVuY3Rpb24gdHJpZ2dlciAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgICBvYnNlcnZlci5lbWl0KGV2ZW50LCBldmVudCwgLi4uZGF0YSk7XG4gIH07XG5cbiAgb2JzZXJ2ZXIub2ZmID0gZnVuY3Rpb24gb2ZmIChldmVudCwgLi4uZGF0YSkge1xuICAgIG9ic2VydmVyLnJlbW92ZUxpc3RlbmVyKGV2ZW50LCAuLi5kYXRhKTtcbiAgfTtcbiAgc2VsZi5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgZnVuY3Rpb24gKGV2KSB7XG4gICAgdmFyIGRhdGEgPSBldi5kYXRhO1xuICAgIC8vY29uc29sZS5sb2coJ2RlbXV4ZXIgY21kOicgKyBkYXRhLmNtZCk7XG4gICAgc3dpdGNoIChkYXRhLmNtZCkge1xuICAgICAgY2FzZSAnaW5pdCc6XG4gICAgICAgIHNlbGYuZGVtdXhlciA9IG5ldyBEZW11eGVySW5saW5lKG9ic2VydmVyLCBkYXRhLnR5cGVTdXBwb3J0ZWQpO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ2RlbXV4JzpcbiAgICAgICAgc2VsZi5kZW11eGVyLnB1c2gobmV3IFVpbnQ4QXJyYXkoZGF0YS5kYXRhKSwgZGF0YS5hdWRpb0NvZGVjLCBkYXRhLnZpZGVvQ29kZWMsIGRhdGEudGltZU9mZnNldCwgZGF0YS5jYywgZGF0YS5sZXZlbCwgZGF0YS5zbiwgZGF0YS5kdXJhdGlvbik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9KTtcblxuICAvLyBsaXN0ZW4gdG8gZXZlbnRzIHRyaWdnZXJlZCBieSBEZW11eGVyXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIGZ1bmN0aW9uKGV2LCBkYXRhKSB7XG4gICAgc2VsZi5wb3N0TWVzc2FnZSh7ZXZlbnQ6IGV2LCB0cmFja3MgOiBkYXRhLnRyYWNrcywgdW5pcXVlIDogZGF0YS51bmlxdWUgfSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCBmdW5jdGlvbihldiwgZGF0YSkge1xuICAgIHZhciBvYmpEYXRhID0ge2V2ZW50OiBldiwgdHlwZTogZGF0YS50eXBlLCBzdGFydFBUUzogZGF0YS5zdGFydFBUUywgZW5kUFRTOiBkYXRhLmVuZFBUUywgc3RhcnREVFM6IGRhdGEuc3RhcnREVFMsIGVuZERUUzogZGF0YS5lbmREVFMsIGRhdGExOiBkYXRhLmRhdGExLmJ1ZmZlciwgZGF0YTI6IGRhdGEuZGF0YTIuYnVmZmVyLCBuYjogZGF0YS5uYn07XG4gICAgLy8gcGFzcyBkYXRhMS9kYXRhMiBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0IChubyBjb3B5KVxuICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSwgW29iakRhdGEuZGF0YTEsIG9iakRhdGEuZGF0YTJdKTtcbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub24oRXZlbnQuRlJBR19QQVJTRUQsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgc2VsZi5wb3N0TWVzc2FnZSh7ZXZlbnQ6IGV2ZW50fSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkVSUk9SLCBmdW5jdGlvbihldmVudCwgZGF0YSkge1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uoe2V2ZW50OiBldmVudCwgZGF0YTogZGF0YX0pO1xuICB9KTtcblxuICBvYnNlcnZlci5vbihFdmVudC5GUkFHX1BBUlNJTkdfTUVUQURBVEEsIGZ1bmN0aW9uKGV2ZW50LCBkYXRhKSB7XG4gICAgdmFyIG9iakRhdGEgPSB7ZXZlbnQ6IGV2ZW50LCBzYW1wbGVzOiBkYXRhLnNhbXBsZXN9O1xuICAgIHNlbGYucG9zdE1lc3NhZ2Uob2JqRGF0YSk7XG4gIH0pO1xuXG4gIG9ic2VydmVyLm9uKEV2ZW50LkZSQUdfUEFSU0lOR19VU0VSREFUQSwgZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgb2JqRGF0YSA9IHtldmVudDogZXZlbnQsIHNhbXBsZXM6IGRhdGEuc2FtcGxlc307XG4gICAgc2VsZi5wb3N0TWVzc2FnZShvYmpEYXRhKTtcbiAgfSk7XG5cbn07XG5cbmV4cG9ydCBkZWZhdWx0IERlbXV4ZXJXb3JrZXI7XG5cbiIsImltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IERlbXV4ZXJJbmxpbmUgZnJvbSAnLi4vZGVtdXgvZGVtdXhlci1pbmxpbmUnO1xuaW1wb3J0IERlbXV4ZXJXb3JrZXIgZnJvbSAnLi4vZGVtdXgvZGVtdXhlci13b3JrZXInO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgRGVjcnlwdGVyIGZyb20gJy4uL2NyeXB0L2RlY3J5cHRlcic7XG5cbmNsYXNzIERlbXV4ZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHZhciB0eXBlU3VwcG9ydGVkID0ge1xuICAgICAgbXA0IDogTWVkaWFTb3VyY2UuaXNUeXBlU3VwcG9ydGVkKCd2aWRlby9tcDQnKSxcbiAgICAgIG1wMnQgOiBobHMuY29uZmlnLmVuYWJsZU1QMlRQYXNzVGhyb3VnaCAmJiBNZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoJ3ZpZGVvL21wMnQnKVxuICAgIH07XG4gICAgaWYgKGhscy5jb25maWcuZW5hYmxlV29ya2VyICYmICh0eXBlb2YoV29ya2VyKSAhPT0gJ3VuZGVmaW5lZCcpKSB7XG4gICAgICAgIGxvZ2dlci5sb2coJ2RlbXV4aW5nIGluIHdlYndvcmtlcicpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIHZhciB3b3JrID0gcmVxdWlyZSgnd2Vid29ya2lmeScpO1xuICAgICAgICAgIHRoaXMudyA9IHdvcmsoRGVtdXhlcldvcmtlcik7XG4gICAgICAgICAgdGhpcy5vbndtc2cgPSB0aGlzLm9uV29ya2VyTWVzc2FnZS5iaW5kKHRoaXMpO1xuICAgICAgICAgIHRoaXMudy5hZGRFdmVudExpc3RlbmVyKCdtZXNzYWdlJywgdGhpcy5vbndtc2cpO1xuICAgICAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7Y21kOiAnaW5pdCcsIHR5cGVTdXBwb3J0ZWQgOiB0eXBlU3VwcG9ydGVkfSk7XG4gICAgICAgIH0gY2F0Y2goZXJyKSB7XG4gICAgICAgICAgbG9nZ2VyLmVycm9yKCdlcnJvciB3aGlsZSBpbml0aWFsaXppbmcgRGVtdXhlcldvcmtlciwgZmFsbGJhY2sgb24gRGVtdXhlcklubGluZScpO1xuICAgICAgICAgIHRoaXMuZGVtdXhlciA9IG5ldyBEZW11eGVySW5saW5lKGhscyx0eXBlU3VwcG9ydGVkKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5kZW11eGVyID0gbmV3IERlbXV4ZXJJbmxpbmUoaGxzLHR5cGVTdXBwb3J0ZWQpO1xuICAgICAgfVxuICAgICAgdGhpcy5kZW11eEluaXRpYWxpemVkID0gdHJ1ZTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMudykge1xuICAgICAgdGhpcy53LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ21lc3NhZ2UnLCB0aGlzLm9ud21zZyk7XG4gICAgICB0aGlzLncudGVybWluYXRlKCk7XG4gICAgICB0aGlzLncgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmRlbXV4ZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5kZW11eGVyID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHRoaXMuZGVjcnlwdGVyKSB7XG4gICAgICB0aGlzLmRlY3J5cHRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmRlY3J5cHRlciA9IG51bGw7XG4gICAgfVxuICB9XG5cbiAgcHVzaERlY3J5cHRlZChkYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbikge1xuICAgIGlmICh0aGlzLncpIHtcbiAgICAgIC8vIHBvc3QgZnJhZ21lbnQgcGF5bG9hZCBhcyB0cmFuc2ZlcmFibGUgb2JqZWN0cyAobm8gY29weSlcbiAgICAgIHRoaXMudy5wb3N0TWVzc2FnZSh7Y21kOiAnZGVtdXgnLCBkYXRhOiBkYXRhLCBhdWRpb0NvZGVjOiBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjOiB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0OiB0aW1lT2Zmc2V0LCBjYzogY2MsIGxldmVsOiBsZXZlbCwgc24gOiBzbiwgZHVyYXRpb246IGR1cmF0aW9ufSwgW2RhdGFdKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5kZW11eGVyLnB1c2gobmV3IFVpbnQ4QXJyYXkoZGF0YSksIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uKTtcbiAgICB9XG4gIH1cblxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uLCBkZWNyeXB0ZGF0YSkge1xuICAgIGlmICgoZGF0YS5ieXRlTGVuZ3RoID4gMCkgJiYgKGRlY3J5cHRkYXRhICE9IG51bGwpICYmIChkZWNyeXB0ZGF0YS5rZXkgIT0gbnVsbCkgJiYgKGRlY3J5cHRkYXRhLm1ldGhvZCA9PT0gJ0FFUy0xMjgnKSkge1xuICAgICAgaWYgKHRoaXMuZGVjcnlwdGVyID09IG51bGwpIHtcbiAgICAgICAgdGhpcy5kZWNyeXB0ZXIgPSBuZXcgRGVjcnlwdGVyKHRoaXMuaGxzKTtcbiAgICAgIH1cblxuICAgICAgdmFyIGxvY2FsdGhpcyA9IHRoaXM7XG4gICAgICB0aGlzLmRlY3J5cHRlci5kZWNyeXB0KGRhdGEsIGRlY3J5cHRkYXRhLmtleSwgZGVjcnlwdGRhdGEuaXYsIGZ1bmN0aW9uKGRlY3J5cHRlZERhdGEpe1xuICAgICAgICBsb2NhbHRoaXMucHVzaERlY3J5cHRlZChkZWNyeXB0ZWREYXRhLCBhdWRpb0NvZGVjLCB2aWRlb0NvZGVjLCB0aW1lT2Zmc2V0LCBjYywgbGV2ZWwsIHNuLCBkdXJhdGlvbik7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wdXNoRGVjcnlwdGVkKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uKTtcbiAgICB9XG4gIH1cblxuICBvbldvcmtlck1lc3NhZ2UoZXYpIHtcbiAgICB2YXIgZGF0YSA9IGV2LmRhdGE7XG4gICAgLy9jb25zb2xlLmxvZygnb25Xb3JrZXJNZXNzYWdlOicgKyBkYXRhLmV2ZW50KTtcbiAgICBzd2l0Y2goZGF0YS5ldmVudCkge1xuICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfSU5JVF9TRUdNRU5UOlxuICAgICAgICB2YXIgb2JqID0ge307XG4gICAgICAgIG9iai50cmFja3MgPSBkYXRhLnRyYWNrcztcbiAgICAgICAgb2JqLnVuaXF1ZSA9IGRhdGEudW5pcXVlO1xuICAgICAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsIG9iaik7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfREFUQTpcbiAgICAgICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfREFUQSx7XG4gICAgICAgICAgZGF0YTE6IG5ldyBVaW50OEFycmF5KGRhdGEuZGF0YTEpLFxuICAgICAgICAgIGRhdGEyOiBuZXcgVWludDhBcnJheShkYXRhLmRhdGEyKSxcbiAgICAgICAgICBzdGFydFBUUzogZGF0YS5zdGFydFBUUyxcbiAgICAgICAgICBlbmRQVFM6IGRhdGEuZW5kUFRTLFxuICAgICAgICAgIHN0YXJ0RFRTOiBkYXRhLnN0YXJ0RFRTLFxuICAgICAgICAgIGVuZERUUzogZGF0YS5lbmREVFMsXG4gICAgICAgICAgdHlwZTogZGF0YS50eXBlLFxuICAgICAgICAgIG5iOiBkYXRhLm5iXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfTUVUQURBVEE6XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX01FVEFEQVRBLCB7XG4gICAgICAgICAgc2FtcGxlczogZGF0YS5zYW1wbGVzXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSBFdmVudC5GUkFHX1BBUlNJTkdfVVNFUkRBVEE6XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX1VTRVJEQVRBLCB7XG4gICAgICAgICAgc2FtcGxlczogZGF0YS5zYW1wbGVzXG4gICAgICAgIH0pO1xuICAgICAgICBicmVhaztcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoZGF0YS5ldmVudCwgZGF0YS5kYXRhKTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IERlbXV4ZXI7XG5cbiIsIi8qKlxuICogUGFyc2VyIGZvciBleHBvbmVudGlhbCBHb2xvbWIgY29kZXMsIGEgdmFyaWFibGUtYml0d2lkdGggbnVtYmVyIGVuY29kaW5nIHNjaGVtZSB1c2VkIGJ5IGgyNjQuXG4qL1xuXG5pbXBvcnQge2xvZ2dlcn0gZnJvbSAnLi4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgRXhwR29sb21iIHtcblxuICBjb25zdHJ1Y3RvcihkYXRhKSB7XG4gICAgdGhpcy5kYXRhID0gZGF0YTtcbiAgICAvLyB0aGUgbnVtYmVyIG9mIGJ5dGVzIGxlZnQgdG8gZXhhbWluZSBpbiB0aGlzLmRhdGFcbiAgICB0aGlzLmJ5dGVzQXZhaWxhYmxlID0gdGhpcy5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgLy8gdGhlIGN1cnJlbnQgd29yZCBiZWluZyBleGFtaW5lZFxuICAgIHRoaXMud29yZCA9IDA7IC8vIDp1aW50XG4gICAgLy8gdGhlIG51bWJlciBvZiBiaXRzIGxlZnQgdG8gZXhhbWluZSBpbiB0aGUgY3VycmVudCB3b3JkXG4gICAgdGhpcy5iaXRzQXZhaWxhYmxlID0gMDsgLy8gOnVpbnRcbiAgfVxuXG4gIC8vICgpOnZvaWRcbiAgbG9hZFdvcmQoKSB7XG4gICAgdmFyXG4gICAgICBwb3NpdGlvbiA9IHRoaXMuZGF0YS5ieXRlTGVuZ3RoIC0gdGhpcy5ieXRlc0F2YWlsYWJsZSxcbiAgICAgIHdvcmtpbmdCeXRlcyA9IG5ldyBVaW50OEFycmF5KDQpLFxuICAgICAgYXZhaWxhYmxlQnl0ZXMgPSBNYXRoLm1pbig0LCB0aGlzLmJ5dGVzQXZhaWxhYmxlKTtcbiAgICBpZiAoYXZhaWxhYmxlQnl0ZXMgPT09IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignbm8gYnl0ZXMgYXZhaWxhYmxlJyk7XG4gICAgfVxuICAgIHdvcmtpbmdCeXRlcy5zZXQodGhpcy5kYXRhLnN1YmFycmF5KHBvc2l0aW9uLCBwb3NpdGlvbiArIGF2YWlsYWJsZUJ5dGVzKSk7XG4gICAgdGhpcy53b3JkID0gbmV3IERhdGFWaWV3KHdvcmtpbmdCeXRlcy5idWZmZXIpLmdldFVpbnQzMigwKTtcbiAgICAvLyB0cmFjayB0aGUgYW1vdW50IG9mIHRoaXMuZGF0YSB0aGF0IGhhcyBiZWVuIHByb2Nlc3NlZFxuICAgIHRoaXMuYml0c0F2YWlsYWJsZSA9IGF2YWlsYWJsZUJ5dGVzICogODtcbiAgICB0aGlzLmJ5dGVzQXZhaWxhYmxlIC09IGF2YWlsYWJsZUJ5dGVzO1xuICB9XG5cbiAgLy8gKGNvdW50OmludCk6dm9pZFxuICBza2lwQml0cyhjb3VudCkge1xuICAgIHZhciBza2lwQnl0ZXM7IC8vIDppbnRcbiAgICBpZiAodGhpcy5iaXRzQXZhaWxhYmxlID4gY291bnQpIHtcbiAgICAgIHRoaXMud29yZCA8PD0gY291bnQ7XG4gICAgICB0aGlzLmJpdHNBdmFpbGFibGUgLT0gY291bnQ7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvdW50IC09IHRoaXMuYml0c0F2YWlsYWJsZTtcbiAgICAgIHNraXBCeXRlcyA9IGNvdW50ID4+IDM7XG4gICAgICBjb3VudCAtPSAoc2tpcEJ5dGVzID4+IDMpO1xuICAgICAgdGhpcy5ieXRlc0F2YWlsYWJsZSAtPSBza2lwQnl0ZXM7XG4gICAgICB0aGlzLmxvYWRXb3JkKCk7XG4gICAgICB0aGlzLndvcmQgPDw9IGNvdW50O1xuICAgICAgdGhpcy5iaXRzQXZhaWxhYmxlIC09IGNvdW50O1xuICAgIH1cbiAgfVxuXG4gIC8vIChzaXplOmludCk6dWludFxuICByZWFkQml0cyhzaXplKSB7XG4gICAgdmFyXG4gICAgICBiaXRzID0gTWF0aC5taW4odGhpcy5iaXRzQXZhaWxhYmxlLCBzaXplKSwgLy8gOnVpbnRcbiAgICAgIHZhbHUgPSB0aGlzLndvcmQgPj4+ICgzMiAtIGJpdHMpOyAvLyA6dWludFxuICAgIGlmIChzaXplID4gMzIpIHtcbiAgICAgIGxvZ2dlci5lcnJvcignQ2Fubm90IHJlYWQgbW9yZSB0aGFuIDMyIGJpdHMgYXQgYSB0aW1lJyk7XG4gICAgfVxuICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBiaXRzO1xuICAgIGlmICh0aGlzLmJpdHNBdmFpbGFibGUgPiAwKSB7XG4gICAgICB0aGlzLndvcmQgPDw9IGJpdHM7XG4gICAgfSBlbHNlIGlmICh0aGlzLmJ5dGVzQXZhaWxhYmxlID4gMCkge1xuICAgICAgdGhpcy5sb2FkV29yZCgpO1xuICAgIH1cbiAgICBiaXRzID0gc2l6ZSAtIGJpdHM7XG4gICAgaWYgKGJpdHMgPiAwKSB7XG4gICAgICByZXR1cm4gdmFsdSA8PCBiaXRzIHwgdGhpcy5yZWFkQml0cyhiaXRzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHZhbHU7XG4gICAgfVxuICB9XG5cbiAgLy8gKCk6dWludFxuICBza2lwTFooKSB7XG4gICAgdmFyIGxlYWRpbmdaZXJvQ291bnQ7IC8vIDp1aW50XG4gICAgZm9yIChsZWFkaW5nWmVyb0NvdW50ID0gMDsgbGVhZGluZ1plcm9Db3VudCA8IHRoaXMuYml0c0F2YWlsYWJsZTsgKytsZWFkaW5nWmVyb0NvdW50KSB7XG4gICAgICBpZiAoMCAhPT0gKHRoaXMud29yZCAmICgweDgwMDAwMDAwID4+PiBsZWFkaW5nWmVyb0NvdW50KSkpIHtcbiAgICAgICAgLy8gdGhlIGZpcnN0IGJpdCBvZiB3b3JraW5nIHdvcmQgaXMgMVxuICAgICAgICB0aGlzLndvcmQgPDw9IGxlYWRpbmdaZXJvQ291bnQ7XG4gICAgICAgIHRoaXMuYml0c0F2YWlsYWJsZSAtPSBsZWFkaW5nWmVyb0NvdW50O1xuICAgICAgICByZXR1cm4gbGVhZGluZ1plcm9Db3VudDtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gd2UgZXhoYXVzdGVkIHdvcmQgYW5kIHN0aWxsIGhhdmUgbm90IGZvdW5kIGEgMVxuICAgIHRoaXMubG9hZFdvcmQoKTtcbiAgICByZXR1cm4gbGVhZGluZ1plcm9Db3VudCArIHRoaXMuc2tpcExaKCk7XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIHNraXBVRUcoKSB7XG4gICAgdGhpcy5za2lwQml0cygxICsgdGhpcy5za2lwTFooKSk7XG4gIH1cblxuICAvLyAoKTp2b2lkXG4gIHNraXBFRygpIHtcbiAgICB0aGlzLnNraXBCaXRzKDEgKyB0aGlzLnNraXBMWigpKTtcbiAgfVxuXG4gIC8vICgpOnVpbnRcbiAgcmVhZFVFRygpIHtcbiAgICB2YXIgY2x6ID0gdGhpcy5za2lwTFooKTsgLy8gOnVpbnRcbiAgICByZXR1cm4gdGhpcy5yZWFkQml0cyhjbHogKyAxKSAtIDE7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZEVHKCkge1xuICAgIHZhciB2YWx1ID0gdGhpcy5yZWFkVUVHKCk7IC8vIDppbnRcbiAgICBpZiAoMHgwMSAmIHZhbHUpIHtcbiAgICAgIC8vIHRoZSBudW1iZXIgaXMgb2RkIGlmIHRoZSBsb3cgb3JkZXIgYml0IGlzIHNldFxuICAgICAgcmV0dXJuICgxICsgdmFsdSkgPj4+IDE7IC8vIGFkZCAxIHRvIG1ha2UgaXQgZXZlbiwgYW5kIGRpdmlkZSBieSAyXG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAtMSAqICh2YWx1ID4+PiAxKTsgLy8gZGl2aWRlIGJ5IHR3byB0aGVuIG1ha2UgaXQgbmVnYXRpdmVcbiAgICB9XG4gIH1cblxuICAvLyBTb21lIGNvbnZlbmllbmNlIGZ1bmN0aW9uc1xuICAvLyA6Qm9vbGVhblxuICByZWFkQm9vbGVhbigpIHtcbiAgICByZXR1cm4gMSA9PT0gdGhpcy5yZWFkQml0cygxKTtcbiAgfVxuXG4gIC8vICgpOmludFxuICByZWFkVUJ5dGUoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoOCk7XG4gIH1cblxuICAvLyAoKTppbnRcbiAgcmVhZFVTaG9ydCgpIHtcbiAgICByZXR1cm4gdGhpcy5yZWFkQml0cygxNik7XG4gIH1cbiAgICAvLyAoKTppbnRcbiAgcmVhZFVJbnQoKSB7XG4gICAgcmV0dXJuIHRoaXMucmVhZEJpdHMoMzIpO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkdmFuY2UgdGhlIEV4cEdvbG9tYiBkZWNvZGVyIHBhc3QgYSBzY2FsaW5nIGxpc3QuIFRoZSBzY2FsaW5nXG4gICAqIGxpc3QgaXMgb3B0aW9uYWxseSB0cmFuc21pdHRlZCBhcyBwYXJ0IG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyXG4gICAqIHNldCBhbmQgaXMgbm90IHJlbGV2YW50IHRvIHRyYW5zbXV4aW5nLlxuICAgKiBAcGFyYW0gY291bnQge251bWJlcn0gdGhlIG51bWJlciBvZiBlbnRyaWVzIGluIHRoaXMgc2NhbGluZyBsaXN0XG4gICAqIEBzZWUgUmVjb21tZW5kYXRpb24gSVRVLVQgSC4yNjQsIFNlY3Rpb24gNy4zLjIuMS4xLjFcbiAgICovXG4gIHNraXBTY2FsaW5nTGlzdChjb3VudCkge1xuICAgIHZhclxuICAgICAgbGFzdFNjYWxlID0gOCxcbiAgICAgIG5leHRTY2FsZSA9IDgsXG4gICAgICBqLFxuICAgICAgZGVsdGFTY2FsZTtcbiAgICBmb3IgKGogPSAwOyBqIDwgY291bnQ7IGorKykge1xuICAgICAgaWYgKG5leHRTY2FsZSAhPT0gMCkge1xuICAgICAgICBkZWx0YVNjYWxlID0gdGhpcy5yZWFkRUcoKTtcbiAgICAgICAgbmV4dFNjYWxlID0gKGxhc3RTY2FsZSArIGRlbHRhU2NhbGUgKyAyNTYpICUgMjU2O1xuICAgICAgfVxuICAgICAgbGFzdFNjYWxlID0gKG5leHRTY2FsZSA9PT0gMCkgPyBsYXN0U2NhbGUgOiBuZXh0U2NhbGU7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlYWQgYSBzZXF1ZW5jZSBwYXJhbWV0ZXIgc2V0IGFuZCByZXR1cm4gc29tZSBpbnRlcmVzdGluZyB2aWRlb1xuICAgKiBwcm9wZXJ0aWVzLiBBIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQgaXMgdGhlIEgyNjQgbWV0YWRhdGEgdGhhdFxuICAgKiBkZXNjcmliZXMgdGhlIHByb3BlcnRpZXMgb2YgdXBjb21pbmcgdmlkZW8gZnJhbWVzLlxuICAgKiBAcGFyYW0gZGF0YSB7VWludDhBcnJheX0gdGhlIGJ5dGVzIG9mIGEgc2VxdWVuY2UgcGFyYW1ldGVyIHNldFxuICAgKiBAcmV0dXJuIHtvYmplY3R9IGFuIG9iamVjdCB3aXRoIGNvbmZpZ3VyYXRpb24gcGFyc2VkIGZyb20gdGhlXG4gICAqIHNlcXVlbmNlIHBhcmFtZXRlciBzZXQsIGluY2x1ZGluZyB0aGUgZGltZW5zaW9ucyBvZiB0aGVcbiAgICogYXNzb2NpYXRlZCB2aWRlbyBmcmFtZXMuXG4gICAqL1xuICByZWFkU1BTKCkge1xuICAgIHZhclxuICAgICAgZnJhbWVDcm9wTGVmdE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BSaWdodE9mZnNldCA9IDAsXG4gICAgICBmcmFtZUNyb3BUb3BPZmZzZXQgPSAwLFxuICAgICAgZnJhbWVDcm9wQm90dG9tT2Zmc2V0ID0gMCxcbiAgICAgIHNhclNjYWxlID0gMSxcbiAgICAgIHByb2ZpbGVJZGMscHJvZmlsZUNvbXBhdCxsZXZlbElkYyxcbiAgICAgIG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZSwgcGljV2lkdGhJbk1ic01pbnVzMSxcbiAgICAgIHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEsXG4gICAgICBmcmFtZU1ic09ubHlGbGFnLFxuICAgICAgc2NhbGluZ0xpc3RDb3VudCxcbiAgICAgIGk7XG4gICAgdGhpcy5yZWFkVUJ5dGUoKTtcbiAgICBwcm9maWxlSWRjID0gdGhpcy5yZWFkVUJ5dGUoKTsgLy8gcHJvZmlsZV9pZGNcbiAgICBwcm9maWxlQ29tcGF0ID0gdGhpcy5yZWFkQml0cyg1KTsgLy8gY29uc3RyYWludF9zZXRbMC00XV9mbGFnLCB1KDUpXG4gICAgdGhpcy5za2lwQml0cygzKTsgLy8gcmVzZXJ2ZWRfemVyb18zYml0cyB1KDMpLFxuICAgIGxldmVsSWRjID0gdGhpcy5yZWFkVUJ5dGUoKTsgLy9sZXZlbF9pZGMgdSg4KVxuICAgIHRoaXMuc2tpcFVFRygpOyAvLyBzZXFfcGFyYW1ldGVyX3NldF9pZFxuICAgIC8vIHNvbWUgcHJvZmlsZXMgaGF2ZSBtb3JlIG9wdGlvbmFsIGRhdGEgd2UgZG9uJ3QgbmVlZFxuICAgIGlmIChwcm9maWxlSWRjID09PSAxMDAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTEwIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDEyMiB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSAyNDQgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gNDQgIHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDgzICB8fFxuICAgICAgICBwcm9maWxlSWRjID09PSA4NiAgfHxcbiAgICAgICAgcHJvZmlsZUlkYyA9PT0gMTE4IHx8XG4gICAgICAgIHByb2ZpbGVJZGMgPT09IDEyOCkge1xuICAgICAgdmFyIGNocm9tYUZvcm1hdElkYyA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgaWYgKGNocm9tYUZvcm1hdElkYyA9PT0gMykge1xuICAgICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBzZXBhcmF0ZV9jb2xvdXJfcGxhbmVfZmxhZ1xuICAgICAgfVxuICAgICAgdGhpcy5za2lwVUVHKCk7IC8vIGJpdF9kZXB0aF9sdW1hX21pbnVzOFxuICAgICAgdGhpcy5za2lwVUVHKCk7IC8vIGJpdF9kZXB0aF9jaHJvbWFfbWludXM4XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBxcHByaW1lX3lfemVyb190cmFuc2Zvcm1fYnlwYXNzX2ZsYWdcbiAgICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gc2VxX3NjYWxpbmdfbWF0cml4X3ByZXNlbnRfZmxhZ1xuICAgICAgICBzY2FsaW5nTGlzdENvdW50ID0gKGNocm9tYUZvcm1hdElkYyAhPT0gMykgPyA4IDogMTI7XG4gICAgICAgIGZvciAoaSA9IDA7IGkgPCBzY2FsaW5nTGlzdENvdW50OyBpKyspIHtcbiAgICAgICAgICBpZiAodGhpcy5yZWFkQm9vbGVhbigpKSB7IC8vIHNlcV9zY2FsaW5nX2xpc3RfcHJlc2VudF9mbGFnWyBpIF1cbiAgICAgICAgICAgIGlmIChpIDwgNikge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCgxNik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICB0aGlzLnNraXBTY2FsaW5nTGlzdCg2NCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMuc2tpcFVFRygpOyAvLyBsb2cyX21heF9mcmFtZV9udW1fbWludXM0XG4gICAgdmFyIHBpY09yZGVyQ250VHlwZSA9IHRoaXMucmVhZFVFRygpO1xuICAgIGlmIChwaWNPcmRlckNudFR5cGUgPT09IDApIHtcbiAgICAgIHRoaXMucmVhZFVFRygpOyAvL2xvZzJfbWF4X3BpY19vcmRlcl9jbnRfbHNiX21pbnVzNFxuICAgIH0gZWxzZSBpZiAocGljT3JkZXJDbnRUeXBlID09PSAxKSB7XG4gICAgICB0aGlzLnNraXBCaXRzKDEpOyAvLyBkZWx0YV9waWNfb3JkZXJfYWx3YXlzX3plcm9fZmxhZ1xuICAgICAgdGhpcy5za2lwRUcoKTsgLy8gb2Zmc2V0X2Zvcl9ub25fcmVmX3BpY1xuICAgICAgdGhpcy5za2lwRUcoKTsgLy8gb2Zmc2V0X2Zvcl90b3BfdG9fYm90dG9tX2ZpZWxkXG4gICAgICBudW1SZWZGcmFtZXNJblBpY09yZGVyQ250Q3ljbGUgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZvcihpID0gMDsgaSA8IG51bVJlZkZyYW1lc0luUGljT3JkZXJDbnRDeWNsZTsgaSsrKSB7XG4gICAgICAgIHRoaXMuc2tpcEVHKCk7IC8vIG9mZnNldF9mb3JfcmVmX2ZyYW1lWyBpIF1cbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy5za2lwVUVHKCk7IC8vIG1heF9udW1fcmVmX2ZyYW1lc1xuICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIGdhcHNfaW5fZnJhbWVfbnVtX3ZhbHVlX2FsbG93ZWRfZmxhZ1xuICAgIHBpY1dpZHRoSW5NYnNNaW51czEgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICBwaWNIZWlnaHRJbk1hcFVuaXRzTWludXMxID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgZnJhbWVNYnNPbmx5RmxhZyA9IHRoaXMucmVhZEJpdHMoMSk7XG4gICAgaWYgKGZyYW1lTWJzT25seUZsYWcgPT09IDApIHtcbiAgICAgIHRoaXMuc2tpcEJpdHMoMSk7IC8vIG1iX2FkYXB0aXZlX2ZyYW1lX2ZpZWxkX2ZsYWdcbiAgICB9XG4gICAgdGhpcy5za2lwQml0cygxKTsgLy8gZGlyZWN0Xzh4OF9pbmZlcmVuY2VfZmxhZ1xuICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHsgLy8gZnJhbWVfY3JvcHBpbmdfZmxhZ1xuICAgICAgZnJhbWVDcm9wTGVmdE9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZnJhbWVDcm9wUmlnaHRPZmZzZXQgPSB0aGlzLnJlYWRVRUcoKTtcbiAgICAgIGZyYW1lQ3JvcFRvcE9mZnNldCA9IHRoaXMucmVhZFVFRygpO1xuICAgICAgZnJhbWVDcm9wQm90dG9tT2Zmc2V0ID0gdGhpcy5yZWFkVUVHKCk7XG4gICAgfVxuICAgIGlmICh0aGlzLnJlYWRCb29sZWFuKCkpIHtcbiAgICAgIC8vIHZ1aV9wYXJhbWV0ZXJzX3ByZXNlbnRfZmxhZ1xuICAgICAgaWYgKHRoaXMucmVhZEJvb2xlYW4oKSkge1xuICAgICAgICAvLyBhc3BlY3RfcmF0aW9faW5mb19wcmVzZW50X2ZsYWdcbiAgICAgICAgbGV0IHNhclJhdGlvO1xuICAgICAgICBjb25zdCBhc3BlY3RSYXRpb0lkYyA9IHRoaXMucmVhZFVCeXRlKCk7XG4gICAgICAgIHN3aXRjaCAoYXNwZWN0UmF0aW9JZGMpIHtcbiAgICAgICAgICBjYXNlIDE6IHNhclJhdGlvID0gWzEsMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMjogc2FyUmF0aW8gPSBbMTIsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDM6IHNhclJhdGlvID0gWzEwLDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA0OiBzYXJSYXRpbyA9IFsxNiwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgNTogc2FyUmF0aW8gPSBbNDAsMzNdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDY6IHNhclJhdGlvID0gWzI0LDExXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSA3OiBzYXJSYXRpbyA9IFsyMCwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgODogc2FyUmF0aW8gPSBbMzIsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDk6IHNhclJhdGlvID0gWzgwLDMzXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxMDogc2FyUmF0aW8gPSBbMTgsMTFdOyBicmVhaztcbiAgICAgICAgICBjYXNlIDExOiBzYXJSYXRpbyA9IFsxNSwxMV07IGJyZWFrO1xuICAgICAgICAgIGNhc2UgMTI6IHNhclJhdGlvID0gWzY0LDMzXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxMzogc2FyUmF0aW8gPSBbMTYwLDk5XTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxNDogc2FyUmF0aW8gPSBbNCwzXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxNTogc2FyUmF0aW8gPSBbMywyXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAxNjogc2FyUmF0aW8gPSBbMiwxXTsgYnJlYWs7XG4gICAgICAgICAgY2FzZSAyNTU6IHtcbiAgICAgICAgICAgIHNhclJhdGlvID0gW3RoaXMucmVhZFVCeXRlKCkgPDwgOCB8IHRoaXMucmVhZFVCeXRlKCksIHRoaXMucmVhZFVCeXRlKCkgPDwgOCB8IHRoaXMucmVhZFVCeXRlKCldO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmIChzYXJSYXRpbykge1xuICAgICAgICAgIHNhclNjYWxlID0gc2FyUmF0aW9bMF0gLyBzYXJSYXRpb1sxXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgd2lkdGg6IE1hdGguY2VpbCgoKChwaWNXaWR0aEluTWJzTWludXMxICsgMSkgKiAxNikgLSBmcmFtZUNyb3BMZWZ0T2Zmc2V0ICogMiAtIGZyYW1lQ3JvcFJpZ2h0T2Zmc2V0ICogMikgKiBzYXJTY2FsZSksXG4gICAgICBoZWlnaHQ6ICgoMiAtIGZyYW1lTWJzT25seUZsYWcpICogKHBpY0hlaWdodEluTWFwVW5pdHNNaW51czEgKyAxKSAqIDE2KSAtICgoZnJhbWVNYnNPbmx5RmxhZz8gMiA6IDQpICogKGZyYW1lQ3JvcFRvcE9mZnNldCArIGZyYW1lQ3JvcEJvdHRvbU9mZnNldCkpXG4gICAgfTtcbiAgfVxuXG4gIHJlYWRTbGljZVR5cGUoKSB7XG4gICAgLy8gc2tpcCBOQUx1IHR5cGVcbiAgICB0aGlzLnJlYWRVQnl0ZSgpO1xuICAgIC8vIGRpc2NhcmQgZmlyc3RfbWJfaW5fc2xpY2VcbiAgICB0aGlzLnJlYWRVRUcoKTtcbiAgICAvLyByZXR1cm4gc2xpY2VfdHlwZVxuICAgIHJldHVybiB0aGlzLnJlYWRVRUcoKTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBFeHBHb2xvbWI7XG4iLCIvKipcbiAqIElEMyBwYXJzZXJcbiAqL1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG4vL2ltcG9ydCBIZXggZnJvbSAnLi4vdXRpbHMvaGV4JztcblxuIGNsYXNzIElEMyB7XG5cbiAgY29uc3RydWN0b3IoZGF0YSkge1xuICAgIHRoaXMuX2hhc1RpbWVTdGFtcCA9IGZhbHNlO1xuICAgIHZhciBvZmZzZXQgPSAwLCBieXRlMSxieXRlMixieXRlMyxieXRlNCx0YWdTaXplLGVuZFBvcyxoZWFkZXIsbGVuO1xuICAgICAgZG8ge1xuICAgICAgICBoZWFkZXIgPSB0aGlzLnJlYWRVVEYoZGF0YSxvZmZzZXQsMyk7XG4gICAgICAgIG9mZnNldCs9MztcbiAgICAgICAgICAvLyBmaXJzdCBjaGVjayBmb3IgSUQzIGhlYWRlclxuICAgICAgICAgIGlmIChoZWFkZXIgPT09ICdJRDMnKSB7XG4gICAgICAgICAgICAgIC8vIHNraXAgMjQgYml0c1xuICAgICAgICAgICAgICBvZmZzZXQgKz0gMztcbiAgICAgICAgICAgICAgLy8gcmV0cmlldmUgdGFnKHMpIGxlbmd0aFxuICAgICAgICAgICAgICBieXRlMSA9IGRhdGFbb2Zmc2V0KytdICYgMHg3ZjtcbiAgICAgICAgICAgICAgYnl0ZTIgPSBkYXRhW29mZnNldCsrXSAmIDB4N2Y7XG4gICAgICAgICAgICAgIGJ5dGUzID0gZGF0YVtvZmZzZXQrK10gJiAweDdmO1xuICAgICAgICAgICAgICBieXRlNCA9IGRhdGFbb2Zmc2V0KytdICYgMHg3ZjtcbiAgICAgICAgICAgICAgdGFnU2l6ZSA9IChieXRlMSA8PCAyMSkgKyAoYnl0ZTIgPDwgMTQpICsgKGJ5dGUzIDw8IDcpICsgYnl0ZTQ7XG4gICAgICAgICAgICAgIGVuZFBvcyA9IG9mZnNldCArIHRhZ1NpemU7XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZyhgSUQzIHRhZyBmb3VuZCwgc2l6ZS9lbmQ6ICR7dGFnU2l6ZX0vJHtlbmRQb3N9YCk7XG5cbiAgICAgICAgICAgICAgLy8gcmVhZCBJRDMgdGFnc1xuICAgICAgICAgICAgICB0aGlzLl9wYXJzZUlEM0ZyYW1lcyhkYXRhLCBvZmZzZXQsZW5kUG9zKTtcbiAgICAgICAgICAgICAgb2Zmc2V0ID0gZW5kUG9zO1xuICAgICAgICAgIH0gZWxzZSBpZiAoaGVhZGVyID09PSAnM0RJJykge1xuICAgICAgICAgICAgICAvLyBodHRwOi8vaWQzLm9yZy9pZDN2Mi40LjAtc3RydWN0dXJlIGNoYXB0ZXIgMy40LiAgIElEM3YyIGZvb3RlclxuICAgICAgICAgICAgICBvZmZzZXQgKz0gNztcbiAgICAgICAgICAgICAgICAgIGxvZ2dlci5sb2coYDNESSBmb290ZXIgZm91bmQsIGVuZDogJHtvZmZzZXR9YCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgb2Zmc2V0IC09IDM7XG4gICAgICAgICAgICAgIGxlbiA9IG9mZnNldDtcbiAgICAgICAgICAgICAgICAgIGlmIChsZW4pIHtcbiAgICAgICAgICAgICAgICAgICAgICAvL2xvZ2dlci5sb2coYElEMyBsZW46ICR7bGVufWApO1xuICAgICAgICAgICAgICAgICAgICAgIGlmICghdGhpcy5oYXNUaW1lU3RhbXApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbG9nZ2VyLndhcm4oJ0lEMyB0YWcgZm91bmQsIGJ1dCBubyB0aW1lc3RhbXAnKTtcbiAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgdGhpcy5fbGVuZ3RoID0gbGVuO1xuICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX3BheWxvYWQgPSBkYXRhLnN1YmFycmF5KDAsbGVuKTtcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cbiAgICAgIH0gd2hpbGUgKHRydWUpO1xuICB9XG5cbiAgcmVhZFVURihkYXRhLHN0YXJ0LGxlbikge1xuXG4gICAgdmFyIHJlc3VsdCA9ICcnLG9mZnNldCA9IHN0YXJ0LCBlbmQgPSBzdGFydCArIGxlbjtcbiAgICBkbyB7XG4gICAgICByZXN1bHQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZShkYXRhW29mZnNldCsrXSk7XG4gICAgfSB3aGlsZShvZmZzZXQgPCBlbmQpO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBfcGFyc2VJRDNGcmFtZXMoZGF0YSxvZmZzZXQsZW5kUG9zKSB7XG4gICAgdmFyIHRhZ0lkLHRhZ0xlbix0YWdTdGFydCx0YWdGbGFncyx0aW1lc3RhbXA7XG4gICAgd2hpbGUob2Zmc2V0ICsgOCA8PSBlbmRQb3MpIHtcbiAgICAgIHRhZ0lkID0gdGhpcy5yZWFkVVRGKGRhdGEsb2Zmc2V0LDQpO1xuICAgICAgb2Zmc2V0ICs9NDtcblxuICAgICAgdGFnTGVuID0gZGF0YVtvZmZzZXQrK10gPDwgMjQgK1xuICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdIDw8IDE2ICtcbiAgICAgICAgICAgICAgICBkYXRhW29mZnNldCsrXSA8PCA4ICtcbiAgICAgICAgICAgICAgICBkYXRhW29mZnNldCsrXTtcblxuICAgICAgdGFnRmxhZ3MgPSBkYXRhW29mZnNldCsrXSA8PCA4ICtcbiAgICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdO1xuXG4gICAgICB0YWdTdGFydCA9IG9mZnNldDtcbiAgICAgIC8vbG9nZ2VyLmxvZyhcIklEMyB0YWcgaWQ6XCIgKyB0YWdJZCk7XG4gICAgICBzd2l0Y2godGFnSWQpIHtcbiAgICAgICAgY2FzZSAnUFJJVic6XG4gICAgICAgICAgICAvL2xvZ2dlci5sb2coJ3BhcnNlIGZyYW1lOicgKyBIZXguaGV4RHVtcChkYXRhLnN1YmFycmF5KG9mZnNldCxlbmRQb3MpKSk7XG4gICAgICAgICAgICAvLyBvd25lciBzaG91bGQgYmUgXCJjb20uYXBwbGUuc3RyZWFtaW5nLnRyYW5zcG9ydFN0cmVhbVRpbWVzdGFtcFwiXG4gICAgICAgICAgICBpZiAodGhpcy5yZWFkVVRGKGRhdGEsb2Zmc2V0LDQ0KSA9PT0gJ2NvbS5hcHBsZS5zdHJlYW1pbmcudHJhbnNwb3J0U3RyZWFtVGltZXN0YW1wJykge1xuICAgICAgICAgICAgICAgIG9mZnNldCs9NDQ7XG4gICAgICAgICAgICAgICAgLy8gc21lbGxpbmcgZXZlbiBiZXR0ZXIgISB3ZSBmb3VuZCB0aGUgcmlnaHQgZGVzY3JpcHRvclxuICAgICAgICAgICAgICAgIC8vIHNraXAgbnVsbCBjaGFyYWN0ZXIgKHN0cmluZyBlbmQpICsgMyBmaXJzdCBieXRlc1xuICAgICAgICAgICAgICAgIG9mZnNldCs9IDQ7XG5cbiAgICAgICAgICAgICAgICAvLyB0aW1lc3RhbXAgaXMgMzMgYml0IGV4cHJlc3NlZCBhcyBhIGJpZy1lbmRpYW4gZWlnaHQtb2N0ZXQgbnVtYmVyLCB3aXRoIHRoZSB1cHBlciAzMSBiaXRzIHNldCB0byB6ZXJvLlxuICAgICAgICAgICAgICAgIHZhciBwdHMzM0JpdCAgPSBkYXRhW29mZnNldCsrXSAmIDB4MTtcbiAgICAgICAgICAgICAgICB0aGlzLl9oYXNUaW1lU3RhbXAgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgdGltZXN0YW1wID0gKChkYXRhW29mZnNldCsrXSA8PCAyMykgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoZGF0YVtvZmZzZXQrK10gPDwgMTUpICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKGRhdGFbb2Zmc2V0KytdIDw8ICA3KSArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRhdGFbb2Zmc2V0KytdKSAvNDU7XG5cbiAgICAgICAgICAgICAgICBpZiAocHRzMzNCaXQpIHtcbiAgICAgICAgICAgICAgICAgICAgdGltZXN0YW1wICAgKz0gNDc3MjE4NTguODQ7IC8vIDJeMzIgLyA5MFxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aW1lc3RhbXAgPSBNYXRoLnJvdW5kKHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgbG9nZ2VyLnRyYWNlKGBJRDMgdGltZXN0YW1wIGZvdW5kOiAke3RpbWVzdGFtcH1gKTtcbiAgICAgICAgICAgICAgICB0aGlzLl90aW1lU3RhbXAgPSB0aW1lc3RhbXA7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGdldCBoYXNUaW1lU3RhbXAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2hhc1RpbWVTdGFtcDtcbiAgfVxuXG4gIGdldCB0aW1lU3RhbXAoKSB7XG4gICAgcmV0dXJuIHRoaXMuX3RpbWVTdGFtcDtcbiAgfVxuXG4gIGdldCBsZW5ndGgoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2xlbmd0aDtcbiAgfVxuXG4gIGdldCBwYXlsb2FkKCkge1xuICAgIHJldHVybiB0aGlzLl9wYXlsb2FkO1xuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgSUQzO1xuXG4iLCIvKipcbiAqIGhpZ2hseSBvcHRpbWl6ZWQgVFMgZGVtdXhlcjpcbiAqIHBhcnNlIFBBVCwgUE1UXG4gKiBleHRyYWN0IFBFUyBwYWNrZXQgZnJvbSBhdWRpbyBhbmQgdmlkZW8gUElEc1xuICogZXh0cmFjdCBBVkMvSDI2NCBOQUwgdW5pdHMgYW5kIEFBQy9BRFRTIHNhbXBsZXMgZnJvbSBQRVMgcGFja2V0XG4gKiB0cmlnZ2VyIHRoZSByZW11eGVyIHVwb24gcGFyc2luZyBjb21wbGV0aW9uXG4gKiBpdCBhbHNvIHRyaWVzIHRvIHdvcmthcm91bmQgYXMgYmVzdCBhcyBpdCBjYW4gYXVkaW8gY29kZWMgc3dpdGNoIChIRS1BQUMgdG8gQUFDIGFuZCB2aWNlIHZlcnNhKSwgd2l0aG91dCBoYXZpbmcgdG8gcmVzdGFydCB0aGUgTWVkaWFTb3VyY2UuXG4gKiBpdCBhbHNvIGNvbnRyb2xzIHRoZSByZW11eGluZyBwcm9jZXNzIDpcbiAqIHVwb24gZGlzY29udGludWl0eSBvciBsZXZlbCBzd2l0Y2ggZGV0ZWN0aW9uLCBpdCB3aWxsIGFsc28gbm90aWZpZXMgdGhlIHJlbXV4ZXIgc28gdGhhdCBpdCBjYW4gcmVzZXQgaXRzIHN0YXRlLlxuKi9cblxuIGltcG9ydCBBRFRTIGZyb20gJy4vYWR0cyc7XG4gaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG4gaW1wb3J0IEV4cEdvbG9tYiBmcm9tICcuL2V4cC1nb2xvbWInO1xuLy8gaW1wb3J0IEhleCBmcm9tICcuLi91dGlscy9oZXgnO1xuIGltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuIGltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuXG4gY2xhc3MgVFNEZW11eGVyIHtcblxuICBjb25zdHJ1Y3RvcihvYnNlcnZlcixyZW11eGVyQ2xhc3MpIHtcbiAgICB0aGlzLm9ic2VydmVyID0gb2JzZXJ2ZXI7XG4gICAgdGhpcy5yZW11eGVyQ2xhc3MgPSByZW11eGVyQ2xhc3M7XG4gICAgdGhpcy5sYXN0Q0MgPSAwO1xuICAgIHRoaXMucmVtdXhlciA9IG5ldyB0aGlzLnJlbXV4ZXJDbGFzcyhvYnNlcnZlcik7XG4gIH1cblxuICBzdGF0aWMgcHJvYmUoZGF0YSkge1xuICAgIC8vIGEgVFMgZnJhZ21lbnQgc2hvdWxkIGNvbnRhaW4gYXQgbGVhc3QgMyBUUyBwYWNrZXRzLCBhIFBBVCwgYSBQTVQsIGFuZCBvbmUgUElELCBlYWNoIHN0YXJ0aW5nIHdpdGggMHg0N1xuICAgIGlmIChkYXRhLmxlbmd0aCA+PSAzKjE4OCAmJiBkYXRhWzBdID09PSAweDQ3ICYmIGRhdGFbMTg4XSA9PT0gMHg0NyAmJiBkYXRhWzIqMTg4XSA9PT0gMHg0Nykge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBzd2l0Y2hMZXZlbCgpIHtcbiAgICB0aGlzLnBtdFBhcnNlZCA9IGZhbHNlO1xuICAgIHRoaXMuX3BtdElkID0gLTE7XG4gICAgdGhpcy5sYXN0QWFjUFRTID0gbnVsbDtcbiAgICB0aGlzLmFhY092ZXJGbG93ID0gbnVsbDtcbiAgICB0aGlzLl9hdmNUcmFjayA9IHtjb250YWluZXIgOiAndmlkZW8vbXAydCcsIHR5cGU6ICd2aWRlbycsIGlkIDotMSwgc2VxdWVuY2VOdW1iZXI6IDAsIHNhbXBsZXMgOiBbXSwgbGVuIDogMCwgbmJOYWx1IDogMH07XG4gICAgdGhpcy5fYWFjVHJhY2sgPSB7Y29udGFpbmVyIDogJ3ZpZGVvL21wMnQnLCB0eXBlOiAnYXVkaW8nLCBpZCA6LTEsIHNlcXVlbmNlTnVtYmVyOiAwLCBzYW1wbGVzIDogW10sIGxlbiA6IDB9O1xuICAgIHRoaXMuX2lkM1RyYWNrID0ge3R5cGU6ICdpZDMnLCBpZCA6LTEsIHNlcXVlbmNlTnVtYmVyOiAwLCBzYW1wbGVzIDogW10sIGxlbiA6IDB9O1xuICAgIHRoaXMuX3R4dFRyYWNrID0ge3R5cGU6ICd0ZXh0JywgaWQ6IC0xLCBzZXF1ZW5jZU51bWJlcjogMCwgc2FtcGxlczogW10sIGxlbjogMH07XG4gICAgdGhpcy5yZW11eGVyLnN3aXRjaExldmVsKCk7XG4gIH1cblxuICBpbnNlcnREaXNjb250aW51aXR5KCkge1xuICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICB0aGlzLnJlbXV4ZXIuaW5zZXJ0RGlzY29udGludWl0eSgpO1xuICB9XG5cbiAgLy8gZmVlZCBpbmNvbWluZyBkYXRhIHRvIHRoZSBmcm9udCBvZiB0aGUgcGFyc2luZyBwaXBlbGluZVxuICBwdXNoKGRhdGEsIGF1ZGlvQ29kZWMsIHZpZGVvQ29kZWMsIHRpbWVPZmZzZXQsIGNjLCBsZXZlbCwgc24sIGR1cmF0aW9uKSB7XG4gICAgdmFyIGF2Y0RhdGEsIGFhY0RhdGEsIGlkM0RhdGEsXG4gICAgICAgIHN0YXJ0LCBsZW4gPSBkYXRhLmxlbmd0aCwgc3R0LCBwaWQsIGF0Ziwgb2Zmc2V0LFxuICAgICAgICBjb2RlY3NPbmx5ID0gdGhpcy5yZW11eGVyLnBhc3N0aHJvdWdoO1xuXG4gICAgdGhpcy5hdWRpb0NvZGVjID0gYXVkaW9Db2RlYztcbiAgICB0aGlzLnZpZGVvQ29kZWMgPSB2aWRlb0NvZGVjO1xuICAgIHRoaXMudGltZU9mZnNldCA9IHRpbWVPZmZzZXQ7XG4gICAgdGhpcy5fZHVyYXRpb24gPSBkdXJhdGlvbjtcbiAgICB0aGlzLmNvbnRpZ3VvdXMgPSBmYWxzZTtcbiAgICBpZiAoY2MgIT09IHRoaXMubGFzdENDKSB7XG4gICAgICBsb2dnZXIubG9nKCdkaXNjb250aW51aXR5IGRldGVjdGVkJyk7XG4gICAgICB0aGlzLmluc2VydERpc2NvbnRpbnVpdHkoKTtcbiAgICAgIHRoaXMubGFzdENDID0gY2M7XG4gICAgfSBlbHNlIGlmIChsZXZlbCAhPT0gdGhpcy5sYXN0TGV2ZWwpIHtcbiAgICAgIGxvZ2dlci5sb2coJ2xldmVsIHN3aXRjaCBkZXRlY3RlZCcpO1xuICAgICAgdGhpcy5zd2l0Y2hMZXZlbCgpO1xuICAgICAgdGhpcy5sYXN0TGV2ZWwgPSBsZXZlbDtcbiAgICB9IGVsc2UgaWYgKHNuID09PSAodGhpcy5sYXN0U04rMSkpIHtcbiAgICAgIHRoaXMuY29udGlndW91cyA9IHRydWU7XG4gICAgfVxuICAgIHRoaXMubGFzdFNOID0gc247XG5cbiAgICBpZighdGhpcy5jb250aWd1b3VzKSB7XG4gICAgICAvLyBmbHVzaCBhbnkgcGFydGlhbCBjb250ZW50XG4gICAgICB0aGlzLmFhY092ZXJGbG93ID0gbnVsbDtcbiAgICB9XG5cbiAgICB2YXIgcG10UGFyc2VkID0gdGhpcy5wbXRQYXJzZWQsXG4gICAgICAgIGF2Y0lkID0gdGhpcy5fYXZjVHJhY2suaWQsXG4gICAgICAgIGFhY0lkID0gdGhpcy5fYWFjVHJhY2suaWQsXG4gICAgICAgIGlkM0lkID0gdGhpcy5faWQzVHJhY2suaWQ7XG5cbiAgICAvLyBkb24ndCBwYXJzZSBsYXN0IFRTIHBhY2tldCBpZiBpbmNvbXBsZXRlXG4gICAgbGVuIC09IGxlbiAlIDE4ODtcbiAgICAvLyBsb29wIHRocm91Z2ggVFMgcGFja2V0c1xuICAgIGZvciAoc3RhcnQgPSAwOyBzdGFydCA8IGxlbjsgc3RhcnQgKz0gMTg4KSB7XG4gICAgICBpZiAoZGF0YVtzdGFydF0gPT09IDB4NDcpIHtcbiAgICAgICAgc3R0ID0gISEoZGF0YVtzdGFydCArIDFdICYgMHg0MCk7XG4gICAgICAgIC8vIHBpZCBpcyBhIDEzLWJpdCBmaWVsZCBzdGFydGluZyBhdCB0aGUgbGFzdCBiaXQgb2YgVFNbMV1cbiAgICAgICAgcGlkID0gKChkYXRhW3N0YXJ0ICsgMV0gJiAweDFmKSA8PCA4KSArIGRhdGFbc3RhcnQgKyAyXTtcbiAgICAgICAgYXRmID0gKGRhdGFbc3RhcnQgKyAzXSAmIDB4MzApID4+IDQ7XG4gICAgICAgIC8vIGlmIGFuIGFkYXB0aW9uIGZpZWxkIGlzIHByZXNlbnQsIGl0cyBsZW5ndGggaXMgc3BlY2lmaWVkIGJ5IHRoZSBmaWZ0aCBieXRlIG9mIHRoZSBUUyBwYWNrZXQgaGVhZGVyLlxuICAgICAgICBpZiAoYXRmID4gMSkge1xuICAgICAgICAgIG9mZnNldCA9IHN0YXJ0ICsgNSArIGRhdGFbc3RhcnQgKyA0XTtcbiAgICAgICAgICAvLyBjb250aW51ZSBpZiB0aGVyZSBpcyBvbmx5IGFkYXB0YXRpb24gZmllbGRcbiAgICAgICAgICBpZiAob2Zmc2V0ID09PSAoc3RhcnQgKyAxODgpKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgb2Zmc2V0ID0gc3RhcnQgKyA0O1xuICAgICAgICB9XG4gICAgICAgIGlmIChwbXRQYXJzZWQpIHtcbiAgICAgICAgICBpZiAocGlkID09PSBhdmNJZCkge1xuICAgICAgICAgICAgaWYgKHN0dCkge1xuICAgICAgICAgICAgICBpZiAoYXZjRGF0YSkge1xuICAgICAgICAgICAgICAgIHRoaXMuX3BhcnNlQVZDUEVTKHRoaXMuX3BhcnNlUEVTKGF2Y0RhdGEpKTtcbiAgICAgICAgICAgICAgICBpZiAoY29kZWNzT25seSkge1xuICAgICAgICAgICAgICAgICAgLy8gaWYgd2UgaGF2ZSB2aWRlbyBjb2RlYyBpbmZvIEFORFxuICAgICAgICAgICAgICAgICAgLy8gaWYgYXVkaW8gUElEIGlzIHVuZGVmaW5lZCBPUiBpZiB3ZSBoYXZlIGF1ZGlvIGNvZGVjIGluZm8sXG4gICAgICAgICAgICAgICAgICAvLyB3ZSBoYXZlIGFsbCBjb2RlYyBpbmZvICFcbiAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9hdmNUcmFjay5jb2RlYyAmJiAoYWFjSWQgPT09IC0xIHx8IHRoaXMuX2FhY1RyYWNrLmNvZGVjKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbXV4KGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGF2Y0RhdGEgPSB7ZGF0YTogW10sIHNpemU6IDB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGF2Y0RhdGEpIHtcbiAgICAgICAgICAgICAgYXZjRGF0YS5kYXRhLnB1c2goZGF0YS5zdWJhcnJheShvZmZzZXQsIHN0YXJ0ICsgMTg4KSk7XG4gICAgICAgICAgICAgIGF2Y0RhdGEuc2l6ZSArPSBzdGFydCArIDE4OCAtIG9mZnNldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKHBpZCA9PT0gYWFjSWQpIHtcbiAgICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgICAgaWYgKGFhY0RhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUFBQ1BFUyh0aGlzLl9wYXJzZVBFUyhhYWNEYXRhKSk7XG4gICAgICAgICAgICAgICAgaWYgKGNvZGVjc09ubHkpIHtcbiAgICAgICAgICAgICAgICAgIC8vIGhlcmUgd2Ugbm93IHRoYXQgd2UgaGF2ZSBhdWRpbyBjb2RlYyBpbmZvXG4gICAgICAgICAgICAgICAgICAvLyBpZiB2aWRlbyBQSUQgaXMgdW5kZWZpbmVkIE9SIGlmIHdlIGhhdmUgdmlkZW8gY29kZWMgaW5mbyxcbiAgICAgICAgICAgICAgICAgIC8vIHdlIGhhdmUgYWxsIGNvZGVjIGluZm9zICFcbiAgICAgICAgICAgICAgICAgIGlmICh0aGlzLl9hYWNUcmFjay5jb2RlYyAmJiAoYXZjSWQgPT09IC0xIHx8IHRoaXMuX2F2Y1RyYWNrLmNvZGVjKSkge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbXV4KGRhdGEpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGFhY0RhdGEgPSB7ZGF0YTogW10sIHNpemU6IDB9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGFhY0RhdGEpIHtcbiAgICAgICAgICAgICAgYWFjRGF0YS5kYXRhLnB1c2goZGF0YS5zdWJhcnJheShvZmZzZXQsIHN0YXJ0ICsgMTg4KSk7XG4gICAgICAgICAgICAgIGFhY0RhdGEuc2l6ZSArPSBzdGFydCArIDE4OCAtIG9mZnNldDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2UgaWYgKHBpZCA9PT0gaWQzSWQpIHtcbiAgICAgICAgICAgIGlmIChzdHQpIHtcbiAgICAgICAgICAgICAgaWYgKGlkM0RhdGEpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9wYXJzZUlEM1BFUyh0aGlzLl9wYXJzZVBFUyhpZDNEYXRhKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaWQzRGF0YSA9IHtkYXRhOiBbXSwgc2l6ZTogMH07XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaWQzRGF0YSkge1xuICAgICAgICAgICAgICBpZDNEYXRhLmRhdGEucHVzaChkYXRhLnN1YmFycmF5KG9mZnNldCwgc3RhcnQgKyAxODgpKTtcbiAgICAgICAgICAgICAgaWQzRGF0YS5zaXplICs9IHN0YXJ0ICsgMTg4IC0gb2Zmc2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBpZiAoc3R0KSB7XG4gICAgICAgICAgICBvZmZzZXQgKz0gZGF0YVtvZmZzZXRdICsgMTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHBpZCA9PT0gMCkge1xuICAgICAgICAgICAgdGhpcy5fcGFyc2VQQVQoZGF0YSwgb2Zmc2V0KTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHBpZCA9PT0gdGhpcy5fcG10SWQpIHtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlUE1UKGRhdGEsIG9mZnNldCk7XG4gICAgICAgICAgICBwbXRQYXJzZWQgPSB0aGlzLnBtdFBhcnNlZCA9IHRydWU7XG4gICAgICAgICAgICBhdmNJZCA9IHRoaXMuX2F2Y1RyYWNrLmlkO1xuICAgICAgICAgICAgYWFjSWQgPSB0aGlzLl9hYWNUcmFjay5pZDtcbiAgICAgICAgICAgIGlkM0lkID0gdGhpcy5faWQzVHJhY2suaWQ7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlIDogRXJyb3JUeXBlcy5NRURJQV9FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfUEFSU0lOR19FUlJPUiwgZmF0YWw6IGZhbHNlLCByZWFzb246ICdUUyBwYWNrZXQgZGlkIG5vdCBzdGFydCB3aXRoIDB4NDcnfSk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHBhcnNlIGxhc3QgUEVTIHBhY2tldFxuICAgIGlmIChhdmNEYXRhKSB7XG4gICAgICB0aGlzLl9wYXJzZUFWQ1BFUyh0aGlzLl9wYXJzZVBFUyhhdmNEYXRhKSk7XG4gICAgfVxuICAgIGlmIChhYWNEYXRhKSB7XG4gICAgICB0aGlzLl9wYXJzZUFBQ1BFUyh0aGlzLl9wYXJzZVBFUyhhYWNEYXRhKSk7XG4gICAgfVxuICAgIGlmIChpZDNEYXRhKSB7XG4gICAgICB0aGlzLl9wYXJzZUlEM1BFUyh0aGlzLl9wYXJzZVBFUyhpZDNEYXRhKSk7XG4gICAgfVxuICAgIHRoaXMucmVtdXgobnVsbCk7XG4gIH1cblxuICByZW11eChkYXRhKSB7XG4gICAgdGhpcy5yZW11eGVyLnJlbXV4KHRoaXMuX2FhY1RyYWNrLCB0aGlzLl9hdmNUcmFjaywgdGhpcy5faWQzVHJhY2ssIHRoaXMuX3R4dFRyYWNrLCB0aGlzLnRpbWVPZmZzZXQsIHRoaXMuY29udGlndW91cywgZGF0YSk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuc3dpdGNoTGV2ZWwoKTtcbiAgICB0aGlzLl9pbml0UFRTID0gdGhpcy5faW5pdERUUyA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLl9kdXJhdGlvbiA9IDA7XG4gIH1cblxuICBfcGFyc2VQQVQoZGF0YSwgb2Zmc2V0KSB7XG4gICAgLy8gc2tpcCB0aGUgUFNJIGhlYWRlciBhbmQgcGFyc2UgdGhlIGZpcnN0IFBNVCBlbnRyeVxuICAgIHRoaXMuX3BtdElkICA9IChkYXRhW29mZnNldCArIDEwXSAmIDB4MUYpIDw8IDggfCBkYXRhW29mZnNldCArIDExXTtcbiAgICAvL2xvZ2dlci5sb2coJ1BNVCBQSUQ6JyAgKyB0aGlzLl9wbXRJZCk7XG4gIH1cblxuICBfcGFyc2VQTVQoZGF0YSwgb2Zmc2V0KSB7XG4gICAgdmFyIHNlY3Rpb25MZW5ndGgsIHRhYmxlRW5kLCBwcm9ncmFtSW5mb0xlbmd0aCwgcGlkO1xuICAgIHNlY3Rpb25MZW5ndGggPSAoZGF0YVtvZmZzZXQgKyAxXSAmIDB4MGYpIDw8IDggfCBkYXRhW29mZnNldCArIDJdO1xuICAgIHRhYmxlRW5kID0gb2Zmc2V0ICsgMyArIHNlY3Rpb25MZW5ndGggLSA0O1xuICAgIC8vIHRvIGRldGVybWluZSB3aGVyZSB0aGUgdGFibGUgaXMsIHdlIGhhdmUgdG8gZmlndXJlIG91dCBob3dcbiAgICAvLyBsb25nIHRoZSBwcm9ncmFtIGluZm8gZGVzY3JpcHRvcnMgYXJlXG4gICAgcHJvZ3JhbUluZm9MZW5ndGggPSAoZGF0YVtvZmZzZXQgKyAxMF0gJiAweDBmKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAxMV07XG4gICAgLy8gYWR2YW5jZSB0aGUgb2Zmc2V0IHRvIHRoZSBmaXJzdCBlbnRyeSBpbiB0aGUgbWFwcGluZyB0YWJsZVxuICAgIG9mZnNldCArPSAxMiArIHByb2dyYW1JbmZvTGVuZ3RoO1xuICAgIHdoaWxlIChvZmZzZXQgPCB0YWJsZUVuZCkge1xuICAgICAgcGlkID0gKGRhdGFbb2Zmc2V0ICsgMV0gJiAweDFGKSA8PCA4IHwgZGF0YVtvZmZzZXQgKyAyXTtcbiAgICAgIHN3aXRjaChkYXRhW29mZnNldF0pIHtcbiAgICAgICAgLy8gSVNPL0lFQyAxMzgxOC03IEFEVFMgQUFDIChNUEVHLTIgbG93ZXIgYml0LXJhdGUgYXVkaW8pXG4gICAgICAgIGNhc2UgMHgwZjpcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0FBQyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICAgIHRoaXMuX2FhY1RyYWNrLmlkID0gcGlkO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvLyBQYWNrZXRpemVkIG1ldGFkYXRhIChJRDMpXG4gICAgICAgIGNhc2UgMHgxNTpcbiAgICAgICAgICAvL2xvZ2dlci5sb2coJ0lEMyBQSUQ6JyAgKyBwaWQpO1xuICAgICAgICAgIHRoaXMuX2lkM1RyYWNrLmlkID0gcGlkO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvLyBJVFUtVCBSZWMuIEguMjY0IGFuZCBJU08vSUVDIDE0NDk2LTEwIChsb3dlciBiaXQtcmF0ZSB2aWRlbylcbiAgICAgICAgY2FzZSAweDFiOlxuICAgICAgICAgIC8vbG9nZ2VyLmxvZygnQVZDIFBJRDonICArIHBpZCk7XG4gICAgICAgICAgdGhpcy5fYXZjVHJhY2suaWQgPSBwaWQ7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgIGxvZ2dlci5sb2coJ3Vua293biBzdHJlYW0gdHlwZTonICArIGRhdGFbb2Zmc2V0XSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgLy8gbW92ZSB0byB0aGUgbmV4dCB0YWJsZSBlbnRyeVxuICAgICAgLy8gc2tpcCBwYXN0IHRoZSBlbGVtZW50YXJ5IHN0cmVhbSBkZXNjcmlwdG9ycywgaWYgcHJlc2VudFxuICAgICAgb2Zmc2V0ICs9ICgoZGF0YVtvZmZzZXQgKyAzXSAmIDB4MEYpIDw8IDggfCBkYXRhW29mZnNldCArIDRdKSArIDU7XG4gICAgfVxuICB9XG5cbiAgX3BhcnNlUEVTKHN0cmVhbSkge1xuICAgIHZhciBpID0gMCwgZnJhZywgcGVzRmxhZ3MsIHBlc1ByZWZpeCwgcGVzTGVuLCBwZXNIZHJMZW4sIHBlc0RhdGEsIHBlc1B0cywgcGVzRHRzLCBwYXlsb2FkU3RhcnRPZmZzZXQsIGRhdGEgPSBzdHJlYW0uZGF0YTtcbiAgICAvL3JldHJpZXZlIFBUUy9EVFMgZnJvbSBmaXJzdCBmcmFnbWVudFxuICAgIGZyYWcgPSBkYXRhWzBdO1xuICAgIHBlc1ByZWZpeCA9IChmcmFnWzBdIDw8IDE2KSArIChmcmFnWzFdIDw8IDgpICsgZnJhZ1syXTtcbiAgICBpZiAocGVzUHJlZml4ID09PSAxKSB7XG4gICAgICBwZXNMZW4gPSAoZnJhZ1s0XSA8PCA4KSArIGZyYWdbNV07XG4gICAgICBwZXNGbGFncyA9IGZyYWdbN107XG4gICAgICBpZiAocGVzRmxhZ3MgJiAweEMwKSB7XG4gICAgICAgIC8qIFBFUyBoZWFkZXIgZGVzY3JpYmVkIGhlcmUgOiBodHRwOi8vZHZkLnNvdXJjZWZvcmdlLm5ldC9kdmRpbmZvL3Blcy1oZHIuaHRtbFxuICAgICAgICAgICAgYXMgUFRTIC8gRFRTIGlzIDMzIGJpdCB3ZSBjYW5ub3QgdXNlIGJpdHdpc2Ugb3BlcmF0b3IgaW4gSlMsXG4gICAgICAgICAgICBhcyBCaXR3aXNlIG9wZXJhdG9ycyB0cmVhdCB0aGVpciBvcGVyYW5kcyBhcyBhIHNlcXVlbmNlIG9mIDMyIGJpdHMgKi9cbiAgICAgICAgcGVzUHRzID0gKGZyYWdbOV0gJiAweDBFKSAqIDUzNjg3MDkxMiArLy8gMSA8PCAyOVxuICAgICAgICAgIChmcmFnWzEwXSAmIDB4RkYpICogNDE5NDMwNCArLy8gMSA8PCAyMlxuICAgICAgICAgIChmcmFnWzExXSAmIDB4RkUpICogMTYzODQgKy8vIDEgPDwgMTRcbiAgICAgICAgICAoZnJhZ1sxMl0gJiAweEZGKSAqIDEyOCArLy8gMSA8PCA3XG4gICAgICAgICAgKGZyYWdbMTNdICYgMHhGRSkgLyAyO1xuICAgICAgICAgIC8vIGNoZWNrIGlmIGdyZWF0ZXIgdGhhbiAyXjMyIC0xXG4gICAgICAgICAgaWYgKHBlc1B0cyA+IDQyOTQ5NjcyOTUpIHtcbiAgICAgICAgICAgIC8vIGRlY3JlbWVudCAyXjMzXG4gICAgICAgICAgICBwZXNQdHMgLT0gODU4OTkzNDU5MjtcbiAgICAgICAgICB9XG4gICAgICAgIGlmIChwZXNGbGFncyAmIDB4NDApIHtcbiAgICAgICAgICBwZXNEdHMgPSAoZnJhZ1sxNF0gJiAweDBFICkgKiA1MzY4NzA5MTIgKy8vIDEgPDwgMjlcbiAgICAgICAgICAgIChmcmFnWzE1XSAmIDB4RkYgKSAqIDQxOTQzMDQgKy8vIDEgPDwgMjJcbiAgICAgICAgICAgIChmcmFnWzE2XSAmIDB4RkUgKSAqIDE2Mzg0ICsvLyAxIDw8IDE0XG4gICAgICAgICAgICAoZnJhZ1sxN10gJiAweEZGICkgKiAxMjggKy8vIDEgPDwgN1xuICAgICAgICAgICAgKGZyYWdbMThdICYgMHhGRSApIC8gMjtcbiAgICAgICAgICAvLyBjaGVjayBpZiBncmVhdGVyIHRoYW4gMl4zMiAtMVxuICAgICAgICAgIGlmIChwZXNEdHMgPiA0Mjk0OTY3Mjk1KSB7XG4gICAgICAgICAgICAvLyBkZWNyZW1lbnQgMl4zM1xuICAgICAgICAgICAgcGVzRHRzIC09IDg1ODk5MzQ1OTI7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBlc0R0cyA9IHBlc1B0cztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcGVzSGRyTGVuID0gZnJhZ1s4XTtcbiAgICAgIHBheWxvYWRTdGFydE9mZnNldCA9IHBlc0hkckxlbiArIDk7XG5cbiAgICAgIHN0cmVhbS5zaXplIC09IHBheWxvYWRTdGFydE9mZnNldDtcbiAgICAgIC8vcmVhc3NlbWJsZSBQRVMgcGFja2V0XG4gICAgICBwZXNEYXRhID0gbmV3IFVpbnQ4QXJyYXkoc3RyZWFtLnNpemUpO1xuICAgICAgd2hpbGUgKGRhdGEubGVuZ3RoKSB7XG4gICAgICAgIGZyYWcgPSBkYXRhLnNoaWZ0KCk7XG4gICAgICAgIHZhciBsZW4gPSBmcmFnLmJ5dGVMZW5ndGg7XG4gICAgICAgIGlmIChwYXlsb2FkU3RhcnRPZmZzZXQpIHtcbiAgICAgICAgICBpZiAocGF5bG9hZFN0YXJ0T2Zmc2V0ID4gbGVuKSB7XG4gICAgICAgICAgICAvLyB0cmltIGZ1bGwgZnJhZyBpZiBQRVMgaGVhZGVyIGJpZ2dlciB0aGFuIGZyYWdcbiAgICAgICAgICAgIHBheWxvYWRTdGFydE9mZnNldC09bGVuO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIHRyaW0gcGFydGlhbCBmcmFnIGlmIFBFUyBoZWFkZXIgc21hbGxlciB0aGFuIGZyYWdcbiAgICAgICAgICAgIGZyYWcgPSBmcmFnLnN1YmFycmF5KHBheWxvYWRTdGFydE9mZnNldCk7XG4gICAgICAgICAgICBsZW4tPXBheWxvYWRTdGFydE9mZnNldDtcbiAgICAgICAgICAgIHBheWxvYWRTdGFydE9mZnNldCA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHBlc0RhdGEuc2V0KGZyYWcsIGkpO1xuICAgICAgICBpKz1sZW47XG4gICAgICB9XG4gICAgICByZXR1cm4ge2RhdGE6IHBlc0RhdGEsIHB0czogcGVzUHRzLCBkdHM6IHBlc0R0cywgbGVuOiBwZXNMZW59O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG4gIH1cblxuICBfcGFyc2VBVkNQRVMocGVzKSB7XG4gICAgdmFyIHRyYWNrID0gdGhpcy5fYXZjVHJhY2ssXG4gICAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzLFxuICAgICAgICB1bml0cyA9IHRoaXMuX3BhcnNlQVZDTkFMdShwZXMuZGF0YSksXG4gICAgICAgIHVuaXRzMiA9IFtdLFxuICAgICAgICBkZWJ1ZyA9IGZhbHNlLFxuICAgICAgICBrZXkgPSBmYWxzZSxcbiAgICAgICAgbGVuZ3RoID0gMCxcbiAgICAgICAgZXhwR29sb21iRGVjb2RlcixcbiAgICAgICAgYXZjU2FtcGxlLFxuICAgICAgICBwdXNoLFxuICAgICAgICBpO1xuICAgIC8vIG5vIE5BTHUgZm91bmRcbiAgICBpZiAodW5pdHMubGVuZ3RoID09PSAwICYmIHNhbXBsZXMubGVuZ3RoID4gMCkge1xuICAgICAgLy8gYXBwZW5kIHBlcy5kYXRhIHRvIHByZXZpb3VzIE5BTCB1bml0XG4gICAgICB2YXIgbGFzdGF2Y1NhbXBsZSA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGggLSAxXTtcbiAgICAgIHZhciBsYXN0VW5pdCA9IGxhc3RhdmNTYW1wbGUudW5pdHMudW5pdHNbbGFzdGF2Y1NhbXBsZS51bml0cy51bml0cy5sZW5ndGggLSAxXTtcbiAgICAgIHZhciB0bXAgPSBuZXcgVWludDhBcnJheShsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGggKyBwZXMuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgIHRtcC5zZXQobGFzdFVuaXQuZGF0YSwgMCk7XG4gICAgICB0bXAuc2V0KHBlcy5kYXRhLCBsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgbGFzdFVuaXQuZGF0YSA9IHRtcDtcbiAgICAgIGxhc3RhdmNTYW1wbGUudW5pdHMubGVuZ3RoICs9IHBlcy5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICB0cmFjay5sZW4gKz0gcGVzLmRhdGEuYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgLy9mcmVlIHBlcy5kYXRhIHRvIHNhdmUgdXAgc29tZSBtZW1vcnlcbiAgICBwZXMuZGF0YSA9IG51bGw7XG4gICAgdmFyIGRlYnVnU3RyaW5nID0gJyc7XG5cbiAgICB1bml0cy5mb3JFYWNoKHVuaXQgPT4ge1xuICAgICAgc3dpdGNoKHVuaXQudHlwZSkge1xuICAgICAgICAvL05EUlxuICAgICAgICAgY2FzZSAxOlxuICAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICAgaWYoZGVidWcpIHtcbiAgICAgICAgICAgIGRlYnVnU3RyaW5nICs9ICdORFIgJztcbiAgICAgICAgICAgfVxuICAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9JRFJcbiAgICAgICAgY2FzZSA1OlxuICAgICAgICAgIHB1c2ggPSB0cnVlO1xuICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnSURSICc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGtleSA9IHRydWU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vU0VJXG4gICAgICAgIGNhc2UgNjpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ1NFSSAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBleHBHb2xvbWJEZWNvZGVyID0gbmV3IEV4cEdvbG9tYih1bml0LmRhdGEpO1xuXG4gICAgICAgICAgLy8gc2tpcCBmcmFtZVR5cGVcbiAgICAgICAgICBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuXG4gICAgICAgICAgdmFyIHBheWxvYWRUeXBlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcblxuICAgICAgICAgIC8vIFRPRE86IHRoZXJlIGNhbiBiZSBtb3JlIHRoYW4gb25lIHBheWxvYWQgaW4gYW4gU0VJIHBhY2tldC4uLlxuICAgICAgICAgIC8vIFRPRE86IG5lZWQgdG8gcmVhZCB0eXBlIGFuZCBzaXplIGluIGEgd2hpbGUgbG9vcCB0byBnZXQgdGhlbSBhbGxcbiAgICAgICAgICBpZiAocGF5bG9hZFR5cGUgPT09IDQpXG4gICAgICAgICAge1xuICAgICAgICAgICAgdmFyIHBheWxvYWRTaXplID0gMDtcblxuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICBwYXlsb2FkU2l6ZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB3aGlsZSAocGF5bG9hZFNpemUgPT09IDI1NSk7XG5cbiAgICAgICAgICAgIHZhciBjb3VudHJ5Q29kZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVCeXRlKCk7XG5cbiAgICAgICAgICAgIGlmIChjb3VudHJ5Q29kZSA9PT0gMTgxKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICB2YXIgcHJvdmlkZXJDb2RlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVVNob3J0KCk7XG5cbiAgICAgICAgICAgICAgaWYgKHByb3ZpZGVyQ29kZSA9PT0gNDkpXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB2YXIgdXNlclN0cnVjdHVyZSA9IGV4cEdvbG9tYkRlY29kZXIucmVhZFVJbnQoKTtcblxuICAgICAgICAgICAgICAgIGlmICh1c2VyU3RydWN0dXJlID09PSAweDQ3NDEzOTM0KVxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIHZhciB1c2VyRGF0YVR5cGUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAvLyBSYXcgQ0VBLTYwOCBieXRlcyB3cmFwcGVkIGluIENFQS03MDggcGFja2V0XG4gICAgICAgICAgICAgICAgICBpZiAodXNlckRhdGFUeXBlID09PSAzKVxuICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICB2YXIgZmlyc3RCeXRlID0gZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKTtcbiAgICAgICAgICAgICAgICAgICAgdmFyIHNlY29uZEJ5dGUgPSBleHBHb2xvbWJEZWNvZGVyLnJlYWRVQnl0ZSgpO1xuXG4gICAgICAgICAgICAgICAgICAgIHZhciB0b3RhbENDcyA9IDMxICYgZmlyc3RCeXRlO1xuICAgICAgICAgICAgICAgICAgICB2YXIgYnl0ZUFycmF5ID0gW2ZpcnN0Qnl0ZSwgc2Vjb25kQnl0ZV07XG5cbiAgICAgICAgICAgICAgICAgICAgZm9yIChpPTA7IGk8dG90YWxDQ3M7IGkrKylcbiAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgIC8vIDMgYnl0ZXMgcGVyIENDXG4gICAgICAgICAgICAgICAgICAgICAgYnl0ZUFycmF5LnB1c2goZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgYnl0ZUFycmF5LnB1c2goZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKSk7XG4gICAgICAgICAgICAgICAgICAgICAgYnl0ZUFycmF5LnB1c2goZXhwR29sb21iRGVjb2Rlci5yZWFkVUJ5dGUoKSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICB0aGlzLl90eHRUcmFjay5zYW1wbGVzLnB1c2goe3R5cGU6IDMsIHB0czogcGVzLnB0cywgYnl0ZXM6IGJ5dGVBcnJheX0pO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgLy9TUFNcbiAgICAgICAgY2FzZSA3OlxuICAgICAgICAgIHB1c2ggPSB0cnVlO1xuICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnU1BTICc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmKCF0cmFjay5zcHMpIHtcbiAgICAgICAgICAgIGV4cEdvbG9tYkRlY29kZXIgPSBuZXcgRXhwR29sb21iKHVuaXQuZGF0YSk7XG4gICAgICAgICAgICB2YXIgY29uZmlnID0gZXhwR29sb21iRGVjb2Rlci5yZWFkU1BTKCk7XG4gICAgICAgICAgICB0cmFjay53aWR0aCA9IGNvbmZpZy53aWR0aDtcbiAgICAgICAgICAgIHRyYWNrLmhlaWdodCA9IGNvbmZpZy5oZWlnaHQ7XG4gICAgICAgICAgICB0cmFjay5zcHMgPSBbdW5pdC5kYXRhXTtcbiAgICAgICAgICAgIHRyYWNrLmR1cmF0aW9uID0gdGhpcy5fZHVyYXRpb247XG4gICAgICAgICAgICB2YXIgY29kZWNhcnJheSA9IHVuaXQuZGF0YS5zdWJhcnJheSgxLCA0KTtcbiAgICAgICAgICAgIHZhciBjb2RlY3N0cmluZyA9ICdhdmMxLic7XG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgMzsgaSsrKSB7XG4gICAgICAgICAgICAgIHZhciBoID0gY29kZWNhcnJheVtpXS50b1N0cmluZygxNik7XG4gICAgICAgICAgICAgIGlmIChoLmxlbmd0aCA8IDIpIHtcbiAgICAgICAgICAgICAgICBoID0gJzAnICsgaDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBjb2RlY3N0cmluZyArPSBoO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdHJhY2suY29kZWMgPSBjb2RlY3N0cmluZztcbiAgICAgICAgICB9XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIC8vUFBTXG4gICAgICAgIGNhc2UgODpcbiAgICAgICAgICBwdXNoID0gdHJ1ZTtcbiAgICAgICAgICBpZihkZWJ1Zykge1xuICAgICAgICAgICAgZGVidWdTdHJpbmcgKz0gJ1BQUyAnO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIXRyYWNrLnBwcykge1xuICAgICAgICAgICAgdHJhY2sucHBzID0gW3VuaXQuZGF0YV07XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDk6XG4gICAgICAgICAgcHVzaCA9IGZhbHNlO1xuICAgICAgICAgIGlmKGRlYnVnKSB7XG4gICAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAnQVVEICc7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHB1c2ggPSBmYWxzZTtcbiAgICAgICAgICBkZWJ1Z1N0cmluZyArPSAndW5rbm93biBOQUwgJyArIHVuaXQudHlwZSArICcgJztcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIGlmKHB1c2gpIHtcbiAgICAgICAgdW5pdHMyLnB1c2godW5pdCk7XG4gICAgICAgIGxlbmd0aCs9dW5pdC5kYXRhLmJ5dGVMZW5ndGg7XG4gICAgICB9XG4gICAgfSk7XG4gICAgaWYoZGVidWcgfHwgZGVidWdTdHJpbmcubGVuZ3RoKSB7XG4gICAgICBsb2dnZXIubG9nKGRlYnVnU3RyaW5nKTtcbiAgICB9XG4gICAgLy9idWlsZCBzYW1wbGUgZnJvbSBQRVNcbiAgICAvLyBBbm5leCBCIHRvIE1QNCBjb252ZXJzaW9uIHRvIGJlIGRvbmVcbiAgICBpZiAodW5pdHMyLmxlbmd0aCkge1xuICAgICAgLy8gb25seSBwdXNoIEFWQyBzYW1wbGUgaWYga2V5ZnJhbWUgYWxyZWFkeSBmb3VuZC4gYnJvd3NlcnMgZXhwZWN0IGEga2V5ZnJhbWUgYXQgZmlyc3QgdG8gc3RhcnQgZGVjb2RpbmdcbiAgICAgIGlmIChrZXkgPT09IHRydWUgfHwgdHJhY2suc3BzICkge1xuICAgICAgICBhdmNTYW1wbGUgPSB7dW5pdHM6IHsgdW5pdHMgOiB1bml0czIsIGxlbmd0aCA6IGxlbmd0aH0sIHB0czogcGVzLnB0cywgZHRzOiBwZXMuZHRzLCBrZXk6IGtleX07XG4gICAgICAgIHNhbXBsZXMucHVzaChhdmNTYW1wbGUpO1xuICAgICAgICB0cmFjay5sZW4gKz0gbGVuZ3RoO1xuICAgICAgICB0cmFjay5uYk5hbHUgKz0gdW5pdHMyLmxlbmd0aDtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuXG4gIF9wYXJzZUFWQ05BTHUoYXJyYXkpIHtcbiAgICB2YXIgaSA9IDAsIGxlbiA9IGFycmF5LmJ5dGVMZW5ndGgsIHZhbHVlLCBvdmVyZmxvdywgc3RhdGUgPSAwO1xuICAgIHZhciB1bml0cyA9IFtdLCB1bml0LCB1bml0VHlwZSwgbGFzdFVuaXRTdGFydCwgbGFzdFVuaXRUeXBlO1xuICAgIC8vbG9nZ2VyLmxvZygnUEVTOicgKyBIZXguaGV4RHVtcChhcnJheSkpO1xuICAgIHdoaWxlIChpIDwgbGVuKSB7XG4gICAgICB2YWx1ZSA9IGFycmF5W2krK107XG4gICAgICAvLyBmaW5kaW5nIDMgb3IgNC1ieXRlIHN0YXJ0IGNvZGVzICgwMCAwMCAwMSBPUiAwMCAwMCAwMCAwMSlcbiAgICAgIHN3aXRjaCAoc3RhdGUpIHtcbiAgICAgICAgY2FzZSAwOlxuICAgICAgICAgIGlmICh2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAxO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAxOlxuICAgICAgICAgIGlmKCB2YWx1ZSA9PT0gMCkge1xuICAgICAgICAgICAgc3RhdGUgPSAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIDI6XG4gICAgICAgIGNhc2UgMzpcbiAgICAgICAgICBpZiggdmFsdWUgPT09IDApIHtcbiAgICAgICAgICAgIHN0YXRlID0gMztcbiAgICAgICAgICB9IGVsc2UgaWYgKHZhbHVlID09PSAxICYmIGkgPCBsZW4pIHtcbiAgICAgICAgICAgIHVuaXRUeXBlID0gYXJyYXlbaV0gJiAweDFmO1xuICAgICAgICAgICAgLy9sb2dnZXIubG9nKCdmaW5kIE5BTFUgQCBvZmZzZXQ6JyArIGkgKyAnLHR5cGU6JyArIHVuaXRUeXBlKTtcbiAgICAgICAgICAgIGlmIChsYXN0VW5pdFN0YXJ0KSB7XG4gICAgICAgICAgICAgIHVuaXQgPSB7ZGF0YTogYXJyYXkuc3ViYXJyYXkobGFzdFVuaXRTdGFydCwgaSAtIHN0YXRlIC0gMSksIHR5cGU6IGxhc3RVbml0VHlwZX07XG4gICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygncHVzaGluZyBOQUxVLCB0eXBlL3NpemU6JyArIHVuaXQudHlwZSArICcvJyArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICAgICAgICAgICAgdW5pdHMucHVzaCh1bml0KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIElmIE5BTCB1bml0cyBhcmUgbm90IHN0YXJ0aW5nIHJpZ2h0IGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBFUyBwYWNrZXQsIHB1c2ggcHJlY2VkaW5nIGRhdGEgaW50byBwcmV2aW91cyBOQUwgdW5pdC5cbiAgICAgICAgICAgICAgb3ZlcmZsb3cgID0gaSAtIHN0YXRlIC0gMTtcbiAgICAgICAgICAgICAgaWYgKG92ZXJmbG93KSB7XG4gICAgICAgICAgICAgICAgdmFyIHRyYWNrID0gdGhpcy5fYXZjVHJhY2ssXG4gICAgICAgICAgICAgICAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzO1xuICAgICAgICAgICAgICAgIC8vbG9nZ2VyLmxvZygnZmlyc3QgTkFMVSBmb3VuZCB3aXRoIG92ZXJmbG93OicgKyBvdmVyZmxvdyk7XG4gICAgICAgICAgICAgICAgaWYgKHNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICAgICAgICAgICAgICB2YXIgbGFzdGF2Y1NhbXBsZSA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGggLSAxXSxcbiAgICAgICAgICAgICAgICAgICAgICBsYXN0VW5pdHMgPSBsYXN0YXZjU2FtcGxlLnVuaXRzLnVuaXRzLFxuICAgICAgICAgICAgICAgICAgICAgIGxhc3RVbml0ID0gbGFzdFVuaXRzW2xhc3RVbml0cy5sZW5ndGggLSAxXSxcbiAgICAgICAgICAgICAgICAgICAgICB0bXAgPSBuZXcgVWludDhBcnJheShsYXN0VW5pdC5kYXRhLmJ5dGVMZW5ndGggKyBvdmVyZmxvdyk7XG4gICAgICAgICAgICAgICAgICB0bXAuc2V0KGxhc3RVbml0LmRhdGEsIDApO1xuICAgICAgICAgICAgICAgICAgdG1wLnNldChhcnJheS5zdWJhcnJheSgwLCBvdmVyZmxvdyksIGxhc3RVbml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgICAgICAgICBsYXN0VW5pdC5kYXRhID0gdG1wO1xuICAgICAgICAgICAgICAgICAgbGFzdGF2Y1NhbXBsZS51bml0cy5sZW5ndGggKz0gb3ZlcmZsb3c7XG4gICAgICAgICAgICAgICAgICB0cmFjay5sZW4gKz0gb3ZlcmZsb3c7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsYXN0VW5pdFN0YXJ0ID0gaTtcbiAgICAgICAgICAgIGxhc3RVbml0VHlwZSA9IHVuaXRUeXBlO1xuICAgICAgICAgICAgc3RhdGUgPSAwO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBzdGF0ZSA9IDA7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAobGFzdFVuaXRTdGFydCkge1xuICAgICAgdW5pdCA9IHtkYXRhOiBhcnJheS5zdWJhcnJheShsYXN0VW5pdFN0YXJ0LCBsZW4pLCB0eXBlOiBsYXN0VW5pdFR5cGV9O1xuICAgICAgdW5pdHMucHVzaCh1bml0KTtcbiAgICAgIC8vbG9nZ2VyLmxvZygncHVzaGluZyBOQUxVLCB0eXBlL3NpemU6JyArIHVuaXQudHlwZSArICcvJyArIHVuaXQuZGF0YS5ieXRlTGVuZ3RoKTtcbiAgICB9XG4gICAgcmV0dXJuIHVuaXRzO1xuICB9XG5cbiAgX3BhcnNlQUFDUEVTKHBlcykge1xuICAgIHZhciB0cmFjayA9IHRoaXMuX2FhY1RyYWNrLFxuICAgICAgICBkYXRhID0gcGVzLmRhdGEsXG4gICAgICAgIHB0cyA9IHBlcy5wdHMsXG4gICAgICAgIHN0YXJ0T2Zmc2V0ID0gMCxcbiAgICAgICAgZHVyYXRpb24gPSB0aGlzLl9kdXJhdGlvbixcbiAgICAgICAgYXVkaW9Db2RlYyA9IHRoaXMuYXVkaW9Db2RlYyxcbiAgICAgICAgYWFjT3ZlckZsb3cgPSB0aGlzLmFhY092ZXJGbG93LFxuICAgICAgICBsYXN0QWFjUFRTID0gdGhpcy5sYXN0QWFjUFRTLFxuICAgICAgICBjb25maWcsIGZyYW1lTGVuZ3RoLCBmcmFtZUR1cmF0aW9uLCBmcmFtZUluZGV4LCBvZmZzZXQsIGhlYWRlckxlbmd0aCwgc3RhbXAsIGxlbiwgYWFjU2FtcGxlO1xuICAgIGlmIChhYWNPdmVyRmxvdykge1xuICAgICAgdmFyIHRtcCA9IG5ldyBVaW50OEFycmF5KGFhY092ZXJGbG93LmJ5dGVMZW5ndGggKyBkYXRhLmJ5dGVMZW5ndGgpO1xuICAgICAgdG1wLnNldChhYWNPdmVyRmxvdywgMCk7XG4gICAgICB0bXAuc2V0KGRhdGEsIGFhY092ZXJGbG93LmJ5dGVMZW5ndGgpO1xuICAgICAgLy9sb2dnZXIubG9nKGBBQUM6IGFwcGVuZCBvdmVyZmxvd2luZyAke2FhY092ZXJGbG93LmJ5dGVMZW5ndGh9IGJ5dGVzIHRvIGJlZ2lubmluZyBvZiBuZXcgUEVTYCk7XG4gICAgICBkYXRhID0gdG1wO1xuICAgIH1cbiAgICAvLyBsb29rIGZvciBBRFRTIGhlYWRlciAoMHhGRkZ4KVxuICAgIGZvciAob2Zmc2V0ID0gc3RhcnRPZmZzZXQsIGxlbiA9IGRhdGEubGVuZ3RoOyBvZmZzZXQgPCBsZW4gLSAxOyBvZmZzZXQrKykge1xuICAgICAgaWYgKChkYXRhW29mZnNldF0gPT09IDB4ZmYpICYmIChkYXRhW29mZnNldCsxXSAmIDB4ZjApID09PSAweGYwKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBpZiBBRFRTIGhlYWRlciBkb2VzIG5vdCBzdGFydCBzdHJhaWdodCBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgdGhlIFBFUyBwYXlsb2FkLCByYWlzZSBhbiBlcnJvclxuICAgIGlmIChvZmZzZXQpIHtcbiAgICAgIHZhciByZWFzb24sIGZhdGFsO1xuICAgICAgaWYgKG9mZnNldCA8IGxlbiAtIDEpIHtcbiAgICAgICAgcmVhc29uID0gYEFBQyBQRVMgZGlkIG5vdCBzdGFydCB3aXRoIEFEVFMgaGVhZGVyLG9mZnNldDoke29mZnNldH1gO1xuICAgICAgICBmYXRhbCA9IGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVhc29uID0gJ25vIEFEVFMgaGVhZGVyIGZvdW5kIGluIEFBQyBQRVMnO1xuICAgICAgICBmYXRhbCA9IHRydWU7XG4gICAgICB9XG4gICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogZmF0YWwsIHJlYXNvbjogcmVhc29ufSk7XG4gICAgICBpZiAoZmF0YWwpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAoIXRyYWNrLmF1ZGlvc2FtcGxlcmF0ZSkge1xuICAgICAgY29uZmlnID0gQURUUy5nZXRBdWRpb0NvbmZpZyh0aGlzLm9ic2VydmVyLGRhdGEsIG9mZnNldCwgYXVkaW9Db2RlYyk7XG4gICAgICB0cmFjay5jb25maWcgPSBjb25maWcuY29uZmlnO1xuICAgICAgdHJhY2suYXVkaW9zYW1wbGVyYXRlID0gY29uZmlnLnNhbXBsZXJhdGU7XG4gICAgICB0cmFjay5jaGFubmVsQ291bnQgPSBjb25maWcuY2hhbm5lbENvdW50O1xuICAgICAgdHJhY2suY29kZWMgPSBjb25maWcuY29kZWM7XG4gICAgICB0cmFjay5kdXJhdGlvbiA9IGR1cmF0aW9uO1xuICAgICAgbG9nZ2VyLmxvZyhgcGFyc2VkIGNvZGVjOiR7dHJhY2suY29kZWN9LHJhdGU6JHtjb25maWcuc2FtcGxlcmF0ZX0sbmIgY2hhbm5lbDoke2NvbmZpZy5jaGFubmVsQ291bnR9YCk7XG4gICAgfVxuICAgIGZyYW1lSW5kZXggPSAwO1xuICAgIGZyYW1lRHVyYXRpb24gPSAxMDI0ICogOTAwMDAgLyB0cmFjay5hdWRpb3NhbXBsZXJhdGU7XG5cbiAgICAvLyBpZiBsYXN0IEFBQyBmcmFtZSBpcyBvdmVyZmxvd2luZywgd2Ugc2hvdWxkIGVuc3VyZSB0aW1lc3RhbXBzIGFyZSBjb250aWd1b3VzOlxuICAgIC8vIGZpcnN0IHNhbXBsZSBQVFMgc2hvdWxkIGJlIGVxdWFsIHRvIGxhc3Qgc2FtcGxlIFBUUyArIGZyYW1lRHVyYXRpb25cbiAgICBpZihhYWNPdmVyRmxvdyAmJiBsYXN0QWFjUFRTKSB7XG4gICAgICB2YXIgbmV3UFRTID0gbGFzdEFhY1BUUytmcmFtZUR1cmF0aW9uO1xuICAgICAgaWYoTWF0aC5hYnMobmV3UFRTLXB0cykgPiAxKSB7XG4gICAgICAgIGxvZ2dlci5sb2coYEFBQzogYWxpZ24gUFRTIGZvciBvdmVybGFwcGluZyBmcmFtZXMgYnkgJHtNYXRoLnJvdW5kKChuZXdQVFMtcHRzKS85MCl9YCk7XG4gICAgICAgIHB0cz1uZXdQVFM7XG4gICAgICB9XG4gICAgfVxuXG4gICAgd2hpbGUgKChvZmZzZXQgKyA1KSA8IGxlbikge1xuICAgICAgLy8gVGhlIHByb3RlY3Rpb24gc2tpcCBiaXQgdGVsbHMgdXMgaWYgd2UgaGF2ZSAyIGJ5dGVzIG9mIENSQyBkYXRhIGF0IHRoZSBlbmQgb2YgdGhlIEFEVFMgaGVhZGVyXG4gICAgICBoZWFkZXJMZW5ndGggPSAoISEoZGF0YVtvZmZzZXQgKyAxXSAmIDB4MDEpID8gNyA6IDkpO1xuICAgICAgLy8gcmV0cmlldmUgZnJhbWUgc2l6ZVxuICAgICAgZnJhbWVMZW5ndGggPSAoKGRhdGFbb2Zmc2V0ICsgM10gJiAweDAzKSA8PCAxMSkgfFxuICAgICAgICAgICAgICAgICAgICAgKGRhdGFbb2Zmc2V0ICsgNF0gPDwgMykgfFxuICAgICAgICAgICAgICAgICAgICAoKGRhdGFbb2Zmc2V0ICsgNV0gJiAweEUwKSA+Pj4gNSk7XG4gICAgICBmcmFtZUxlbmd0aCAgLT0gaGVhZGVyTGVuZ3RoO1xuICAgICAgLy9zdGFtcCA9IHBlcy5wdHM7XG5cbiAgICAgIGlmICgoZnJhbWVMZW5ndGggPiAwKSAmJiAoKG9mZnNldCArIGhlYWRlckxlbmd0aCArIGZyYW1lTGVuZ3RoKSA8PSBsZW4pKSB7XG4gICAgICAgIHN0YW1wID0gcHRzICsgZnJhbWVJbmRleCAqIGZyYW1lRHVyYXRpb247XG4gICAgICAgIC8vbG9nZ2VyLmxvZyhgQUFDIGZyYW1lLCBvZmZzZXQvbGVuZ3RoL3RvdGFsL3B0czoke29mZnNldCtoZWFkZXJMZW5ndGh9LyR7ZnJhbWVMZW5ndGh9LyR7ZGF0YS5ieXRlTGVuZ3RofS8keyhzdGFtcC85MCkudG9GaXhlZCgwKX1gKTtcbiAgICAgICAgYWFjU2FtcGxlID0ge3VuaXQ6IGRhdGEuc3ViYXJyYXkob2Zmc2V0ICsgaGVhZGVyTGVuZ3RoLCBvZmZzZXQgKyBoZWFkZXJMZW5ndGggKyBmcmFtZUxlbmd0aCksIHB0czogc3RhbXAsIGR0czogc3RhbXB9O1xuICAgICAgICB0cmFjay5zYW1wbGVzLnB1c2goYWFjU2FtcGxlKTtcbiAgICAgICAgdHJhY2subGVuICs9IGZyYW1lTGVuZ3RoO1xuICAgICAgICBvZmZzZXQgKz0gZnJhbWVMZW5ndGggKyBoZWFkZXJMZW5ndGg7XG4gICAgICAgIGZyYW1lSW5kZXgrKztcbiAgICAgICAgLy8gbG9vayBmb3IgQURUUyBoZWFkZXIgKDB4RkZGeClcbiAgICAgICAgZm9yICggOyBvZmZzZXQgPCAobGVuIC0gMSk7IG9mZnNldCsrKSB7XG4gICAgICAgICAgaWYgKChkYXRhW29mZnNldF0gPT09IDB4ZmYpICYmICgoZGF0YVtvZmZzZXQgKyAxXSAmIDB4ZjApID09PSAweGYwKSkge1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKG9mZnNldCA8IGxlbikge1xuICAgICAgYWFjT3ZlckZsb3cgPSBkYXRhLnN1YmFycmF5KG9mZnNldCwgbGVuKTtcbiAgICAgIC8vbG9nZ2VyLmxvZyhgQUFDOiBvdmVyZmxvdyBkZXRlY3RlZDoke2xlbi1vZmZzZXR9YCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFhY092ZXJGbG93ID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5hYWNPdmVyRmxvdyA9IGFhY092ZXJGbG93O1xuICAgIHRoaXMubGFzdEFhY1BUUyA9IHN0YW1wO1xuICB9XG5cbiAgX3BhcnNlSUQzUEVTKHBlcykge1xuICAgIHRoaXMuX2lkM1RyYWNrLnNhbXBsZXMucHVzaChwZXMpO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFRTRGVtdXhlcjtcblxuIiwiZXhwb3J0IGNvbnN0IEVycm9yVHlwZXMgPSB7XG4gIC8vIElkZW50aWZpZXIgZm9yIGEgbmV0d29yayBlcnJvciAobG9hZGluZyBlcnJvciAvIHRpbWVvdXQgLi4uKVxuICBORVRXT1JLX0VSUk9SOiAnbmV0d29ya0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtZWRpYSBFcnJvciAodmlkZW8vcGFyc2luZy9tZWRpYXNvdXJjZSBlcnJvcilcbiAgTUVESUFfRVJST1I6ICdtZWRpYUVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYWxsIG90aGVyIGVycm9yc1xuICBPVEhFUl9FUlJPUjogJ290aGVyRXJyb3InXG59O1xuXG5leHBvcnQgY29uc3QgRXJyb3JEZXRhaWxzID0ge1xuICAvLyBJZGVudGlmaWVyIGZvciBhIG1hbmlmZXN0IGxvYWQgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBNQU5JRkVTVF9MT0FEX0VSUk9SOiAnbWFuaWZlc3RMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIG1hbmlmZXN0IGxvYWQgdGltZW91dCAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIE1BTklGRVNUX0xPQURfVElNRU9VVDogJ21hbmlmZXN0TG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIG1hbmlmZXN0IHBhcnNpbmcgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlYXNvbiA6IGVycm9yIHJlYXNvbn1cbiAgTUFOSUZFU1RfUEFSU0lOR19FUlJPUjogJ21hbmlmZXN0UGFyc2luZ0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBtYW5pZmVzdCB3aXRoIG9ubHkgaW5jb21wYXRpYmxlIGNvZGVjcyBlcnJvciAtIGRhdGE6IHsgdXJsIDogZmF1bHR5IFVSTCwgcmVhc29uIDogZXJyb3IgcmVhc29ufVxuICBNQU5JRkVTVF9JTkNPTVBBVElCTEVfQ09ERUNTX0VSUk9SOiAnbWFuaWZlc3RJbmNvbXBhdGlibGVDb2RlY3NFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIHBsYXlsaXN0IGxvYWQgZXJyb3IgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBMRVZFTF9MT0FEX0VSUk9SOiAnbGV2ZWxMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBwbGF5bGlzdCBsb2FkIHRpbWVvdXQgLSBkYXRhOiB7IHVybCA6IGZhdWx0eSBVUkwsIHJlc3BvbnNlIDogWEhSIHJlc3BvbnNlfVxuICBMRVZFTF9MT0FEX1RJTUVPVVQ6ICdsZXZlbExvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBsZXZlbCBzd2l0Y2ggZXJyb3IgLSBkYXRhOiB7IGxldmVsIDogZmF1bHR5IGxldmVsIElkLCBldmVudCA6IGVycm9yIGRlc2NyaXB0aW9ufVxuICBMRVZFTF9TV0lUQ0hfRVJST1I6ICdsZXZlbFN3aXRjaEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZnJhZ21lbnQgbG9hZCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIEZSQUdfTE9BRF9FUlJPUjogJ2ZyYWdMb2FkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb29wIGxvYWRpbmcgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9PUF9MT0FESU5HX0VSUk9SOiAnZnJhZ0xvb3BMb2FkaW5nRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBmcmFnbWVudCBsb2FkIHRpbWVvdXQgZXJyb3IgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRF9USU1FT1VUOiAnZnJhZ0xvYWRUaW1lT3V0JyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBkZWNyeXB0aW9uIGVycm9yIGV2ZW50IC0gZGF0YTogcGFyc2luZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX0RFQ1JZUFRfRVJST1I6ICdmcmFnRGVjcnlwdEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBmcmFnbWVudCBwYXJzaW5nIGVycm9yIGV2ZW50IC0gZGF0YTogcGFyc2luZyBlcnJvciBkZXNjcmlwdGlvblxuICBGUkFHX1BBUlNJTkdfRVJST1I6ICdmcmFnUGFyc2luZ0Vycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZGVjcnlwdCBrZXkgbG9hZCBlcnJvciAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcmVzcG9uc2UgOiBYSFIgcmVzcG9uc2V9XG4gIEtFWV9MT0FEX0VSUk9SOiAna2V5TG9hZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgZGVjcnlwdCBrZXkgbG9hZCB0aW1lb3V0IGVycm9yIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBLRVlfTE9BRF9USU1FT1VUOiAna2V5TG9hZFRpbWVPdXQnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGJ1ZmZlciBhcHBlbmQgZXJyb3IgLSBkYXRhOiBhcHBlbmQgZXJyb3IgZGVzY3JpcHRpb25cbiAgQlVGRkVSX0FQUEVORF9FUlJPUjogJ2J1ZmZlckFwcGVuZEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBidWZmZXIgYXBwZW5kaW5nIGVycm9yIGV2ZW50IC0gZGF0YTogYXBwZW5kaW5nIGVycm9yIGRlc2NyaXB0aW9uXG4gIEJVRkZFUl9BUFBFTkRJTkdfRVJST1I6ICdidWZmZXJBcHBlbmRpbmdFcnJvcicsXG4gIC8vIElkZW50aWZpZXIgZm9yIGEgYnVmZmVyIHN0YWxsZWQgZXJyb3IgZXZlbnRcbiAgQlVGRkVSX1NUQUxMRURfRVJST1I6ICdidWZmZXJTdGFsbGVkRXJyb3InLFxuICAvLyBJZGVudGlmaWVyIGZvciBhIGJ1ZmZlciBmdWxsIGV2ZW50XG4gIEJVRkZFUl9GVUxMX0VSUk9SOiAnYnVmZmVyRnVsbEVycm9yJyxcbiAgLy8gSWRlbnRpZmllciBmb3IgYSBidWZmZXIgc2VlayBvdmVyIGhvbGUgZXZlbnRcbiAgQlVGRkVSX1NFRUtfT1ZFUl9IT0xFOiAnYnVmZmVyU2Vla092ZXJIb2xlJ1xufTtcbiIsIi8qXG4qXG4qIEFsbCBvYmplY3RzIGluIHRoZSBldmVudCBoYW5kbGluZyBjaGFpbiBzaG91bGQgaW5oZXJpdCBmcm9tIHRoaXMgY2xhc3NcbipcbiovXG5cbi8vaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcblxuY2xhc3MgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMsIC4uLmV2ZW50cykge1xuICAgIHRoaXMuaGxzID0gaGxzO1xuICAgIHRoaXMub25FdmVudCA9IHRoaXMub25FdmVudC5iaW5kKHRoaXMpO1xuICAgIHRoaXMuaGFuZGxlZEV2ZW50cyA9IGV2ZW50cztcbiAgICB0aGlzLnVzZUdlbmVyaWNIYW5kbGVyID0gdHJ1ZTtcblxuICAgIHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy51bnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG4gIH1cblxuICBpc0V2ZW50SGFuZGxlcigpIHtcbiAgICByZXR1cm4gdHlwZW9mIHRoaXMuaGFuZGxlZEV2ZW50cyA9PT0gJ29iamVjdCcgJiYgdGhpcy5oYW5kbGVkRXZlbnRzLmxlbmd0aCAmJiB0eXBlb2YgdGhpcy5vbkV2ZW50ID09PSAnZnVuY3Rpb24nO1xuICB9XG5cbiAgcmVnaXN0ZXJMaXN0ZW5lcnMoKSB7XG4gICAgaWYgKHRoaXMuaXNFdmVudEhhbmRsZXIoKSkge1xuICAgICAgdGhpcy5oYW5kbGVkRXZlbnRzLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgaWYgKGV2ZW50ID09PSAnaGxzRXZlbnRHZW5lcmljJykge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignRm9yYmlkZGVuIGV2ZW50IG5hbWU6ICcgKyBldmVudCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5obHMub24oZXZlbnQsIHRoaXMub25FdmVudCk7XG4gICAgICB9LmJpbmQodGhpcykpO1xuICAgIH1cbiAgfVxuXG4gIHVucmVnaXN0ZXJMaXN0ZW5lcnMoKSB7XG4gICAgaWYgKHRoaXMuaXNFdmVudEhhbmRsZXIoKSkge1xuICAgICAgdGhpcy5oYW5kbGVkRXZlbnRzLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICAgICAgdGhpcy5obHMub2ZmKGV2ZW50LCB0aGlzLm9uRXZlbnQpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9XG4gIH1cblxuICAvKlxuICAqIGFyZ3VtZW50czogZXZlbnQgKHN0cmluZyksIGRhdGEgKGFueSlcbiAgKi9cbiAgb25FdmVudChldmVudCwgZGF0YSkge1xuICAgIHRoaXMub25FdmVudEdlbmVyaWMoZXZlbnQsIGRhdGEpO1xuICB9XG5cbiAgb25FdmVudEdlbmVyaWMoZXZlbnQsIGRhdGEpIHtcbiAgICB2YXIgZXZlbnRUb0Z1bmN0aW9uID0gZnVuY3Rpb24oZXZlbnQsIGRhdGEpIHtcbiAgICAgIHZhciBmdW5jTmFtZSA9ICdvbicgKyBldmVudC5yZXBsYWNlKCdobHMnLCAnJyk7XG4gICAgICBpZiAodHlwZW9mIHRoaXNbZnVuY05hbWVdICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgRXZlbnQgJHtldmVudH0gaGFzIG5vIGdlbmVyaWMgaGFuZGxlciBpbiB0aGlzICR7dGhpcy5jb25zdHJ1Y3Rvci5uYW1lfSBjbGFzcyAodHJpZWQgJHtmdW5jTmFtZX0pYCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpc1tmdW5jTmFtZV0uYmluZCh0aGlzLCBkYXRhKTtcbiAgICB9O1xuICAgIGV2ZW50VG9GdW5jdGlvbi5jYWxsKHRoaXMsIGV2ZW50LCBkYXRhKS5jYWxsKCk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRXZlbnRIYW5kbGVyOyIsIm1vZHVsZS5leHBvcnRzID0ge1xuICAvLyBmaXJlZCBiZWZvcmUgTWVkaWFTb3VyY2UgaXMgYXR0YWNoaW5nIHRvIG1lZGlhIGVsZW1lbnQgLSBkYXRhOiB7IG1lZGlhIH1cbiAgTUVESUFfQVRUQUNISU5HOiAnaGxzTWVkaWFBdHRhY2hpbmcnLFxuICAvLyBmaXJlZCB3aGVuIE1lZGlhU291cmNlIGhhcyBiZWVuIHN1Y2Nlc2Z1bGx5IGF0dGFjaGVkIHRvIG1lZGlhIGVsZW1lbnQgLSBkYXRhOiB7IH1cbiAgTUVESUFfQVRUQUNIRUQ6ICdobHNNZWRpYUF0dGFjaGVkJyxcbiAgLy8gZmlyZWQgYmVmb3JlIGRldGFjaGluZyBNZWRpYVNvdXJjZSBmcm9tIG1lZGlhIGVsZW1lbnQgLSBkYXRhOiB7IH1cbiAgTUVESUFfREVUQUNISU5HOiAnaGxzTWVkaWFEZXRhY2hpbmcnLFxuICAvLyBmaXJlZCB3aGVuIE1lZGlhU291cmNlIGhhcyBiZWVuIGRldGFjaGVkIGZyb20gbWVkaWEgZWxlbWVudCAtIGRhdGE6IHsgfVxuICBNRURJQV9ERVRBQ0hFRDogJ2hsc01lZGlhRGV0YWNoZWQnLFxuICAvLyBmaXJlZCB3aGVuIHdlIGJ1ZmZlciBpcyBnb2luZyB0byBiZSByZXNldHRlZFxuICBCVUZGRVJfUkVTRVQ6ICdobHNCdWZmZXJSZXNldCcsXG4gIC8vIGZpcmVkIHdoZW4gd2Uga25vdyBhYm91dCB0aGUgY29kZWNzIHRoYXQgd2UgbmVlZCBidWZmZXJzIGZvciB0byBwdXNoIGludG8gLSBkYXRhOiB7dHJhY2tzIDogeyBjb250YWluZXIsIGNvZGVjLCBsZXZlbENvZGVjLCBpbml0U2VnbWVudCwgbWV0YWRhdGEgfX1cbiAgQlVGRkVSX0NPREVDUzogJ2hsc0J1ZmZlckNvZGVjcycsXG4gIC8vIGZpcmVkIHdoZW4gd2UgYXBwZW5kIGEgc2VnbWVudCB0byB0aGUgYnVmZmVyIC0gZGF0YTogeyBzZWdtZW50OiBzZWdtZW50IG9iamVjdCB9XG4gIEJVRkZFUl9BUFBFTkRJTkc6ICdobHNCdWZmZXJBcHBlbmRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIHdlIGFyZSBkb25lIHdpdGggYXBwZW5kaW5nIGEgbWVkaWEgc2VnbWVudCB0byB0aGUgYnVmZmVyXG4gIEJVRkZFUl9BUFBFTkRFRDogJ2hsc0J1ZmZlckFwcGVuZGVkJyxcbiAgLy8gZmlyZWQgd2hlbiB0aGUgc3RyZWFtIGlzIGZpbmlzaGVkIGFuZCB3ZSB3YW50IHRvIG5vdGlmeSB0aGUgbWVkaWEgYnVmZmVyIHRoYXQgdGhlcmUgd2lsbCBiZSBubyBtb3JlIGRhdGFcbiAgQlVGRkVSX0VPUzogJ2hsc0J1ZmZlckVvcycsXG4gIC8vIGZpcmVkIHdoZW4gdGhlIG1lZGlhIGJ1ZmZlciBzaG91bGQgYmUgZmx1c2hlZCAtIGRhdGEge3N0YXJ0T2Zmc2V0LCBlbmRPZmZzZXR9XG4gIEJVRkZFUl9GTFVTSElORzogJ2hsc0J1ZmZlckZsdXNoaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiB0aGUgbWVkaWEgaGFzIGJlZW4gZmx1c2hlZFxuICBCVUZGRVJfRkxVU0hFRDogJ2hsc0J1ZmZlckZsdXNoZWQnLFxuICAvLyBmaXJlZCB0byBzaWduYWwgdGhhdCBhIG1hbmlmZXN0IGxvYWRpbmcgc3RhcnRzIC0gZGF0YTogeyB1cmwgOiBtYW5pZmVzdFVSTH1cbiAgTUFOSUZFU1RfTE9BRElORzogJ2hsc01hbmlmZXN0TG9hZGluZycsXG4gIC8vIGZpcmVkIGFmdGVyIG1hbmlmZXN0IGhhcyBiZWVuIGxvYWRlZCAtIGRhdGE6IHsgbGV2ZWxzIDogW2F2YWlsYWJsZSBxdWFsaXR5IGxldmVsc10gLCB1cmwgOiBtYW5pZmVzdFVSTCwgc3RhdHMgOiB7IHRyZXF1ZXN0LCB0Zmlyc3QsIHRsb2FkLCBtdGltZX19XG4gIE1BTklGRVNUX0xPQURFRDogJ2hsc01hbmlmZXN0TG9hZGVkJyxcbiAgLy8gZmlyZWQgYWZ0ZXIgbWFuaWZlc3QgaGFzIGJlZW4gcGFyc2VkIC0gZGF0YTogeyBsZXZlbHMgOiBbYXZhaWxhYmxlIHF1YWxpdHkgbGV2ZWxzXSAsIGZpcnN0TGV2ZWwgOiBpbmRleCBvZiBmaXJzdCBxdWFsaXR5IGxldmVsIGFwcGVhcmluZyBpbiBNYW5pZmVzdH1cbiAgTUFOSUZFU1RfUEFSU0VEOiAnaGxzTWFuaWZlc3RQYXJzZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgcGxheWxpc3QgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IHVybCA6IGxldmVsIFVSTCAgbGV2ZWwgOiBpZCBvZiBsZXZlbCBiZWluZyBsb2FkZWR9XG4gIExFVkVMX0xPQURJTkc6ICdobHNMZXZlbExvYWRpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgbGV2ZWwgcGxheWxpc3QgbG9hZGluZyBmaW5pc2hlcyAtIGRhdGE6IHsgZGV0YWlscyA6IGxldmVsRGV0YWlscyBvYmplY3QsIGxldmVsIDogaWQgb2YgbG9hZGVkIGxldmVsLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIG10aW1lfSB9XG4gIExFVkVMX0xPQURFRDogJ2hsc0xldmVsTG9hZGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsJ3MgZGV0YWlscyBoYXZlIGJlZW4gdXBkYXRlZCBiYXNlZCBvbiBwcmV2aW91cyBkZXRhaWxzLCBhZnRlciBpdCBoYXMgYmVlbiBsb2FkZWQuIC0gZGF0YTogeyBkZXRhaWxzIDogbGV2ZWxEZXRhaWxzIG9iamVjdCwgbGV2ZWwgOiBpZCBvZiB1cGRhdGVkIGxldmVsIH1cbiAgTEVWRUxfVVBEQVRFRDogJ2hsc0xldmVsVXBkYXRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gYSBsZXZlbCdzIFBUUyBpbmZvcm1hdGlvbiBoYXMgYmVlbiB1cGRhdGVkIGFmdGVyIHBhcnNpbmcgYSBmcmFnbWVudCAtIGRhdGE6IHsgZGV0YWlscyA6IGxldmVsRGV0YWlscyBvYmplY3QsIGxldmVsIDogaWQgb2YgdXBkYXRlZCBsZXZlbCwgZHJpZnQ6IFBUUyBkcmlmdCBvYnNlcnZlZCB3aGVuIHBhcnNpbmcgbGFzdCBmcmFnbWVudCB9XG4gIExFVkVMX1BUU19VUERBVEVEOiAnaGxzTGV2ZWxQdHNVcGRhdGVkJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGxldmVsIHN3aXRjaCBpcyByZXF1ZXN0ZWQgLSBkYXRhOiB7IGxldmVsIDogaWQgb2YgbmV3IGxldmVsIH1cbiAgTEVWRUxfU1dJVENIOiAnaGxzTGV2ZWxTd2l0Y2gnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEZSQUdfTE9BRElORzogJ2hsc0ZyYWdMb2FkaW5nJyxcbiAgLy8gZmlyZWQgd2hlbiBhIGZyYWdtZW50IGxvYWRpbmcgaXMgcHJvZ3Jlc3NpbmcgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHsgdHJlcXVlc3QsIHRmaXJzdCwgbG9hZGVkfX1cbiAgRlJBR19MT0FEX1BST0dSRVNTOiAnaGxzRnJhZ0xvYWRQcm9ncmVzcycsXG4gIC8vIElkZW50aWZpZXIgZm9yIGZyYWdtZW50IGxvYWQgYWJvcnRpbmcgZm9yIGVtZXJnZW5jeSBzd2l0Y2ggZG93biAtIGRhdGE6IHtmcmFnIDogZnJhZ21lbnQgb2JqZWN0fVxuICBGUkFHX0xPQURfRU1FUkdFTkNZX0FCT1JURUQ6ICdobHNGcmFnTG9hZEVtZXJnZW5jeUFib3J0ZWQnLFxuICAvLyBmaXJlZCB3aGVuIGEgZnJhZ21lbnQgbG9hZGluZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QsIHBheWxvYWQgOiBmcmFnbWVudCBwYXlsb2FkLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIGxlbmd0aH19XG4gIEZSQUdfTE9BREVEOiAnaGxzRnJhZ0xvYWRlZCcsXG4gIC8vIGZpcmVkIHdoZW4gSW5pdCBTZWdtZW50IGhhcyBiZWVuIGV4dHJhY3RlZCBmcm9tIGZyYWdtZW50IC0gZGF0YTogeyBtb292IDogbW9vdiBNUDQgYm94LCBjb2RlY3MgOiBjb2RlY3MgZm91bmQgd2hpbGUgcGFyc2luZyBmcmFnbWVudH1cbiAgRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVDogJ2hsc0ZyYWdQYXJzaW5nSW5pdFNlZ21lbnQnLFxuICAvLyBmaXJlZCB3aGVuIHBhcnNpbmcgc2VpIHRleHQgaXMgY29tcGxldGVkIC0gZGF0YTogeyBzYW1wbGVzIDogWyBzZWkgc2FtcGxlcyBwZXMgXSB9XG4gIEZSQUdfUEFSU0lOR19VU0VSREFUQTogJ2hsc0ZyYWdQYXJzaW5nVXNlcmRhdGEnLFxuICAvLyBmaXJlZCB3aGVuIHBhcnNpbmcgaWQzIGlzIGNvbXBsZXRlZCAtIGRhdGE6IHsgc2FtcGxlcyA6IFsgaWQzIHNhbXBsZXMgcGVzIF0gfVxuICBGUkFHX1BBUlNJTkdfTUVUQURBVEE6ICdobHNGcmFnUGFyc2luZ01ldGFkYXRhJyxcbiAgLy8gZmlyZWQgd2hlbiBkYXRhIGhhdmUgYmVlbiBleHRyYWN0ZWQgZnJvbSBmcmFnbWVudCAtIGRhdGE6IHsgZGF0YTEgOiBtb29mIE1QNCBib3ggb3IgVFMgZnJhZ21lbnRzLCBkYXRhMiA6IG1kYXQgTVA0IGJveCBvciBudWxsfVxuICBGUkFHX1BBUlNJTkdfREFUQTogJ2hsc0ZyYWdQYXJzaW5nRGF0YScsXG4gIC8vIGZpcmVkIHdoZW4gZnJhZ21lbnQgcGFyc2luZyBpcyBjb21wbGV0ZWQgLSBkYXRhOiB1bmRlZmluZWRcbiAgRlJBR19QQVJTRUQ6ICdobHNGcmFnUGFyc2VkJyxcbiAgLy8gZmlyZWQgd2hlbiBmcmFnbWVudCByZW11eGVkIE1QNCBib3hlcyBoYXZlIGFsbCBiZWVuIGFwcGVuZGVkIGludG8gU291cmNlQnVmZmVyIC0gZGF0YTogeyBmcmFnIDogZnJhZ21lbnQgb2JqZWN0LCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIHRwYXJzZWQsIHRidWZmZXJlZCwgbGVuZ3RofSB9XG4gIEZSQUdfQlVGRkVSRUQ6ICdobHNGcmFnQnVmZmVyZWQnLFxuICAvLyBmaXJlZCB3aGVuIGZyYWdtZW50IG1hdGNoaW5nIHdpdGggY3VycmVudCBtZWRpYSBwb3NpdGlvbiBpcyBjaGFuZ2luZyAtIGRhdGEgOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3QgfVxuICBGUkFHX0NIQU5HRUQ6ICdobHNGcmFnQ2hhbmdlZCcsXG4gICAgLy8gSWRlbnRpZmllciBmb3IgYSBGUFMgZHJvcCBldmVudCAtIGRhdGE6IHtjdXJlbnREcm9wcGVkLCBjdXJyZW50RGVjb2RlZCwgdG90YWxEcm9wcGVkRnJhbWVzfVxuICBGUFNfRFJPUDogJ2hsc0Zwc0Ryb3AnLFxuICAvLyBJZGVudGlmaWVyIGZvciBhbiBlcnJvciBldmVudCAtIGRhdGE6IHsgdHlwZSA6IGVycm9yIHR5cGUsIGRldGFpbHMgOiBlcnJvciBkZXRhaWxzLCBmYXRhbCA6IGlmIHRydWUsIGhscy5qcyBjYW5ub3Qvd2lsbCBub3QgdHJ5IHRvIHJlY292ZXIsIGlmIGZhbHNlLCBobHMuanMgd2lsbCB0cnkgdG8gcmVjb3ZlcixvdGhlciBlcnJvciBzcGVjaWZpYyBkYXRhfVxuICBFUlJPUjogJ2hsc0Vycm9yJyxcbiAgLy8gZmlyZWQgd2hlbiBobHMuanMgaW5zdGFuY2Ugc3RhcnRzIGRlc3Ryb3lpbmcuIERpZmZlcmVudCBmcm9tIE1FRElBX0RFVEFDSEVEIGFzIG9uZSBjb3VsZCB3YW50IHRvIGRldGFjaCBhbmQgcmVhdHRhY2ggYSBtZWRpYSB0byB0aGUgaW5zdGFuY2Ugb2YgaGxzLmpzIHRvIGhhbmRsZSBtaWQtcm9sbHMgZm9yIGV4YW1wbGVcbiAgREVTVFJPWUlORzogJ2hsc0Rlc3Ryb3lpbmcnLFxuICAvLyBmaXJlZCB3aGVuIGEgZGVjcnlwdCBrZXkgbG9hZGluZyBzdGFydHMgLSBkYXRhOiB7IGZyYWcgOiBmcmFnbWVudCBvYmplY3R9XG4gIEtFWV9MT0FESU5HOiAnaGxzS2V5TG9hZGluZycsXG4gIC8vIGZpcmVkIHdoZW4gYSBkZWNyeXB0IGtleSBsb2FkaW5nIGlzIGNvbXBsZXRlZCAtIGRhdGE6IHsgZnJhZyA6IGZyYWdtZW50IG9iamVjdCwgcGF5bG9hZCA6IGtleSBwYXlsb2FkLCBzdGF0cyA6IHsgdHJlcXVlc3QsIHRmaXJzdCwgdGxvYWQsIGxlbmd0aH19XG4gIEtFWV9MT0FERUQ6ICdobHNLZXlMb2FkZWQnLFxufTtcbiIsIi8qKlxuICogQnVmZmVyIEhlbHBlciBjbGFzcywgcHJvdmlkaW5nIG1ldGhvZHMgZGVhbGluZyBidWZmZXIgbGVuZ3RoIHJldHJpZXZhbFxuKi9cblxuXG5jbGFzcyBCdWZmZXJIZWxwZXIge1xuXG4gIHN0YXRpYyBidWZmZXJJbmZvKG1lZGlhLCBwb3MsbWF4SG9sZUR1cmF0aW9uKSB7XG4gICAgaWYgKG1lZGlhKSB7XG4gICAgICB2YXIgdmJ1ZmZlcmVkID0gbWVkaWEuYnVmZmVyZWQsIGJ1ZmZlcmVkID0gW10saTtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCB2YnVmZmVyZWQubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgYnVmZmVyZWQucHVzaCh7c3RhcnQ6IHZidWZmZXJlZC5zdGFydChpKSwgZW5kOiB2YnVmZmVyZWQuZW5kKGkpfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gdGhpcy5idWZmZXJlZEluZm8oYnVmZmVyZWQscG9zLG1heEhvbGVEdXJhdGlvbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB7bGVuOiAwLCBzdGFydDogMCwgZW5kOiAwLCBuZXh0U3RhcnQgOiB1bmRlZmluZWR9IDtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgYnVmZmVyZWRJbmZvKGJ1ZmZlcmVkLHBvcyxtYXhIb2xlRHVyYXRpb24pIHtcbiAgICB2YXIgYnVmZmVyZWQyID0gW10sXG4gICAgICAgIC8vIGJ1ZmZlclN0YXJ0IGFuZCBidWZmZXJFbmQgYXJlIGJ1ZmZlciBib3VuZGFyaWVzIGFyb3VuZCBjdXJyZW50IHZpZGVvIHBvc2l0aW9uXG4gICAgICAgIGJ1ZmZlckxlbixidWZmZXJTdGFydCwgYnVmZmVyRW5kLGJ1ZmZlclN0YXJ0TmV4dCxpO1xuICAgIC8vIHNvcnQgb24gYnVmZmVyLnN0YXJ0L3NtYWxsZXIgZW5kIChJRSBkb2VzIG5vdCBhbHdheXMgcmV0dXJuIHNvcnRlZCBidWZmZXJlZCByYW5nZSlcbiAgICBidWZmZXJlZC5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG4gICAgICB2YXIgZGlmZiA9IGEuc3RhcnQgLSBiLnN0YXJ0O1xuICAgICAgaWYgKGRpZmYpIHtcbiAgICAgICAgcmV0dXJuIGRpZmY7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gYi5lbmQgLSBhLmVuZDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICAvLyB0aGVyZSBtaWdodCBiZSBzb21lIHNtYWxsIGhvbGVzIGJldHdlZW4gYnVmZmVyIHRpbWUgcmFuZ2VcbiAgICAvLyBjb25zaWRlciB0aGF0IGhvbGVzIHNtYWxsZXIgdGhhbiBtYXhIb2xlRHVyYXRpb24gYXJlIGlycmVsZXZhbnQgYW5kIGJ1aWxkIGFub3RoZXJcbiAgICAvLyBidWZmZXIgdGltZSByYW5nZSByZXByZXNlbnRhdGlvbnMgdGhhdCBkaXNjYXJkcyB0aG9zZSBob2xlc1xuICAgIGZvciAoaSA9IDA7IGkgPCBidWZmZXJlZC5sZW5ndGg7IGkrKykge1xuICAgICAgdmFyIGJ1ZjJsZW4gPSBidWZmZXJlZDIubGVuZ3RoO1xuICAgICAgaWYoYnVmMmxlbikge1xuICAgICAgICB2YXIgYnVmMmVuZCA9IGJ1ZmZlcmVkMltidWYybGVuIC0gMV0uZW5kO1xuICAgICAgICAvLyBpZiBzbWFsbCBob2xlICh2YWx1ZSBiZXR3ZWVuIDAgb3IgbWF4SG9sZUR1cmF0aW9uICkgb3Igb3ZlcmxhcHBpbmcgKG5lZ2F0aXZlKVxuICAgICAgICBpZigoYnVmZmVyZWRbaV0uc3RhcnQgLSBidWYyZW5kKSA8IG1heEhvbGVEdXJhdGlvbikge1xuICAgICAgICAgIC8vIG1lcmdlIG92ZXJsYXBwaW5nIHRpbWUgcmFuZ2VzXG4gICAgICAgICAgLy8gdXBkYXRlIGxhc3RSYW5nZS5lbmQgb25seSBpZiBzbWFsbGVyIHRoYW4gaXRlbS5lbmRcbiAgICAgICAgICAvLyBlLmcuICBbIDEsIDE1XSB3aXRoICBbIDIsOF0gPT4gWyAxLDE1XSAobm8gbmVlZCB0byBtb2RpZnkgbGFzdFJhbmdlLmVuZClcbiAgICAgICAgICAvLyB3aGVyZWFzIFsgMSwgOF0gd2l0aCAgWyAyLDE1XSA9PiBbIDEsMTVdICggbGFzdFJhbmdlIHNob3VsZCBzd2l0Y2ggZnJvbSBbMSw4XSB0byBbMSwxNV0pXG4gICAgICAgICAgaWYoYnVmZmVyZWRbaV0uZW5kID4gYnVmMmVuZCkge1xuICAgICAgICAgICAgYnVmZmVyZWQyW2J1ZjJsZW4gLSAxXS5lbmQgPSBidWZmZXJlZFtpXS5lbmQ7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIGJpZyBob2xlXG4gICAgICAgICAgYnVmZmVyZWQyLnB1c2goYnVmZmVyZWRbaV0pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBmaXJzdCB2YWx1ZVxuICAgICAgICBidWZmZXJlZDIucHVzaChidWZmZXJlZFtpXSk7XG4gICAgICB9XG4gICAgfVxuICAgIGZvciAoaSA9IDAsIGJ1ZmZlckxlbiA9IDAsIGJ1ZmZlclN0YXJ0ID0gYnVmZmVyRW5kID0gcG9zOyBpIDwgYnVmZmVyZWQyLmxlbmd0aDsgaSsrKSB7XG4gICAgICB2YXIgc3RhcnQgPSAgYnVmZmVyZWQyW2ldLnN0YXJ0LFxuICAgICAgICAgIGVuZCA9IGJ1ZmZlcmVkMltpXS5lbmQ7XG4gICAgICAvL2xvZ2dlci5sb2coJ2J1ZiBzdGFydC9lbmQ6JyArIGJ1ZmZlcmVkLnN0YXJ0KGkpICsgJy8nICsgYnVmZmVyZWQuZW5kKGkpKTtcbiAgICAgIGlmICgocG9zICsgbWF4SG9sZUR1cmF0aW9uKSA+PSBzdGFydCAmJiBwb3MgPCBlbmQpIHtcbiAgICAgICAgLy8gcGxheSBwb3NpdGlvbiBpcyBpbnNpZGUgdGhpcyBidWZmZXIgVGltZVJhbmdlLCByZXRyaWV2ZSBlbmQgb2YgYnVmZmVyIHBvc2l0aW9uIGFuZCBidWZmZXIgbGVuZ3RoXG4gICAgICAgIGJ1ZmZlclN0YXJ0ID0gc3RhcnQ7XG4gICAgICAgIGJ1ZmZlckVuZCA9IGVuZDtcbiAgICAgICAgYnVmZmVyTGVuID0gYnVmZmVyRW5kIC0gcG9zO1xuICAgICAgfSBlbHNlIGlmICgocG9zICsgbWF4SG9sZUR1cmF0aW9uKSA8IHN0YXJ0KSB7XG4gICAgICAgIGJ1ZmZlclN0YXJ0TmV4dCA9IHN0YXJ0O1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHtsZW46IGJ1ZmZlckxlbiwgc3RhcnQ6IGJ1ZmZlclN0YXJ0LCBlbmQ6IGJ1ZmZlckVuZCwgbmV4dFN0YXJ0IDogYnVmZmVyU3RhcnROZXh0fTtcbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEJ1ZmZlckhlbHBlcjtcbiIsIi8qKlxuICogTGV2ZWwgSGVscGVyIGNsYXNzLCBwcm92aWRpbmcgbWV0aG9kcyBkZWFsaW5nIHdpdGggcGxheWxpc3Qgc2xpZGluZyBhbmQgZHJpZnRcbiovXG5cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBMZXZlbEhlbHBlciB7XG5cbiAgc3RhdGljIG1lcmdlRGV0YWlscyhvbGREZXRhaWxzLG5ld0RldGFpbHMpIHtcbiAgICB2YXIgc3RhcnQgPSBNYXRoLm1heChvbGREZXRhaWxzLnN0YXJ0U04sbmV3RGV0YWlscy5zdGFydFNOKS1uZXdEZXRhaWxzLnN0YXJ0U04sXG4gICAgICAgIGVuZCA9IE1hdGgubWluKG9sZERldGFpbHMuZW5kU04sbmV3RGV0YWlscy5lbmRTTiktbmV3RGV0YWlscy5zdGFydFNOLFxuICAgICAgICBkZWx0YSA9IG5ld0RldGFpbHMuc3RhcnRTTiAtIG9sZERldGFpbHMuc3RhcnRTTixcbiAgICAgICAgb2xkZnJhZ21lbnRzID0gb2xkRGV0YWlscy5mcmFnbWVudHMsXG4gICAgICAgIG5ld2ZyYWdtZW50cyA9IG5ld0RldGFpbHMuZnJhZ21lbnRzLFxuICAgICAgICBjY09mZnNldCA9MCxcbiAgICAgICAgUFRTRnJhZztcblxuICAgIC8vIGNoZWNrIGlmIG9sZC9uZXcgcGxheWxpc3RzIGhhdmUgZnJhZ21lbnRzIGluIGNvbW1vblxuICAgIGlmICggZW5kIDwgc3RhcnQpIHtcbiAgICAgIG5ld0RldGFpbHMuUFRTS25vd24gPSBmYWxzZTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gbG9vcCB0aHJvdWdoIG92ZXJsYXBwaW5nIFNOIGFuZCB1cGRhdGUgc3RhcnRQVFMgLCBjYywgYW5kIGR1cmF0aW9uIGlmIGFueSBmb3VuZFxuICAgIGZvcih2YXIgaSA9IHN0YXJ0IDsgaSA8PSBlbmQgOyBpKyspIHtcbiAgICAgIHZhciBvbGRGcmFnID0gb2xkZnJhZ21lbnRzW2RlbHRhK2ldLFxuICAgICAgICAgIG5ld0ZyYWcgPSBuZXdmcmFnbWVudHNbaV07XG4gICAgICBjY09mZnNldCA9IG9sZEZyYWcuY2MgLSBuZXdGcmFnLmNjO1xuICAgICAgaWYgKCFpc05hTihvbGRGcmFnLnN0YXJ0UFRTKSkge1xuICAgICAgICBuZXdGcmFnLnN0YXJ0ID0gbmV3RnJhZy5zdGFydFBUUyA9IG9sZEZyYWcuc3RhcnRQVFM7XG4gICAgICAgIG5ld0ZyYWcuZW5kUFRTID0gb2xkRnJhZy5lbmRQVFM7XG4gICAgICAgIG5ld0ZyYWcuZHVyYXRpb24gPSBvbGRGcmFnLmR1cmF0aW9uO1xuICAgICAgICBQVFNGcmFnID0gbmV3RnJhZztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZihjY09mZnNldCkge1xuICAgICAgbG9nZ2VyLmxvZyhgZGlzY29udGludWl0eSBzbGlkaW5nIGZyb20gcGxheWxpc3QsIHRha2UgZHJpZnQgaW50byBhY2NvdW50YCk7XG4gICAgICBmb3IoaSA9IDAgOyBpIDwgbmV3ZnJhZ21lbnRzLmxlbmd0aCA7IGkrKykge1xuICAgICAgICBuZXdmcmFnbWVudHNbaV0uY2MgKz0gY2NPZmZzZXQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gaWYgYXQgbGVhc3Qgb25lIGZyYWdtZW50IGNvbnRhaW5zIFBUUyBpbmZvLCByZWNvbXB1dGUgUFRTIGluZm9ybWF0aW9uIGZvciBhbGwgZnJhZ21lbnRzXG4gICAgaWYoUFRTRnJhZykge1xuICAgICAgTGV2ZWxIZWxwZXIudXBkYXRlRnJhZ1BUUyhuZXdEZXRhaWxzLFBUU0ZyYWcuc24sUFRTRnJhZy5zdGFydFBUUyxQVFNGcmFnLmVuZFBUUyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGFkanVzdCBzdGFydCBieSBzbGlkaW5nIG9mZnNldFxuICAgICAgdmFyIHNsaWRpbmcgPSBvbGRmcmFnbWVudHNbZGVsdGFdLnN0YXJ0O1xuICAgICAgZm9yKGkgPSAwIDsgaSA8IG5ld2ZyYWdtZW50cy5sZW5ndGggOyBpKyspIHtcbiAgICAgICAgbmV3ZnJhZ21lbnRzW2ldLnN0YXJ0ICs9IHNsaWRpbmc7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGlmIHdlIGFyZSBoZXJlLCBpdCBtZWFucyB3ZSBoYXZlIGZyYWdtZW50cyBvdmVybGFwcGluZyBiZXR3ZWVuXG4gICAgLy8gb2xkIGFuZCBuZXcgbGV2ZWwuIHJlbGlhYmxlIFBUUyBpbmZvIGlzIHRodXMgcmVseWluZyBvbiBvbGQgbGV2ZWxcbiAgICBuZXdEZXRhaWxzLlBUU0tub3duID0gb2xkRGV0YWlscy5QVFNLbm93bjtcbiAgICByZXR1cm47XG4gIH1cblxuICBzdGF0aWMgdXBkYXRlRnJhZ1BUUyhkZXRhaWxzLHNuLHN0YXJ0UFRTLGVuZFBUUykge1xuICAgIHZhciBmcmFnSWR4LCBmcmFnbWVudHMsIGZyYWcsIGk7XG4gICAgLy8gZXhpdCBpZiBzbiBvdXQgb2YgcmFuZ2VcbiAgICBpZiAoc24gPCBkZXRhaWxzLnN0YXJ0U04gfHwgc24gPiBkZXRhaWxzLmVuZFNOKSB7XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG4gICAgZnJhZ0lkeCA9IHNuIC0gZGV0YWlscy5zdGFydFNOO1xuICAgIGZyYWdtZW50cyA9IGRldGFpbHMuZnJhZ21lbnRzO1xuICAgIGZyYWcgPSBmcmFnbWVudHNbZnJhZ0lkeF07XG4gICAgaWYoIWlzTmFOKGZyYWcuc3RhcnRQVFMpKSB7XG4gICAgICBzdGFydFBUUyA9IE1hdGgubWluKHN0YXJ0UFRTLGZyYWcuc3RhcnRQVFMpO1xuICAgICAgZW5kUFRTID0gTWF0aC5tYXgoZW5kUFRTLCBmcmFnLmVuZFBUUyk7XG4gICAgfVxuXG4gICAgdmFyIGRyaWZ0ID0gc3RhcnRQVFMgLSBmcmFnLnN0YXJ0O1xuXG4gICAgZnJhZy5zdGFydCA9IGZyYWcuc3RhcnRQVFMgPSBzdGFydFBUUztcbiAgICBmcmFnLmVuZFBUUyA9IGVuZFBUUztcbiAgICBmcmFnLmR1cmF0aW9uID0gZW5kUFRTIC0gc3RhcnRQVFM7XG4gICAgLy8gYWRqdXN0IGZyYWdtZW50IFBUUy9kdXJhdGlvbiBmcm9tIHNlcW51bS0xIHRvIGZyYWcgMFxuICAgIGZvcihpID0gZnJhZ0lkeCA7IGkgPiAwIDsgaS0tKSB7XG4gICAgICBMZXZlbEhlbHBlci51cGRhdGVQVFMoZnJhZ21lbnRzLGksaS0xKTtcbiAgICB9XG5cbiAgICAvLyBhZGp1c3QgZnJhZ21lbnQgUFRTL2R1cmF0aW9uIGZyb20gc2VxbnVtIHRvIGxhc3QgZnJhZ1xuICAgIGZvcihpID0gZnJhZ0lkeCA7IGkgPCBmcmFnbWVudHMubGVuZ3RoIC0gMSA7IGkrKykge1xuICAgICAgTGV2ZWxIZWxwZXIudXBkYXRlUFRTKGZyYWdtZW50cyxpLGkrMSk7XG4gICAgfVxuICAgIGRldGFpbHMuUFRTS25vd24gPSB0cnVlO1xuICAgIC8vbG9nZ2VyLmxvZyhgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmcmFnIHN0YXJ0L2VuZDoke3N0YXJ0UFRTLnRvRml4ZWQoMyl9LyR7ZW5kUFRTLnRvRml4ZWQoMyl9YCk7XG5cbiAgICByZXR1cm4gZHJpZnQ7XG4gIH1cblxuICBzdGF0aWMgdXBkYXRlUFRTKGZyYWdtZW50cyxmcm9tSWR4LCB0b0lkeCkge1xuICAgIHZhciBmcmFnRnJvbSA9IGZyYWdtZW50c1tmcm9tSWR4XSxmcmFnVG8gPSBmcmFnbWVudHNbdG9JZHhdLCBmcmFnVG9QVFMgPSBmcmFnVG8uc3RhcnRQVFM7XG4gICAgLy8gaWYgd2Uga25vdyBzdGFydFBUU1t0b0lkeF1cbiAgICBpZighaXNOYU4oZnJhZ1RvUFRTKSkge1xuICAgICAgLy8gdXBkYXRlIGZyYWdtZW50IGR1cmF0aW9uLlxuICAgICAgLy8gaXQgaGVscHMgdG8gZml4IGRyaWZ0cyBiZXR3ZWVuIHBsYXlsaXN0IHJlcG9ydGVkIGR1cmF0aW9uIGFuZCBmcmFnbWVudCByZWFsIGR1cmF0aW9uXG4gICAgICBpZiAodG9JZHggPiBmcm9tSWR4KSB7XG4gICAgICAgIGZyYWdGcm9tLmR1cmF0aW9uID0gZnJhZ1RvUFRTLWZyYWdGcm9tLnN0YXJ0O1xuICAgICAgICBpZihmcmFnRnJvbS5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYG5lZ2F0aXZlIGR1cmF0aW9uIGNvbXB1dGVkIGZvciBmcmFnICR7ZnJhZ0Zyb20uc259LGxldmVsICR7ZnJhZ0Zyb20ubGV2ZWx9LCB0aGVyZSBzaG91bGQgYmUgc29tZSBkdXJhdGlvbiBkcmlmdCBiZXR3ZWVuIHBsYXlsaXN0IGFuZCBmcmFnbWVudCFgKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZnJhZ1RvLmR1cmF0aW9uID0gZnJhZ0Zyb20uc3RhcnQgLSBmcmFnVG9QVFM7XG4gICAgICAgIGlmKGZyYWdUby5kdXJhdGlvbiA8IDApIHtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYG5lZ2F0aXZlIGR1cmF0aW9uIGNvbXB1dGVkIGZvciBmcmFnICR7ZnJhZ1RvLnNufSxsZXZlbCAke2ZyYWdUby5sZXZlbH0sIHRoZXJlIHNob3VsZCBiZSBzb21lIGR1cmF0aW9uIGRyaWZ0IGJldHdlZW4gcGxheWxpc3QgYW5kIGZyYWdtZW50IWApO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIHdlIGRvbnQga25vdyBzdGFydFBUU1t0b0lkeF1cbiAgICAgIGlmICh0b0lkeCA+IGZyb21JZHgpIHtcbiAgICAgICAgZnJhZ1RvLnN0YXJ0ID0gZnJhZ0Zyb20uc3RhcnQgKyBmcmFnRnJvbS5kdXJhdGlvbjtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGZyYWdUby5zdGFydCA9IGZyYWdGcm9tLnN0YXJ0IC0gZnJhZ1RvLmR1cmF0aW9uO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBMZXZlbEhlbHBlcjtcbiIsIi8qKlxuICogSExTIGludGVyZmFjZVxuICovXG4ndXNlIHN0cmljdCc7XG5cbmltcG9ydCBFdmVudCBmcm9tICcuL2V2ZW50cyc7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi9lcnJvcnMnO1xuaW1wb3J0IFBsYXlsaXN0TG9hZGVyIGZyb20gJy4vbG9hZGVyL3BsYXlsaXN0LWxvYWRlcic7XG5pbXBvcnQgRnJhZ21lbnRMb2FkZXIgZnJvbSAnLi9sb2FkZXIvZnJhZ21lbnQtbG9hZGVyJztcbmltcG9ydCBBYnJDb250cm9sbGVyIGZyb20gICAgJy4vY29udHJvbGxlci9hYnItY29udHJvbGxlcic7XG5pbXBvcnQgQnVmZmVyQ29udHJvbGxlciBmcm9tICAnLi9jb250cm9sbGVyL2J1ZmZlci1jb250cm9sbGVyJztcbmltcG9ydCBDYXBMZXZlbENvbnRyb2xsZXIgZnJvbSAgJy4vY29udHJvbGxlci9jYXAtbGV2ZWwtY29udHJvbGxlcic7XG5pbXBvcnQgU3RyZWFtQ29udHJvbGxlciBmcm9tICAnLi9jb250cm9sbGVyL3N0cmVhbS1jb250cm9sbGVyJztcbmltcG9ydCBMZXZlbENvbnRyb2xsZXIgZnJvbSAgJy4vY29udHJvbGxlci9sZXZlbC1jb250cm9sbGVyJztcbmltcG9ydCBUaW1lbGluZUNvbnRyb2xsZXIgZnJvbSAnLi9jb250cm9sbGVyL3RpbWVsaW5lLWNvbnRyb2xsZXInO1xuLy9pbXBvcnQgRlBTQ29udHJvbGxlciBmcm9tICcuL2NvbnRyb2xsZXIvZnBzLWNvbnRyb2xsZXInO1xuaW1wb3J0IHtsb2dnZXIsIGVuYWJsZUxvZ3N9IGZyb20gJy4vdXRpbHMvbG9nZ2VyJztcbmltcG9ydCBYaHJMb2FkZXIgZnJvbSAnLi91dGlscy94aHItbG9hZGVyJztcbmltcG9ydCBFdmVudEVtaXR0ZXIgZnJvbSAnZXZlbnRzJztcbmltcG9ydCBLZXlMb2FkZXIgZnJvbSAnLi9sb2FkZXIva2V5LWxvYWRlcic7XG5cbmNsYXNzIEhscyB7XG5cbiAgc3RhdGljIGlzU3VwcG9ydGVkKCkge1xuICAgIHJldHVybiAod2luZG93Lk1lZGlhU291cmNlICYmIHdpbmRvdy5NZWRpYVNvdXJjZS5pc1R5cGVTdXBwb3J0ZWQoJ3ZpZGVvL21wNDsgY29kZWNzPVwiYXZjMS40MkUwMUUsbXA0YS40MC4yXCInKSk7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEV2ZW50cygpIHtcbiAgICByZXR1cm4gRXZlbnQ7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEVycm9yVHlwZXMoKSB7XG4gICAgcmV0dXJuIEVycm9yVHlwZXM7XG4gIH1cblxuICBzdGF0aWMgZ2V0IEVycm9yRGV0YWlscygpIHtcbiAgICByZXR1cm4gRXJyb3JEZXRhaWxzO1xuICB9XG5cbiAgc3RhdGljIGdldCBEZWZhdWx0Q29uZmlnKCkge1xuICAgIGlmKCFIbHMuZGVmYXVsdENvbmZpZykge1xuICAgICAgIEhscy5kZWZhdWx0Q29uZmlnID0ge1xuICAgICAgICAgIGF1dG9TdGFydExvYWQ6IHRydWUsXG4gICAgICAgICAgZGVidWc6IGZhbHNlLFxuICAgICAgICAgIGNhcExldmVsVG9QbGF5ZXJTaXplOiBmYWxzZSxcbiAgICAgICAgICBtYXhCdWZmZXJMZW5ndGg6IDMwLFxuICAgICAgICAgIG1heEJ1ZmZlclNpemU6IDYwICogMTAwMCAqIDEwMDAsXG4gICAgICAgICAgbWF4QnVmZmVySG9sZTogMC41LFxuICAgICAgICAgIG1heFNlZWtIb2xlOiAyLFxuICAgICAgICAgIG1heEZyYWdMb29rVXBUb2xlcmFuY2UgOiAwLjIsXG4gICAgICAgICAgbGl2ZVN5bmNEdXJhdGlvbkNvdW50OjMsXG4gICAgICAgICAgbGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50OiBJbmZpbml0eSxcbiAgICAgICAgICBsaXZlU3luY0R1cmF0aW9uOiB1bmRlZmluZWQsXG4gICAgICAgICAgbGl2ZU1heExhdGVuY3lEdXJhdGlvbjogdW5kZWZpbmVkLFxuICAgICAgICAgIG1heE1heEJ1ZmZlckxlbmd0aDogNjAwLFxuICAgICAgICAgIGVuYWJsZVdvcmtlcjogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVTb2Z0d2FyZUFFUzogdHJ1ZSxcbiAgICAgICAgICBtYW5pZmVzdExvYWRpbmdUaW1lT3V0OiAxMDAwMCxcbiAgICAgICAgICBtYW5pZmVzdExvYWRpbmdNYXhSZXRyeTogMSxcbiAgICAgICAgICBtYW5pZmVzdExvYWRpbmdSZXRyeURlbGF5OiAxMDAwLFxuICAgICAgICAgIGxldmVsTG9hZGluZ1RpbWVPdXQ6IDEwMDAwLFxuICAgICAgICAgIGxldmVsTG9hZGluZ01heFJldHJ5OiA0LFxuICAgICAgICAgIGxldmVsTG9hZGluZ1JldHJ5RGVsYXk6IDEwMDAsXG4gICAgICAgICAgZnJhZ0xvYWRpbmdUaW1lT3V0OiAyMDAwMCxcbiAgICAgICAgICBmcmFnTG9hZGluZ01heFJldHJ5OiA2LFxuICAgICAgICAgIGZyYWdMb2FkaW5nUmV0cnlEZWxheTogMTAwMCxcbiAgICAgICAgICBmcmFnTG9hZGluZ0xvb3BUaHJlc2hvbGQ6IDMsXG4gICAgICAgICAgc3RhcnRGcmFnUHJlZmV0Y2ggOiBmYWxzZSxcbiAgICAgICAgICAvLyBmcHNEcm9wcGVkTW9uaXRvcmluZ1BlcmlvZDogNTAwMCxcbiAgICAgICAgICAvLyBmcHNEcm9wcGVkTW9uaXRvcmluZ1RocmVzaG9sZDogMC4yLFxuICAgICAgICAgIGFwcGVuZEVycm9yTWF4UmV0cnk6IDMsXG4gICAgICAgICAgbG9hZGVyOiBYaHJMb2FkZXIsXG4gICAgICAgICAgZkxvYWRlcjogdW5kZWZpbmVkLFxuICAgICAgICAgIHBMb2FkZXI6IHVuZGVmaW5lZCxcbiAgICAgICAgICBhYnJDb250cm9sbGVyIDogQWJyQ29udHJvbGxlcixcbiAgICAgICAgICBidWZmZXJDb250cm9sbGVyIDogQnVmZmVyQ29udHJvbGxlcixcbiAgICAgICAgICBjYXBMZXZlbENvbnRyb2xsZXIgOiBDYXBMZXZlbENvbnRyb2xsZXIsXG4gICAgICAgICAgc3RyZWFtQ29udHJvbGxlcjogU3RyZWFtQ29udHJvbGxlcixcbiAgICAgICAgICB0aW1lbGluZUNvbnRyb2xsZXI6IFRpbWVsaW5lQ29udHJvbGxlcixcbiAgICAgICAgICBlbmFibGVDRUE3MDhDYXB0aW9uczogdHJ1ZSxcbiAgICAgICAgICBlbmFibGVNUDJUUGFzc1Rocm91Z2ggOiBmYWxzZVxuICAgICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4gSGxzLmRlZmF1bHRDb25maWc7XG4gIH1cblxuICBzdGF0aWMgc2V0IERlZmF1bHRDb25maWcoZGVmYXVsdENvbmZpZykge1xuICAgIEhscy5kZWZhdWx0Q29uZmlnID0gZGVmYXVsdENvbmZpZztcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZyA9IHt9KSB7XG4gICAgdmFyIGRlZmF1bHRDb25maWcgPSBIbHMuRGVmYXVsdENvbmZpZztcblxuICAgIGlmICgoY29uZmlnLmxpdmVTeW5jRHVyYXRpb25Db3VudCB8fCBjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50KSAmJiAoY29uZmlnLmxpdmVTeW5jRHVyYXRpb24gfHwgY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb24pKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lsbGVnYWwgaGxzLmpzIGNvbmZpZzogZG9uXFwndCBtaXggdXAgbGl2ZVN5bmNEdXJhdGlvbkNvdW50L2xpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudCBhbmQgbGl2ZVN5bmNEdXJhdGlvbi9saXZlTWF4TGF0ZW5jeUR1cmF0aW9uJyk7XG4gICAgfVxuXG4gICAgZm9yICh2YXIgcHJvcCBpbiBkZWZhdWx0Q29uZmlnKSB7XG4gICAgICAgIGlmIChwcm9wIGluIGNvbmZpZykgeyBjb250aW51ZTsgfVxuICAgICAgICBjb25maWdbcHJvcF0gPSBkZWZhdWx0Q29uZmlnW3Byb3BdO1xuICAgIH1cblxuICAgIGlmIChjb25maWcubGl2ZU1heExhdGVuY3lEdXJhdGlvbkNvdW50ICE9PSB1bmRlZmluZWQgJiYgY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb25Db3VudCA8PSBjb25maWcubGl2ZVN5bmNEdXJhdGlvbkNvdW50KSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0lsbGVnYWwgaGxzLmpzIGNvbmZpZzogXCJsaXZlTWF4TGF0ZW5jeUR1cmF0aW9uQ291bnRcIiBtdXN0IGJlIGd0IFwibGl2ZVN5bmNEdXJhdGlvbkNvdW50XCInKTtcbiAgICB9XG5cbiAgICBpZiAoY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb24gIT09IHVuZGVmaW5lZCAmJiAoY29uZmlnLmxpdmVNYXhMYXRlbmN5RHVyYXRpb24gPD0gY29uZmlnLmxpdmVTeW5jRHVyYXRpb24gfHwgY29uZmlnLmxpdmVTeW5jRHVyYXRpb24gPT09IHVuZGVmaW5lZCkpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignSWxsZWdhbCBobHMuanMgY29uZmlnOiBcImxpdmVNYXhMYXRlbmN5RHVyYXRpb25cIiBtdXN0IGJlIGd0IFwibGl2ZVN5bmNEdXJhdGlvblwiJyk7XG4gICAgfVxuXG4gICAgZW5hYmxlTG9ncyhjb25maWcuZGVidWcpO1xuICAgIHRoaXMuY29uZmlnID0gY29uZmlnO1xuICAgIC8vIG9ic2VydmVyIHNldHVwXG4gICAgdmFyIG9ic2VydmVyID0gdGhpcy5vYnNlcnZlciA9IG5ldyBFdmVudEVtaXR0ZXIoKTtcbiAgICBvYnNlcnZlci50cmlnZ2VyID0gZnVuY3Rpb24gdHJpZ2dlciAoZXZlbnQsIC4uLmRhdGEpIHtcbiAgICAgIG9ic2VydmVyLmVtaXQoZXZlbnQsIGV2ZW50LCAuLi5kYXRhKTtcbiAgICB9O1xuXG4gICAgb2JzZXJ2ZXIub2ZmID0gZnVuY3Rpb24gb2ZmIChldmVudCwgLi4uZGF0YSkge1xuICAgICAgb2JzZXJ2ZXIucmVtb3ZlTGlzdGVuZXIoZXZlbnQsIC4uLmRhdGEpO1xuICAgIH07XG4gICAgdGhpcy5vbiA9IG9ic2VydmVyLm9uLmJpbmQob2JzZXJ2ZXIpO1xuICAgIHRoaXMub2ZmID0gb2JzZXJ2ZXIub2ZmLmJpbmQob2JzZXJ2ZXIpO1xuICAgIHRoaXMudHJpZ2dlciA9IG9ic2VydmVyLnRyaWdnZXIuYmluZChvYnNlcnZlcik7XG4gICAgdGhpcy5wbGF5bGlzdExvYWRlciA9IG5ldyBQbGF5bGlzdExvYWRlcih0aGlzKTtcbiAgICB0aGlzLmZyYWdtZW50TG9hZGVyID0gbmV3IEZyYWdtZW50TG9hZGVyKHRoaXMpO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyID0gbmV3IExldmVsQ29udHJvbGxlcih0aGlzKTtcbiAgICB0aGlzLmFickNvbnRyb2xsZXIgPSBuZXcgY29uZmlnLmFickNvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy5idWZmZXJDb250cm9sbGVyID0gbmV3IGNvbmZpZy5idWZmZXJDb250cm9sbGVyKHRoaXMpO1xuICAgIHRoaXMuY2FwTGV2ZWxDb250cm9sbGVyID0gbmV3IGNvbmZpZy5jYXBMZXZlbENvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy5zdHJlYW1Db250cm9sbGVyID0gbmV3IGNvbmZpZy5zdHJlYW1Db250cm9sbGVyKHRoaXMpO1xuICAgIHRoaXMudGltZWxpbmVDb250cm9sbGVyID0gbmV3IGNvbmZpZy50aW1lbGluZUNvbnRyb2xsZXIodGhpcyk7XG4gICAgdGhpcy5rZXlMb2FkZXIgPSBuZXcgS2V5TG9hZGVyKHRoaXMpO1xuICAgIC8vdGhpcy5mcHNDb250cm9sbGVyID0gbmV3IEZQU0NvbnRyb2xsZXIodGhpcyk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGxvZ2dlci5sb2coJ2Rlc3Ryb3knKTtcbiAgICB0aGlzLnRyaWdnZXIoRXZlbnQuREVTVFJPWUlORyk7XG4gICAgdGhpcy5kZXRhY2hNZWRpYSgpO1xuICAgIHRoaXMucGxheWxpc3RMb2FkZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuZnJhZ21lbnRMb2FkZXIuZGVzdHJveSgpO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLmJ1ZmZlckNvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMuY2FwTGV2ZWxDb250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMudGltZWxpbmVDb250cm9sbGVyLmRlc3Ryb3koKTtcbiAgICB0aGlzLmtleUxvYWRlci5kZXN0cm95KCk7XG4gICAgLy90aGlzLmZwc0NvbnRyb2xsZXIuZGVzdHJveSgpO1xuICAgIHRoaXMudXJsID0gbnVsbDtcbiAgICB0aGlzLm9ic2VydmVyLnJlbW92ZUFsbExpc3RlbmVycygpO1xuICB9XG5cbiAgYXR0YWNoTWVkaWEobWVkaWEpIHtcbiAgICBsb2dnZXIubG9nKCdhdHRhY2hNZWRpYScpO1xuICAgIHRoaXMubWVkaWEgPSBtZWRpYTtcbiAgICB0aGlzLnRyaWdnZXIoRXZlbnQuTUVESUFfQVRUQUNISU5HLCB7bWVkaWE6IG1lZGlhfSk7XG4gIH1cblxuICBkZXRhY2hNZWRpYSgpIHtcbiAgICBsb2dnZXIubG9nKCdkZXRhY2hNZWRpYScpO1xuICAgIHRoaXMudHJpZ2dlcihFdmVudC5NRURJQV9ERVRBQ0hJTkcpO1xuICAgIHRoaXMubWVkaWEgPSBudWxsO1xuICB9XG5cbiAgbG9hZFNvdXJjZSh1cmwpIHtcbiAgICBsb2dnZXIubG9nKGBsb2FkU291cmNlOiR7dXJsfWApO1xuICAgIHRoaXMudXJsID0gdXJsO1xuICAgIC8vIHdoZW4gYXR0YWNoaW5nIHRvIGEgc291cmNlIFVSTCwgdHJpZ2dlciBhIHBsYXlsaXN0IGxvYWRcbiAgICB0aGlzLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BRElORywge3VybDogdXJsfSk7XG4gIH1cblxuICBzdGFydExvYWQoc3RhcnRQb3NpdGlvbj0wKSB7XG4gICAgbG9nZ2VyLmxvZygnc3RhcnRMb2FkJyk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RhcnRMb2FkKCk7XG4gICAgdGhpcy5zdHJlYW1Db250cm9sbGVyLnN0YXJ0TG9hZChzdGFydFBvc2l0aW9uKTtcbiAgfVxuXG4gIHN0b3BMb2FkKCkge1xuICAgIGxvZ2dlci5sb2coJ3N0b3BMb2FkJyk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuc3RvcExvYWQoKTtcbiAgICB0aGlzLnN0cmVhbUNvbnRyb2xsZXIuc3RvcExvYWQoKTtcbiAgfVxuXG4gIHN3YXBBdWRpb0NvZGVjKCkge1xuICAgIGxvZ2dlci5sb2coJ3N3YXBBdWRpb0NvZGVjJyk7XG4gICAgdGhpcy5zdHJlYW1Db250cm9sbGVyLnN3YXBBdWRpb0NvZGVjKCk7XG4gIH1cblxuICByZWNvdmVyTWVkaWFFcnJvcigpIHtcbiAgICBsb2dnZXIubG9nKCdyZWNvdmVyTWVkaWFFcnJvcicpO1xuICAgIHZhciBtZWRpYSA9IHRoaXMubWVkaWE7XG4gICAgdGhpcy5kZXRhY2hNZWRpYSgpO1xuICAgIHRoaXMuYXR0YWNoTWVkaWEobWVkaWEpO1xuICB9XG5cbiAgLyoqIFJldHVybiBhbGwgcXVhbGl0eSBsZXZlbHMgKiovXG4gIGdldCBsZXZlbHMoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLmxldmVscztcbiAgfVxuXG4gIC8qKiBSZXR1cm4gY3VycmVudCBwbGF5YmFjayBxdWFsaXR5IGxldmVsICoqL1xuICBnZXQgY3VycmVudExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLnN0cmVhbUNvbnRyb2xsZXIuY3VycmVudExldmVsO1xuICB9XG5cbiAgLyogc2V0IHF1YWxpdHkgbGV2ZWwgaW1tZWRpYXRlbHkgKC0xIGZvciBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uKSAqL1xuICBzZXQgY3VycmVudExldmVsKG5ld0xldmVsKSB7XG4gICAgbG9nZ2VyLmxvZyhgc2V0IGN1cnJlbnRMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubG9hZExldmVsID0gbmV3TGV2ZWw7XG4gICAgdGhpcy5zdHJlYW1Db250cm9sbGVyLmltbWVkaWF0ZUxldmVsU3dpdGNoKCk7XG4gIH1cblxuICAvKiogUmV0dXJuIG5leHQgcGxheWJhY2sgcXVhbGl0eSBsZXZlbCAocXVhbGl0eSBsZXZlbCBvZiBuZXh0IGZyYWdtZW50KSAqKi9cbiAgZ2V0IG5leHRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5zdHJlYW1Db250cm9sbGVyLm5leHRMZXZlbDtcbiAgfVxuXG4gIC8qIHNldCBxdWFsaXR5IGxldmVsIGZvciBuZXh0IGZyYWdtZW50ICgtMSBmb3IgYXV0b21hdGljIGxldmVsIHNlbGVjdGlvbikgKi9cbiAgc2V0IG5leHRMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBuZXh0TGV2ZWw6JHtuZXdMZXZlbH1gKTtcbiAgICB0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbCA9IG5ld0xldmVsO1xuICAgIHRoaXMuc3RyZWFtQ29udHJvbGxlci5uZXh0TGV2ZWxTd2l0Y2goKTtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIHF1YWxpdHkgbGV2ZWwgb2YgY3VycmVudC9sYXN0IGxvYWRlZCBmcmFnbWVudCAqKi9cbiAgZ2V0IGxvYWRMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIubGV2ZWw7XG4gIH1cblxuICAvKiBzZXQgcXVhbGl0eSBsZXZlbCBmb3IgY3VycmVudC9uZXh0IGxvYWRlZCBmcmFnbWVudCAoLTEgZm9yIGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24pICovXG4gIHNldCBsb2FkTGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgbG9hZExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIubWFudWFsTGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIHF1YWxpdHkgbGV2ZWwgb2YgbmV4dCBsb2FkZWQgZnJhZ21lbnQgKiovXG4gIGdldCBuZXh0TG9hZExldmVsKCkge1xuICAgIHJldHVybiB0aGlzLmxldmVsQ29udHJvbGxlci5uZXh0TG9hZExldmVsO1xuICB9XG5cbiAgLyoqIHNldCBxdWFsaXR5IGxldmVsIG9mIG5leHQgbG9hZGVkIGZyYWdtZW50ICoqL1xuICBzZXQgbmV4dExvYWRMZXZlbChsZXZlbCkge1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLm5leHRMb2FkTGV2ZWwgPSBsZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gZmlyc3QgbGV2ZWwgKGluZGV4IG9mIGZpcnN0IGxldmVsIHJlZmVyZW5jZWQgaW4gbWFuaWZlc3QpXG4gICoqL1xuICBnZXQgZmlyc3RMZXZlbCgpIHtcbiAgICByZXR1cm4gdGhpcy5sZXZlbENvbnRyb2xsZXIuZmlyc3RMZXZlbDtcbiAgfVxuXG4gIC8qKiBzZXQgZmlyc3QgbGV2ZWwgKGluZGV4IG9mIGZpcnN0IGxldmVsIHJlZmVyZW5jZWQgaW4gbWFuaWZlc3QpXG4gICoqL1xuICBzZXQgZmlyc3RMZXZlbChuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBmaXJzdExldmVsOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5sZXZlbENvbnRyb2xsZXIuZmlyc3RMZXZlbCA9IG5ld0xldmVsO1xuICB9XG5cbiAgLyoqIFJldHVybiBzdGFydCBsZXZlbCAobGV2ZWwgb2YgZmlyc3QgZnJhZ21lbnQgdGhhdCB3aWxsIGJlIHBsYXllZCBiYWNrKVxuICAgICAgaWYgbm90IG92ZXJyaWRlZCBieSB1c2VyLCBmaXJzdCBsZXZlbCBhcHBlYXJpbmcgaW4gbWFuaWZlc3Qgd2lsbCBiZSB1c2VkIGFzIHN0YXJ0IGxldmVsXG4gICAgICBpZiAtMSA6IGF1dG9tYXRpYyBzdGFydCBsZXZlbCBzZWxlY3Rpb24sIHBsYXliYWNrIHdpbGwgc3RhcnQgZnJvbSBsZXZlbCBtYXRjaGluZyBkb3dubG9hZCBiYW5kd2lkdGggKGRldGVybWluZWQgZnJvbSBkb3dubG9hZCBvZiBmaXJzdCBzZWdtZW50KVxuICAqKi9cbiAgZ2V0IHN0YXJ0TGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLnN0YXJ0TGV2ZWw7XG4gIH1cblxuICAvKiogc2V0ICBzdGFydCBsZXZlbCAobGV2ZWwgb2YgZmlyc3QgZnJhZ21lbnQgdGhhdCB3aWxsIGJlIHBsYXllZCBiYWNrKVxuICAgICAgaWYgbm90IG92ZXJyaWRlZCBieSB1c2VyLCBmaXJzdCBsZXZlbCBhcHBlYXJpbmcgaW4gbWFuaWZlc3Qgd2lsbCBiZSB1c2VkIGFzIHN0YXJ0IGxldmVsXG4gICAgICBpZiAtMSA6IGF1dG9tYXRpYyBzdGFydCBsZXZlbCBzZWxlY3Rpb24sIHBsYXliYWNrIHdpbGwgc3RhcnQgZnJvbSBsZXZlbCBtYXRjaGluZyBkb3dubG9hZCBiYW5kd2lkdGggKGRldGVybWluZWQgZnJvbSBkb3dubG9hZCBvZiBmaXJzdCBzZWdtZW50KVxuICAqKi9cbiAgc2V0IHN0YXJ0TGV2ZWwobmV3TGV2ZWwpIHtcbiAgICBsb2dnZXIubG9nKGBzZXQgc3RhcnRMZXZlbDoke25ld0xldmVsfWApO1xuICAgIHRoaXMubGV2ZWxDb250cm9sbGVyLnN0YXJ0TGV2ZWwgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qKiBSZXR1cm4gdGhlIGNhcHBpbmcvbWF4IGxldmVsIHZhbHVlIHRoYXQgY291bGQgYmUgdXNlZCBieSBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIGFsZ29yaXRobSAqKi9cbiAgZ2V0IGF1dG9MZXZlbENhcHBpbmcoKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJyQ29udHJvbGxlci5hdXRvTGV2ZWxDYXBwaW5nO1xuICB9XG5cbiAgLyoqIHNldCB0aGUgY2FwcGluZy9tYXggbGV2ZWwgdmFsdWUgdGhhdCBjb3VsZCBiZSB1c2VkIGJ5IGF1dG9tYXRpYyBsZXZlbCBzZWxlY3Rpb24gYWxnb3JpdGhtICoqL1xuICBzZXQgYXV0b0xldmVsQ2FwcGluZyhuZXdMZXZlbCkge1xuICAgIGxvZ2dlci5sb2coYHNldCBhdXRvTGV2ZWxDYXBwaW5nOiR7bmV3TGV2ZWx9YCk7XG4gICAgdGhpcy5hYnJDb250cm9sbGVyLmF1dG9MZXZlbENhcHBpbmcgPSBuZXdMZXZlbDtcbiAgfVxuXG4gIC8qIGNoZWNrIGlmIHdlIGFyZSBpbiBhdXRvbWF0aWMgbGV2ZWwgc2VsZWN0aW9uIG1vZGUgKi9cbiAgZ2V0IGF1dG9MZXZlbEVuYWJsZWQoKSB7XG4gICAgcmV0dXJuICh0aGlzLmxldmVsQ29udHJvbGxlci5tYW51YWxMZXZlbCA9PT0gLTEpO1xuICB9XG5cbiAgLyogcmV0dXJuIG1hbnVhbCBsZXZlbCAqL1xuICBnZXQgbWFudWFsTGV2ZWwoKSB7XG4gICAgcmV0dXJuIHRoaXMubGV2ZWxDb250cm9sbGVyLm1hbnVhbExldmVsO1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IEhscztcbiIsIi8vIFRoaXMgaXMgbW9zdGx5IGZvciBzdXBwb3J0IG9mIHRoZSBlczYgbW9kdWxlIGV4cG9ydFxuLy8gc3ludGF4IHdpdGggdGhlIGJhYmVsIGNvbXBpbGVyLCBpdCBsb29rcyBsaWtlIGl0IGRvZXNudCBzdXBwb3J0XG4vLyBmdW5jdGlvbiBleHBvcnRzIGxpa2Ugd2UgYXJlIHVzZWQgdG8gaW4gbm9kZS9jb21tb25qc1xubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2hscy5qcycpLmRlZmF1bHQ7XG4iLCIvKlxuICogRnJhZ21lbnQgTG9hZGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY2xhc3MgRnJhZ21lbnRMb2FkZXIgZXh0ZW5kcyBFdmVudEhhbmRsZXIge1xuXG4gIGNvbnN0cnVjdG9yKGhscykge1xuICAgIHN1cGVyKGhscywgRXZlbnQuRlJBR19MT0FESU5HKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5kZXN0cm95KCk7XG4gICAgICB0aGlzLmxvYWRlciA9IG51bGw7XG4gICAgfVxuICAgIEV2ZW50SGFuZGxlci5wcm90b3R5cGUuZGVzdHJveS5jYWxsKHRoaXMpO1xuICB9XG5cbiAgb25GcmFnTG9hZGluZyhkYXRhKSB7XG4gICAgdmFyIGZyYWcgPSBkYXRhLmZyYWc7XG4gICAgdGhpcy5mcmFnID0gZnJhZztcbiAgICB0aGlzLmZyYWcubG9hZGVkID0gMDtcbiAgICB2YXIgY29uZmlnID0gdGhpcy5obHMuY29uZmlnO1xuICAgIGZyYWcubG9hZGVyID0gdGhpcy5sb2FkZXIgPSB0eXBlb2YoY29uZmlnLmZMb2FkZXIpICE9PSAndW5kZWZpbmVkJyA/IG5ldyBjb25maWcuZkxvYWRlcihjb25maWcpIDogbmV3IGNvbmZpZy5sb2FkZXIoY29uZmlnKTtcbiAgICB0aGlzLmxvYWRlci5sb2FkKGZyYWcudXJsLCAnYXJyYXlidWZmZXInLCB0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyksIHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyksIHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgY29uZmlnLmZyYWdMb2FkaW5nVGltZU91dCwgMSwgMCwgdGhpcy5sb2FkcHJvZ3Jlc3MuYmluZCh0aGlzKSwgZnJhZyk7XG4gIH1cblxuICBsb2Fkc3VjY2VzcyhldmVudCwgc3RhdHMpIHtcbiAgICB2YXIgcGF5bG9hZCA9IGV2ZW50LmN1cnJlbnRUYXJnZXQucmVzcG9uc2U7XG4gICAgc3RhdHMubGVuZ3RoID0gcGF5bG9hZC5ieXRlTGVuZ3RoO1xuICAgIC8vIGRldGFjaCBmcmFnbWVudCBsb2FkZXIgb24gbG9hZCBzdWNjZXNzXG4gICAgdGhpcy5mcmFnLmxvYWRlciA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BREVELCB7cGF5bG9hZDogcGF5bG9hZCwgZnJhZzogdGhpcy5mcmFnLCBzdGF0czogc3RhdHN9KTtcbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLkZSQUdfTE9BRF9FUlJPUiwgZmF0YWw6IGZhbHNlLCBmcmFnOiB0aGlzLmZyYWcsIHJlc3BvbnNlOiBldmVudH0pO1xuICB9XG5cbiAgbG9hZHRpbWVvdXQoKSB7XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19MT0FEX1RJTUVPVVQsIGZhdGFsOiBmYWxzZSwgZnJhZzogdGhpcy5mcmFnfSk7XG4gIH1cblxuICBsb2FkcHJvZ3Jlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdGhpcy5mcmFnLmxvYWRlZCA9IHN0YXRzLmxvYWRlZDtcbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkZSQUdfTE9BRF9QUk9HUkVTUywge2ZyYWc6IHRoaXMuZnJhZywgc3RhdHM6IHN0YXRzfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgRnJhZ21lbnRMb2FkZXI7XG4iLCIvKlxuICogRGVjcnlwdCBrZXkgTG9hZGVyXG4qL1xuXG5pbXBvcnQgRXZlbnQgZnJvbSAnLi4vZXZlbnRzJztcbmltcG9ydCBFdmVudEhhbmRsZXIgZnJvbSAnLi4vZXZlbnQtaGFuZGxlcic7XG5pbXBvcnQge0Vycm9yVHlwZXMsIEVycm9yRGV0YWlsc30gZnJvbSAnLi4vZXJyb3JzJztcblxuY2xhc3MgS2V5TG9hZGVyIGV4dGVuZHMgRXZlbnRIYW5kbGVyIHtcblxuICBjb25zdHJ1Y3RvcihobHMpIHtcbiAgICBzdXBlcihobHMsIEV2ZW50LktFWV9MT0FESU5HKTtcbiAgICB0aGlzLmRlY3J5cHRrZXkgPSBudWxsO1xuICAgIHRoaXMuZGVjcnlwdHVybCA9IG51bGw7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuZGVzdHJveSgpO1xuICAgICAgdGhpcy5sb2FkZXIgPSBudWxsO1xuICAgIH1cbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uS2V5TG9hZGluZyhkYXRhKSB7XG4gICAgdmFyIGZyYWcgPSB0aGlzLmZyYWcgPSBkYXRhLmZyYWcsXG4gICAgICAgIGRlY3J5cHRkYXRhID0gZnJhZy5kZWNyeXB0ZGF0YSxcbiAgICAgICAgdXJpID0gZGVjcnlwdGRhdGEudXJpO1xuICAgICAgICAvLyBpZiB1cmkgaXMgZGlmZmVyZW50IGZyb20gcHJldmlvdXMgb25lIG9yIGlmIGRlY3J5cHQga2V5IG5vdCByZXRyaWV2ZWQgeWV0XG4gICAgICBpZiAodXJpICE9PSB0aGlzLmRlY3J5cHR1cmwgfHwgdGhpcy5kZWNyeXB0a2V5ID09PSBudWxsKSB7XG4gICAgICAgIHZhciBjb25maWcgPSB0aGlzLmhscy5jb25maWc7XG4gICAgICAgIGZyYWcubG9hZGVyID0gdGhpcy5sb2FkZXIgPSBuZXcgY29uZmlnLmxvYWRlcihjb25maWcpO1xuICAgICAgICB0aGlzLmRlY3J5cHR1cmwgPSB1cmk7XG4gICAgICAgIHRoaXMuZGVjcnlwdGtleSA9IG51bGw7XG4gICAgICAgIGZyYWcubG9hZGVyLmxvYWQodXJpLCAnYXJyYXlidWZmZXInLCB0aGlzLmxvYWRzdWNjZXNzLmJpbmQodGhpcyksIHRoaXMubG9hZGVycm9yLmJpbmQodGhpcyksIHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgY29uZmlnLmZyYWdMb2FkaW5nVGltZU91dCwgY29uZmlnLmZyYWdMb2FkaW5nTWF4UmV0cnksIGNvbmZpZy5mcmFnTG9hZGluZ1JldHJ5RGVsYXksIHRoaXMubG9hZHByb2dyZXNzLmJpbmQodGhpcyksIGZyYWcpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLmRlY3J5cHRrZXkpIHtcbiAgICAgICAgLy8gd2UgYWxyZWFkeSBsb2FkZWQgdGhpcyBrZXksIHJldHVybiBpdFxuICAgICAgICBkZWNyeXB0ZGF0YS5rZXkgPSB0aGlzLmRlY3J5cHRrZXk7XG4gICAgICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuS0VZX0xPQURFRCwge2ZyYWc6IGZyYWd9KTtcbiAgICAgIH1cbiAgfVxuXG4gIGxvYWRzdWNjZXNzKGV2ZW50KSB7XG4gICAgdmFyIGZyYWcgPSB0aGlzLmZyYWc7XG4gICAgdGhpcy5kZWNyeXB0a2V5ID0gZnJhZy5kZWNyeXB0ZGF0YS5rZXkgPSBuZXcgVWludDhBcnJheShldmVudC5jdXJyZW50VGFyZ2V0LnJlc3BvbnNlKTtcbiAgICAvLyBkZXRhY2ggZnJhZ21lbnQgbG9hZGVyIG9uIGxvYWQgc3VjY2Vzc1xuICAgIGZyYWcubG9hZGVyID0gdW5kZWZpbmVkO1xuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuS0VZX0xPQURFRCwge2ZyYWc6IGZyYWd9KTtcbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIGlmICh0aGlzLmxvYWRlcikge1xuICAgICAgdGhpcy5sb2FkZXIuYWJvcnQoKTtcbiAgICB9XG4gICAgdGhpcy5obHMudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGU6IEVycm9yVHlwZXMuTkVUV09SS19FUlJPUiwgZGV0YWlsczogRXJyb3JEZXRhaWxzLktFWV9MT0FEX0VSUk9SLCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZywgcmVzcG9uc2U6IGV2ZW50fSk7XG4gIH1cblxuICBsb2FkdGltZW91dCgpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5LRVlfTE9BRF9USU1FT1VULCBmYXRhbDogZmFsc2UsIGZyYWc6IHRoaXMuZnJhZ30pO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKCkge1xuXG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgS2V5TG9hZGVyO1xuIiwiLyoqXG4gKiBQbGF5bGlzdCBMb2FkZXJcbiovXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IEV2ZW50SGFuZGxlciBmcm9tICcuLi9ldmVudC1oYW5kbGVyJztcbmltcG9ydCB7RXJyb3JUeXBlcywgRXJyb3JEZXRhaWxzfSBmcm9tICcuLi9lcnJvcnMnO1xuaW1wb3J0IFVSTEhlbHBlciBmcm9tICcuLi91dGlscy91cmwnO1xuaW1wb3J0IEF0dHJMaXN0IGZyb20gJy4uL3V0aWxzL2F0dHItbGlzdCc7XG4vL2ltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBQbGF5bGlzdExvYWRlciBleHRlbmRzIEV2ZW50SGFuZGxlciB7XG5cbiAgY29uc3RydWN0b3IoaGxzKSB7XG4gICAgc3VwZXIoaGxzLFxuICAgICAgRXZlbnQuTUFOSUZFU1RfTE9BRElORyxcbiAgICAgIEV2ZW50LkxFVkVMX0xPQURJTkcpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmRlc3Ryb3koKTtcbiAgICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy51cmwgPSB0aGlzLmlkID0gbnVsbDtcbiAgICBFdmVudEhhbmRsZXIucHJvdG90eXBlLmRlc3Ryb3kuY2FsbCh0aGlzKTtcbiAgfVxuXG4gIG9uTWFuaWZlc3RMb2FkaW5nKGRhdGEpIHtcbiAgICB0aGlzLmxvYWQoZGF0YS51cmwsIG51bGwpO1xuICB9XG5cbiAgb25MZXZlbExvYWRpbmcoZGF0YSkge1xuICAgIHRoaXMubG9hZChkYXRhLnVybCwgZGF0YS5sZXZlbCwgZGF0YS5pZCk7XG4gIH1cblxuICBsb2FkKHVybCwgaWQxLCBpZDIpIHtcbiAgICB2YXIgY29uZmlnID0gdGhpcy5obHMuY29uZmlnLFxuICAgICAgICByZXRyeSxcbiAgICAgICAgdGltZW91dCxcbiAgICAgICAgcmV0cnlEZWxheTtcbiAgICB0aGlzLnVybCA9IHVybDtcbiAgICB0aGlzLmlkID0gaWQxO1xuICAgIHRoaXMuaWQyID0gaWQyO1xuICAgIGlmKHRoaXMuaWQgPT09IG51bGwpIHtcbiAgICAgIHJldHJ5ID0gY29uZmlnLm1hbmlmZXN0TG9hZGluZ01heFJldHJ5O1xuICAgICAgdGltZW91dCA9IGNvbmZpZy5tYW5pZmVzdExvYWRpbmdUaW1lT3V0O1xuICAgICAgcmV0cnlEZWxheSA9IGNvbmZpZy5tYW5pZmVzdExvYWRpbmdSZXRyeURlbGF5O1xuICAgIH0gZWxzZSB7XG4gICAgICByZXRyeSA9IGNvbmZpZy5sZXZlbExvYWRpbmdNYXhSZXRyeTtcbiAgICAgIHRpbWVvdXQgPSBjb25maWcubGV2ZWxMb2FkaW5nVGltZU91dDtcbiAgICAgIHJldHJ5RGVsYXkgPSBjb25maWcubGV2ZWxMb2FkaW5nUmV0cnlEZWxheTtcbiAgICB9XG4gICAgdGhpcy5sb2FkZXIgPSB0eXBlb2YoY29uZmlnLnBMb2FkZXIpICE9PSAndW5kZWZpbmVkJyA/IG5ldyBjb25maWcucExvYWRlcihjb25maWcpIDogbmV3IGNvbmZpZy5sb2FkZXIoY29uZmlnKTtcbiAgICB0aGlzLmxvYWRlci5sb2FkKHVybCwgJycsIHRoaXMubG9hZHN1Y2Nlc3MuYmluZCh0aGlzKSwgdGhpcy5sb2FkZXJyb3IuYmluZCh0aGlzKSwgdGhpcy5sb2FkdGltZW91dC5iaW5kKHRoaXMpLCB0aW1lb3V0LCByZXRyeSwgcmV0cnlEZWxheSk7XG4gIH1cblxuICByZXNvbHZlKHVybCwgYmFzZVVybCkge1xuICAgIHJldHVybiBVUkxIZWxwZXIuYnVpbGRBYnNvbHV0ZVVSTChiYXNlVXJsLCB1cmwpO1xuICB9XG5cbiAgcGFyc2VNYXN0ZXJQbGF5bGlzdChzdHJpbmcsIGJhc2V1cmwpIHtcbiAgICBsZXQgbGV2ZWxzID0gW10sIHJlc3VsdDtcblxuICAgIC8vIGh0dHBzOi8vcmVnZXgxMDEuY29tIGlzIHlvdXIgZnJpZW5kXG4gICAgY29uc3QgcmUgPSAvI0VYVC1YLVNUUkVBTS1JTkY6KFteXFxuXFxyXSopW1xcclxcbl0rKFteXFxyXFxuXSspL2c7XG4gICAgd2hpbGUgKChyZXN1bHQgPSByZS5leGVjKHN0cmluZykpICE9IG51bGwpe1xuICAgICAgY29uc3QgbGV2ZWwgPSB7fTtcblxuICAgICAgdmFyIGF0dHJzID0gbGV2ZWwuYXR0cnMgPSBuZXcgQXR0ckxpc3QocmVzdWx0WzFdKTtcbiAgICAgIGxldmVsLnVybCA9IHRoaXMucmVzb2x2ZShyZXN1bHRbMl0sIGJhc2V1cmwpO1xuXG4gICAgICB2YXIgcmVzb2x1dGlvbiA9IGF0dHJzLmRlY2ltYWxSZXNvbHV0aW9uKCdSRVNPTFVUSU9OJyk7XG4gICAgICBpZihyZXNvbHV0aW9uKSB7XG4gICAgICAgIGxldmVsLndpZHRoID0gcmVzb2x1dGlvbi53aWR0aDtcbiAgICAgICAgbGV2ZWwuaGVpZ2h0ID0gcmVzb2x1dGlvbi5oZWlnaHQ7XG4gICAgICB9XG4gICAgICBsZXZlbC5iaXRyYXRlID0gYXR0cnMuZGVjaW1hbEludGVnZXIoJ0JBTkRXSURUSCcpO1xuICAgICAgbGV2ZWwubmFtZSA9IGF0dHJzLk5BTUU7XG5cbiAgICAgIHZhciBjb2RlY3MgPSBhdHRycy5DT0RFQ1M7XG4gICAgICBpZihjb2RlY3MpIHtcbiAgICAgICAgY29kZWNzID0gY29kZWNzLnNwbGl0KCcsJyk7XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgY29kZWNzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgY29uc3QgY29kZWMgPSBjb2RlY3NbaV07XG4gICAgICAgICAgaWYgKGNvZGVjLmluZGV4T2YoJ2F2YzEnKSAhPT0gLTEpIHtcbiAgICAgICAgICAgIGxldmVsLnZpZGVvQ29kZWMgPSB0aGlzLmF2YzF0b2F2Y290aShjb2RlYyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldmVsLmF1ZGlvQ29kZWMgPSBjb2RlYztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgbGV2ZWxzLnB1c2gobGV2ZWwpO1xuICAgIH1cbiAgICByZXR1cm4gbGV2ZWxzO1xuICB9XG5cbiAgYXZjMXRvYXZjb3RpKGNvZGVjKSB7XG4gICAgdmFyIHJlc3VsdCwgYXZjZGF0YSA9IGNvZGVjLnNwbGl0KCcuJyk7XG4gICAgaWYgKGF2Y2RhdGEubGVuZ3RoID4gMikge1xuICAgICAgcmVzdWx0ID0gYXZjZGF0YS5zaGlmdCgpICsgJy4nO1xuICAgICAgcmVzdWx0ICs9IHBhcnNlSW50KGF2Y2RhdGEuc2hpZnQoKSkudG9TdHJpbmcoMTYpO1xuICAgICAgcmVzdWx0ICs9ICgnMDAwJyArIHBhcnNlSW50KGF2Y2RhdGEuc2hpZnQoKSkudG9TdHJpbmcoMTYpKS5zdWJzdHIoLTQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgPSBjb2RlYztcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIGNsb25lT2JqKG9iaikge1xuICAgIHJldHVybiBKU09OLnBhcnNlKEpTT04uc3RyaW5naWZ5KG9iaikpO1xuICB9XG5cbiAgcGFyc2VMZXZlbFBsYXlsaXN0KHN0cmluZywgYmFzZXVybCwgaWQpIHtcbiAgICB2YXIgY3VycmVudFNOID0gMCxcbiAgICAgICAgdG90YWxkdXJhdGlvbiA9IDAsXG4gICAgICAgIGxldmVsID0ge3VybDogYmFzZXVybCwgZnJhZ21lbnRzOiBbXSwgbGl2ZTogdHJ1ZSwgc3RhcnRTTjogMH0sXG4gICAgICAgIGxldmVsa2V5ID0ge21ldGhvZCA6IG51bGwsIGtleSA6IG51bGwsIGl2IDogbnVsbCwgdXJpIDogbnVsbH0sXG4gICAgICAgIGNjID0gMCxcbiAgICAgICAgcHJvZ3JhbURhdGVUaW1lID0gbnVsbCxcbiAgICAgICAgZnJhZyA9IG51bGwsXG4gICAgICAgIHJlc3VsdCxcbiAgICAgICAgcmVnZXhwLFxuICAgICAgICBieXRlUmFuZ2VFbmRPZmZzZXQsXG4gICAgICAgIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0LFxuICAgICAgICBuZXh0VGltZXN0YW1wO1xuXG4gICAgcmVnZXhwID0gLyg/OiNFWFQtWC0oTUVESUEtU0VRVUVOQ0UpOihcXGQrKSl8KD86I0VYVC1YLShUQVJHRVREVVJBVElPTik6KFxcZCspKXwoPzojRVhULVgtKEtFWSk6KC4qKSl8KD86I0VYVChJTkYpOihbXFxkXFwuXSspW15cXHJcXG5dKihbXFxyXFxuXStbXiN8XFxyXFxuXSspPyl8KD86I0VYVC1YLShCWVRFUkFOR0UpOihbXFxkXStbQFtcXGRdKildKltcXHJcXG5dKyhbXiN8XFxyXFxuXSspP3woPzojRVhULVgtKEVORExJU1QpKXwoPzojRVhULVgtKERJUylDT05USU5VSVRZKSl8KD86I0VYVC1YLShQUk9HUkFNLURBVEUtVElNRSk6KC4qKSkvZztcbiAgICB3aGlsZSAoKHJlc3VsdCA9IHJlZ2V4cC5leGVjKHN0cmluZykpICE9PSBudWxsKSB7XG4gICAgICByZXN1bHQuc2hpZnQoKTtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIoZnVuY3Rpb24obikgeyByZXR1cm4gKG4gIT09IHVuZGVmaW5lZCk7IH0pO1xuICAgICAgc3dpdGNoIChyZXN1bHRbMF0pIHtcbiAgICAgICAgY2FzZSAnTUVESUEtU0VRVUVOQ0UnOlxuICAgICAgICAgIGN1cnJlbnRTTiA9IGxldmVsLnN0YXJ0U04gPSBwYXJzZUludChyZXN1bHRbMV0pO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdUQVJHRVREVVJBVElPTic6XG4gICAgICAgICAgbGV2ZWwudGFyZ2V0ZHVyYXRpb24gPSBwYXJzZUZsb2F0KHJlc3VsdFsxXSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgJ0VORExJU1QnOlxuICAgICAgICAgIGxldmVsLmxpdmUgPSBmYWxzZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnRElTJzpcbiAgICAgICAgICBjYysrO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdCWVRFUkFOR0UnOlxuICAgICAgICAgIHZhciBwYXJhbXMgPSByZXN1bHRbMV0uc3BsaXQoJ0AnKTtcbiAgICAgICAgICBpZiAocGFyYW1zLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgYnl0ZVJhbmdlU3RhcnRPZmZzZXQgPSBieXRlUmFuZ2VFbmRPZmZzZXQ7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ID0gcGFyc2VJbnQocGFyYW1zWzFdKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYnl0ZVJhbmdlRW5kT2Zmc2V0ID0gcGFyc2VJbnQocGFyYW1zWzBdKSArIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0O1xuICAgICAgICAgIGlmIChmcmFnICYmICFmcmFnLnVybCkge1xuICAgICAgICAgICAgZnJhZy5ieXRlUmFuZ2VTdGFydE9mZnNldCA9IGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0O1xuICAgICAgICAgICAgZnJhZy5ieXRlUmFuZ2VFbmRPZmZzZXQgPSBieXRlUmFuZ2VFbmRPZmZzZXQ7XG4gICAgICAgICAgICBmcmFnLnVybCA9IHRoaXMucmVzb2x2ZShyZXN1bHRbMl0sIGJhc2V1cmwpO1xuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnSU5GJzpcbiAgICAgICAgICB2YXIgZHVyYXRpb24gPSBwYXJzZUZsb2F0KHJlc3VsdFsxXSk7XG4gICAgICAgICAgaWYgKCFpc05hTihkdXJhdGlvbikpIHtcbiAgICAgICAgICAgIHZhciBmcmFnZGVjcnlwdGRhdGEsXG4gICAgICAgICAgICAgICAgc24gPSBjdXJyZW50U04rKztcbiAgICAgICAgICAgIGlmIChsZXZlbGtleS5tZXRob2QgJiYgbGV2ZWxrZXkudXJpICYmICFsZXZlbGtleS5pdikge1xuICAgICAgICAgICAgICBmcmFnZGVjcnlwdGRhdGEgPSB0aGlzLmNsb25lT2JqKGxldmVsa2V5KTtcbiAgICAgICAgICAgICAgdmFyIHVpbnQ4VmlldyA9IG5ldyBVaW50OEFycmF5KDE2KTtcbiAgICAgICAgICAgICAgZm9yICh2YXIgaSA9IDEyOyBpIDwgMTY7IGkrKykge1xuICAgICAgICAgICAgICAgIHVpbnQ4Vmlld1tpXSA9IChzbiA+PiA4KigxNS1pKSkgJiAweGZmO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGZyYWdkZWNyeXB0ZGF0YS5pdiA9IHVpbnQ4VmlldztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGZyYWdkZWNyeXB0ZGF0YSA9IGxldmVsa2V5O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdmFyIHVybCA9IHJlc3VsdFsyXSA/IHRoaXMucmVzb2x2ZShyZXN1bHRbMl0sIGJhc2V1cmwpIDogbnVsbDtcblxuICAgICAgICAgICAgdmFyIHIgPSAvKFxcZCspX1xcZCsudHMvO1xuICAgICAgICAgICAgdmFyIG1hdGNoID0gci5leGVjKHVybCk7XG4gICAgICAgICAgICB2YXIgdGltZXN0YW1wID0gKG1hdGNoICYmIG1hdGNoWzFdKSA/IG1hdGNoWzFdIDogbnVsbDtcblxuICAgICAgICAgICAgaWYgKHRpbWVzdGFtcCAmJiBuZXh0VGltZXN0YW1wKSB7XG4gICAgICAgICAgICAgIHRpbWVzdGFtcCA9IHBhcnNlSW50KHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgIGlmICh0aW1lc3RhbXAgLSBuZXh0VGltZXN0YW1wID4gNTAwMCkge1xuICAgICAgICAgICAgICAgIGNjKys7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbmV4dFRpbWVzdGFtcCA9IHRpbWVzdGFtcCArIGR1cmF0aW9uICogMTAwMDtcblxuICAgICAgICAgICAgZnJhZyA9IHt1cmw6IHVybCwgZHVyYXRpb246IGR1cmF0aW9uLCBzdGFydDogdG90YWxkdXJhdGlvbiwgc246IHNuLCBsZXZlbDogaWQsIGNjOiBjYywgYnl0ZVJhbmdlU3RhcnRPZmZzZXQ6IGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0LCBieXRlUmFuZ2VFbmRPZmZzZXQ6IGJ5dGVSYW5nZUVuZE9mZnNldCwgZGVjcnlwdGRhdGEgOiBmcmFnZGVjcnlwdGRhdGEsIHByb2dyYW1EYXRlVGltZTogcHJvZ3JhbURhdGVUaW1lfTtcbiAgICAgICAgICAgIGxldmVsLmZyYWdtZW50cy5wdXNoKGZyYWcpO1xuICAgICAgICAgICAgdG90YWxkdXJhdGlvbiArPSBkdXJhdGlvbjtcbiAgICAgICAgICAgIGJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ID0gbnVsbDtcbiAgICAgICAgICAgIHByb2dyYW1EYXRlVGltZSA9IG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlICdLRVknOlxuICAgICAgICAgIC8vIGh0dHBzOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9kcmFmdC1wYW50b3MtaHR0cC1saXZlLXN0cmVhbWluZy0wOCNzZWN0aW9uLTMuNC40XG4gICAgICAgICAgdmFyIGRlY3J5cHRwYXJhbXMgPSByZXN1bHRbMV07XG4gICAgICAgICAgdmFyIGtleUF0dHJzID0gbmV3IEF0dHJMaXN0KGRlY3J5cHRwYXJhbXMpO1xuICAgICAgICAgIHZhciBkZWNyeXB0bWV0aG9kID0ga2V5QXR0cnMuZW51bWVyYXRlZFN0cmluZygnTUVUSE9EJyksXG4gICAgICAgICAgICAgIGRlY3J5cHR1cmkgPSBrZXlBdHRycy5VUkksXG4gICAgICAgICAgICAgIGRlY3J5cHRpdiA9IGtleUF0dHJzLmhleGFkZWNpbWFsSW50ZWdlcignSVYnKTtcbiAgICAgICAgICBpZiAoZGVjcnlwdG1ldGhvZCkge1xuICAgICAgICAgICAgbGV2ZWxrZXkgPSB7IG1ldGhvZDogbnVsbCwga2V5OiBudWxsLCBpdjogbnVsbCwgdXJpOiBudWxsIH07XG4gICAgICAgICAgICBpZiAoKGRlY3J5cHR1cmkpICYmIChkZWNyeXB0bWV0aG9kID09PSAnQUVTLTEyOCcpKSB7XG4gICAgICAgICAgICAgIGxldmVsa2V5Lm1ldGhvZCA9IGRlY3J5cHRtZXRob2Q7XG4gICAgICAgICAgICAgIC8vIFVSSSB0byBnZXQgdGhlIGtleVxuICAgICAgICAgICAgICBsZXZlbGtleS51cmkgPSB0aGlzLnJlc29sdmUoZGVjcnlwdHVyaSwgYmFzZXVybCk7XG4gICAgICAgICAgICAgIGxldmVsa2V5LmtleSA9IG51bGw7XG4gICAgICAgICAgICAgIC8vIEluaXRpYWxpemF0aW9uIFZlY3RvciAoSVYpXG4gICAgICAgICAgICAgIGxldmVsa2V5Lml2ID0gZGVjcnlwdGl2O1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY2FzZSAnUFJPR1JBTS1EQVRFLVRJTUUnOlxuICAgICAgICAgIHByb2dyYW1EYXRlVGltZSA9IG5ldyBEYXRlKERhdGUucGFyc2UocmVzdWx0WzFdKSk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnZm91bmQgJyArIGxldmVsLmZyYWdtZW50cy5sZW5ndGggKyAnIGZyYWdtZW50cycpO1xuICAgIGlmKGZyYWcgJiYgIWZyYWcudXJsKSB7XG4gICAgICBsZXZlbC5mcmFnbWVudHMucG9wKCk7XG4gICAgICB0b3RhbGR1cmF0aW9uLT1mcmFnLmR1cmF0aW9uO1xuICAgIH1cbiAgICBsZXZlbC50b3RhbGR1cmF0aW9uID0gdG90YWxkdXJhdGlvbjtcbiAgICBsZXZlbC5lbmRTTiA9IGN1cnJlbnRTTiAtIDE7XG4gICAgcmV0dXJuIGxldmVsO1xuICB9XG5cbiAgbG9hZHN1Y2Nlc3MoZXZlbnQsIHN0YXRzKSB7XG4gICAgdmFyIHRhcmdldCA9IGV2ZW50LmN1cnJlbnRUYXJnZXQsXG4gICAgICAgIHN0cmluZyA9IHRhcmdldC5yZXNwb25zZVRleHQsXG4gICAgICAgIHVybCA9IHRhcmdldC5yZXNwb25zZVVSTCxcbiAgICAgICAgaWQgPSB0aGlzLmlkLFxuICAgICAgICBpZDIgPSB0aGlzLmlkMixcbiAgICAgICAgaGxzID0gdGhpcy5obHMsXG4gICAgICAgIGxldmVscztcbiAgICAvLyByZXNwb25zZVVSTCBub3Qgc3VwcG9ydGVkIG9uIHNvbWUgYnJvd3NlcnMgKGl0IGlzIHVzZWQgdG8gZGV0ZWN0IFVSTCByZWRpcmVjdGlvbilcbiAgICBpZiAodXJsID09PSB1bmRlZmluZWQpIHtcbiAgICAgIC8vIGZhbGxiYWNrIHRvIGluaXRpYWwgVVJMXG4gICAgICB1cmwgPSB0aGlzLnVybDtcbiAgICB9XG4gICAgc3RhdHMudGxvYWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICBzdGF0cy5tdGltZSA9IG5ldyBEYXRlKHRhcmdldC5nZXRSZXNwb25zZUhlYWRlcignTGFzdC1Nb2RpZmllZCcpKTtcbiAgICBpZiAoc3RyaW5nLmluZGV4T2YoJyNFWFRNM1UnKSA9PT0gMCkge1xuICAgICAgaWYgKHN0cmluZy5pbmRleE9mKCcjRVhUSU5GOicpID4gMCkge1xuICAgICAgICAvLyAxIGxldmVsIHBsYXlsaXN0XG4gICAgICAgIC8vIGlmIGZpcnN0IHJlcXVlc3QsIGZpcmUgbWFuaWZlc3QgbG9hZGVkIGV2ZW50LCBsZXZlbCB3aWxsIGJlIHJlbG9hZGVkIGFmdGVyd2FyZHNcbiAgICAgICAgLy8gKHRoaXMgaXMgdG8gaGF2ZSBhIHVuaWZvcm0gbG9naWMgZm9yIDEgbGV2ZWwvbXVsdGlsZXZlbCBwbGF5bGlzdHMpXG4gICAgICAgIGlmICh0aGlzLmlkID09PSBudWxsKSB7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTUFOSUZFU1RfTE9BREVELCB7bGV2ZWxzOiBbe3VybDogdXJsfV0sIHVybDogdXJsLCBzdGF0czogc3RhdHN9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB2YXIgbGV2ZWxEZXRhaWxzID0gdGhpcy5wYXJzZUxldmVsUGxheWxpc3Qoc3RyaW5nLCB1cmwsIGlkKTtcbiAgICAgICAgICBzdGF0cy50cGFyc2VkID0gcGVyZm9ybWFuY2Uubm93KCk7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuTEVWRUxfTE9BREVELCB7ZGV0YWlsczogbGV2ZWxEZXRhaWxzLCBsZXZlbDogaWQsIGlkOiBpZDIsIHN0YXRzOiBzdGF0c30pO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXZlbHMgPSB0aGlzLnBhcnNlTWFzdGVyUGxheWxpc3Qoc3RyaW5nLCB1cmwpO1xuICAgICAgICAvLyBtdWx0aSBsZXZlbCBwbGF5bGlzdCwgcGFyc2UgbGV2ZWwgaW5mb1xuICAgICAgICBpZiAobGV2ZWxzLmxlbmd0aCkge1xuICAgICAgICAgIGhscy50cmlnZ2VyKEV2ZW50Lk1BTklGRVNUX0xPQURFRCwge2xldmVsczogbGV2ZWxzLCB1cmw6IHVybCwgc3RhdHM6IHN0YXRzfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IEVycm9yRGV0YWlscy5NQU5JRkVTVF9QQVJTSU5HX0VSUk9SLCBmYXRhbDogdHJ1ZSwgdXJsOiB1cmwsIHJlYXNvbjogJ25vIGxldmVsIGZvdW5kIGluIG1hbmlmZXN0J30pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuTUFOSUZFU1RfUEFSU0lOR19FUlJPUiwgZmF0YWw6IHRydWUsIHVybDogdXJsLCByZWFzb246ICdubyBFWFRNM1UgZGVsaW1pdGVyJ30pO1xuICAgIH1cbiAgfVxuXG4gIGxvYWRlcnJvcihldmVudCkge1xuICAgIHZhciBkZXRhaWxzLCBmYXRhbDtcbiAgICBpZiAodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5NQU5JRkVTVF9MT0FEX0VSUk9SO1xuICAgICAgZmF0YWwgPSB0cnVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBkZXRhaWxzID0gRXJyb3JEZXRhaWxzLkxFVkVMX0xPQURfRVJST1I7XG4gICAgICBmYXRhbCA9IGZhbHNlO1xuICAgIH1cbiAgICBpZiAodGhpcy5sb2FkZXIpIHtcbiAgICAgIHRoaXMubG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIHRoaXMuaGxzLnRyaWdnZXIoRXZlbnQuRVJST1IsIHt0eXBlOiBFcnJvclR5cGVzLk5FVFdPUktfRVJST1IsIGRldGFpbHM6IGRldGFpbHMsIGZhdGFsOiBmYXRhbCwgdXJsOiB0aGlzLnVybCwgbG9hZGVyOiB0aGlzLmxvYWRlciwgcmVzcG9uc2U6IGV2ZW50LmN1cnJlbnRUYXJnZXQsIGxldmVsOiB0aGlzLmlkLCBpZDogdGhpcy5pZDJ9KTtcbiAgfVxuXG4gIGxvYWR0aW1lb3V0KCkge1xuICAgIHZhciBkZXRhaWxzLCBmYXRhbDtcbiAgICBpZiAodGhpcy5pZCA9PT0gbnVsbCkge1xuICAgICAgZGV0YWlscyA9IEVycm9yRGV0YWlscy5NQU5JRkVTVF9MT0FEX1RJTUVPVVQ7XG4gICAgICBmYXRhbCA9IHRydWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRldGFpbHMgPSBFcnJvckRldGFpbHMuTEVWRUxfTE9BRF9USU1FT1VUO1xuICAgICAgZmF0YWwgPSBmYWxzZTtcbiAgICB9XG4gICAgaWYgKHRoaXMubG9hZGVyKSB7XG4gICAgICB0aGlzLmxvYWRlci5hYm9ydCgpO1xuICAgIH1cbiAgICB0aGlzLmhscy50cmlnZ2VyKEV2ZW50LkVSUk9SLCB7dHlwZTogRXJyb3JUeXBlcy5ORVRXT1JLX0VSUk9SLCBkZXRhaWxzOiBkZXRhaWxzLCBmYXRhbDogZmF0YWwsIHVybDogdGhpcy51cmwsIGxvYWRlcjogdGhpcy5sb2FkZXIsIGxldmVsOiB0aGlzLmlkLCBpZDogdGhpcy5pZDJ9KTtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBQbGF5bGlzdExvYWRlcjtcbiIsIi8qKlxuICogR2VuZXJhdGUgTVA0IEJveFxuKi9cblxuLy9pbXBvcnQgSGV4IGZyb20gJy4uL3V0aWxzL2hleCc7XG5jbGFzcyBNUDQge1xuICBzdGF0aWMgaW5pdCgpIHtcbiAgICBNUDQudHlwZXMgPSB7XG4gICAgICBhdmMxOiBbXSwgLy8gY29kaW5nbmFtZVxuICAgICAgYXZjQzogW10sXG4gICAgICBidHJ0OiBbXSxcbiAgICAgIGRpbmY6IFtdLFxuICAgICAgZHJlZjogW10sXG4gICAgICBlc2RzOiBbXSxcbiAgICAgIGZ0eXA6IFtdLFxuICAgICAgaGRscjogW10sXG4gICAgICBtZGF0OiBbXSxcbiAgICAgIG1kaGQ6IFtdLFxuICAgICAgbWRpYTogW10sXG4gICAgICBtZmhkOiBbXSxcbiAgICAgIG1pbmY6IFtdLFxuICAgICAgbW9vZjogW10sXG4gICAgICBtb292OiBbXSxcbiAgICAgIG1wNGE6IFtdLFxuICAgICAgbXZleDogW10sXG4gICAgICBtdmhkOiBbXSxcbiAgICAgIHNkdHA6IFtdLFxuICAgICAgc3RibDogW10sXG4gICAgICBzdGNvOiBbXSxcbiAgICAgIHN0c2M6IFtdLFxuICAgICAgc3RzZDogW10sXG4gICAgICBzdHN6OiBbXSxcbiAgICAgIHN0dHM6IFtdLFxuICAgICAgdGZkdDogW10sXG4gICAgICB0ZmhkOiBbXSxcbiAgICAgIHRyYWY6IFtdLFxuICAgICAgdHJhazogW10sXG4gICAgICB0cnVuOiBbXSxcbiAgICAgIHRyZXg6IFtdLFxuICAgICAgdGtoZDogW10sXG4gICAgICB2bWhkOiBbXSxcbiAgICAgIHNtaGQ6IFtdXG4gICAgfTtcblxuICAgIHZhciBpO1xuICAgIGZvciAoaSBpbiBNUDQudHlwZXMpIHtcbiAgICAgIGlmIChNUDQudHlwZXMuaGFzT3duUHJvcGVydHkoaSkpIHtcbiAgICAgICAgTVA0LnR5cGVzW2ldID0gW1xuICAgICAgICAgIGkuY2hhckNvZGVBdCgwKSxcbiAgICAgICAgICBpLmNoYXJDb2RlQXQoMSksXG4gICAgICAgICAgaS5jaGFyQ29kZUF0KDIpLFxuICAgICAgICAgIGkuY2hhckNvZGVBdCgzKVxuICAgICAgICBdO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciB2aWRlb0hkbHIgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBwcmVfZGVmaW5lZFxuICAgICAgMHg3NiwgMHg2OSwgMHg2NCwgMHg2NSwgLy8gaGFuZGxlcl90eXBlOiAndmlkZSdcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4NTYsIDB4NjksIDB4NjQsIDB4NjUsXG4gICAgICAweDZmLCAweDQ4LCAweDYxLCAweDZlLFxuICAgICAgMHg2NCwgMHg2YywgMHg2NSwgMHg3MiwgMHgwMCAvLyBuYW1lOiAnVmlkZW9IYW5kbGVyJ1xuICAgIF0pO1xuXG4gICAgdmFyIGF1ZGlvSGRsciA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAweDczLCAweDZmLCAweDc1LCAweDZlLCAvLyBoYW5kbGVyX3R5cGU6ICdzb3VuJ1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgMHg1MywgMHg2ZiwgMHg3NSwgMHg2ZSxcbiAgICAgIDB4NjQsIDB4NDgsIDB4NjEsIDB4NmUsXG4gICAgICAweDY0LCAweDZjLCAweDY1LCAweDcyLCAweDAwIC8vIG5hbWU6ICdTb3VuZEhhbmRsZXInXG4gICAgXSk7XG5cbiAgICBNUDQuSERMUl9UWVBFUyA9IHtcbiAgICAgICd2aWRlbyc6IHZpZGVvSGRscixcbiAgICAgICdhdWRpbyc6IGF1ZGlvSGRsclxuICAgIH07XG5cbiAgICB2YXIgZHJlZiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGVudHJ5X2NvdW50XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDBjLCAvLyBlbnRyeV9zaXplXG4gICAgICAweDc1LCAweDcyLCAweDZjLCAweDIwLCAvLyAndXJsJyB0eXBlXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDEgLy8gZW50cnlfZmxhZ3NcbiAgICBdKTtcblxuICAgIHZhciBzdGNvID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAgLy8gZW50cnlfY291bnRcbiAgICBdKTtcblxuICAgIE1QNC5TVFRTID0gTVA0LlNUU0MgPSBNUDQuU1RDTyA9IHN0Y287XG5cbiAgICBNUDQuU1RTWiA9IG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb25cbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBzYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gc2FtcGxlX2NvdW50XG4gICAgXSk7XG4gICAgTVA0LlZNSEQgPSBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uXG4gICAgICAweDAwLCAweDAwLCAweDAxLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgLy8gZ3JhcGhpY3Ntb2RlXG4gICAgICAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAgLy8gb3Bjb2xvclxuICAgIF0pO1xuICAgIE1QNC5TTUhEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGJhbGFuY2VcbiAgICAgIDB4MDAsIDB4MDAgLy8gcmVzZXJ2ZWRcbiAgICBdKTtcblxuICAgIE1QNC5TVFNEID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMV0pOy8vIGVudHJ5X2NvdW50XG5cbiAgICB2YXIgbWFqb3JCcmFuZCA9IG5ldyBVaW50OEFycmF5KFsxMDUsMTE1LDExMSwxMDldKTsgLy8gaXNvbVxuICAgIHZhciBhdmMxQnJhbmQgPSBuZXcgVWludDhBcnJheShbOTcsMTE4LDk5LDQ5XSk7IC8vIGF2YzFcbiAgICB2YXIgbWlub3JWZXJzaW9uID0gbmV3IFVpbnQ4QXJyYXkoWzAsIDAsIDAsIDFdKTtcblxuICAgIE1QNC5GVFlQID0gTVA0LmJveChNUDQudHlwZXMuZnR5cCwgbWFqb3JCcmFuZCwgbWlub3JWZXJzaW9uLCBtYWpvckJyYW5kLCBhdmMxQnJhbmQpO1xuICAgIE1QNC5ESU5GID0gTVA0LmJveChNUDQudHlwZXMuZGluZiwgTVA0LmJveChNUDQudHlwZXMuZHJlZiwgZHJlZikpO1xuICB9XG5cbiAgc3RhdGljIGJveCh0eXBlKSB7XG4gIHZhclxuICAgIHBheWxvYWQgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpLFxuICAgIHNpemUgPSA4LFxuICAgIGkgPSBwYXlsb2FkLmxlbmd0aCxcbiAgICBsZW4gPSBpLFxuICAgIHJlc3VsdDtcbiAgICAvLyBjYWxjdWxhdGUgdGhlIHRvdGFsIHNpemUgd2UgbmVlZCB0byBhbGxvY2F0ZVxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHNpemUgKz0gcGF5bG9hZFtpXS5ieXRlTGVuZ3RoO1xuICAgIH1cbiAgICByZXN1bHQgPSBuZXcgVWludDhBcnJheShzaXplKTtcbiAgICByZXN1bHRbMF0gPSAoc2l6ZSA+PiAyNCkgJiAweGZmO1xuICAgIHJlc3VsdFsxXSA9IChzaXplID4+IDE2KSAmIDB4ZmY7XG4gICAgcmVzdWx0WzJdID0gKHNpemUgPj4gOCkgJiAweGZmO1xuICAgIHJlc3VsdFszXSA9IHNpemUgICYgMHhmZjtcbiAgICByZXN1bHQuc2V0KHR5cGUsIDQpO1xuICAgIC8vIGNvcHkgdGhlIHBheWxvYWQgaW50byB0aGUgcmVzdWx0XG4gICAgZm9yIChpID0gMCwgc2l6ZSA9IDg7IGkgPCBsZW47IGkrKykge1xuICAgICAgLy8gY29weSBwYXlsb2FkW2ldIGFycmF5IEAgb2Zmc2V0IHNpemVcbiAgICAgIHJlc3VsdC5zZXQocGF5bG9hZFtpXSwgc2l6ZSk7XG4gICAgICBzaXplICs9IHBheWxvYWRbaV0uYnl0ZUxlbmd0aDtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfVxuXG4gIHN0YXRpYyBoZGxyKHR5cGUpIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuaGRsciwgTVA0LkhETFJfVFlQRVNbdHlwZV0pO1xuICB9XG5cbiAgc3RhdGljIG1kYXQoZGF0YSkge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGF0LCBkYXRhKTtcbiAgfVxuXG4gIHN0YXRpYyBtZGhkKHRpbWVzY2FsZSwgZHVyYXRpb24pIHtcbiAgICBkdXJhdGlvbiAqPSB0aW1lc2NhbGU7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1kaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgIDB4MDAsIC8vIHZlcnNpb24gMFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDIsIC8vIGNyZWF0aW9uX3RpbWVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDMsIC8vIG1vZGlmaWNhdGlvbl90aW1lXG4gICAgICAodGltZXNjYWxlID4+IDI0KSAmIDB4RkYsXG4gICAgICAodGltZXNjYWxlID4+IDE2KSAmIDB4RkYsXG4gICAgICAodGltZXNjYWxlID4+ICA4KSAmIDB4RkYsXG4gICAgICB0aW1lc2NhbGUgJiAweEZGLCAvLyB0aW1lc2NhbGVcbiAgICAgIChkdXJhdGlvbiA+PiAyNCksXG4gICAgICAoZHVyYXRpb24gPj4gMTYpICYgMHhGRixcbiAgICAgIChkdXJhdGlvbiA+PiAgOCkgJiAweEZGLFxuICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgMHg1NSwgMHhjNCwgLy8gJ3VuZCcgbGFuZ3VhZ2UgKHVuZGV0ZXJtaW5lZClcbiAgICAgIDB4MDAsIDB4MDBcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgbWRpYSh0cmFjaykge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZGlhLCBNUDQubWRoZCh0cmFjay50aW1lc2NhbGUsIHRyYWNrLmR1cmF0aW9uKSwgTVA0LmhkbHIodHJhY2sudHlwZSksIE1QNC5taW5mKHRyYWNrKSk7XG4gIH1cblxuICBzdGF0aWMgbWZoZChzZXF1ZW5jZU51bWJlcikge1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5tZmhkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAyNCksXG4gICAgICAoc2VxdWVuY2VOdW1iZXIgPj4gMTYpICYgMHhGRixcbiAgICAgIChzZXF1ZW5jZU51bWJlciA+PiAgOCkgJiAweEZGLFxuICAgICAgc2VxdWVuY2VOdW1iZXIgJiAweEZGLCAvLyBzZXF1ZW5jZV9udW1iZXJcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgbWluZih0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubWluZiwgTVA0LmJveChNUDQudHlwZXMuc21oZCwgTVA0LlNNSEQpLCBNUDQuRElORiwgTVA0LnN0YmwodHJhY2spKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1pbmYsIE1QNC5ib3goTVA0LnR5cGVzLnZtaGQsIE1QNC5WTUhEKSwgTVA0LkRJTkYsIE1QNC5zdGJsKHRyYWNrKSk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGljIG1vb2Yoc24sIGJhc2VNZWRpYURlY29kZVRpbWUsIHRyYWNrKSB7XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLm1vb2YsIE1QNC5tZmhkKHNuKSwgTVA0LnRyYWYodHJhY2ssYmFzZU1lZGlhRGVjb2RlVGltZSkpO1xuICB9XG4vKipcbiAqIEBwYXJhbSB0cmFja3MuLi4gKG9wdGlvbmFsKSB7YXJyYXl9IHRoZSB0cmFja3MgYXNzb2NpYXRlZCB3aXRoIHRoaXMgbW92aWVcbiAqL1xuICBzdGF0aWMgbW9vdih0cmFja3MpIHtcbiAgICB2YXJcbiAgICAgIGkgPSB0cmFja3MubGVuZ3RoLFxuICAgICAgYm94ZXMgPSBbXTtcblxuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGJveGVzW2ldID0gTVA0LnRyYWsodHJhY2tzW2ldKTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveC5hcHBseShudWxsLCBbTVA0LnR5cGVzLm1vb3YsIE1QNC5tdmhkKHRyYWNrc1swXS50aW1lc2NhbGUsIHRyYWNrc1swXS5kdXJhdGlvbildLmNvbmNhdChib3hlcykuY29uY2F0KE1QNC5tdmV4KHRyYWNrcykpKTtcbiAgfVxuXG4gIHN0YXRpYyBtdmV4KHRyYWNrcykge1xuICAgIHZhclxuICAgICAgaSA9IHRyYWNrcy5sZW5ndGgsXG4gICAgICBib3hlcyA9IFtdO1xuXG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgYm94ZXNbaV0gPSBNUDQudHJleCh0cmFja3NbaV0pO1xuICAgIH1cbiAgICByZXR1cm4gTVA0LmJveC5hcHBseShudWxsLCBbTVA0LnR5cGVzLm12ZXhdLmNvbmNhdChib3hlcykpO1xuICB9XG5cbiAgc3RhdGljIG12aGQodGltZXNjYWxlLGR1cmF0aW9uKSB7XG4gICAgZHVyYXRpb24qPXRpbWVzY2FsZTtcbiAgICB2YXJcbiAgICAgIGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMSwgLy8gY3JlYXRpb25fdGltZVxuICAgICAgICAweDAwLCAweDAwLCAweDAwLCAweDAyLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgICAodGltZXNjYWxlID4+IDI0KSAmIDB4RkYsXG4gICAgICAgICh0aW1lc2NhbGUgPj4gMTYpICYgMHhGRixcbiAgICAgICAgKHRpbWVzY2FsZSA+PiAgOCkgJiAweEZGLFxuICAgICAgICB0aW1lc2NhbGUgJiAweEZGLCAvLyB0aW1lc2NhbGVcbiAgICAgICAgKGR1cmF0aW9uID4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgICAoZHVyYXRpb24gPj4gIDgpICYgMHhGRixcbiAgICAgICAgZHVyYXRpb24gJiAweEZGLCAvLyBkdXJhdGlvblxuICAgICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLCAvLyAxLjAgcmF0ZVxuICAgICAgICAweDAxLCAweDAwLCAvLyAxLjAgdm9sdW1lXG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDEsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4NDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHRyYW5zZm9ybWF0aW9uOiB1bml0eSBtYXRyaXhcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcHJlX2RlZmluZWRcbiAgICAgICAgMHhmZiwgMHhmZiwgMHhmZiwgMHhmZiAvLyBuZXh0X3RyYWNrX0lEXG4gICAgICBdKTtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubXZoZCwgYnl0ZXMpO1xuICB9XG5cbiAgc3RhdGljIHNkdHAodHJhY2spIHtcbiAgICB2YXJcbiAgICAgIHNhbXBsZXMgPSB0cmFjay5zYW1wbGVzIHx8IFtdLFxuICAgICAgYnl0ZXMgPSBuZXcgVWludDhBcnJheSg0ICsgc2FtcGxlcy5sZW5ndGgpLFxuICAgICAgZmxhZ3MsXG4gICAgICBpO1xuICAgIC8vIGxlYXZlIHRoZSBmdWxsIGJveCBoZWFkZXIgKDQgYnl0ZXMpIGFsbCB6ZXJvXG4gICAgLy8gd3JpdGUgdGhlIHNhbXBsZSB0YWJsZVxuICAgIGZvciAoaSA9IDA7IGkgPCBzYW1wbGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBmbGFncyA9IHNhbXBsZXNbaV0uZmxhZ3M7XG4gICAgICBieXRlc1tpICsgNF0gPSAoZmxhZ3MuZGVwZW5kc09uIDw8IDQpIHxcbiAgICAgICAgKGZsYWdzLmlzRGVwZW5kZWRPbiA8PCAyKSB8XG4gICAgICAgIChmbGFncy5oYXNSZWR1bmRhbmN5KTtcbiAgICB9XG5cbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc2R0cCwgYnl0ZXMpO1xuICB9XG5cbiAgc3RhdGljIHN0YmwodHJhY2spIHtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RibCwgTVA0LnN0c2QodHJhY2spLCBNUDQuYm94KE1QNC50eXBlcy5zdHRzLCBNUDQuU1RUUyksIE1QNC5ib3goTVA0LnR5cGVzLnN0c2MsIE1QNC5TVFNDKSwgTVA0LmJveChNUDQudHlwZXMuc3RzeiwgTVA0LlNUU1opLCBNUDQuYm94KE1QNC50eXBlcy5zdGNvLCBNUDQuU1RDTykpO1xuICB9XG5cbiAgc3RhdGljIGF2YzEodHJhY2spIHtcbiAgICB2YXIgc3BzID0gW10sIHBwcyA9IFtdLCBpLCBkYXRhLCBsZW47XG4gICAgLy8gYXNzZW1ibGUgdGhlIFNQU3NcblxuICAgIGZvciAoaSA9IDA7IGkgPCB0cmFjay5zcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGRhdGEgPSB0cmFjay5zcHNbaV07XG4gICAgICBsZW4gPSBkYXRhLmJ5dGVMZW5ndGg7XG4gICAgICBzcHMucHVzaCgobGVuID4+PiA4KSAmIDB4RkYpO1xuICAgICAgc3BzLnB1c2goKGxlbiAmIDB4RkYpKTtcbiAgICAgIHNwcyA9IHNwcy5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZGF0YSkpOyAvLyBTUFNcbiAgICB9XG5cbiAgICAvLyBhc3NlbWJsZSB0aGUgUFBTc1xuICAgIGZvciAoaSA9IDA7IGkgPCB0cmFjay5wcHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGRhdGEgPSB0cmFjay5wcHNbaV07XG4gICAgICBsZW4gPSBkYXRhLmJ5dGVMZW5ndGg7XG4gICAgICBwcHMucHVzaCgobGVuID4+PiA4KSAmIDB4RkYpO1xuICAgICAgcHBzLnB1c2goKGxlbiAmIDB4RkYpKTtcbiAgICAgIHBwcyA9IHBwcy5jb25jYXQoQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoZGF0YSkpO1xuICAgIH1cblxuICAgIHZhciBhdmNjID0gTVA0LmJveChNUDQudHlwZXMuYXZjQywgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgMHgwMSwgICAvLyB2ZXJzaW9uXG4gICAgICAgICAgICBzcHNbM10sIC8vIHByb2ZpbGVcbiAgICAgICAgICAgIHNwc1s0XSwgLy8gcHJvZmlsZSBjb21wYXRcbiAgICAgICAgICAgIHNwc1s1XSwgLy8gbGV2ZWxcbiAgICAgICAgICAgIDB4ZmMgfCAzLCAvLyBsZW5ndGhTaXplTWludXNPbmUsIGhhcmQtY29kZWQgdG8gNCBieXRlc1xuICAgICAgICAgICAgMHhFMCB8IHRyYWNrLnNwcy5sZW5ndGggLy8gM2JpdCByZXNlcnZlZCAoMTExKSArIG51bU9mU2VxdWVuY2VQYXJhbWV0ZXJTZXRzXG4gICAgICAgICAgXS5jb25jYXQoc3BzKS5jb25jYXQoW1xuICAgICAgICAgICAgdHJhY2sucHBzLmxlbmd0aCAvLyBudW1PZlBpY3R1cmVQYXJhbWV0ZXJTZXRzXG4gICAgICAgICAgXSkuY29uY2F0KHBwcykpKSwgLy8gXCJQUFNcIlxuICAgICAgICB3aWR0aCA9IHRyYWNrLndpZHRoLFxuICAgICAgICBoZWlnaHQgPSB0cmFjay5oZWlnaHQ7XG4gICAgLy9jb25zb2xlLmxvZygnYXZjYzonICsgSGV4LmhleER1bXAoYXZjYykpO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5hdmMxLCBuZXcgVWludDhBcnJheShbXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDEsIC8vIGRhdGFfcmVmZXJlbmNlX2luZGV4XG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHByZV9kZWZpbmVkXG4gICAgICAgICh3aWR0aCA+PiA4KSAmIDB4RkYsXG4gICAgICAgIHdpZHRoICYgMHhmZiwgLy8gd2lkdGhcbiAgICAgICAgKGhlaWdodCA+PiA4KSAmIDB4RkYsXG4gICAgICAgIGhlaWdodCAmIDB4ZmYsIC8vIGhlaWdodFxuICAgICAgICAweDAwLCAweDQ4LCAweDAwLCAweDAwLCAvLyBob3JpenJlc29sdXRpb25cbiAgICAgICAgMHgwMCwgMHg0OCwgMHgwMCwgMHgwMCwgLy8gdmVydHJlc29sdXRpb25cbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgICAgMHgwMCwgMHgwMSwgLy8gZnJhbWVfY291bnRcbiAgICAgICAgMHgxMixcbiAgICAgICAgMHg2NCwgMHg2MSwgMHg2OSwgMHg2QywgLy9kYWlseW1vdGlvbi9obHMuanNcbiAgICAgICAgMHg3OSwgMHg2RCwgMHg2RiwgMHg3NCxcbiAgICAgICAgMHg2OSwgMHg2RiwgMHg2RSwgMHgyRixcbiAgICAgICAgMHg2OCwgMHg2QywgMHg3MywgMHgyRSxcbiAgICAgICAgMHg2QSwgMHg3MywgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gY29tcHJlc3Nvcm5hbWVcbiAgICAgICAgMHgwMCwgMHgxOCwgICAvLyBkZXB0aCA9IDI0XG4gICAgICAgIDB4MTEsIDB4MTFdKSwgLy8gcHJlX2RlZmluZWQgPSAtMVxuICAgICAgICAgIGF2Y2MsXG4gICAgICAgICAgTVA0LmJveChNUDQudHlwZXMuYnRydCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgMHgwMCwgMHgxYywgMHg5YywgMHg4MCwgLy8gYnVmZmVyU2l6ZURCXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwLCAvLyBtYXhCaXRyYXRlXG4gICAgICAgICAgICAweDAwLCAweDJkLCAweGM2LCAweGMwXSkpIC8vIGF2Z0JpdHJhdGVcbiAgICAgICAgICApO1xuICB9XG5cbiAgc3RhdGljIGVzZHModHJhY2spIHtcbiAgICB2YXIgY29uZmlnbGVuID0gdHJhY2suY29uZmlnLmxlbmd0aDtcbiAgICByZXR1cm4gbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAvLyBmbGFnc1xuXG4gICAgICAweDAzLCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIDB4MTcrY29uZmlnbGVuLCAvLyBsZW5ndGhcbiAgICAgIDB4MDAsIDB4MDEsIC8vZXNfaWRcbiAgICAgIDB4MDAsIC8vIHN0cmVhbV9wcmlvcml0eVxuXG4gICAgICAweDA0LCAvLyBkZXNjcmlwdG9yX3R5cGVcbiAgICAgIDB4MGYrY29uZmlnbGVuLCAvLyBsZW5ndGhcbiAgICAgIDB4NDAsIC8vY29kZWMgOiBtcGVnNF9hdWRpb1xuICAgICAgMHgxNSwgLy8gc3RyZWFtX3R5cGVcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGJ1ZmZlcl9zaXplXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBtYXhCaXRyYXRlXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBhdmdCaXRyYXRlXG5cbiAgICAgIDB4MDUgLy8gZGVzY3JpcHRvcl90eXBlXG4gICAgICBdLmNvbmNhdChbY29uZmlnbGVuXSkuY29uY2F0KHRyYWNrLmNvbmZpZykuY29uY2F0KFsweDA2LCAweDAxLCAweDAyXSkpOyAvLyBHQVNwZWNpZmljQ29uZmlnKSk7IC8vIGxlbmd0aCArIGF1ZGlvIGNvbmZpZyBkZXNjcmlwdG9yXG4gIH1cblxuICBzdGF0aWMgbXA0YSh0cmFjaykge1xuICAgIHZhciBhdWRpb3NhbXBsZXJhdGUgPSB0cmFjay5hdWRpb3NhbXBsZXJhdGU7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMubXA0YSwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAxLCAvLyBkYXRhX3JlZmVyZW5jZV9pbmRleFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCB0cmFjay5jaGFubmVsQ291bnQsIC8vIGNoYW5uZWxjb3VudFxuICAgICAgMHgwMCwgMHgxMCwgLy8gc2FtcGxlU2l6ZToxNmJpdHNcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkMlxuICAgICAgKGF1ZGlvc2FtcGxlcmF0ZSA+PiA4KSAmIDB4RkYsXG4gICAgICBhdWRpb3NhbXBsZXJhdGUgJiAweGZmLCAvL1xuICAgICAgMHgwMCwgMHgwMF0pLFxuICAgICAgTVA0LmJveChNUDQudHlwZXMuZXNkcywgTVA0LmVzZHModHJhY2spKSk7XG4gIH1cblxuICBzdGF0aWMgc3RzZCh0cmFjaykge1xuICAgIGlmICh0cmFjay50eXBlID09PSAnYXVkaW8nKSB7XG4gICAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMuc3RzZCwgTVA0LlNUU0QsIE1QNC5tcDRhKHRyYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy5zdHNkLCBNUDQuU1RTRCwgTVA0LmF2YzEodHJhY2spKTtcbiAgICB9XG4gIH1cblxuICBzdGF0aWMgdGtoZCh0cmFjaykge1xuICAgIHZhciBpZCA9IHRyYWNrLmlkLFxuICAgICAgICBkdXJhdGlvbiA9IHRyYWNrLmR1cmF0aW9uKnRyYWNrLnRpbWVzY2FsZSxcbiAgICAgICAgd2lkdGggPSB0cmFjay53aWR0aCxcbiAgICAgICAgaGVpZ2h0ID0gdHJhY2suaGVpZ2h0O1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50a2hkLCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDcsIC8vIGZsYWdzXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBjcmVhdGlvbl90aW1lXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBtb2RpZmljYXRpb25fdGltZVxuICAgICAgKGlkID4+IDI0KSAmIDB4RkYsXG4gICAgICAoaWQgPj4gMTYpICYgMHhGRixcbiAgICAgIChpZCA+PiA4KSAmIDB4RkYsXG4gICAgICBpZCAmIDB4RkYsIC8vIHRyYWNrX0lEXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyByZXNlcnZlZFxuICAgICAgKGR1cmF0aW9uID4+IDI0KSxcbiAgICAgIChkdXJhdGlvbiA+PiAxNikgJiAweEZGLFxuICAgICAgKGR1cmF0aW9uID4+ICA4KSAmIDB4RkYsXG4gICAgICBkdXJhdGlvbiAmIDB4RkYsIC8vIGR1cmF0aW9uXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gcmVzZXJ2ZWRcbiAgICAgIDB4MDAsIDB4MDAsIC8vIGxheWVyXG4gICAgICAweDAwLCAweDAwLCAvLyBhbHRlcm5hdGVfZ3JvdXBcbiAgICAgIDB4MDAsIDB4MDAsIC8vIG5vbi1hdWRpbyB0cmFjayB2b2x1bWVcbiAgICAgIDB4MDAsIDB4MDAsIC8vIHJlc2VydmVkXG4gICAgICAweDAwLCAweDAxLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMCxcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDAsXG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLFxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCxcbiAgICAgIDB4NDAsIDB4MDAsIDB4MDAsIDB4MDAsIC8vIHRyYW5zZm9ybWF0aW9uOiB1bml0eSBtYXRyaXhcbiAgICAgICh3aWR0aCA+PiA4KSAmIDB4RkYsXG4gICAgICB3aWR0aCAmIDB4RkYsXG4gICAgICAweDAwLCAweDAwLCAvLyB3aWR0aFxuICAgICAgKGhlaWdodCA+PiA4KSAmIDB4RkYsXG4gICAgICBoZWlnaHQgJiAweEZGLFxuICAgICAgMHgwMCwgMHgwMCAvLyBoZWlnaHRcbiAgICBdKSk7XG4gIH1cblxuICBzdGF0aWMgdHJhZih0cmFjayxiYXNlTWVkaWFEZWNvZGVUaW1lKSB7XG4gICAgdmFyIHNhbXBsZURlcGVuZGVuY3lUYWJsZSA9IE1QNC5zZHRwKHRyYWNrKSxcbiAgICAgICAgaWQgPSB0cmFjay5pZDtcbiAgICByZXR1cm4gTVA0LmJveChNUDQudHlwZXMudHJhZixcbiAgICAgICAgICAgICAgIE1QNC5ib3goTVA0LnR5cGVzLnRmaGQsIG5ldyBVaW50OEFycmF5KFtcbiAgICAgICAgICAgICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAgICAgICAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgICAgICAgICAgICAgIChpZCA+PiAyNCksXG4gICAgICAgICAgICAgICAgIChpZCA+PiAxNikgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoaWQgPj4gOCkgJiAwWEZGLFxuICAgICAgICAgICAgICAgICAoaWQgJiAweEZGKSAvLyB0cmFja19JRFxuICAgICAgICAgICAgICAgXSkpLFxuICAgICAgICAgICAgICAgTVA0LmJveChNUDQudHlwZXMudGZkdCwgbmV3IFVpbnQ4QXJyYXkoW1xuICAgICAgICAgICAgICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgICAgICAgICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZmxhZ3NcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgPj4yNCksXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+IDE2KSAmIDBYRkYsXG4gICAgICAgICAgICAgICAgIChiYXNlTWVkaWFEZWNvZGVUaW1lID4+IDgpICYgMFhGRixcbiAgICAgICAgICAgICAgICAgKGJhc2VNZWRpYURlY29kZVRpbWUgJiAweEZGKSAvLyBiYXNlTWVkaWFEZWNvZGVUaW1lXG4gICAgICAgICAgICAgICBdKSksXG4gICAgICAgICAgICAgICBNUDQudHJ1bih0cmFjayxcbiAgICAgICAgICAgICAgICAgICAgc2FtcGxlRGVwZW5kZW5jeVRhYmxlLmxlbmd0aCArXG4gICAgICAgICAgICAgICAgICAgIDE2ICsgLy8gdGZoZFxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIHRmZHRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyB0cmFmIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICAxNiArIC8vIG1maGRcbiAgICAgICAgICAgICAgICAgICAgOCArICAvLyBtb29mIGhlYWRlclxuICAgICAgICAgICAgICAgICAgICA4KSwgIC8vIG1kYXQgaGVhZGVyXG4gICAgICAgICAgICAgICBzYW1wbGVEZXBlbmRlbmN5VGFibGUpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdlbmVyYXRlIGEgdHJhY2sgYm94LlxuICAgKiBAcGFyYW0gdHJhY2sge29iamVjdH0gYSB0cmFjayBkZWZpbml0aW9uXG4gICAqIEByZXR1cm4ge1VpbnQ4QXJyYXl9IHRoZSB0cmFjayBib3hcbiAgICovXG4gIHN0YXRpYyB0cmFrKHRyYWNrKSB7XG4gICAgdHJhY2suZHVyYXRpb24gPSB0cmFjay5kdXJhdGlvbiB8fCAweGZmZmZmZmZmO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmFrLCBNUDQudGtoZCh0cmFjayksIE1QNC5tZGlhKHRyYWNrKSk7XG4gIH1cblxuICBzdGF0aWMgdHJleCh0cmFjaykge1xuICAgIHZhciBpZCA9IHRyYWNrLmlkO1xuICAgIHJldHVybiBNUDQuYm94KE1QNC50eXBlcy50cmV4LCBuZXcgVWludDhBcnJheShbXG4gICAgICAweDAwLCAvLyB2ZXJzaW9uIDBcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIC8vIGZsYWdzXG4gICAgIChpZCA+PiAyNCksXG4gICAgIChpZCA+PiAxNikgJiAwWEZGLFxuICAgICAoaWQgPj4gOCkgJiAwWEZGLFxuICAgICAoaWQgJiAweEZGKSwgLy8gdHJhY2tfSURcbiAgICAgIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDEsIC8vIGRlZmF1bHRfc2FtcGxlX2Rlc2NyaXB0aW9uX2luZGV4XG4gICAgICAweDAwLCAweDAwLCAweDAwLCAweDAwLCAvLyBkZWZhdWx0X3NhbXBsZV9kdXJhdGlvblxuICAgICAgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMCwgLy8gZGVmYXVsdF9zYW1wbGVfc2l6ZVxuICAgICAgMHgwMCwgMHgwMSwgMHgwMCwgMHgwMSAvLyBkZWZhdWx0X3NhbXBsZV9mbGFnc1xuICAgIF0pKTtcbiAgfVxuXG4gIHN0YXRpYyB0cnVuKHRyYWNrLCBvZmZzZXQpIHtcbiAgICB2YXIgc2FtcGxlcz0gdHJhY2suc2FtcGxlcyB8fCBbXSxcbiAgICAgICAgbGVuID0gc2FtcGxlcy5sZW5ndGgsXG4gICAgICAgIGFycmF5bGVuID0gMTIgKyAoMTYgKiBsZW4pLFxuICAgICAgICBhcnJheSA9IG5ldyBVaW50OEFycmF5KGFycmF5bGVuKSxcbiAgICAgICAgaSxzYW1wbGUsZHVyYXRpb24sc2l6ZSxmbGFncyxjdHM7XG4gICAgb2Zmc2V0ICs9IDggKyBhcnJheWxlbjtcbiAgICBhcnJheS5zZXQoW1xuICAgICAgMHgwMCwgLy8gdmVyc2lvbiAwXG4gICAgICAweDAwLCAweDBmLCAweDAxLCAvLyBmbGFnc1xuICAgICAgKGxlbiA+Pj4gMjQpICYgMHhGRixcbiAgICAgIChsZW4gPj4+IDE2KSAmIDB4RkYsXG4gICAgICAobGVuID4+PiA4KSAmIDB4RkYsXG4gICAgICBsZW4gJiAweEZGLCAvLyBzYW1wbGVfY291bnRcbiAgICAgIChvZmZzZXQgPj4+IDI0KSAmIDB4RkYsXG4gICAgICAob2Zmc2V0ID4+PiAxNikgJiAweEZGLFxuICAgICAgKG9mZnNldCA+Pj4gOCkgJiAweEZGLFxuICAgICAgb2Zmc2V0ICYgMHhGRiAvLyBkYXRhX29mZnNldFxuICAgIF0sMCk7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBzYW1wbGUgPSBzYW1wbGVzW2ldO1xuICAgICAgZHVyYXRpb24gPSBzYW1wbGUuZHVyYXRpb247XG4gICAgICBzaXplID0gc2FtcGxlLnNpemU7XG4gICAgICBmbGFncyA9IHNhbXBsZS5mbGFncztcbiAgICAgIGN0cyA9IHNhbXBsZS5jdHM7XG4gICAgICBhcnJheS5zZXQoW1xuICAgICAgICAoZHVyYXRpb24gPj4+IDI0KSAmIDB4RkYsXG4gICAgICAgIChkdXJhdGlvbiA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKGR1cmF0aW9uID4+PiA4KSAmIDB4RkYsXG4gICAgICAgIGR1cmF0aW9uICYgMHhGRiwgLy8gc2FtcGxlX2R1cmF0aW9uXG4gICAgICAgIChzaXplID4+PiAyNCkgJiAweEZGLFxuICAgICAgICAoc2l6ZSA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKHNpemUgPj4+IDgpICYgMHhGRixcbiAgICAgICAgc2l6ZSAmIDB4RkYsIC8vIHNhbXBsZV9zaXplXG4gICAgICAgIChmbGFncy5pc0xlYWRpbmcgPDwgMikgfCBmbGFncy5kZXBlbmRzT24sXG4gICAgICAgIChmbGFncy5pc0RlcGVuZGVkT24gPDwgNikgfFxuICAgICAgICAgIChmbGFncy5oYXNSZWR1bmRhbmN5IDw8IDQpIHxcbiAgICAgICAgICAoZmxhZ3MucGFkZGluZ1ZhbHVlIDw8IDEpIHxcbiAgICAgICAgICBmbGFncy5pc05vblN5bmMsXG4gICAgICAgIGZsYWdzLmRlZ3JhZFByaW8gJiAweEYwIDw8IDgsXG4gICAgICAgIGZsYWdzLmRlZ3JhZFByaW8gJiAweDBGLCAvLyBzYW1wbGVfZmxhZ3NcbiAgICAgICAgKGN0cyA+Pj4gMjQpICYgMHhGRixcbiAgICAgICAgKGN0cyA+Pj4gMTYpICYgMHhGRixcbiAgICAgICAgKGN0cyA+Pj4gOCkgJiAweEZGLFxuICAgICAgICBjdHMgJiAweEZGIC8vIHNhbXBsZV9jb21wb3NpdGlvbl90aW1lX29mZnNldFxuICAgICAgXSwxMisxNippKTtcbiAgICB9XG4gICAgcmV0dXJuIE1QNC5ib3goTVA0LnR5cGVzLnRydW4sIGFycmF5KTtcbiAgfVxuXG4gIHN0YXRpYyBpbml0U2VnbWVudCh0cmFja3MpIHtcbiAgICBpZiAoIU1QNC50eXBlcykge1xuICAgICAgTVA0LmluaXQoKTtcbiAgICB9XG4gICAgdmFyIG1vdmllID0gTVA0Lm1vb3YodHJhY2tzKSwgcmVzdWx0O1xuICAgIHJlc3VsdCA9IG5ldyBVaW50OEFycmF5KE1QNC5GVFlQLmJ5dGVMZW5ndGggKyBtb3ZpZS5ieXRlTGVuZ3RoKTtcbiAgICByZXN1bHQuc2V0KE1QNC5GVFlQKTtcbiAgICByZXN1bHQuc2V0KG1vdmllLCBNUDQuRlRZUC5ieXRlTGVuZ3RoKTtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IE1QNDtcbiIsIi8qKlxuICogZk1QNCByZW11eGVyXG4qL1xuXG5cbmltcG9ydCBFdmVudCBmcm9tICcuLi9ldmVudHMnO1xuaW1wb3J0IHtsb2dnZXJ9IGZyb20gJy4uL3V0aWxzL2xvZ2dlcic7XG5pbXBvcnQgTVA0IGZyb20gJy4uL3JlbXV4L21wNC1nZW5lcmF0b3InO1xuaW1wb3J0IHtFcnJvclR5cGVzLCBFcnJvckRldGFpbHN9IGZyb20gJy4uL2Vycm9ycyc7XG5cbmNsYXNzIE1QNFJlbXV4ZXIge1xuICBjb25zdHJ1Y3RvcihvYnNlcnZlcikge1xuICAgIHRoaXMub2JzZXJ2ZXIgPSBvYnNlcnZlcjtcbiAgICB0aGlzLklTR2VuZXJhdGVkID0gZmFsc2U7XG4gICAgdGhpcy5QRVMyTVA0U0NBTEVGQUNUT1IgPSA0O1xuICAgIHRoaXMuUEVTX1RJTUVTQ0FMRSA9IDkwMDAwO1xuICAgIHRoaXMuTVA0X1RJTUVTQ0FMRSA9IHRoaXMuUEVTX1RJTUVTQ0FMRSAvIHRoaXMuUEVTMk1QNFNDQUxFRkFDVE9SO1xuICB9XG5cbiAgZ2V0IHBhc3N0aHJvdWdoKCkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxuICBpbnNlcnREaXNjb250aW51aXR5KCkge1xuICAgIHRoaXMuX2luaXRQVFMgPSB0aGlzLl9pbml0RFRTID0gdGhpcy5uZXh0QWFjUHRzID0gdGhpcy5uZXh0QXZjRHRzID0gdW5kZWZpbmVkO1xuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgdGhpcy5JU0dlbmVyYXRlZCA9IGZhbHNlO1xuICB9XG5cbiAgcmVtdXgoYXVkaW9UcmFjayx2aWRlb1RyYWNrLGlkM1RyYWNrLHRleHRUcmFjayx0aW1lT2Zmc2V0LCBjb250aWd1b3VzKSB7XG4gICAgLy8gZ2VuZXJhdGUgSW5pdCBTZWdtZW50IGlmIG5lZWRlZFxuICAgIGlmICghdGhpcy5JU0dlbmVyYXRlZCkge1xuICAgICAgdGhpcy5nZW5lcmF0ZUlTKGF1ZGlvVHJhY2ssdmlkZW9UcmFjayx0aW1lT2Zmc2V0KTtcbiAgICB9XG4gICAgLy9sb2dnZXIubG9nKCduYiBBVkMgc2FtcGxlczonICsgdmlkZW9UcmFjay5zYW1wbGVzLmxlbmd0aCk7XG4gICAgaWYgKHZpZGVvVHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMucmVtdXhWaWRlbyh2aWRlb1RyYWNrLHRpbWVPZmZzZXQsY29udGlndW91cyk7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnbmIgQUFDIHNhbXBsZXM6JyArIGF1ZGlvVHJhY2suc2FtcGxlcy5sZW5ndGgpO1xuICAgIGlmIChhdWRpb1RyYWNrLnNhbXBsZXMubGVuZ3RoKSB7XG4gICAgICB0aGlzLnJlbXV4QXVkaW8oYXVkaW9UcmFjayx0aW1lT2Zmc2V0LGNvbnRpZ3VvdXMpO1xuICAgIH1cbiAgICAvL2xvZ2dlci5sb2coJ25iIElEMyBzYW1wbGVzOicgKyBhdWRpb1RyYWNrLnNhbXBsZXMubGVuZ3RoKTtcbiAgICBpZiAoaWQzVHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMucmVtdXhJRDMoaWQzVHJhY2ssdGltZU9mZnNldCk7XG4gICAgfVxuICAgIC8vbG9nZ2VyLmxvZygnbmIgSUQzIHNhbXBsZXM6JyArIGF1ZGlvVHJhY2suc2FtcGxlcy5sZW5ndGgpO1xuICAgIGlmICh0ZXh0VHJhY2suc2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHRoaXMucmVtdXhUZXh0KHRleHRUcmFjayx0aW1lT2Zmc2V0KTtcbiAgICB9XG4gICAgLy9ub3RpZnkgZW5kIG9mIHBhcnNpbmdcbiAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTRUQpO1xuICB9XG5cbiAgZ2VuZXJhdGVJUyhhdWRpb1RyYWNrLHZpZGVvVHJhY2ssdGltZU9mZnNldCkge1xuICAgIHZhciBvYnNlcnZlciA9IHRoaXMub2JzZXJ2ZXIsXG4gICAgICAgIGF1ZGlvU2FtcGxlcyA9IGF1ZGlvVHJhY2suc2FtcGxlcyxcbiAgICAgICAgdmlkZW9TYW1wbGVzID0gdmlkZW9UcmFjay5zYW1wbGVzLFxuICAgICAgICBwZXNUaW1lU2NhbGUgPSB0aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICAgIHRyYWNrcyA9IHt9LFxuICAgICAgICBkYXRhID0geyB0cmFja3MgOiB0cmFja3MsIHVuaXF1ZSA6IGZhbHNlIH0sXG4gICAgICAgIGNvbXB1dGVQVFNEVFMgPSAodGhpcy5faW5pdFBUUyA9PT0gdW5kZWZpbmVkKSxcbiAgICAgICAgaW5pdFBUUywgaW5pdERUUztcblxuICAgIGlmIChjb21wdXRlUFRTRFRTKSB7XG4gICAgICBpbml0UFRTID0gaW5pdERUUyA9IEluZmluaXR5O1xuICAgIH1cbiAgICBpZiAoYXVkaW9UcmFjay5jb25maWcgJiYgYXVkaW9TYW1wbGVzLmxlbmd0aCkge1xuICAgICAgYXVkaW9UcmFjay50aW1lc2NhbGUgPSBhdWRpb1RyYWNrLmF1ZGlvc2FtcGxlcmF0ZTtcbiAgICAgIC8vIE1QNCBkdXJhdGlvbiAodHJhY2sgZHVyYXRpb24gaW4gc2Vjb25kcyBtdWx0aXBsaWVkIGJ5IHRpbWVzY2FsZSkgaXMgY29kZWQgb24gMzIgYml0c1xuICAgICAgLy8gd2Uga25vdyB0aGF0IGVhY2ggQUFDIHNhbXBsZSBjb250YWlucyAxMDI0IGZyYW1lcy4uLi5cbiAgICAgIC8vIGluIG9yZGVyIHRvIGF2b2lkIG92ZXJmbG93aW5nIHRoZSAzMiBiaXQgY291bnRlciBmb3IgbGFyZ2UgZHVyYXRpb24sIHdlIHVzZSBzbWFsbGVyIHRpbWVzY2FsZSAodGltZXNjYWxlL2djZClcbiAgICAgIC8vIHdlIGp1c3QgbmVlZCB0byBlbnN1cmUgdGhhdCBBQUMgc2FtcGxlIGR1cmF0aW9uIHdpbGwgc3RpbGwgYmUgYW4gaW50ZWdlciAod2lsbCBiZSAxMDI0L2djZClcbiAgICAgIGlmIChhdWRpb1RyYWNrLnRpbWVzY2FsZSAqIGF1ZGlvVHJhY2suZHVyYXRpb24gPiBNYXRoLnBvdygyLCAzMikpIHtcbiAgICAgICAgbGV0IGdyZWF0ZXN0Q29tbW9uRGl2aXNvciA9IGZ1bmN0aW9uKGEsIGIpIHtcbiAgICAgICAgICAgIGlmICggISBiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gZ3JlYXRlc3RDb21tb25EaXZpc29yKGIsIGEgJSBiKTtcbiAgICAgICAgfTtcbiAgICAgICAgYXVkaW9UcmFjay50aW1lc2NhbGUgPSBhdWRpb1RyYWNrLmF1ZGlvc2FtcGxlcmF0ZSAvIGdyZWF0ZXN0Q29tbW9uRGl2aXNvcihhdWRpb1RyYWNrLmF1ZGlvc2FtcGxlcmF0ZSwxMDI0KTtcbiAgICAgIH1cbiAgICAgIGxvZ2dlci5sb2cgKCdhdWRpbyBtcDQgdGltZXNjYWxlIDonKyBhdWRpb1RyYWNrLnRpbWVzY2FsZSk7XG4gICAgICB0cmFja3MuYXVkaW8gPSB7XG4gICAgICAgIGNvbnRhaW5lciA6ICdhdWRpby9tcDQnLFxuICAgICAgICBjb2RlYyA6ICBhdWRpb1RyYWNrLmNvZGVjLFxuICAgICAgICBpbml0U2VnbWVudCA6IE1QNC5pbml0U2VnbWVudChbYXVkaW9UcmFja10pLFxuICAgICAgICBtZXRhZGF0YSA6IHtcbiAgICAgICAgICBjaGFubmVsQ291bnQgOiBhdWRpb1RyYWNrLmNoYW5uZWxDb3VudFxuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgaWYgKGNvbXB1dGVQVFNEVFMpIHtcbiAgICAgICAgLy8gcmVtZW1iZXIgZmlyc3QgUFRTIG9mIHRoaXMgZGVtdXhpbmcgY29udGV4dC4gZm9yIGF1ZGlvLCBQVFMgKyBEVFMgLi4uXG4gICAgICAgIGluaXRQVFMgPSBpbml0RFRTID0gYXVkaW9TYW1wbGVzWzBdLnB0cyAtIHBlc1RpbWVTY2FsZSAqIHRpbWVPZmZzZXQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHZpZGVvVHJhY2suc3BzICYmIHZpZGVvVHJhY2sucHBzICYmIHZpZGVvU2FtcGxlcy5sZW5ndGgpIHtcbiAgICAgIHZpZGVvVHJhY2sudGltZXNjYWxlID0gdGhpcy5NUDRfVElNRVNDQUxFO1xuICAgICAgdHJhY2tzLnZpZGVvID0ge1xuICAgICAgICBjb250YWluZXIgOiAndmlkZW8vbXA0JyxcbiAgICAgICAgY29kZWMgOiAgdmlkZW9UcmFjay5jb2RlYyxcbiAgICAgICAgaW5pdFNlZ21lbnQgOiBNUDQuaW5pdFNlZ21lbnQoW3ZpZGVvVHJhY2tdKSxcbiAgICAgICAgbWV0YWRhdGEgOiB7XG4gICAgICAgICAgd2lkdGggOiB2aWRlb1RyYWNrLndpZHRoLFxuICAgICAgICAgIGhlaWdodCA6IHZpZGVvVHJhY2suaGVpZ2h0XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBpZiAoY29tcHV0ZVBUU0RUUykge1xuICAgICAgICBpbml0UFRTID0gTWF0aC5taW4oaW5pdFBUUyx2aWRlb1NhbXBsZXNbMF0ucHRzIC0gcGVzVGltZVNjYWxlICogdGltZU9mZnNldCk7XG4gICAgICAgIGluaXREVFMgPSBNYXRoLm1pbihpbml0RFRTLHZpZGVvU2FtcGxlc1swXS5kdHMgLSBwZXNUaW1lU2NhbGUgKiB0aW1lT2Zmc2V0KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZighT2JqZWN0LmtleXModHJhY2tzKSkge1xuICAgICAgb2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5FUlJPUiwge3R5cGUgOiBFcnJvclR5cGVzLk1FRElBX0VSUk9SLCBkZXRhaWxzOiBFcnJvckRldGFpbHMuRlJBR19QQVJTSU5HX0VSUk9SLCBmYXRhbDogZmFsc2UsIHJlYXNvbjogJ25vIGF1ZGlvL3ZpZGVvIHNhbXBsZXMgZm91bmQnfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0lOSVRfU0VHTUVOVCxkYXRhKTtcbiAgICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSB0cnVlO1xuICAgICAgaWYgKGNvbXB1dGVQVFNEVFMpIHtcbiAgICAgICAgdGhpcy5faW5pdFBUUyA9IGluaXRQVFM7XG4gICAgICAgIHRoaXMuX2luaXREVFMgPSBpbml0RFRTO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJlbXV4VmlkZW8odHJhY2ssIHRpbWVPZmZzZXQsIGNvbnRpZ3VvdXMpIHtcbiAgICB2YXIgdmlldyxcbiAgICAgICAgb2Zmc2V0ID0gOCxcbiAgICAgICAgcGVzVGltZVNjYWxlID0gdGhpcy5QRVNfVElNRVNDQUxFLFxuICAgICAgICBwZXMybXA0U2NhbGVGYWN0b3IgPSB0aGlzLlBFUzJNUDRTQ0FMRUZBQ1RPUixcbiAgICAgICAgYXZjU2FtcGxlLFxuICAgICAgICBtcDRTYW1wbGUsXG4gICAgICAgIG1wNFNhbXBsZUxlbmd0aCxcbiAgICAgICAgdW5pdCxcbiAgICAgICAgbWRhdCwgbW9vZixcbiAgICAgICAgZmlyc3RQVFMsIGZpcnN0RFRTLCBsYXN0RFRTLFxuICAgICAgICBwdHMsIGR0cywgcHRzbm9ybSwgZHRzbm9ybSxcbiAgICAgICAgZmxhZ3MsXG4gICAgICAgIHNhbXBsZXMgPSBbXTtcbiAgICAvKiBjb25jYXRlbmF0ZSB0aGUgdmlkZW8gZGF0YSBhbmQgY29uc3RydWN0IHRoZSBtZGF0IGluIHBsYWNlXG4gICAgICAobmVlZCA4IG1vcmUgYnl0ZXMgdG8gZmlsbCBsZW5ndGggYW5kIG1wZGF0IHR5cGUpICovXG4gICAgbWRhdCA9IG5ldyBVaW50OEFycmF5KHRyYWNrLmxlbiArICg0ICogdHJhY2submJOYWx1KSArIDgpO1xuICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcobWRhdC5idWZmZXIpO1xuICAgIHZpZXcuc2V0VWludDMyKDAsIG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgbWRhdC5zZXQoTVA0LnR5cGVzLm1kYXQsIDQpO1xuICAgIHdoaWxlICh0cmFjay5zYW1wbGVzLmxlbmd0aCkge1xuICAgICAgYXZjU2FtcGxlID0gdHJhY2suc2FtcGxlcy5zaGlmdCgpO1xuICAgICAgbXA0U2FtcGxlTGVuZ3RoID0gMDtcbiAgICAgIC8vIGNvbnZlcnQgTkFMVSBiaXRzdHJlYW0gdG8gTVA0IGZvcm1hdCAocHJlcGVuZCBOQUxVIHdpdGggc2l6ZSBmaWVsZClcbiAgICAgIHdoaWxlIChhdmNTYW1wbGUudW5pdHMudW5pdHMubGVuZ3RoKSB7XG4gICAgICAgIHVuaXQgPSBhdmNTYW1wbGUudW5pdHMudW5pdHMuc2hpZnQoKTtcbiAgICAgICAgdmlldy5zZXRVaW50MzIob2Zmc2V0LCB1bml0LmRhdGEuYnl0ZUxlbmd0aCk7XG4gICAgICAgIG9mZnNldCArPSA0O1xuICAgICAgICBtZGF0LnNldCh1bml0LmRhdGEsIG9mZnNldCk7XG4gICAgICAgIG9mZnNldCArPSB1bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgICAgbXA0U2FtcGxlTGVuZ3RoICs9IDQgKyB1bml0LmRhdGEuYnl0ZUxlbmd0aDtcbiAgICAgIH1cbiAgICAgIHB0cyA9IGF2Y1NhbXBsZS5wdHMgLSB0aGlzLl9pbml0RFRTO1xuICAgICAgZHRzID0gYXZjU2FtcGxlLmR0cyAtIHRoaXMuX2luaXREVFM7XG4gICAgICAvLyBlbnN1cmUgRFRTIGlzIG5vdCBiaWdnZXIgdGhhbiBQVFNcbiAgICAgIGR0cyA9IE1hdGgubWluKHB0cyxkdHMpO1xuICAgICAgLy9sb2dnZXIubG9nKGBWaWRlby9QVFMvRFRTOiR7TWF0aC5yb3VuZChwdHMvOTApfS8ke01hdGgucm91bmQoZHRzLzkwKX1gKTtcbiAgICAgIC8vIGlmIG5vdCBmaXJzdCBBVkMgc2FtcGxlIG9mIHZpZGVvIHRyYWNrLCBub3JtYWxpemUgUFRTL0RUUyB3aXRoIHByZXZpb3VzIHNhbXBsZSB2YWx1ZVxuICAgICAgLy8gYW5kIGVuc3VyZSB0aGF0IHNhbXBsZSBkdXJhdGlvbiBpcyBwb3NpdGl2ZVxuICAgICAgaWYgKGxhc3REVFMgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBwdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKHB0cywgbGFzdERUUyk7XG4gICAgICAgIGR0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUoZHRzLCBsYXN0RFRTKTtcbiAgICAgICAgdmFyIHNhbXBsZUR1cmF0aW9uID0gKGR0c25vcm0gLSBsYXN0RFRTKSAvIHBlczJtcDRTY2FsZUZhY3RvcjtcbiAgICAgICAgaWYgKHNhbXBsZUR1cmF0aW9uIDw9IDApIHtcbiAgICAgICAgICBsb2dnZXIubG9nKGBpbnZhbGlkIHNhbXBsZSBkdXJhdGlvbiBhdCBQVFMvRFRTOiAke2F2Y1NhbXBsZS5wdHN9LyR7YXZjU2FtcGxlLmR0c306JHtzYW1wbGVEdXJhdGlvbn1gKTtcbiAgICAgICAgICBzYW1wbGVEdXJhdGlvbiA9IDE7XG4gICAgICAgIH1cbiAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gc2FtcGxlRHVyYXRpb247XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsZXQgbmV4dEF2Y0R0cywgZGVsdGE7XG4gICAgICAgIGlmIChjb250aWd1b3VzKSB7XG4gICAgICAgICAgbmV4dEF2Y0R0cyA9IHRoaXMubmV4dEF2Y0R0cztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBuZXh0QXZjRHRzID0gdGltZU9mZnNldCpwZXNUaW1lU2NhbGU7XG4gICAgICAgIH1cbiAgICAgICAgLy8gZmlyc3QgQVZDIHNhbXBsZSBvZiB2aWRlbyB0cmFjaywgbm9ybWFsaXplIFBUUy9EVFNcbiAgICAgICAgcHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShwdHMsIG5leHRBdmNEdHMpO1xuICAgICAgICBkdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKGR0cywgbmV4dEF2Y0R0cyk7XG4gICAgICAgIGRlbHRhID0gTWF0aC5yb3VuZCgoZHRzbm9ybSAtIG5leHRBdmNEdHMpIC8gOTApO1xuICAgICAgICAvLyBpZiBmcmFnbWVudCBhcmUgY29udGlndW91cywgb3IgZGVsdGEgbGVzcyB0aGFuIDYwMG1zLCBlbnN1cmUgdGhlcmUgaXMgbm8gb3ZlcmxhcC9ob2xlIGJldHdlZW4gZnJhZ21lbnRzXG4gICAgICAgIGlmIChjb250aWd1b3VzIHx8IE1hdGguYWJzKGRlbHRhKSA8IDYwMCkge1xuICAgICAgICAgIGlmIChkZWx0YSkge1xuICAgICAgICAgICAgaWYgKGRlbHRhID4gMSkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGBBVkM6JHtkZWx0YX0gbXMgaG9sZSBiZXR3ZWVuIGZyYWdtZW50cyBkZXRlY3RlZCxmaWxsaW5nIGl0YCk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGRlbHRhIDwgLTEpIHtcbiAgICAgICAgICAgICAgbG9nZ2VyLmxvZyhgQVZDOiR7KC1kZWx0YSl9IG1zIG92ZXJsYXBwaW5nIGJldHdlZW4gZnJhZ21lbnRzIGRldGVjdGVkYCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICAvLyBzZXQgRFRTIHRvIG5leHQgRFRTXG4gICAgICAgICAgICBkdHNub3JtID0gbmV4dEF2Y0R0cztcbiAgICAgICAgICAgIC8vIG9mZnNldCBQVFMgYXMgd2VsbCwgZW5zdXJlIHRoYXQgUFRTIGlzIHNtYWxsZXIgb3IgZXF1YWwgdGhhbiBuZXcgRFRTXG4gICAgICAgICAgICBwdHNub3JtID0gTWF0aC5tYXgocHRzbm9ybSAtIGRlbHRhLCBkdHNub3JtKTtcbiAgICAgICAgICAgIGxvZ2dlci5sb2coYFZpZGVvL1BUUy9EVFMgYWRqdXN0ZWQ6ICR7cHRzbm9ybX0vJHtkdHNub3JtfSxkZWx0YToke2RlbHRhfWApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2Ygb3VyIGF2Y1NhbXBsZXMsIGVuc3VyZSB2YWx1ZSBpcyBwb3NpdGl2ZVxuICAgICAgICBmaXJzdFBUUyA9IE1hdGgubWF4KDAsIHB0c25vcm0pO1xuICAgICAgICBmaXJzdERUUyA9IE1hdGgubWF4KDAsIGR0c25vcm0pO1xuICAgICAgfVxuICAgICAgLy9jb25zb2xlLmxvZygnUFRTL0RUUy9pbml0RFRTL25vcm1QVFMvbm9ybURUUy9yZWxhdGl2ZSBQVFMgOiAke2F2Y1NhbXBsZS5wdHN9LyR7YXZjU2FtcGxlLmR0c30vJHt0aGlzLl9pbml0RFRTfS8ke3B0c25vcm19LyR7ZHRzbm9ybX0vJHsoYXZjU2FtcGxlLnB0cy80Mjk0OTY3Mjk2KS50b0ZpeGVkKDMpfScpO1xuICAgICAgbXA0U2FtcGxlID0ge1xuICAgICAgICBzaXplOiBtcDRTYW1wbGVMZW5ndGgsXG4gICAgICAgIGR1cmF0aW9uOiAwLFxuICAgICAgICBjdHM6IChwdHNub3JtIC0gZHRzbm9ybSkgLyBwZXMybXA0U2NhbGVGYWN0b3IsXG4gICAgICAgIGZsYWdzOiB7XG4gICAgICAgICAgaXNMZWFkaW5nOiAwLFxuICAgICAgICAgIGlzRGVwZW5kZWRPbjogMCxcbiAgICAgICAgICBoYXNSZWR1bmRhbmN5OiAwLFxuICAgICAgICAgIGRlZ3JhZFByaW86IDBcbiAgICAgICAgfVxuICAgICAgfTtcbiAgICAgIGZsYWdzID0gbXA0U2FtcGxlLmZsYWdzO1xuICAgICAgaWYgKGF2Y1NhbXBsZS5rZXkgPT09IHRydWUpIHtcbiAgICAgICAgLy8gdGhlIGN1cnJlbnQgc2FtcGxlIGlzIGEga2V5IGZyYW1lXG4gICAgICAgIGZsYWdzLmRlcGVuZHNPbiA9IDI7XG4gICAgICAgIGZsYWdzLmlzTm9uU3luYyA9IDA7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmbGFncy5kZXBlbmRzT24gPSAxO1xuICAgICAgICBmbGFncy5pc05vblN5bmMgPSAxO1xuICAgICAgfVxuICAgICAgc2FtcGxlcy5wdXNoKG1wNFNhbXBsZSk7XG4gICAgICBsYXN0RFRTID0gZHRzbm9ybTtcbiAgICB9XG4gICAgdmFyIGxhc3RTYW1wbGVEdXJhdGlvbiA9IDA7XG4gICAgaWYgKHNhbXBsZXMubGVuZ3RoID49IDIpIHtcbiAgICAgIGxhc3RTYW1wbGVEdXJhdGlvbiA9IHNhbXBsZXNbc2FtcGxlcy5sZW5ndGggLSAyXS5kdXJhdGlvbjtcbiAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IGxhc3RTYW1wbGVEdXJhdGlvbjtcbiAgICB9XG4gICAgLy8gbmV4dCBBVkMgc2FtcGxlIERUUyBzaG91bGQgYmUgZXF1YWwgdG8gbGFzdCBzYW1wbGUgRFRTICsgbGFzdCBzYW1wbGUgZHVyYXRpb25cbiAgICB0aGlzLm5leHRBdmNEdHMgPSBkdHNub3JtICsgbGFzdFNhbXBsZUR1cmF0aW9uICogcGVzMm1wNFNjYWxlRmFjdG9yO1xuICAgIHRyYWNrLmxlbiA9IDA7XG4gICAgdHJhY2submJOYWx1ID0gMDtcbiAgICBpZihzYW1wbGVzLmxlbmd0aCAmJiBuYXZpZ2F0b3IudXNlckFnZW50LnRvTG93ZXJDYXNlKCkuaW5kZXhPZignY2hyb21lJykgPiAtMSkge1xuICAgICAgZmxhZ3MgPSBzYW1wbGVzWzBdLmZsYWdzO1xuICAgIC8vIGNocm9tZSB3b3JrYXJvdW5kLCBtYXJrIGZpcnN0IHNhbXBsZSBhcyBiZWluZyBhIFJhbmRvbSBBY2Nlc3MgUG9pbnQgdG8gYXZvaWQgc291cmNlYnVmZmVyIGFwcGVuZCBpc3N1ZVxuICAgIC8vIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD0yMjk0MTJcbiAgICAgIGZsYWdzLmRlcGVuZHNPbiA9IDI7XG4gICAgICBmbGFncy5pc05vblN5bmMgPSAwO1xuICAgIH1cbiAgICB0cmFjay5zYW1wbGVzID0gc2FtcGxlcztcbiAgICBtb29mID0gTVA0Lm1vb2YodHJhY2suc2VxdWVuY2VOdW1iZXIrKywgZmlyc3REVFMgLyBwZXMybXA0U2NhbGVGYWN0b3IsIHRyYWNrKTtcbiAgICB0cmFjay5zYW1wbGVzID0gW107XG4gICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB7XG4gICAgICBkYXRhMTogbW9vZixcbiAgICAgIGRhdGEyOiBtZGF0LFxuICAgICAgc3RhcnRQVFM6IGZpcnN0UFRTIC8gcGVzVGltZVNjYWxlLFxuICAgICAgZW5kUFRTOiAocHRzbm9ybSArIHBlczJtcDRTY2FsZUZhY3RvciAqIGxhc3RTYW1wbGVEdXJhdGlvbikgLyBwZXNUaW1lU2NhbGUsXG4gICAgICBzdGFydERUUzogZmlyc3REVFMgLyBwZXNUaW1lU2NhbGUsXG4gICAgICBlbmREVFM6IHRoaXMubmV4dEF2Y0R0cyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgIHR5cGU6ICd2aWRlbycsXG4gICAgICBuYjogc2FtcGxlcy5sZW5ndGhcbiAgICB9KTtcbiAgfVxuXG4gIHJlbXV4QXVkaW8odHJhY2ssdGltZU9mZnNldCwgY29udGlndW91cykge1xuICAgIHZhciB2aWV3LFxuICAgICAgICBvZmZzZXQgPSA4LFxuICAgICAgICBwZXNUaW1lU2NhbGUgPSB0aGlzLlBFU19USU1FU0NBTEUsXG4gICAgICAgIG1wNHRpbWVTY2FsZSA9IHRyYWNrLnRpbWVzY2FsZSxcbiAgICAgICAgcGVzMm1wNFNjYWxlRmFjdG9yID0gcGVzVGltZVNjYWxlL21wNHRpbWVTY2FsZSxcbiAgICAgICAgZXhwZWN0ZWRTYW1wbGVEdXJhdGlvbiA9IHRyYWNrLnRpbWVzY2FsZSAqIDEwMjQgLyB0cmFjay5hdWRpb3NhbXBsZXJhdGUsXG4gICAgICAgIGFhY1NhbXBsZSwgbXA0U2FtcGxlLFxuICAgICAgICB1bml0LFxuICAgICAgICBtZGF0LCBtb29mLFxuICAgICAgICBmaXJzdFBUUywgZmlyc3REVFMsIGxhc3REVFMsXG4gICAgICAgIHB0cywgZHRzLCBwdHNub3JtLCBkdHNub3JtLFxuICAgICAgICBzYW1wbGVzID0gW10sXG4gICAgICAgIHNhbXBsZXMwID0gW107XG5cbiAgICB0cmFjay5zYW1wbGVzLnNvcnQoZnVuY3Rpb24oYSwgYikge1xuICAgICAgcmV0dXJuIChhLnB0cy1iLnB0cyk7XG4gICAgfSk7XG4gICAgc2FtcGxlczAgPSB0cmFjay5zYW1wbGVzO1xuXG4gICAgd2hpbGUgKHNhbXBsZXMwLmxlbmd0aCkge1xuICAgICAgYWFjU2FtcGxlID0gc2FtcGxlczAuc2hpZnQoKTtcbiAgICAgIHVuaXQgPSBhYWNTYW1wbGUudW5pdDtcbiAgICAgIHB0cyA9IGFhY1NhbXBsZS5wdHMgLSB0aGlzLl9pbml0RFRTO1xuICAgICAgZHRzID0gYWFjU2FtcGxlLmR0cyAtIHRoaXMuX2luaXREVFM7XG4gICAgICAvL2xvZ2dlci5sb2coYEF1ZGlvL1BUUzoke01hdGgucm91bmQocHRzLzkwKX1gKTtcbiAgICAgIC8vIGlmIG5vdCBmaXJzdCBzYW1wbGVcbiAgICAgIGlmIChsYXN0RFRTICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgcHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShwdHMsIGxhc3REVFMpO1xuICAgICAgICBkdHNub3JtID0gdGhpcy5fUFRTTm9ybWFsaXplKGR0cywgbGFzdERUUyk7XG4gICAgICAgIC8vIGxldCdzIGNvbXB1dGUgc2FtcGxlIGR1cmF0aW9uLlxuICAgICAgICAvLyBzYW1wbGUgRHVyYXRpb24gc2hvdWxkIGJlIGNsb3NlIHRvIGV4cGVjdGVkU2FtcGxlRHVyYXRpb25cbiAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gKGR0c25vcm0gLSBsYXN0RFRTKSAvIHBlczJtcDRTY2FsZUZhY3RvcjtcbiAgICAgICAgaWYoTWF0aC5hYnMobXA0U2FtcGxlLmR1cmF0aW9uIC0gZXhwZWN0ZWRTYW1wbGVEdXJhdGlvbikgPiBleHBlY3RlZFNhbXBsZUR1cmF0aW9uLzEwKSB7XG4gICAgICAgICAgLy8gbW9yZSB0aGFuIDEwJSBkaWZmIGJldHdlZW4gc2FtcGxlIGR1cmF0aW9uIGFuZCBleHBlY3RlZFNhbXBsZUR1cmF0aW9uIC4uLi4gbGV0cyBsb2cgdGhhdFxuICAgICAgICAgIGxvZ2dlci5sb2coYGludmFsaWQgQUFDIHNhbXBsZSBkdXJhdGlvbiBhdCBQVFMgJHtNYXRoLnJvdW5kKHB0cy85MCl9LHNob3VsZCBiZSAxMDI0LGZvdW5kIDoke01hdGgucm91bmQobXA0U2FtcGxlLmR1cmF0aW9uKnRyYWNrLmF1ZGlvc2FtcGxlcmF0ZS90cmFjay50aW1lc2NhbGUpfWApO1xuICAgICAgICB9XG4gICAgICAgIC8vIGFsd2F5cyBhZGp1c3Qgc2FtcGxlIGR1cmF0aW9uIHRvIGF2b2lkIGF2IHN5bmMgaXNzdWVcbiAgICAgICAgbXA0U2FtcGxlLmR1cmF0aW9uID0gZXhwZWN0ZWRTYW1wbGVEdXJhdGlvbjtcbiAgICAgICAgZHRzbm9ybSA9IGV4cGVjdGVkU2FtcGxlRHVyYXRpb24gKiBwZXMybXA0U2NhbGVGYWN0b3IgKyBsYXN0RFRTO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbGV0IG5leHRBYWNQdHMsIGRlbHRhO1xuICAgICAgICBpZiAoY29udGlndW91cykge1xuICAgICAgICAgIG5leHRBYWNQdHMgPSB0aGlzLm5leHRBYWNQdHM7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbmV4dEFhY1B0cyA9IHRpbWVPZmZzZXQqcGVzVGltZVNjYWxlO1xuICAgICAgICB9XG4gICAgICAgIHB0c25vcm0gPSB0aGlzLl9QVFNOb3JtYWxpemUocHRzLCBuZXh0QWFjUHRzKTtcbiAgICAgICAgZHRzbm9ybSA9IHRoaXMuX1BUU05vcm1hbGl6ZShkdHMsIG5leHRBYWNQdHMpO1xuICAgICAgICBkZWx0YSA9IE1hdGgucm91bmQoMTAwMCAqIChwdHNub3JtIC0gbmV4dEFhY1B0cykgLyBwZXNUaW1lU2NhbGUpO1xuICAgICAgICAvLyBpZiBmcmFnbWVudCBhcmUgY29udGlndW91cywgb3IgZGVsdGEgbGVzcyB0aGFuIDYwMG1zLCBlbnN1cmUgdGhlcmUgaXMgbm8gb3ZlcmxhcC9ob2xlIGJldHdlZW4gZnJhZ21lbnRzXG4gICAgICAgIGlmIChjb250aWd1b3VzIHx8IE1hdGguYWJzKGRlbHRhKSA8IDYwMCkge1xuICAgICAgICAgIC8vIGxvZyBkZWx0YVxuICAgICAgICAgIGlmIChkZWx0YSkge1xuICAgICAgICAgICAgaWYgKGRlbHRhID4gMCkge1xuICAgICAgICAgICAgICBsb2dnZXIubG9nKGAke2RlbHRhfSBtcyBob2xlIGJldHdlZW4gQUFDIHNhbXBsZXMgZGV0ZWN0ZWQsZmlsbGluZyBpdGApO1xuICAgICAgICAgICAgICAvLyBpZiB3ZSBoYXZlIGZyYW1lIG92ZXJsYXAsIG92ZXJsYXBwaW5nIGZvciBtb3JlIHRoYW4gaGFsZiBhIGZyYW1lIGR1cmFpb25cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoZGVsdGEgPCAtMTIpIHtcbiAgICAgICAgICAgICAgLy8gZHJvcCBvdmVybGFwcGluZyBhdWRpbyBmcmFtZXMuLi4gYnJvd3NlciB3aWxsIGRlYWwgd2l0aCBpdFxuICAgICAgICAgICAgICBsb2dnZXIubG9nKGAkeygtZGVsdGEpfSBtcyBvdmVybGFwcGluZyBiZXR3ZWVuIEFBQyBzYW1wbGVzIGRldGVjdGVkLCBkcm9wIGZyYW1lYCk7XG4gICAgICAgICAgICAgIHRyYWNrLmxlbiAtPSB1bml0LmJ5dGVMZW5ndGg7XG4gICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy8gc2V0IERUUyB0byBuZXh0IERUU1xuICAgICAgICAgICAgcHRzbm9ybSA9IGR0c25vcm0gPSBuZXh0QWFjUHRzO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvLyByZW1lbWJlciBmaXJzdCBQVFMgb2Ygb3VyIGFhY1NhbXBsZXMsIGVuc3VyZSB2YWx1ZSBpcyBwb3NpdGl2ZVxuICAgICAgICBmaXJzdFBUUyA9IE1hdGgubWF4KDAsIHB0c25vcm0pO1xuICAgICAgICBmaXJzdERUUyA9IE1hdGgubWF4KDAsIGR0c25vcm0pO1xuICAgICAgICBpZih0cmFjay5sZW4gPiAwKSB7XG4gICAgICAgICAgLyogY29uY2F0ZW5hdGUgdGhlIGF1ZGlvIGRhdGEgYW5kIGNvbnN0cnVjdCB0aGUgbWRhdCBpbiBwbGFjZVxuICAgICAgICAgICAgKG5lZWQgOCBtb3JlIGJ5dGVzIHRvIGZpbGwgbGVuZ3RoIGFuZCBtZGF0IHR5cGUpICovXG4gICAgICAgICAgbWRhdCA9IG5ldyBVaW50OEFycmF5KHRyYWNrLmxlbiArIDgpO1xuICAgICAgICAgIHZpZXcgPSBuZXcgRGF0YVZpZXcobWRhdC5idWZmZXIpO1xuICAgICAgICAgIHZpZXcuc2V0VWludDMyKDAsIG1kYXQuYnl0ZUxlbmd0aCk7XG4gICAgICAgICAgbWRhdC5zZXQoTVA0LnR5cGVzLm1kYXQsIDQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIG5vIGF1ZGlvIHNhbXBsZXNcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIG1kYXQuc2V0KHVuaXQsIG9mZnNldCk7XG4gICAgICBvZmZzZXQgKz0gdW5pdC5ieXRlTGVuZ3RoO1xuICAgICAgLy9jb25zb2xlLmxvZygnUFRTL0RUUy9pbml0RFRTL25vcm1QVFMvbm9ybURUUy9yZWxhdGl2ZSBQVFMgOiAke2FhY1NhbXBsZS5wdHN9LyR7YWFjU2FtcGxlLmR0c30vJHt0aGlzLl9pbml0RFRTfS8ke3B0c25vcm19LyR7ZHRzbm9ybX0vJHsoYWFjU2FtcGxlLnB0cy80Mjk0OTY3Mjk2KS50b0ZpeGVkKDMpfScpO1xuICAgICAgbXA0U2FtcGxlID0ge1xuICAgICAgICBzaXplOiB1bml0LmJ5dGVMZW5ndGgsXG4gICAgICAgIGN0czogMCxcbiAgICAgICAgZHVyYXRpb246MCxcbiAgICAgICAgZmxhZ3M6IHtcbiAgICAgICAgICBpc0xlYWRpbmc6IDAsXG4gICAgICAgICAgaXNEZXBlbmRlZE9uOiAwLFxuICAgICAgICAgIGhhc1JlZHVuZGFuY3k6IDAsXG4gICAgICAgICAgZGVncmFkUHJpbzogMCxcbiAgICAgICAgICBkZXBlbmRzT246IDEsXG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgICBzYW1wbGVzLnB1c2gobXA0U2FtcGxlKTtcbiAgICAgIGxhc3REVFMgPSBkdHNub3JtO1xuICAgIH1cbiAgICB2YXIgbGFzdFNhbXBsZUR1cmF0aW9uID0gMDtcbiAgICB2YXIgbmJTYW1wbGVzID0gc2FtcGxlcy5sZW5ndGg7XG4gICAgLy9zZXQgbGFzdCBzYW1wbGUgZHVyYXRpb24gYXMgYmVpbmcgaWRlbnRpY2FsIHRvIHByZXZpb3VzIHNhbXBsZVxuICAgIGlmIChuYlNhbXBsZXMgPj0gMikge1xuICAgICAgbGFzdFNhbXBsZUR1cmF0aW9uID0gc2FtcGxlc1tuYlNhbXBsZXMgLSAyXS5kdXJhdGlvbjtcbiAgICAgIG1wNFNhbXBsZS5kdXJhdGlvbiA9IGxhc3RTYW1wbGVEdXJhdGlvbjtcbiAgICB9XG4gICAgaWYgKG5iU2FtcGxlcykge1xuICAgICAgLy8gbmV4dCBhYWMgc2FtcGxlIFBUUyBzaG91bGQgYmUgZXF1YWwgdG8gbGFzdCBzYW1wbGUgUFRTICsgZHVyYXRpb25cbiAgICAgIHRoaXMubmV4dEFhY1B0cyA9IHB0c25vcm0gKyBwZXMybXA0U2NhbGVGYWN0b3IgKiBsYXN0U2FtcGxlRHVyYXRpb247XG4gICAgICAvL2xvZ2dlci5sb2coJ0F1ZGlvL1BUUy9QVFNlbmQ6JyArIGFhY1NhbXBsZS5wdHMudG9GaXhlZCgwKSArICcvJyArIHRoaXMubmV4dEFhY0R0cy50b0ZpeGVkKDApKTtcbiAgICAgIHRyYWNrLmxlbiA9IDA7XG4gICAgICB0cmFjay5zYW1wbGVzID0gc2FtcGxlcztcbiAgICAgIG1vb2YgPSBNUDQubW9vZih0cmFjay5zZXF1ZW5jZU51bWJlcisrLCBmaXJzdERUUyAvIHBlczJtcDRTY2FsZUZhY3RvciwgdHJhY2spO1xuICAgICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgICAgdGhpcy5vYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19EQVRBLCB7XG4gICAgICAgIGRhdGExOiBtb29mLFxuICAgICAgICBkYXRhMjogbWRhdCxcbiAgICAgICAgc3RhcnRQVFM6IGZpcnN0UFRTIC8gcGVzVGltZVNjYWxlLFxuICAgICAgICBlbmRQVFM6IHRoaXMubmV4dEFhY1B0cyAvIHBlc1RpbWVTY2FsZSxcbiAgICAgICAgc3RhcnREVFM6IGZpcnN0RFRTIC8gcGVzVGltZVNjYWxlLFxuICAgICAgICBlbmREVFM6IChkdHNub3JtICsgcGVzMm1wNFNjYWxlRmFjdG9yICogbGFzdFNhbXBsZUR1cmF0aW9uKSAvIHBlc1RpbWVTY2FsZSxcbiAgICAgICAgdHlwZTogJ2F1ZGlvJyxcbiAgICAgICAgbmI6IG5iU2FtcGxlc1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgcmVtdXhJRDModHJhY2ssdGltZU9mZnNldCkge1xuICAgIHZhciBsZW5ndGggPSB0cmFjay5zYW1wbGVzLmxlbmd0aCwgc2FtcGxlO1xuICAgIC8vIGNvbnN1bWUgc2FtcGxlc1xuICAgIGlmKGxlbmd0aCkge1xuICAgICAgZm9yKHZhciBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIHNhbXBsZSA9IHRyYWNrLnNhbXBsZXNbaW5kZXhdO1xuICAgICAgICAvLyBzZXR0aW5nIGlkMyBwdHMsIGR0cyB0byByZWxhdGl2ZSB0aW1lXG4gICAgICAgIC8vIHVzaW5nIHRoaXMuX2luaXRQVFMgYW5kIHRoaXMuX2luaXREVFMgdG8gY2FsY3VsYXRlIHJlbGF0aXZlIHRpbWVcbiAgICAgICAgc2FtcGxlLnB0cyA9ICgoc2FtcGxlLnB0cyAtIHRoaXMuX2luaXRQVFMpIC8gdGhpcy5QRVNfVElNRVNDQUxFKTtcbiAgICAgICAgc2FtcGxlLmR0cyA9ICgoc2FtcGxlLmR0cyAtIHRoaXMuX2luaXREVFMpIC8gdGhpcy5QRVNfVElNRVNDQUxFKTtcbiAgICAgIH1cbiAgICAgIHRoaXMub2JzZXJ2ZXIudHJpZ2dlcihFdmVudC5GUkFHX1BBUlNJTkdfTUVUQURBVEEsIHtcbiAgICAgICAgc2FtcGxlczp0cmFjay5zYW1wbGVzXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB0cmFjay5zYW1wbGVzID0gW107XG4gICAgdGltZU9mZnNldCA9IHRpbWVPZmZzZXQ7XG4gIH1cblxuICByZW11eFRleHQodHJhY2ssdGltZU9mZnNldCkge1xuICAgIHRyYWNrLnNhbXBsZXMuc29ydChmdW5jdGlvbihhLCBiKSB7XG4gICAgICByZXR1cm4gKGEucHRzLWIucHRzKTtcbiAgICB9KTtcblxuICAgIHZhciBsZW5ndGggPSB0cmFjay5zYW1wbGVzLmxlbmd0aCwgc2FtcGxlO1xuICAgIC8vIGNvbnN1bWUgc2FtcGxlc1xuICAgIGlmKGxlbmd0aCkge1xuICAgICAgZm9yKHZhciBpbmRleCA9IDA7IGluZGV4IDwgbGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgICAgIHNhbXBsZSA9IHRyYWNrLnNhbXBsZXNbaW5kZXhdO1xuICAgICAgICAvLyBzZXR0aW5nIHRleHQgcHRzLCBkdHMgdG8gcmVsYXRpdmUgdGltZVxuICAgICAgICAvLyB1c2luZyB0aGlzLl9pbml0UFRTIGFuZCB0aGlzLl9pbml0RFRTIHRvIGNhbGN1bGF0ZSByZWxhdGl2ZSB0aW1lXG4gICAgICAgIHNhbXBsZS5wdHMgPSAoKHNhbXBsZS5wdHMgLSB0aGlzLl9pbml0UFRTKSAvIHRoaXMuUEVTX1RJTUVTQ0FMRSk7XG4gICAgICB9XG4gICAgICB0aGlzLm9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX1VTRVJEQVRBLCB7XG4gICAgICAgIHNhbXBsZXM6dHJhY2suc2FtcGxlc1xuICAgICAgfSk7XG4gICAgfVxuXG4gICAgdHJhY2suc2FtcGxlcyA9IFtdO1xuICAgIHRpbWVPZmZzZXQgPSB0aW1lT2Zmc2V0O1xuICB9XG5cbiAgX1BUU05vcm1hbGl6ZSh2YWx1ZSwgcmVmZXJlbmNlKSB7XG4gICAgdmFyIG9mZnNldDtcbiAgICBpZiAocmVmZXJlbmNlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG4gICAgaWYgKHJlZmVyZW5jZSA8IHZhbHVlKSB7XG4gICAgICAvLyAtIDJeMzNcbiAgICAgIG9mZnNldCA9IC04NTg5OTM0NTkyO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyArIDJeMzNcbiAgICAgIG9mZnNldCA9IDg1ODk5MzQ1OTI7XG4gICAgfVxuICAgIC8qIFBUUyBpcyAzM2JpdCAoZnJvbSAwIHRvIDJeMzMgLTEpXG4gICAgICBpZiBkaWZmIGJldHdlZW4gdmFsdWUgYW5kIHJlZmVyZW5jZSBpcyBiaWdnZXIgdGhhbiBoYWxmIG9mIHRoZSBhbXBsaXR1ZGUgKDJeMzIpIHRoZW4gaXQgbWVhbnMgdGhhdFxuICAgICAgUFRTIGxvb3Bpbmcgb2NjdXJlZC4gZmlsbCB0aGUgZ2FwICovXG4gICAgd2hpbGUgKE1hdGguYWJzKHZhbHVlIC0gcmVmZXJlbmNlKSA+IDQyOTQ5NjcyOTYpIHtcbiAgICAgICAgdmFsdWUgKz0gb2Zmc2V0O1xuICAgIH1cbiAgICByZXR1cm4gdmFsdWU7XG4gIH1cblxufVxuXG5leHBvcnQgZGVmYXVsdCBNUDRSZW11eGVyO1xuIiwiLyoqXG4gKiBwYXNzdGhyb3VnaCByZW11eGVyXG4qL1xuaW1wb3J0IEV2ZW50IGZyb20gJy4uL2V2ZW50cyc7XG5cbmNsYXNzIFBhc3NUaHJvdWdoUmVtdXhlciB7XG4gIGNvbnN0cnVjdG9yKG9ic2VydmVyKSB7XG4gICAgdGhpcy5vYnNlcnZlciA9IG9ic2VydmVyO1xuICAgIHRoaXMuSVNHZW5lcmF0ZWQgPSBmYWxzZTtcbiAgfVxuXG4gIGdldCBwYXNzdGhyb3VnaCgpIHtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gIH1cblxuICBpbnNlcnREaXNjb250aW51aXR5KCkge1xuICB9XG5cbiAgc3dpdGNoTGV2ZWwoKSB7XG4gICAgdGhpcy5JU0dlbmVyYXRlZCA9IGZhbHNlO1xuICB9XG5cbiAgcmVtdXgoYXVkaW9UcmFjayx2aWRlb1RyYWNrLGlkM1RyYWNrLHRleHRUcmFjayx0aW1lT2Zmc2V0LHJhd0RhdGEpIHtcbiAgICB2YXIgb2JzZXJ2ZXIgPSB0aGlzLm9ic2VydmVyO1xuICAgIC8vIGdlbmVyYXRlIEluaXQgU2VnbWVudCBpZiBuZWVkZWRcbiAgICBpZiAoIXRoaXMuSVNHZW5lcmF0ZWQpIHtcbiAgICAgIHZhciB0cmFja3MgPSB7fSxcbiAgICAgICAgICBkYXRhID0geyB0cmFja3MgOiB0cmFja3MsIHVuaXF1ZSA6IHRydWUgfSxcbiAgICAgICAgICB0cmFjayA9IHZpZGVvVHJhY2ssXG4gICAgICAgICAgY29kZWMgPSB0cmFjay5jb2RlYztcblxuICAgICAgaWYgKGNvZGVjKSB7XG4gICAgICAgIGRhdGEudHJhY2tzLnZpZGVvID0ge1xuICAgICAgICAgIGNvbnRhaW5lciA6IHRyYWNrLmNvbnRhaW5lcixcbiAgICAgICAgICBjb2RlYyA6ICBjb2RlYyxcbiAgICAgICAgICBtZXRhZGF0YSA6IHtcbiAgICAgICAgICAgIHdpZHRoIDogdHJhY2sud2lkdGgsXG4gICAgICAgICAgICBoZWlnaHQgOiB0cmFjay5oZWlnaHRcbiAgICAgICAgICB9XG4gICAgICAgIH07XG4gICAgICB9XG5cbiAgICAgIHRyYWNrID0gYXVkaW9UcmFjaztcbiAgICAgIGNvZGVjID0gdHJhY2suY29kZWM7XG4gICAgICBpZiAoY29kZWMpIHtcbiAgICAgICAgZGF0YS50cmFja3MuYXVkaW8gPSB7XG4gICAgICAgICAgY29udGFpbmVyIDogdHJhY2suY29udGFpbmVyLFxuICAgICAgICAgIGNvZGVjIDogIGNvZGVjLFxuICAgICAgICAgIG1ldGFkYXRhIDoge1xuICAgICAgICAgICAgY2hhbm5lbENvdW50IDogdHJhY2suY2hhbm5lbENvdW50XG4gICAgICAgICAgfVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgdGhpcy5JU0dlbmVyYXRlZCA9IHRydWU7XG4gICAgICBvYnNlcnZlci50cmlnZ2VyKEV2ZW50LkZSQUdfUEFSU0lOR19JTklUX1NFR01FTlQsZGF0YSk7XG4gICAgfVxuICAgIG9ic2VydmVyLnRyaWdnZXIoRXZlbnQuRlJBR19QQVJTSU5HX0RBVEEsIHtcbiAgICAgIGRhdGExOiByYXdEYXRhLFxuICAgICAgc3RhcnRQVFM6IHRpbWVPZmZzZXQsXG4gICAgICBzdGFydERUUzogdGltZU9mZnNldCxcbiAgICAgIHR5cGU6ICdhdWRpb3ZpZGVvJyxcbiAgICAgIG5iOiAxXG4gICAgfSk7XG4gIH1cbn1cblxuZXhwb3J0IGRlZmF1bHQgUGFzc1Rocm91Z2hSZW11eGVyO1xuIiwiXG4vLyBhZGFwdGVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2thbm9uZ2lsL25vZGUtbTN1OHBhcnNlL2Jsb2IvbWFzdGVyL2F0dHJsaXN0LmpzXG5jbGFzcyBBdHRyTGlzdCB7XG5cbiAgY29uc3RydWN0b3IoYXR0cnMpIHtcbiAgICBpZiAodHlwZW9mIGF0dHJzID09PSAnc3RyaW5nJykge1xuICAgICAgYXR0cnMgPSBBdHRyTGlzdC5wYXJzZUF0dHJMaXN0KGF0dHJzKTtcbiAgICB9XG4gICAgZm9yKHZhciBhdHRyIGluIGF0dHJzKXtcbiAgICAgIGlmKGF0dHJzLmhhc093blByb3BlcnR5KGF0dHIpKSB7XG4gICAgICAgIHRoaXNbYXR0cl0gPSBhdHRyc1thdHRyXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBkZWNpbWFsSW50ZWdlcihhdHRyTmFtZSkge1xuICAgIGNvbnN0IGludFZhbHVlID0gcGFyc2VJbnQodGhpc1thdHRyTmFtZV0sIDEwKTtcbiAgICBpZiAoaW50VmFsdWUgPiBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUikge1xuICAgICAgcmV0dXJuIEluZmluaXR5O1xuICAgIH1cbiAgICByZXR1cm4gaW50VmFsdWU7XG4gIH1cblxuICBoZXhhZGVjaW1hbEludGVnZXIoYXR0ck5hbWUpIHtcbiAgICBpZih0aGlzW2F0dHJOYW1lXSkge1xuICAgICAgbGV0IHN0cmluZ1ZhbHVlID0gKHRoaXNbYXR0ck5hbWVdIHx8ICcweCcpLnNsaWNlKDIpO1xuICAgICAgc3RyaW5nVmFsdWUgPSAoKHN0cmluZ1ZhbHVlLmxlbmd0aCAmIDEpID8gJzAnIDogJycpICsgc3RyaW5nVmFsdWU7XG5cbiAgICAgIGNvbnN0IHZhbHVlID0gbmV3IFVpbnQ4QXJyYXkoc3RyaW5nVmFsdWUubGVuZ3RoIC8gMik7XG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHN0cmluZ1ZhbHVlLmxlbmd0aCAvIDI7IGkrKykge1xuICAgICAgICB2YWx1ZVtpXSA9IHBhcnNlSW50KHN0cmluZ1ZhbHVlLnNsaWNlKGkgKiAyLCBpICogMiArIDIpLCAxNik7XG4gICAgICB9XG4gICAgICByZXR1cm4gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cbiAgfVxuXG4gIGhleGFkZWNpbWFsSW50ZWdlckFzTnVtYmVyKGF0dHJOYW1lKSB7XG4gICAgY29uc3QgaW50VmFsdWUgPSBwYXJzZUludCh0aGlzW2F0dHJOYW1lXSwgMTYpO1xuICAgIGlmIChpbnRWYWx1ZSA+IE51bWJlci5NQVhfU0FGRV9JTlRFR0VSKSB7XG4gICAgICByZXR1cm4gSW5maW5pdHk7XG4gICAgfVxuICAgIHJldHVybiBpbnRWYWx1ZTtcbiAgfVxuXG4gIGRlY2ltYWxGbG9hdGluZ1BvaW50KGF0dHJOYW1lKSB7XG4gICAgcmV0dXJuIHBhcnNlRmxvYXQodGhpc1thdHRyTmFtZV0pO1xuICB9XG5cbiAgZW51bWVyYXRlZFN0cmluZyhhdHRyTmFtZSkge1xuICAgIHJldHVybiB0aGlzW2F0dHJOYW1lXTtcbiAgfVxuXG4gIGRlY2ltYWxSZXNvbHV0aW9uKGF0dHJOYW1lKSB7XG4gICAgY29uc3QgcmVzID0gL14oXFxkKyl4KFxcZCspJC8uZXhlYyh0aGlzW2F0dHJOYW1lXSk7XG4gICAgaWYgKHJlcyA9PT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgcmV0dXJuIHtcbiAgICAgIHdpZHRoOiBwYXJzZUludChyZXNbMV0sIDEwKSxcbiAgICAgIGhlaWdodDogcGFyc2VJbnQocmVzWzJdLCAxMClcbiAgICB9O1xuICB9XG5cbiAgc3RhdGljIHBhcnNlQXR0ckxpc3QoaW5wdXQpIHtcbiAgICBjb25zdCByZSA9IC9cXHMqKC4rPylcXHMqPSgoPzpcXFwiLio/XFxcIil8Lio/KSg/Oix8JCkvZztcbiAgICB2YXIgbWF0Y2gsIGF0dHJzID0ge307XG4gICAgd2hpbGUgKChtYXRjaCA9IHJlLmV4ZWMoaW5wdXQpKSAhPT0gbnVsbCkge1xuICAgICAgdmFyIHZhbHVlID0gbWF0Y2hbMl0sIHF1b3RlID0gJ1wiJztcblxuICAgICAgaWYgKHZhbHVlLmluZGV4T2YocXVvdGUpID09PSAwICYmXG4gICAgICAgICAgdmFsdWUubGFzdEluZGV4T2YocXVvdGUpID09PSAodmFsdWUubGVuZ3RoLTEpKSB7XG4gICAgICAgIHZhbHVlID0gdmFsdWUuc2xpY2UoMSwgLTEpO1xuICAgICAgfVxuICAgICAgYXR0cnNbbWF0Y2hbMV1dID0gdmFsdWU7XG4gICAgfVxuICAgIHJldHVybiBhdHRycztcbiAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IEF0dHJMaXN0O1xuIiwidmFyIEJpbmFyeVNlYXJjaCA9IHtcbiAgICAvKipcbiAgICAgKiBTZWFyY2hlcyBmb3IgYW4gaXRlbSBpbiBhbiBhcnJheSB3aGljaCBtYXRjaGVzIGEgY2VydGFpbiBjb25kaXRpb24uXG4gICAgICogVGhpcyByZXF1aXJlcyB0aGUgY29uZGl0aW9uIHRvIG9ubHkgbWF0Y2ggb25lIGl0ZW0gaW4gdGhlIGFycmF5LFxuICAgICAqIGFuZCBmb3IgdGhlIGFycmF5IHRvIGJlIG9yZGVyZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBsaXN0IFRoZSBhcnJheSB0byBzZWFyY2guXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY29tcGFyaXNvbkZ1bmN0aW9uXG4gICAgICogICAgICBDYWxsZWQgYW5kIHByb3ZpZGVkIGEgY2FuZGlkYXRlIGl0ZW0gYXMgdGhlIGZpcnN0IGFyZ3VtZW50LlxuICAgICAqICAgICAgU2hvdWxkIHJldHVybjpcbiAgICAgKiAgICAgICAgICA+IC0xIGlmIHRoZSBpdGVtIHNob3VsZCBiZSBsb2NhdGVkIGF0IGEgbG93ZXIgaW5kZXggdGhhbiB0aGUgcHJvdmlkZWQgaXRlbS5cbiAgICAgKiAgICAgICAgICA+IDEgaWYgdGhlIGl0ZW0gc2hvdWxkIGJlIGxvY2F0ZWQgYXQgYSBoaWdoZXIgaW5kZXggdGhhbiB0aGUgcHJvdmlkZWQgaXRlbS5cbiAgICAgKiAgICAgICAgICA+IDAgaWYgdGhlIGl0ZW0gaXMgdGhlIGl0ZW0geW91J3JlIGxvb2tpbmcgZm9yLlxuICAgICAqXG4gICAgICogQHJldHVybiB7Kn0gVGhlIG9iamVjdCBpZiBpdCBpcyBmb3VuZCBvciBudWxsIG90aGVyd2lzZS5cbiAgICAgKi9cbiAgICBzZWFyY2g6IGZ1bmN0aW9uKGxpc3QsIGNvbXBhcmlzb25GdW5jdGlvbikge1xuICAgICAgICB2YXIgbWluSW5kZXggPSAwO1xuICAgICAgICB2YXIgbWF4SW5kZXggPSBsaXN0Lmxlbmd0aCAtIDE7XG4gICAgICAgIHZhciBjdXJyZW50SW5kZXggPSBudWxsO1xuICAgICAgICB2YXIgY3VycmVudEVsZW1lbnQgPSBudWxsO1xuICAgICBcbiAgICAgICAgd2hpbGUgKG1pbkluZGV4IDw9IG1heEluZGV4KSB7XG4gICAgICAgICAgICBjdXJyZW50SW5kZXggPSAobWluSW5kZXggKyBtYXhJbmRleCkgLyAyIHwgMDtcbiAgICAgICAgICAgIGN1cnJlbnRFbGVtZW50ID0gbGlzdFtjdXJyZW50SW5kZXhdO1xuICAgICAgICAgICAgXG4gICAgICAgICAgICB2YXIgY29tcGFyaXNvblJlc3VsdCA9IGNvbXBhcmlzb25GdW5jdGlvbihjdXJyZW50RWxlbWVudCk7XG4gICAgICAgICAgICBpZiAoY29tcGFyaXNvblJlc3VsdCA+IDApIHtcbiAgICAgICAgICAgICAgICBtaW5JbmRleCA9IGN1cnJlbnRJbmRleCArIDE7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBlbHNlIGlmIChjb21wYXJpc29uUmVzdWx0IDwgMCkge1xuICAgICAgICAgICAgICAgIG1heEluZGV4ID0gY3VycmVudEluZGV4IC0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBjdXJyZW50RWxlbWVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICBcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBCaW5hcnlTZWFyY2g7XG4iLCIvKlxuICogQ0VBLTcwOCBpbnRlcnByZXRlclxuKi9cblxuY2xhc3MgQ0VBNzA4SW50ZXJwcmV0ZXIge1xuXG4gIGNvbnN0cnVjdG9yKCkge1xuICB9XG5cbiAgYXR0YWNoKG1lZGlhKSB7XG4gICAgdGhpcy5tZWRpYSA9IG1lZGlhO1xuICAgIHRoaXMuZGlzcGxheSA9IFtdO1xuICAgIHRoaXMubWVtb3J5ID0gW107XG4gIH1cblxuICBkZXRhY2goKVxuICB7XG4gICAgdGhpcy5jbGVhcigpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgfVxuXG4gIF9jcmVhdGVDdWUoKVxuICB7XG4gICAgdmFyIFZUVEN1ZSA9IHdpbmRvdy5WVFRDdWUgfHwgd2luZG93LlRleHRUcmFja0N1ZTtcblxuICAgIHZhciBjdWUgPSB0aGlzLmN1ZSA9IG5ldyBWVFRDdWUoLTEsIC0xLCAnJyk7XG4gICAgY3VlLnRleHQgPSAnJztcbiAgICBjdWUucGF1c2VPbkV4aXQgPSBmYWxzZTtcblxuICAgIC8vIG1ha2Ugc3VyZSBpdCBkb2Vzbid0IHNob3cgdXAgYmVmb3JlIGl0J3MgcmVhZHlcbiAgICBjdWUuc3RhcnRUaW1lID0gTnVtYmVyLk1BWF9WQUxVRTtcblxuICAgIC8vIHNob3cgaXQgJ2ZvcmV2ZXInIG9uY2Ugd2UgZG8gc2hvdyBpdFxuICAgIC8vICh3ZSdsbCBzZXQgdGhlIGVuZCB0aW1lIG9uY2Ugd2Uga25vdyBpdCBsYXRlcilcbiAgICBjdWUuZW5kVGltZSA9IE51bWJlci5NQVhfVkFMVUU7XG5cbiAgICB0aGlzLm1lbW9yeS5wdXNoKGN1ZSk7XG4gIH1cblxuICBjbGVhcigpXG4gIHtcbiAgICB2YXIgdGV4dFRyYWNrID0gdGhpcy5fdGV4dFRyYWNrO1xuICAgIGlmICh0ZXh0VHJhY2sgJiYgdGV4dFRyYWNrLmN1ZXMpXG4gICAge1xuICAgICAgd2hpbGUgKHRleHRUcmFjay5jdWVzLmxlbmd0aCA+IDApXG4gICAgICB7XG4gICAgICAgIHRleHRUcmFjay5yZW1vdmVDdWUodGV4dFRyYWNrLmN1ZXNbMF0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHB1c2godGltZXN0YW1wLCBieXRlcylcbiAge1xuICAgIGlmICghdGhpcy5jdWUpXG4gICAge1xuICAgICAgdGhpcy5fY3JlYXRlQ3VlKCk7XG4gICAgfVxuXG4gICAgdmFyIGNvdW50ID0gYnl0ZXNbMF0gJiAzMTtcbiAgICB2YXIgcG9zaXRpb24gPSAyO1xuICAgIHZhciB0bXBCeXRlLCBjY2J5dGUxLCBjY2J5dGUyLCBjY1ZhbGlkLCBjY1R5cGU7XG5cbiAgICBmb3IgKHZhciBqPTA7IGo8Y291bnQ7IGorKylcbiAgICB7XG4gICAgICB0bXBCeXRlID0gYnl0ZXNbcG9zaXRpb24rK107XG4gICAgICBjY2J5dGUxID0gMHg3RiAmIGJ5dGVzW3Bvc2l0aW9uKytdO1xuICAgICAgY2NieXRlMiA9IDB4N0YgJiBieXRlc1twb3NpdGlvbisrXTtcbiAgICAgIGNjVmFsaWQgPSAoKDQgJiB0bXBCeXRlKSA9PT0gMCA/IGZhbHNlIDogdHJ1ZSk7XG4gICAgICBjY1R5cGUgPSAoMyAmIHRtcEJ5dGUpO1xuXG4gICAgICBpZiAoY2NieXRlMSA9PT0gMCAmJiBjY2J5dGUyID09PSAwKVxuICAgICAge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKGNjVmFsaWQpXG4gICAgICB7XG4gICAgICAgIGlmIChjY1R5cGUgPT09IDApIC8vIHx8IGNjVHlwZSA9PT0gMVxuICAgICAgICB7XG4gICAgICAgICAgLy8gU3RhbmRhcmQgQ2hhcmFjdGVyc1xuICAgICAgICAgIGlmICgweDIwICYgY2NieXRlMSB8fCAweDQwICYgY2NieXRlMSlcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9IHRoaXMuX2Zyb21DaGFyQ29kZShjY2J5dGUxKSArIHRoaXMuX2Zyb21DaGFyQ29kZShjY2J5dGUyKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gU3BlY2lhbCBDaGFyYWN0ZXJzXG4gICAgICAgICAgZWxzZSBpZiAoKGNjYnl0ZTEgPT09IDB4MTEgfHwgY2NieXRlMSA9PT0gMHgxOSkgJiYgY2NieXRlMiA+PSAweDMwICYmIGNjYnl0ZTIgPD0gMHgzRilcbiAgICAgICAgICB7XG4gICAgICAgICAgICAvLyBleHRlbmRlZCBjaGFycywgZS5nLiBtdXNpY2FsIG5vdGUsIGFjY2VudHNcbiAgICAgICAgICAgIHN3aXRjaCAoY2NieXRlMilcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgY2FzZSA0ODpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCric7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNDk6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnwrAnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDUwOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8K9JztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1MTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCvyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTI6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAn4oSiJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1MzpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCoic7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTQ6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1NTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfCoyc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTY6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAn4pmqJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1NzpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICcgJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA1ODpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfDqCc7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNTk6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnw6InO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDYwOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8OqJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSA2MTpcbiAgICAgICAgICAgICAgICB0aGlzLmN1ZS50ZXh0ICs9ICfDric7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgNjI6XG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCArPSAnw7QnO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDYzOlxuICAgICAgICAgICAgICAgIHRoaXMuY3VlLnRleHQgKz0gJ8O7JztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKChjY2J5dGUxID09PSAweDExIHx8IGNjYnl0ZTEgPT09IDB4MTkpICYmIGNjYnl0ZTIgPj0gMHgyMCAmJiBjY2J5dGUyIDw9IDB4MkYpXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gTWlkLXJvdyBjb2RlczogY29sb3IvdW5kZXJsaW5lXG4gICAgICAgICAgICBzd2l0Y2ggKGNjYnl0ZTIpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMDpcbiAgICAgICAgICAgICAgICAvLyBXaGl0ZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjE6XG4gICAgICAgICAgICAgICAgLy8gV2hpdGUgVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMjpcbiAgICAgICAgICAgICAgICAvLyBHcmVlblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjM6XG4gICAgICAgICAgICAgICAgLy8gR3JlZW4gVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNDpcbiAgICAgICAgICAgICAgICAvLyBCbHVlXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNTpcbiAgICAgICAgICAgICAgICAvLyBCbHVlIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjY6XG4gICAgICAgICAgICAgICAgLy8gQ3lhblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjc6XG4gICAgICAgICAgICAgICAgLy8gQ3lhbiBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDI4OlxuICAgICAgICAgICAgICAgIC8vIFJlZFxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4Mjk6XG4gICAgICAgICAgICAgICAgLy8gUmVkIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkE6XG4gICAgICAgICAgICAgICAgLy8gWWVsbG93XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQjpcbiAgICAgICAgICAgICAgICAvLyBZZWxsb3cgVW5kZXJsaW5lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQzpcbiAgICAgICAgICAgICAgICAvLyBNYWdlbnRhXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyRDpcbiAgICAgICAgICAgICAgICAvLyBNYWdlbnRhIFVuZGVybGluZVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkU6XG4gICAgICAgICAgICAgICAgLy8gSXRhbGljc1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkY6XG4gICAgICAgICAgICAgICAgLy8gSXRhbGljcyBVbmRlcmxpbmVcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKChjY2J5dGUxID09PSAweDE0IHx8IGNjYnl0ZTEgPT09IDB4MUMpICYmIGNjYnl0ZTIgPj0gMHgyMCAmJiBjY2J5dGUyIDw9IDB4MkYpXG4gICAgICAgICAge1xuICAgICAgICAgICAgLy8gTWlkLXJvdyBjb2RlczogY29sb3IvdW5kZXJsaW5lXG4gICAgICAgICAgICBzd2l0Y2ggKGNjYnl0ZTIpXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMDpcbiAgICAgICAgICAgICAgICAvLyBUT0RPOiBzaG91bGRuJ3QgYWZmZWN0IHJvbGwtdXBzLi4uXG4gICAgICAgICAgICAgICAgdGhpcy5fY2xlYXJBY3RpdmVDdWVzKHRpbWVzdGFtcCk7XG4gICAgICAgICAgICAgICAgLy8gUkNMOiBSZXN1bWUgQ2FwdGlvbiBMb2FkaW5nXG4gICAgICAgICAgICAgICAgLy8gYmVnaW4gcG9wIG9uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMTpcbiAgICAgICAgICAgICAgICAvLyBCUzogQmFja3NwYWNlXG4gICAgICAgICAgICAgICAgdGhpcy5jdWUudGV4dCA9IHRoaXMuY3VlLnRleHQuc3Vic3RyKDAsIHRoaXMuY3VlLnRleHQubGVuZ3RoLTEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjI6XG4gICAgICAgICAgICAgICAgLy8gQU9GOiByZXNlcnZlZCAoZm9ybWVybHkgYWxhcm0gb2ZmKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MjM6XG4gICAgICAgICAgICAgICAgLy8gQU9OOiByZXNlcnZlZCAoZm9ybWVybHkgYWxhcm0gb24pXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNDpcbiAgICAgICAgICAgICAgICAvLyBERVI6IERlbGV0ZSB0byBlbmQgb2Ygcm93XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNTpcbiAgICAgICAgICAgICAgICAvLyBSVTI6IHJvbGwtdXAgMiByb3dzXG4gICAgICAgICAgICAgICAgLy90aGlzLl9yb2xsdXAoMik7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNjpcbiAgICAgICAgICAgICAgICAvLyBSVTM6IHJvbGwtdXAgMyByb3dzXG4gICAgICAgICAgICAgICAgLy90aGlzLl9yb2xsdXAoMyk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyNzpcbiAgICAgICAgICAgICAgICAvLyBSVTQ6IHJvbGwtdXAgNCByb3dzXG4gICAgICAgICAgICAgICAgLy90aGlzLl9yb2xsdXAoNCk7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyODpcbiAgICAgICAgICAgICAgICAvLyBGT046IEZsYXNoIG9uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyOTpcbiAgICAgICAgICAgICAgICAvLyBSREM6IFJlc3VtZSBkaXJlY3QgY2FwdGlvbmluZ1xuICAgICAgICAgICAgICAgIHRoaXMuX2NsZWFyQWN0aXZlQ3Vlcyh0aW1lc3RhbXApO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkE6XG4gICAgICAgICAgICAgICAgLy8gVFI6IFRleHQgUmVzdGFydFxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkI6XG4gICAgICAgICAgICAgICAgLy8gUlREOiBSZXN1bWUgVGV4dCBEaXNwbGF5XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyQzpcbiAgICAgICAgICAgICAgICAvLyBFRE06IEVyYXNlIERpc3BsYXllZCBNZW1vcnlcbiAgICAgICAgICAgICAgICB0aGlzLl9jbGVhckFjdGl2ZUN1ZXModGltZXN0YW1wKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJEOlxuICAgICAgICAgICAgICAgIC8vIENSOiBDYXJyaWFnZSBSZXR1cm5cbiAgICAgICAgICAgICAgICAvLyBvbmx5IGFmZmVjdHMgcm9sbC11cFxuICAgICAgICAgICAgICAgIC8vdGhpcy5fcm9sbHVwKDEpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICBjYXNlIDB4MkU6XG4gICAgICAgICAgICAgICAgLy8gRU5NOiBFcmFzZSBub24tZGlzcGxheWVkIG1lbW9yeVxuICAgICAgICAgICAgICAgIHRoaXMuX3RleHQgPSAnJztcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDJGOlxuICAgICAgICAgICAgICAgIHRoaXMuX2ZsaXBNZW1vcnkodGltZXN0YW1wKTtcbiAgICAgICAgICAgICAgICAvLyBFT0M6IEVuZCBvZiBjYXB0aW9uXG4gICAgICAgICAgICAgICAgLy8gaGlkZSBhbnkgZGlzcGxheWVkIGNhcHRpb25zIGFuZCBzaG93IGFueSBoaWRkZW4gb25lXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmICgoY2NieXRlMSA9PT0gMHgxNyB8fCBjY2J5dGUxID09PSAweDFGKSAmJiBjY2J5dGUyID49IDB4MjEgJiYgY2NieXRlMiA8PSAweDIzKVxuICAgICAgICAgIHtcbiAgICAgICAgICAgIC8vIE1pZC1yb3cgY29kZXM6IGNvbG9yL3VuZGVybGluZVxuICAgICAgICAgICAgc3dpdGNoIChjY2J5dGUyKVxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBjYXNlIDB4MjE6XG4gICAgICAgICAgICAgICAgLy8gVE8xOiB0YWIgb2Zmc2V0IDEgY29sdW1uXG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgIGNhc2UgMHgyMjpcbiAgICAgICAgICAgICAgICAvLyBUTzE6IHRhYiBvZmZzZXQgMiBjb2x1bW5cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgY2FzZSAweDIzOlxuICAgICAgICAgICAgICAgIC8vIFRPMTogdGFiIG9mZnNldCAzIGNvbHVtblxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBlbHNlIHtcbiAgICAgICAgICAgIC8vIFByb2JhYmx5IGEgcHJlLWFtYmxlIGFkZHJlc3MgY29kZVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIF9mcm9tQ2hhckNvZGUodG1wQnl0ZSlcbiAge1xuICAgIHN3aXRjaCAodG1wQnl0ZSlcbiAgICB7XG4gICAgICBjYXNlIDQyOlxuICAgICAgICByZXR1cm4gJ8OhJztcblxuICAgICAgY2FzZSAyOlxuICAgICAgICByZXR1cm4gJ8OhJztcblxuICAgICAgY2FzZSAyOlxuICAgICAgICByZXR1cm4gJ8OpJztcblxuICAgICAgY2FzZSA0OlxuICAgICAgICByZXR1cm4gJ8OtJztcblxuICAgICAgY2FzZSA1OlxuICAgICAgICByZXR1cm4gJ8OzJztcblxuICAgICAgY2FzZSA2OlxuICAgICAgICByZXR1cm4gJ8O6JztcblxuICAgICAgY2FzZSAzOlxuICAgICAgICByZXR1cm4gJ8OnJztcblxuICAgICAgY2FzZSA0OlxuICAgICAgICByZXR1cm4gJ8O3JztcblxuICAgICAgY2FzZSA1OlxuICAgICAgICByZXR1cm4gJ8ORJztcblxuICAgICAgY2FzZSA2OlxuICAgICAgICByZXR1cm4gJ8OxJztcblxuICAgICAgY2FzZSA3OlxuICAgICAgICByZXR1cm4gJ+KWiCc7XG5cbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKHRtcEJ5dGUpO1xuICAgIH1cbiAgfVxuXG4gIF9mbGlwTWVtb3J5KHRpbWVzdGFtcClcbiAge1xuICAgIHRoaXMuX2NsZWFyQWN0aXZlQ3Vlcyh0aW1lc3RhbXApO1xuICAgIHRoaXMuX2ZsdXNoQ2FwdGlvbnModGltZXN0YW1wKTtcbiAgfVxuXG4gIF9mbHVzaENhcHRpb25zKHRpbWVzdGFtcClcbiAge1xuICAgIGlmICghdGhpcy5faGFzNzA4KVxuICAgIHtcbiAgICAgIHRoaXMuX3RleHRUcmFjayA9IHRoaXMubWVkaWEuYWRkVGV4dFRyYWNrKCdjYXB0aW9ucycsICdFbmdsaXNoJywgJ2VuJyk7XG4gICAgICB0aGlzLl9oYXM3MDggPSB0cnVlO1xuICAgIH1cblxuICAgIGZvcihsZXQgbWVtb3J5SXRlbSBvZiB0aGlzLm1lbW9yeSlcbiAgICB7XG4gICAgICBtZW1vcnlJdGVtLnN0YXJ0VGltZSA9IHRpbWVzdGFtcDtcbiAgICAgIHRoaXMuX3RleHRUcmFjay5hZGRDdWUobWVtb3J5SXRlbSk7XG4gICAgICB0aGlzLmRpc3BsYXkucHVzaChtZW1vcnlJdGVtKTtcbiAgICB9XG5cbiAgICB0aGlzLm1lbW9yeSA9IFtdO1xuICAgIHRoaXMuY3VlID0gbnVsbDtcbiAgfVxuXG4gIF9jbGVhckFjdGl2ZUN1ZXModGltZXN0YW1wKVxuICB7XG4gICAgZm9yIChsZXQgZGlzcGxheUl0ZW0gb2YgdGhpcy5kaXNwbGF5KVxuICAgIHtcbiAgICAgIGRpc3BsYXlJdGVtLmVuZFRpbWUgPSB0aW1lc3RhbXA7XG4gICAgfVxuXG4gICAgdGhpcy5kaXNwbGF5ID0gW107XG4gIH1cblxuLyogIF9yb2xsVXAobilcbiAge1xuICAgIC8vIFRPRE86IGltcGxlbWVudCByb2xsLXVwIGNhcHRpb25zXG4gIH1cbiovXG4gIF9jbGVhckJ1ZmZlcmVkQ3VlcygpXG4gIHtcbiAgICAvL3JlbW92ZSB0aGVtIGFsbC4uLlxuICB9XG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgQ0VBNzA4SW50ZXJwcmV0ZXI7XG5cbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbmNvbnN0IGZha2VMb2dnZXIgPSB7XG4gIHRyYWNlOiBub29wLFxuICBkZWJ1Zzogbm9vcCxcbiAgbG9nOiBub29wLFxuICB3YXJuOiBub29wLFxuICBpbmZvOiBub29wLFxuICBlcnJvcjogbm9vcFxufTtcblxubGV0IGV4cG9ydGVkTG9nZ2VyID0gZmFrZUxvZ2dlcjtcblxuLy9sZXQgbGFzdENhbGxUaW1lO1xuLy8gZnVuY3Rpb24gZm9ybWF0TXNnV2l0aFRpbWVJbmZvKHR5cGUsIG1zZykge1xuLy8gICBjb25zdCBub3cgPSBEYXRlLm5vdygpO1xuLy8gICBjb25zdCBkaWZmID0gbGFzdENhbGxUaW1lID8gJysnICsgKG5vdyAtIGxhc3RDYWxsVGltZSkgOiAnMCc7XG4vLyAgIGxhc3RDYWxsVGltZSA9IG5vdztcbi8vICAgbXNnID0gKG5ldyBEYXRlKG5vdykpLnRvSVNPU3RyaW5nKCkgKyAnIHwgWycgKyAgdHlwZSArICddID4gJyArIG1zZyArICcgKCAnICsgZGlmZiArICcgbXMgKSc7XG4vLyAgIHJldHVybiBtc2c7XG4vLyB9XG5cbmZ1bmN0aW9uIGZvcm1hdE1zZyh0eXBlLCBtc2cpIHtcbiAgbXNnID0gJ1snICsgIHR5cGUgKyAnXSA+ICcgKyBtc2c7XG4gIHJldHVybiBtc2c7XG59XG5cbmZ1bmN0aW9uIGNvbnNvbGVQcmludEZuKHR5cGUpIHtcbiAgY29uc3QgZnVuYyA9IHdpbmRvdy5jb25zb2xlW3R5cGVdO1xuICBpZiAoZnVuYykge1xuICAgIHJldHVybiBmdW5jdGlvbiguLi5hcmdzKSB7XG4gICAgICBpZihhcmdzWzBdKSB7XG4gICAgICAgIGFyZ3NbMF0gPSBmb3JtYXRNc2codHlwZSwgYXJnc1swXSk7XG4gICAgICB9XG4gICAgICBmdW5jLmFwcGx5KHdpbmRvdy5jb25zb2xlLCBhcmdzKTtcbiAgICB9O1xuICB9XG4gIHJldHVybiBub29wO1xufVxuXG5mdW5jdGlvbiBleHBvcnRMb2dnZXJGdW5jdGlvbnMoZGVidWdDb25maWcsIC4uLmZ1bmN0aW9ucykge1xuICBmdW5jdGlvbnMuZm9yRWFjaChmdW5jdGlvbih0eXBlKSB7XG4gICAgZXhwb3J0ZWRMb2dnZXJbdHlwZV0gPSBkZWJ1Z0NvbmZpZ1t0eXBlXSA/IGRlYnVnQ29uZmlnW3R5cGVdLmJpbmQoZGVidWdDb25maWcpIDogY29uc29sZVByaW50Rm4odHlwZSk7XG4gIH0pO1xufVxuXG5leHBvcnQgdmFyIGVuYWJsZUxvZ3MgPSBmdW5jdGlvbihkZWJ1Z0NvbmZpZykge1xuICBpZiAoZGVidWdDb25maWcgPT09IHRydWUgfHwgdHlwZW9mIGRlYnVnQ29uZmlnID09PSAnb2JqZWN0Jykge1xuICAgIGV4cG9ydExvZ2dlckZ1bmN0aW9ucyhkZWJ1Z0NvbmZpZyxcbiAgICAgIC8vIFJlbW92ZSBvdXQgZnJvbSBsaXN0IGhlcmUgdG8gaGFyZC1kaXNhYmxlIGEgbG9nLWxldmVsXG4gICAgICAvLyd0cmFjZScsXG4gICAgICAnZGVidWcnLFxuICAgICAgJ2xvZycsXG4gICAgICAnaW5mbycsXG4gICAgICAnd2FybicsXG4gICAgICAnZXJyb3InXG4gICAgKTtcbiAgICAvLyBTb21lIGJyb3dzZXJzIGRvbid0IGFsbG93IHRvIHVzZSBiaW5kIG9uIGNvbnNvbGUgb2JqZWN0IGFueXdheVxuICAgIC8vIGZhbGxiYWNrIHRvIGRlZmF1bHQgaWYgbmVlZGVkXG4gICAgdHJ5IHtcbiAgICAgZXhwb3J0ZWRMb2dnZXIubG9nKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgZXhwb3J0ZWRMb2dnZXIgPSBmYWtlTG9nZ2VyO1xuICAgIH1cbiAgfVxuICBlbHNlIHtcbiAgICBleHBvcnRlZExvZ2dlciA9IGZha2VMb2dnZXI7XG4gIH1cbn07XG5cbmV4cG9ydCB2YXIgbG9nZ2VyID0gZXhwb3J0ZWRMb2dnZXI7XG4iLCJ2YXIgVVJMSGVscGVyID0ge1xuXG4gIC8vIGJ1aWxkIGFuIGFic29sdXRlIFVSTCBmcm9tIGEgcmVsYXRpdmUgb25lIHVzaW5nIHRoZSBwcm92aWRlZCBiYXNlVVJMXG4gIC8vIGlmIHJlbGF0aXZlVVJMIGlzIGFuIGFic29sdXRlIFVSTCBpdCB3aWxsIGJlIHJldHVybmVkIGFzIGlzLlxuICBidWlsZEFic29sdXRlVVJMOiBmdW5jdGlvbihiYXNlVVJMLCByZWxhdGl2ZVVSTCkge1xuICAgIC8vIHJlbW92ZSBhbnkgcmVtYWluaW5nIHNwYWNlIGFuZCBDUkxGXG4gICAgcmVsYXRpdmVVUkwgPSByZWxhdGl2ZVVSTC50cmltKCk7XG4gICAgaWYgKC9eW2Etel0rOi9pLnRlc3QocmVsYXRpdmVVUkwpKSB7XG4gICAgICAvLyBjb21wbGV0ZSB1cmwsIG5vdCByZWxhdGl2ZVxuICAgICAgcmV0dXJuIHJlbGF0aXZlVVJMO1xuICAgIH1cblxuICAgIHZhciByZWxhdGl2ZVVSTFF1ZXJ5ID0gbnVsbDtcbiAgICB2YXIgcmVsYXRpdmVVUkxIYXNoID0gbnVsbDtcblxuICAgIHZhciByZWxhdGl2ZVVSTEhhc2hTcGxpdCA9IC9eKFteI10qKSguKikkLy5leGVjKHJlbGF0aXZlVVJMKTtcbiAgICBpZiAocmVsYXRpdmVVUkxIYXNoU3BsaXQpIHtcbiAgICAgIHJlbGF0aXZlVVJMSGFzaCA9IHJlbGF0aXZlVVJMSGFzaFNwbGl0WzJdO1xuICAgICAgcmVsYXRpdmVVUkwgPSByZWxhdGl2ZVVSTEhhc2hTcGxpdFsxXTtcbiAgICB9XG4gICAgdmFyIHJlbGF0aXZlVVJMUXVlcnlTcGxpdCA9IC9eKFteXFw/XSopKC4qKSQvLmV4ZWMocmVsYXRpdmVVUkwpO1xuICAgIGlmIChyZWxhdGl2ZVVSTFF1ZXJ5U3BsaXQpIHtcbiAgICAgIHJlbGF0aXZlVVJMUXVlcnkgPSByZWxhdGl2ZVVSTFF1ZXJ5U3BsaXRbMl07XG4gICAgICByZWxhdGl2ZVVSTCA9IHJlbGF0aXZlVVJMUXVlcnlTcGxpdFsxXTtcbiAgICB9XG5cbiAgICB2YXIgYmFzZVVSTEhhc2hTcGxpdCA9IC9eKFteI10qKSguKikkLy5leGVjKGJhc2VVUkwpO1xuICAgIGlmIChiYXNlVVJMSGFzaFNwbGl0KSB7XG4gICAgICBiYXNlVVJMID0gYmFzZVVSTEhhc2hTcGxpdFsxXTtcbiAgICB9XG4gICAgdmFyIGJhc2VVUkxRdWVyeVNwbGl0ID0gL14oW15cXD9dKikoLiopJC8uZXhlYyhiYXNlVVJMKTtcbiAgICBpZiAoYmFzZVVSTFF1ZXJ5U3BsaXQpIHtcbiAgICAgIGJhc2VVUkwgPSBiYXNlVVJMUXVlcnlTcGxpdFsxXTtcbiAgICB9XG5cbiAgICB2YXIgYmFzZVVSTERvbWFpblNwbGl0ID0gL14oKChbYS16XSspOik/XFwvXFwvW2EtejAtOVxcLlxcLV9+XSsoOlswLTldKyk/XFwvKSguKikkL2kuZXhlYyhiYXNlVVJMKTtcbiAgICB2YXIgYmFzZVVSTFByb3RvY29sID0gYmFzZVVSTERvbWFpblNwbGl0WzNdO1xuICAgIHZhciBiYXNlVVJMRG9tYWluID0gYmFzZVVSTERvbWFpblNwbGl0WzFdO1xuICAgIHZhciBiYXNlVVJMUGF0aCA9IGJhc2VVUkxEb21haW5TcGxpdFs1XTtcblxuICAgIHZhciBidWlsdFVSTCA9IG51bGw7XG4gICAgaWYgKC9eXFwvXFwvLy50ZXN0KHJlbGF0aXZlVVJMKSkge1xuICAgICAgYnVpbHRVUkwgPSBiYXNlVVJMUHJvdG9jb2wrJzovLycrVVJMSGVscGVyLmJ1aWxkQWJzb2x1dGVQYXRoKCcnLCByZWxhdGl2ZVVSTC5zdWJzdHJpbmcoMikpO1xuICAgIH1cbiAgICBlbHNlIGlmICgvXlxcLy8udGVzdChyZWxhdGl2ZVVSTCkpIHtcbiAgICAgIGJ1aWx0VVJMID0gYmFzZVVSTERvbWFpbitVUkxIZWxwZXIuYnVpbGRBYnNvbHV0ZVBhdGgoJycsIHJlbGF0aXZlVVJMLnN1YnN0cmluZygxKSk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgYnVpbHRVUkwgPSBVUkxIZWxwZXIuYnVpbGRBYnNvbHV0ZVBhdGgoYmFzZVVSTERvbWFpbitiYXNlVVJMUGF0aCwgcmVsYXRpdmVVUkwpO1xuICAgIH1cblxuICAgIC8vIHB1dCB0aGUgcXVlcnkgYW5kIGhhc2ggcGFydHMgYmFja1xuICAgIGlmIChyZWxhdGl2ZVVSTFF1ZXJ5KSB7XG4gICAgICBidWlsdFVSTCArPSByZWxhdGl2ZVVSTFF1ZXJ5O1xuICAgIH1cbiAgICBpZiAocmVsYXRpdmVVUkxIYXNoKSB7XG4gICAgICBidWlsdFVSTCArPSByZWxhdGl2ZVVSTEhhc2g7XG4gICAgfVxuICAgIHJldHVybiBidWlsdFVSTDtcbiAgfSxcblxuICAvLyBidWlsZCBhbiBhYnNvbHV0ZSBwYXRoIHVzaW5nIHRoZSBwcm92aWRlZCBiYXNlUGF0aFxuICAvLyBhZGFwdGVkIGZyb20gaHR0cHM6Ly9kZXZlbG9wZXIubW96aWxsYS5vcmcvZW4tVVMvZG9jcy9XZWIvQVBJL2RvY3VtZW50L2Nvb2tpZSNVc2luZ19yZWxhdGl2ZV9VUkxzX2luX3RoZV9wYXRoX3BhcmFtZXRlclxuICAvLyB0aGlzIGRvZXMgbm90IGhhbmRsZSB0aGUgY2FzZSB3aGVyZSByZWxhdGl2ZVBhdGggaXMgXCIvXCIgb3IgXCIvL1wiLiBUaGVzZSBjYXNlcyBzaG91bGQgYmUgaGFuZGxlZCBvdXRzaWRlIHRoaXMuXG4gIGJ1aWxkQWJzb2x1dGVQYXRoOiBmdW5jdGlvbihiYXNlUGF0aCwgcmVsYXRpdmVQYXRoKSB7XG4gICAgdmFyIHNSZWxQYXRoID0gcmVsYXRpdmVQYXRoO1xuICAgIHZhciBuVXBMbiwgc0RpciA9ICcnLCBzUGF0aCA9IGJhc2VQYXRoLnJlcGxhY2UoL1teXFwvXSokLywgc1JlbFBhdGgucmVwbGFjZSgvKFxcL3xeKSg/OlxcLj9cXC8rKSsvZywgJyQxJykpO1xuICAgIGZvciAodmFyIG5FbmQsIG5TdGFydCA9IDA7IG5FbmQgPSBzUGF0aC5pbmRleE9mKCcvLi4vJywgblN0YXJ0KSwgbkVuZCA+IC0xOyBuU3RhcnQgPSBuRW5kICsgblVwTG4pIHtcbiAgICAgIG5VcExuID0gL15cXC8oPzpcXC5cXC5cXC8pKi8uZXhlYyhzUGF0aC5zbGljZShuRW5kKSlbMF0ubGVuZ3RoO1xuICAgICAgc0RpciA9IChzRGlyICsgc1BhdGguc3Vic3RyaW5nKG5TdGFydCwgbkVuZCkpLnJlcGxhY2UobmV3IFJlZ0V4cCgnKD86XFxcXFxcLytbXlxcXFxcXC9dKil7MCwnICsgKChuVXBMbiAtIDEpIC8gMykgKyAnfSQnKSwgJy8nKTtcbiAgICB9XG4gICAgcmV0dXJuIHNEaXIgKyBzUGF0aC5zdWJzdHIoblN0YXJ0KTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBVUkxIZWxwZXI7XG4iLCIvKipcbiAqIFhIUiBiYXNlZCBsb2dnZXJcbiovXG5cbmltcG9ydCB7bG9nZ2VyfSBmcm9tICcuLi91dGlscy9sb2dnZXInO1xuXG5jbGFzcyBYaHJMb2FkZXIge1xuXG4gIGNvbnN0cnVjdG9yKGNvbmZpZykge1xuICAgIGlmIChjb25maWcgJiYgY29uZmlnLnhoclNldHVwKSB7XG4gICAgICB0aGlzLnhoclNldHVwID0gY29uZmlnLnhoclNldHVwO1xuICAgIH1cbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5hYm9ydCgpO1xuICAgIHRoaXMubG9hZGVyID0gbnVsbDtcbiAgfVxuXG4gIGFib3J0KCkge1xuICAgIHZhciBsb2FkZXIgPSB0aGlzLmxvYWRlcixcbiAgICAgICAgdGltZW91dEhhbmRsZSA9IHRoaXMudGltZW91dEhhbmRsZTtcbiAgICBpZiAobG9hZGVyICYmIGxvYWRlci5yZWFkeVN0YXRlICE9PSA0KSB7XG4gICAgICB0aGlzLnN0YXRzLmFib3J0ZWQgPSB0cnVlO1xuICAgICAgbG9hZGVyLmFib3J0KCk7XG4gICAgfVxuICAgIGlmICh0aW1lb3V0SGFuZGxlKSB7XG4gICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRpbWVvdXRIYW5kbGUpO1xuICAgIH1cbiAgfVxuXG4gIGxvYWQodXJsLCByZXNwb25zZVR5cGUsIG9uU3VjY2Vzcywgb25FcnJvciwgb25UaW1lb3V0LCB0aW1lb3V0LCBtYXhSZXRyeSwgcmV0cnlEZWxheSwgb25Qcm9ncmVzcyA9IG51bGwsIGZyYWcgPSBudWxsKSB7XG4gICAgdGhpcy51cmwgPSB1cmw7XG4gICAgaWYgKGZyYWcgJiYgIWlzTmFOKGZyYWcuYnl0ZVJhbmdlU3RhcnRPZmZzZXQpICYmICFpc05hTihmcmFnLmJ5dGVSYW5nZUVuZE9mZnNldCkpIHtcbiAgICAgICAgdGhpcy5ieXRlUmFuZ2UgPSBmcmFnLmJ5dGVSYW5nZVN0YXJ0T2Zmc2V0ICsgJy0nICsgKGZyYWcuYnl0ZVJhbmdlRW5kT2Zmc2V0LTEpO1xuICAgIH1cbiAgICB0aGlzLnJlc3BvbnNlVHlwZSA9IHJlc3BvbnNlVHlwZTtcbiAgICB0aGlzLm9uU3VjY2VzcyA9IG9uU3VjY2VzcztcbiAgICB0aGlzLm9uUHJvZ3Jlc3MgPSBvblByb2dyZXNzO1xuICAgIHRoaXMub25UaW1lb3V0ID0gb25UaW1lb3V0O1xuICAgIHRoaXMub25FcnJvciA9IG9uRXJyb3I7XG4gICAgdGhpcy5zdGF0cyA9IHt0cmVxdWVzdDogcGVyZm9ybWFuY2Uubm93KCksIHJldHJ5OiAwfTtcbiAgICB0aGlzLnRpbWVvdXQgPSB0aW1lb3V0O1xuICAgIHRoaXMubWF4UmV0cnkgPSBtYXhSZXRyeTtcbiAgICB0aGlzLnJldHJ5RGVsYXkgPSByZXRyeURlbGF5O1xuICAgIHRoaXMubG9hZEludGVybmFsKCk7XG4gIH1cblxuICBsb2FkSW50ZXJuYWwoKSB7XG4gICAgdmFyIHhocjtcblxuICAgIGlmICh0eXBlb2YgWERvbWFpblJlcXVlc3QgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgeGhyID0gdGhpcy5sb2FkZXIgPSBuZXcgWERvbWFpblJlcXVlc3QoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgIHhociA9IHRoaXMubG9hZGVyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gICAgfVxuXG4gICAgeGhyLm9ubG9hZGVuZCA9IHRoaXMubG9hZGVuZC5iaW5kKHRoaXMpO1xuICAgIHhoci5vbnByb2dyZXNzID0gdGhpcy5sb2FkcHJvZ3Jlc3MuYmluZCh0aGlzKTtcblxuICAgIHhoci5vcGVuKCdHRVQnLCB0aGlzLnVybCwgdHJ1ZSk7XG4gICAgaWYgKHRoaXMuYnl0ZVJhbmdlKSB7XG4gICAgICB4aHIuc2V0UmVxdWVzdEhlYWRlcignUmFuZ2UnLCAnYnl0ZXM9JyArIHRoaXMuYnl0ZVJhbmdlKTtcbiAgICB9XG4gICAgeGhyLnJlc3BvbnNlVHlwZSA9IHRoaXMucmVzcG9uc2VUeXBlO1xuICAgIHRoaXMuc3RhdHMudGZpcnN0ID0gbnVsbDtcbiAgICB0aGlzLnN0YXRzLmxvYWRlZCA9IDA7XG4gICAgaWYgKHRoaXMueGhyU2V0dXApIHtcbiAgICAgIHRoaXMueGhyU2V0dXAoeGhyLCB0aGlzLnVybCk7XG4gICAgfVxuICAgIHRoaXMudGltZW91dEhhbmRsZSA9IHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMubG9hZHRpbWVvdXQuYmluZCh0aGlzKSwgdGhpcy50aW1lb3V0KTtcbiAgICB4aHIuc2VuZCgpO1xuICB9XG5cbiAgbG9hZGVuZChldmVudCkge1xuICAgIHZhciB4aHIgPSBldmVudC5jdXJyZW50VGFyZ2V0LFxuICAgICAgICBzdGF0dXMgPSB4aHIuc3RhdHVzLFxuICAgICAgICBzdGF0cyA9IHRoaXMuc3RhdHM7XG4gICAgLy8gZG9uJ3QgcHJvY2VlZCBpZiB4aHIgaGFzIGJlZW4gYWJvcnRlZFxuICAgIGlmICghc3RhdHMuYWJvcnRlZCkge1xuICAgICAgICAvLyBodHRwIHN0YXR1cyBiZXR3ZWVuIDIwMCB0byAyOTkgYXJlIGFsbCBzdWNjZXNzZnVsXG4gICAgICAgIGlmIChzdGF0dXMgPj0gMjAwICYmIHN0YXR1cyA8IDMwMCkgIHtcbiAgICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMudGltZW91dEhhbmRsZSk7XG4gICAgICAgICAgc3RhdHMudGxvYWQgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICAgICAgICB0aGlzLm9uU3VjY2VzcyhldmVudCwgc3RhdHMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZXJyb3IgLi4uXG4gICAgICAgIGlmIChzdGF0cy5yZXRyeSA8IHRoaXMubWF4UmV0cnkpIHtcbiAgICAgICAgICBsb2dnZXIud2FybihgJHtzdGF0dXN9IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH0sIHJldHJ5aW5nIGluICR7dGhpcy5yZXRyeURlbGF5fS4uLmApO1xuICAgICAgICAgIHRoaXMuZGVzdHJveSgpO1xuICAgICAgICAgIHdpbmRvdy5zZXRUaW1lb3V0KHRoaXMubG9hZEludGVybmFsLmJpbmQodGhpcyksIHRoaXMucmV0cnlEZWxheSk7XG4gICAgICAgICAgLy8gZXhwb25lbnRpYWwgYmFja29mZlxuICAgICAgICAgIHRoaXMucmV0cnlEZWxheSA9IE1hdGgubWluKDIgKiB0aGlzLnJldHJ5RGVsYXksIDY0MDAwKTtcbiAgICAgICAgICBzdGF0cy5yZXRyeSsrO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy50aW1lb3V0SGFuZGxlKTtcbiAgICAgICAgICBsb2dnZXIuZXJyb3IoYCR7c3RhdHVzfSB3aGlsZSBsb2FkaW5nICR7dGhpcy51cmx9YCApO1xuICAgICAgICAgIHRoaXMub25FcnJvcihldmVudCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBsb2FkdGltZW91dChldmVudCkge1xuICAgIGxvZ2dlci53YXJuKGB0aW1lb3V0IHdoaWxlIGxvYWRpbmcgJHt0aGlzLnVybH1gICk7XG4gICAgdGhpcy5vblRpbWVvdXQoZXZlbnQsIHRoaXMuc3RhdHMpO1xuICB9XG5cbiAgbG9hZHByb2dyZXNzKGV2ZW50KSB7XG4gICAgdmFyIHN0YXRzID0gdGhpcy5zdGF0cztcbiAgICBpZiAoc3RhdHMudGZpcnN0ID09PSBudWxsKSB7XG4gICAgICBzdGF0cy50Zmlyc3QgPSBwZXJmb3JtYW5jZS5ub3coKTtcbiAgICB9XG4gICAgc3RhdHMubG9hZGVkID0gZXZlbnQubG9hZGVkO1xuICAgIGlmICh0aGlzLm9uUHJvZ3Jlc3MpIHtcbiAgICAgIHRoaXMub25Qcm9ncmVzcyhldmVudCwgc3RhdHMpO1xuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBYaHJMb2FkZXI7XG4iXX0=
