import { App } from 'aws-cdk-lib';
import { ContextParameters } from '../utils/context';
import { CognitoStack } from '../lib/cognito-stack';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';

const app = new App();
const context = new ContextParameters(app);

const cognitoStackId = context.getResourceId('cognito-stack');

// ParameterStore
const googleClientId = StringParameter.valueFromLookup(app, '/imagestore/google_oauth2_client_id');
const googleClientSecret = StringParameter.valueFromLookup(
	app,
	'/imagestore/google_oauth2_client_secret'
);

// Cognito
new CognitoStack(app, cognitoStackId, {
	env: {
		region: context.stageParameters.region,
	},
	clientId: googleClientId,
	clientSecret: googleClientSecret,
	context: context,
});
