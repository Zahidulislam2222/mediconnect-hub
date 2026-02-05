// src/aws-config.ts
import { Amplify, type ResourcesConfig } from 'aws-amplify';

const awsConfig: ResourcesConfig = {
    Auth: {
        Cognito: {
            userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
            userPoolClientId: import.meta.env.VITE_COGNITO_APP_CLIENT_ID,
            identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID,
            loginWith: {
                email: true,
            },
            signUpVerificationMethod: 'code',
            // allowGuestAccess: true,  <-- REMOVED. Strictly enforce login.
        },
    },
    /*
     * API: { REST: { ... } } REMOVED
     * migrated to src/lib/api.ts with Multi-Cloud support
     */
};

Amplify.configure(awsConfig);

export const STRAPI_URL = import.meta.env.VITE_STRAPI_API_URL;
export const S3_BUCKET_URL = `https://${import.meta.env.VITE_S3_FILES_BUCKET}.s3.amazonaws.com`;

export default awsConfig;