import { ResourcesConfig } from 'aws-amplify';

export const authConfig: ResourcesConfig = {
    Auth: {
        Cognito: {
            userPoolId: 'us-east-1_fUsIfc7kL',
            userPoolClientId: '1qtqco4d5hbgjvag5b1ts0qf34',
            signUpVerificationMethod: 'code',
        }
    }
};