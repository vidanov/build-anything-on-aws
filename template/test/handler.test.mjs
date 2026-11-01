// Unit test for the Lambda handler, run with: node --test test/handler.test.mjs
// DynamoDB is replaced by a stub, so no AWS account is needed.
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

process.env.TABLE_NAME = 'test-table';
const send = mock.method(DynamoDBClient.prototype, 'send', async () => ({ Attributes: { count: { N: '42' } } }));
const { handler } = await import('../lambda/index.mjs');

test('GET /health answers 200', async () => {
  const res = await handler({ routeKey: 'GET /health' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { ok: true });
});

test('POST /visits increments the counter', async () => {
  const res = await handler({ routeKey: 'POST /visits' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(JSON.parse(res.body), { visits: 42 });
  const cmd = send.mock.calls.at(-1).arguments[0];
  assert.equal(cmd.input.TableName, 'test-table');
  assert.equal(cmd.input.UpdateExpression, 'ADD #c :one');
});

test('unknown routes answer 404', async () => {
  const res = await handler({ routeKey: 'DELETE /visits' });
  assert.equal(res.statusCode, 404);
});
