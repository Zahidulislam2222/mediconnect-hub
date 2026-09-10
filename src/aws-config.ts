import { publicEnv, optionalCmsUrl } from "@/config/env";
// src/aws-config.ts
import { type ResourcesConfig } from 'aws-amplify';

// 🟢 1. Amplify Configuration Builder
export const getAwsConfig = (): ResourcesConfig => {
  const region = localStorage.getItem('userRegion') || 'US';
  const isEU = region === 'EU';

  // Amplify configured for region: US or EU

  return {
    Auth: {
      Cognito: {
        userPoolId: isEU 
          ? publicEnv("VITE_COGNITO_USER_POOL_ID_EU")
          : publicEnv("VITE_COGNITO_USER_POOL_ID_US"),
        
        userPoolClientId: isEU 
          ? publicEnv("VITE_COGNITO_CLIENT_PATIENT_EU")
          : publicEnv("VITE_COGNITO_CLIENT_PATIENT_US"),

        identityPoolId: isEU 
          ? publicEnv("VITE_COGNITO_IDENTITY_POOL_ID_EU")
          : publicEnv("VITE_COGNITO_IDENTITY_POOL_ID_US"),

        loginWith: {
          email: true,
        },
        signUpVerificationMethod: 'code',
      },
    },
    Storage: {
      S3: {
        bucket: isEU 
          ? publicEnv("VITE_S3_PATIENT_DATA_BUCKET_EU")
          : publicEnv("VITE_S3_PATIENT_DATA_BUCKET_US"),
        
        region: isEU 
          ? publicEnv("VITE_AWS_REGION_EU")
          : publicEnv("VITE_AWS_REGION_US"),
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
      ? publicEnv("VITE_AWS_REGION_EU")
      : publicEnv("VITE_AWS_REGION_US"),
    buckets: {
      patient: isEU 
        ? publicEnv("VITE_S3_PATIENT_DATA_BUCKET_EU")
        : publicEnv("VITE_S3_PATIENT_DATA_BUCKET_US"),
      
      // Selfie + ID + Diploma go here
      doctor: isEU 
        ? publicEnv("VITE_S3_DOCTOR_DATA_BUCKET_EU")
        : publicEnv("VITE_S3_DOCTOR_DATA_BUCKET_US"),

      // Keep EHR separate for high-security clinical audits
      ehr: isEU 
        ? publicEnv("VITE_S3_EHR_RECORDS_BUCKET_EU")
        : publicEnv("VITE_S3_EHR_RECORDS_BUCKET_US"),
    }
  };
};

// Export constants
const region = localStorage.getItem('userRegion') || 'US';
export const STRAPI_URL = optionalCmsUrl();
export const getS3BucketUrl = (role: 'patient' | 'doctor' = 'patient') => {
  const { buckets } = getRegionalResources();
  const targetBucket = role === 'doctor' ? buckets.doctor : buckets.patient;
  return `https://${targetBucket}.s3.amazonaws.com`;
};

export default getAwsConfig();