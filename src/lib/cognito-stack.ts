import { RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
	AccountRecovery,
	UserPool,
	UserPoolIdentityProviderGoogle,
	ProviderAttribute,
} from 'aws-cdk-lib/aws-cognito';
import { ContextParameters } from '../utils/context';

interface CognitoStackProps extends StackProps {
	clientId: string;
	clientSecret: string;
	context: ContextParameters;
}

/**
 * Cognito
 */
export class CognitoStack extends Stack {
	constructor(scope: Construct, id: string, props: CognitoStackProps) {
		super(scope, id, props);

		// ユーザープール
		const userPoolId = props.context.getResourceId('cognito-user-pool');
		const userPool = new UserPool(this, userPoolId, {
			userPoolName: userPoolId,

			accountRecovery: AccountRecovery.EMAIL_ONLY,
			autoVerify: {
				email: true,
				phone: false,
			},
			deletionProtection: false,

			removalPolicy: RemovalPolicy.DESTROY,
			selfSignUpEnabled: false,
			signInCaseSensitive: true,
			signInAliases: { email: true },
		});

		const googleProviderId = props.context.getResourceId('google-provider');
		const googleProvider = new UserPoolIdentityProviderGoogle(this, googleProviderId, {
			userPool: userPool,
			clientId: props.clientId,
			clientSecret: props.clientSecret,
			scopes: ['email', 'profile'],
			attributeMapping: {
				email: ProviderAttribute.GOOGLE_EMAIL,
				profilePicture: ProviderAttribute.GOOGLE_PICTURE,
				fullname: ProviderAttribute.GOOGLE_NAME,
			},
		});
	}
}
