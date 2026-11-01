// One small handler for both routes. AWS SDK v3 ships with the Node.js runtime,
// so there is nothing to bundle.
import { DynamoDBClient, UpdateItemCommand } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({});

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  const route = event.routeKey;

  if (route === 'GET /health') {
    return json(200, { ok: true });
  }

  if (route === 'POST /visits') {
    const result = await client.send(
      new UpdateItemCommand({
        TableName: process.env.TABLE_NAME,
        Key: { pk: { S: 'visits' } },
        UpdateExpression: 'ADD #c :one',
        ExpressionAttributeNames: { '#c': 'count' },
        ExpressionAttributeValues: { ':one': { N: '1' } },
        ReturnValues: 'UPDATED_NEW',
      }),
    );
    return json(200, { visits: Number(result.Attributes.count.N) });
  }

  return json(404, { error: 'not found' });
};
