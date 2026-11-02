import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalize } from '../src/server.js';

test('normalizes expanded request data and redacts sensitive query values', () => {
  const event = normalize({time:'2026-10-25T12:00:00+00:00',client_ip:'203.0.113.4',method:'GET',request_uri:'/a?topic=art&token=private',host:'example.org',protocol:'HTTP/2.0',status:200,user_agent:'Googlebot',request_time:'0.023',bytes_sent:'42'});
  assert.equal(event.path, '/a');
  assert.equal(event.request_target, '/a?topic=art&token=%5Bredacted%5D');
  assert.equal(event.client_ip, '203.0.113.4');
  assert.equal(event.bot_family, 'googlebot');
  assert.equal(event.verification_status, 'unverified');
  assert.equal(event.bytes_sent, 42);
});

test('rejects malformed status fields', () => assert.throws(() => normalize({status:'oops'}), /status/));
