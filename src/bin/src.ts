import { App } from 'aws-cdk-lib';
import { ContextParameters } from '../utils/context';
import { CognitoStack } from '../lib/cognito-stack';
import { ApiStack } from '../lib/api-stack';
import { CloudFrontStack } from '../lib/cloudfront-stack';

const app = new App();
const context = new ContextParameters(app);

// Cognito
const cognitoStackId = context.getResourceId('cognito-stack');
const cognitoStack = new CognitoStack(app, cognitoStackId, {
	env: {
		region: context.stageParameters.region,
	},
	context: context,
});

// CloudFront + S3
const cloudfrontStackId = context.getResourceId('cloudfront-stack');
const cloudfrontStack = new CloudFrontStack(app, cloudfrontStackId, {
	env: {
		region: context.stageParameters.region,
	},
	context: context,
});

// API
const apiStackId = context.getResourceId('api-stack');
new ApiStack(app, apiStackId, {
	env: {
		region: context.stageParameters.region,
	},
	context: context,
	userPool: cognitoStack.userPool,
	userPoolClientId: cognitoStack.userPoolClientId,
	endpoint: cognitoStack.endpoint,
	imageBucket: cloudfrontStack.imageBucket,
});
