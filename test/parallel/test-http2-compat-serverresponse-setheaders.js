'use strict';

const common = require('../common');
if (!common.hasCrypto)
  common.skip('missing crypto');
const assert = require('assert');
const http2 = require('http2');

function request(handler, onResponse) {
  const server = http2.createServer();
  server.listen(0, common.mustCall(() => {
    const port = server.address().port;

    server.once('request', common.mustCall((request, response) => {
      handler(response);
      response.end(common.mustCall(() => { server.close(); }));
    }));

    const client = http2.connect(`http://localhost:${port}`, common.mustCall(() => {
      const req = client.request();

      if (onResponse) {
        req.on('response', common.mustCall((headers) => {
          onResponse(headers);
        }, 1));
      }
      req.on('end', common.mustCall(() => {
        client.close();
      }));
      req.end();
      req.resume();
    }));
  }));
}

{
  request((response) => {
    const headers = new globalThis.Headers({ foo: '1', bar: '2' });
    assert.strictEqual(response.setHeaders(headers), response);
  }, (headers) => {
    assert.strictEqual(headers.foo, '1');
    assert.strictEqual(headers.bar, '2');
  });
}

{
  request((response) => {
    const headers = new Map([['foo', '1'], ['bar', '2']]);
    assert.strictEqual(response.setHeaders(headers), response);
  }, (headers) => {
    assert.strictEqual(headers.foo, '1');
    assert.strictEqual(headers.bar, '2');
  });
}

{
  request((response) => {
    response.setHeader('foo', '1');
    response.setHeaders(new Map([['foo', '2']]));
  }, (headers) => {
    assert.strictEqual(headers.foo, '2');
  });
}

{
  request((response) => {
    response.setHeaders(new globalThis.Headers({
      'content-type': 'text/html',
      foo: '1',
    }));
    response.writeHead(200, { 'content-type': 'text/plain' });
  }, (headers) => {
    assert.strictEqual(headers['content-type'], 'text/plain');
    assert.strictEqual(headers.foo, '1');
  });
}

{
  request((response) => {
    const headers = new globalThis.Headers();
    headers.append('set-cookie', 'a=b');
    headers.append('set-cookie', 'c=d');
    response.setHeaders(headers);
  }, (headers) => {
    assert.deepStrictEqual(headers['set-cookie'], ['a=b', 'c=d']);
  });
}

{
  request((response) => {
    response.setHeaders(new Map([['set-cookie', ['a=b', 'c=d']]]));
  }, (headers) => {
    assert.deepStrictEqual(headers['set-cookie'], ['a=b', 'c=d']);
  });
}

{
  request((response) => {
    for (const headers of [
      ['foo', '1'],
      { foo: '1' },
      null,
      undefined,
      'test',
      1,
    ]) {
      assert.throws(() => {
        response.setHeaders(headers);
      }, {
        code: 'ERR_INVALID_ARG_TYPE',
      });
    }
  });
}

{
  request((response) => {
    response.writeHead(200);

    assert.throws(() => {
      response.setHeaders(new globalThis.Headers({ foo: '1' }));
    }, {
      code: 'ERR_HTTP2_HEADERS_SENT',
    });
  }, (headers) => {
    assert.strictEqual(headers.foo, undefined);
  });
}
