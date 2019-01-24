'use strict';

const { expect } = require('chai');
const EventEmitter = require('events');
const Drain = require('./');

describe('Drain', function() {
  async function asyncDrain(iterableOfPromises) {
    let values = [];
    let step = await iterableOfPromises.next();
    while (!step.done) {
      values.push(step.value);
      step = await iterableOfPromises.next();
    }
    return values;
  }

  let emitter;
  beforeEach(() => {
    emitter = new EventEmitter();
  });

  it('looks right', function() {
    let drain = new Drain(emitter, {
      request: 'testem:next-module-request',
      response: 'testem:next-module-response'
    });

    expect(drain.done).to.eql(false);
    expect(drain.next).to.be.a('function');
    expect(drain.dispose).to.be.a('function');
  });

  it('drains async - happy path', async function() {
    const responses = ['a', 'b', 'c'];

    emitter.on('testem:next-module-request', () => {
      emitter.emit('testem:next-module-response', {
        done: responses.length === 0,
        value: responses.shift()
      })
    });

    let values = await asyncDrain(new Drain(emitter, {
      request: 'testem:next-module-request',
      response: 'testem:next-module-response'
    }));

    expect(values).to.eql(['a', 'b', 'c'])
  });

  it('errors if diposed', async function() {
    let drain = new Drain(emitter, {
      request: 'testem:next-module-request',
      response: 'testem:next-module-response'
    });

    drain.dispose();

    expect(await drain.next()).to.eql({
      done: true,
      value: null
    })
  });

  it('drains async - error', async function() {
    const responses = ['a', 'b', 'c'];
    const error = new Error('boom!');

    emitter.on('testem:next-module-request', () => {
      emitter.emit('testem:next-module-response', {
        get done() {
          if (responses.length ===1 )  { throw error; }
          return responses.length === 0;
        },
        value: responses.shift()
      })
    });

    try {
      await asyncDrain(new Drain(emitter, {
        request: 'testem:next-module-request',
        response: 'testem:next-module-response'
      }));
      expect(true).to.eql(false);
    } catch (e) {
      expect(e).to.eql(error);
    }
  });

  it('dispose works', function() {
    let drain = new Drain(emitter, {
      request: 'testem:next-module-request',
      response: 'testem:next-module-response'
    });

    expect(emitter.listenerCount('testem:next-module-response')).to.eql(1);
    expect(drain.done).to.eql(false);

    drain.dispose();

    expect(drain.done).to.eql(true);
    expect(emitter.listenerCount('testem:next-module-response')).to.eql(0);
  });

  it('auto dispose on complete drain works', async function() {
    const responses = ['a', 'b', 'c'];

    emitter.on('testem:next-module-request', () => {
      emitter.emit('testem:next-module-response', {
        done: responses.length === 0,
        value: responses.shift()
      })
    });

    let drain = new Drain(emitter, {
      request: 'testem:next-module-request',
      response: 'testem:next-module-response'
    });

    expect(emitter.listenerCount('testem:next-module-response')).to.eql(1);
    expect(drain.done).to.eql(false);

    await asyncDrain(drain);

    expect(drain.done).to.eql(true);
    expect(emitter.listenerCount('testem:next-module-response')).to.eql(0);
  });

  it('throws if handleResponse is invoked while not waiting for a response', function() {
    let drain = new Drain(emitter, {
      request: 'testem:next-module-request',
      response: 'testem:next-module-response'
    });

    expect(() => drain.handleResponse({})).to.throw(/Was not expecting a response, but got a response/);
    drain.next();
    expect(() => drain.handleResponse({})).to.not.throw();

    expect(() => emitter.emit('testem:next-module-response', { })).to.throw(/Was not expecting a response, but got a response/);
  });

  it('has useful toString', function() {
    let drain = new Drain(emitter, {
      request: 'testem:next-module-request',
      response: 'testem:next-module-response'
    });

    expect(drain.toString()).to.eql('<Drain (request: testem:next-module-request response: testem:next-module-response)>');
  });
});
