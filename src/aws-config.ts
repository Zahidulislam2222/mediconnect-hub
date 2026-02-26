// src/aws-config.ts
import { type ResourcesConfig } from 'aws-amplify';

// 🟢 1. Amplify Configuration Builder
export const getAwsConfig = (): ResourcesConfig => {
  const region = localStorage.getItem('userRegion') || 'US';
  const isEU = region === 'EU';

  console.log(`🌍 Initializing AWS Amplify for Region: ${region}`);

  return {
    Auth: {
      Cognito: {
        userPoolId: isEU 
          ? import.meta.env.VITE_COGNITO_USER_POOL_ID_EU 
          : import.meta.env.VITE_COGNITO_USER_POOL_ID_US,
        
        userPoolClientId: isEU 
          ? import.meta.env.VITE_COGNITO_CLIENT_PATIENT_EU 
          : import.meta.env.VITE_COGNITO_CLIENT_PATIENT_US,

        identityPoolId: isEU 
          ? import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID_EU 
          : import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID_US,

        loginWith: {
          email: true,
        },
        signUpVerificationMethod: 'code',
      },
    },
    Storage: {
      S3: {
        bucket: isEU 
          ? import.meta.env.VITE_S3_IDENTITY_BUCKET_EU 
          : import.meta.env.VITE_S3_IDENTITY_BUCKET_US,
        
        region: isEU 
          ? import.meta.env.VITE_AWS_REGION_EU 
          : import.meta.env.VITE_AWS_REGION_US,
      }
    }
  };
};

// 🟢 2. Professional Resource Registry (The missing function)
export const getRegionalResources = () => {
  const region = localStorage.getItem('userRegion') || 'US';
  const isEU = region === 'EU';

  return {
    region: isEU 
      ? (import.meta.env.VITE_AWS_REGION_EU || 'eu-central-1') 
      : (import.meta.env.VITE_AWS_REGION_US || 'us-east-1'),
    buckets: {
      identity: isEU 
        ? import.meta.env.VITE_S3_IDENTITY_BUCKET_EU 
        : import.meta.env.VITE_S3_IDENTITY_BUCKET_US,
      credentials: isEU 
        ? import.meta.env.VITE_S3_CREDENTIALS_BUCKET_EU 
        : import.meta.env.VITE_S3_CREDENTIALS_BUCKET_US,
      ehr: isEU 
        ? import.meta.env.VITE_S3_EHR_RECORDS_BUCKET_EU 
        : import.meta.env.VITE_S3_EHR_RECORDS_BUCKET_US,
    }
  };
};

// Export constants
const region = localStorage.getItem('userRegion') || 'US';
export const STRAPI_URL = import.meta.env.VITE_STRAPI_API_URL;
export const getS3BucketUrl = () => {
  const { buckets } = getRegionalResources();
  return `https://${buckets.identity}.s3.amazonaws.com`;
};

export default getAwsConfig();