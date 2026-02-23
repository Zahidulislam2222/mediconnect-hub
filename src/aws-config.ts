// src/aws-config.ts
import { Amplify, type ResourcesConfig } from 'aws-amplify';

// 🟢 DYNAMIC CONFIGURATION BUILDER
// This function builds the config based on the user's selected region (US or EU)
export const getAwsConfig = (): ResourcesConfig => {
  const region = localStorage.getItem('userRegion') || 'US';
  const isEU = region === 'EU';

  console.log(`🌍 Initializing AWS Amplify for Region: ${region}`);

  return {
    Auth: {
      Cognito: {
        // 🔴 IDENTITY SWITCHER
        userPoolId: isEU 
          ? import.meta.env.VITE_COGNITO_USER_POOL_ID_EU 
          : import.meta.env.VITE_COGNITO_USER_POOL_ID_US,
        
        userPoolClientId: isEU 
          ? import.meta.env.VITE_COGNITO_CLIENT_PATIENT_EU // Default to Patient, overwritten by specific logic if needed
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
        // 🔴 STORAGE SWITCHER
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

// Export constants for other parts of the app
const region = localStorage.getItem('userRegion') || 'US';
export const STRAPI_URL = import.meta.env.VITE_STRAPI_API_URL;
export const S3_BUCKET_URL = `https://${region === 'EU' 
  ? import.meta.env.VITE_S3_IDENTITY_BUCKET_EU 
  : import.meta.env.VITE_S3_IDENTITY_BUCKET_US}.s3.amazonaws.com`;

// Default export is no longer a static object, but we keep the type for compatibility
export default getAwsConfig();