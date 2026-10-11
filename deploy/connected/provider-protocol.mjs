// Immutable Cognito API syntax, not deployment defaults. See AWS API references
// DescribeUserPoolClient and DescribeIdentityPool for field formats and limits.
const COGNITO_PROTOCOL = Object.freeze({ poolMaxLength: 55, clientMaxLength: 128,
  region: /^[a-z]{2}(?:-[a-z]+)+-\d$/u, poolSuffix: /^[A-Za-z0-9]+$/u,
  client: /^[A-Za-z0-9_+]+$/u,
  identitySuffix: /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/u });

/** @param {Readonly<Record<string, string>>} settings @param {'US' | 'EU'} label */
export function validateCognitoIdentifiers(settings, label) {
  const region = settings[`VITE_AWS_REGION_${label}`];
  const pool = settings[`VITE_COGNITO_USER_POOL_ID_${label}`];
  const identity = settings[`VITE_COGNITO_IDENTITY_POOL_ID_${label}`];
  const prefixLength = region.length + 1;
  if (!COGNITO_PROTOCOL.region.test(region)
      || pool.length > COGNITO_PROTOCOL.poolMaxLength || !pool.startsWith(region + '_')
      || !COGNITO_PROTOCOL.poolSuffix.test(pool.slice(prefixLength))
      || identity.length > COGNITO_PROTOCOL.poolMaxLength || !identity.startsWith(region + ':')
      || !COGNITO_PROTOCOL.identitySuffix.test(identity.slice(prefixLength))) {
    throw new Error('Inconsistent regional public configuration');
  }
  for (const role of ['PATIENT', 'DOCTOR', 'ADMIN', 'STAFF']) {
    const client = settings[`VITE_COGNITO_CLIENT_${role}_${label}`];
    if (client.length > COGNITO_PROTOCOL.clientMaxLength || !COGNITO_PROTOCOL.client.test(client)) {
      throw new Error('Invalid regional Cognito client configuration');
    }
  }
}
