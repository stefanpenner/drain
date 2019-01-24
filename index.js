'use strict';

const debug = require('debug')('drain');

/*
 * Creates a drain out of potentially asynchronous event based request response
 * pairs, specifically request/response pairs that implement something
 * resemblying an iterable.
 *
 * This means:
 *
 *   request is emitted, with no arguments
 *   response is recieved with the following shape: { done: Boolean, value: Any }
 *
 * An example:
 *
 *  A detailed example could be, between the drain and a theoretical testem
 *  API, which allows the drain to request new tests modules to run, until
 *  testem's queue has no more.
 *
 *  Diagram illustrating the described sequence diagram:
 *
 *
 * +-------------+                                                         +---------+
 * |    Drain    |                                                         | Testem  |
 * +-------------+                                                         +---------+
 *        |                                                                     |
 *        | testem:next-module-request                                          |
 *        |-------------------------------------------------------------------->|
 *        |                                                                     |
 *        |      testem:next-module-response { done: false, value: moduleName } |
 *        |<--------------------------------------------------------------------|
 *        |                                                                     |
 *        | testem:next-module-request                                          |
 *        |-------------------------------------------------------------------->|
 *        |                                                                     |
 *        |             testem:next-module-response { done: true, value: null } |
 *        |<--------------------------------------------------------------------|
 *
 */

module.exports = class Drain {
  constructor(emitter, options) {
    this._emitter = emitter;

    this._request = options.request;
    this._response = options.response;
    this._done = false;
    this._current = null;
    this._boundHandleResponse = this.handleResponse.bind(this);
    this._waiting = false;
    emitter.on(this._response, this._boundHandleResponse);
  }

  get done() {
    return this._done;
  }

  toString() {
    return `<Drain (request: ${this._request} response: ${this._response})>`;
  }

  handleResponse(response) {
    debug('handleResponse %o', response);

    if (this._waiting === false) {
      throw new Error(this.toString() + ' Was not expecting a response, but got a response');
    } else {
      this._waiting = false;
    }

    try {
      if (response.done) {
        this.dispose();
      }
      this._current.resolve(response);
    } catch (e) {
      this._current.reject(e);
    } finally {
      this._current = null;
    }
  }

  dispose() {
    this._done = true;
    this._emitter.removeListener(this._response, this._boundHandleResponse);
  }

  _makeNextRequest() {
    this._waiting = true;
    debug('makeRequest %s', this._request);
    this._emitter.emit(this._request);
  }

  async next() {
    if (this._done)    { return Promise.resolve({ done: true, value: null }); }
    if (this._current) { return this._current.promise; }

    let resolve, reject;
    let promise = new Promise((_resolve, _reject) => {
      resolve = _resolve;
      reject = _reject;
    });

    // TODO: timeout?

    this._current = {
      resolve,
      reject,
      promise
    };

    this._makeNextRequest();

    return promise;
  }
}
