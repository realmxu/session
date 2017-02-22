'use strict';

const debug = require('debug')('koa-session');
const ContextSession = require('./lib/context');
const util = require('./lib/util');
const assert = require('assert');

/**
 * Initialize session middleware with `opts`:
 *
 * - `key` session cookie name ["koa:sess"]
 * - all other options are passed as cookie options
 *
 * @param {Object} [opts]
 * @param {Application} app, koa application instance
 * @api public
 */

module.exports = function(opts, app) {
  // session(app[, opts])
  if (opts && typeof opts.use === 'function') {
    const tmp = app;
    app = opts;
    opts = tmp;
  }
  // app required
  if (!app || typeof app.use !== 'function') {
    throw new TypeError('app instance required: `session(opts, app)`');
  }

  opts = formatOpts(opts);
  extendContext(app.context, opts);

  return function* session(next) {
    if (this.sess.external) yield this.sess.initFromExternal();
    try {
      yield next;
    } catch (err) {
      throw err;
    } finally {
      yield this.sess.commit();
    }
  };
};

function formatOpts(opts) {
  opts = opts || {};
  // key
  opts.key = opts.key || 'koa:sess';

  // back-compat maxage
  if (!('maxAge' in opts)) opts.maxAge = opts.maxage;

  // defaults
  if (opts.overwrite == null) opts.overwrite = true;
  if (opts.httpOnly == null) opts.httpOnly = true;
  if (opts.signed == null) opts.signed = true;

  debug('session options %j', opts);

  // setup encoding/decoding
  if (typeof opts.encode !== 'function') {
    opts.encode = util.encode;
  }
  if (typeof opts.decode !== 'function') {
    opts.decode = util.decode;
  }

  if (opts.external) {
    assert(typeof opts.external.get === 'function', 'external.get must be function');
    assert(typeof opts.external.set === 'function', 'external.set must be function');
    assert(typeof opts.external.remove === 'function', 'external.remove must be function');
  }

  return opts;
}

function extendContext(context, opts) {
  context.__defineGetter__('sess', function() {
    if (this._sess) return this._sess;
    this._sess = new ContextSession(this, opts);
    return this._sess;
  });

  context.__defineGetter__('session', function() {
    const session = this.sess.session;
    // already retrieved
    if (session) return session;
    // unset
    if (session === false) return null;

    // cookie session store
    this.sess.initFromCookie(this, opts);
    return this.sess.session;
  });

  context.__defineSetter__('session', function(val) {
    if (val === null) {
      this.sess.session = false;
      return;
    }
    if (typeof val === 'object') return this.sess.createSession(val);
    throw new Error('this.session can only be set as null or an object.');
  });

  context.__defineGetter__('sessionOptions', function() {
    return this.sess.opts;
  });
}
