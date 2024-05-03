import { App } from 'aws-cdk-lib';
import { ContextParameters } from '../utils/context';
import { CognitoStack } from '../lib/cognito-stack';
import { ApiStack } from '../lib/api-stack';

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

// API
const apiStackId = context.getResourceId('api-stack');
new ApiStack(app, apiStackId, {
	env: {
		region: context.stageParameters.region,
	},
	context: context,
	userPool: cognitoStack.userPool,
});
