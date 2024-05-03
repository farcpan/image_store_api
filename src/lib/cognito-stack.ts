import { CfnOutput, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
	AccountRecovery,
	OAuthScope,
	UserPool,
	UserPoolIdentityProviderGoogle,
	ProviderAttribute,
	UserPoolClientIdentityProvider,
} from 'aws-cdk-lib/aws-cognito';
import { ContextParameters } from '../utils/context';

interface CognitoStackProps extends StackProps {
	context: ContextParameters;
}

/**
 * Cognito
 */
export class CognitoStack extends Stack {
	userPool: UserPool;
	userPoolClientId: string;
	endpoint: string;

	constructor(scope: Construct, id: string, props: CognitoStackProps) {
		super(scope, id, props);

		const domainPrefix =
			props.context.stageParameters.cognito.domainPrefix + '-' + props.context.stage;

		// ユーザープール
		const userPoolId = props.context.getResourceId('cognito-user-pool');
		this.userPool = new UserPool(this, userPoolId, {
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
		this.userPool.addDomain(props.context.getResourceId('userpool-domain'), {
			cognitoDomain: {
				domainPrefix: domainPrefix,
			},
		});

		// アプリケーションクライアント
		const userPoolClientId: string = props.context.getResourceId('cognito-client');
		const userPoolClient = this.userPool.addClient(userPoolClientId, {
			userPoolClientName: userPoolClientId,
			oAuth: {
				flows: { authorizationCodeGrant: true },
				callbackUrls: ['http://localhost:3000'],
				logoutUrls: ['http://localhost:3000/logout'],
				scopes: [OAuthScope.EMAIL, OAuthScope.OPENID, OAuthScope.PROFILE],
			},
			supportedIdentityProviders: [UserPoolClientIdentityProvider.GOOGLE],
		});
		this.userPoolClientId = userPoolClient.userPoolClientId;

		// GoogleIDプロバイダー
		const googleProviderId = props.context.getResourceId('google-provider');
		const googleProvider = new UserPoolIdentityProviderGoogle(this, googleProviderId, {
			userPool: this.userPool,
			clientId: props.context.stageParameters.cognito.google.clientId,
			clientSecret: props.context.stageParameters.cognito.google.clientSecret,
			scopes: ['email', 'profile'],
			attributeMapping: {
				email: ProviderAttribute.GOOGLE_EMAIL,
				profilePicture: ProviderAttribute.GOOGLE_PICTURE,
				fullname: ProviderAttribute.GOOGLE_NAME,
			},
		});
		if (googleProvider) {
			// クライアントとProviderの構成順序を保証する必要がある
			userPoolClient.node.addDependency(googleProvider);
		}

		//////////////////////////////////////////////////////////////////////////////////
		// Cognito custom domain
		//////////////////////////////////////////////////////////////////////////////////
		this.endpoint = `https://${domainPrefix}.auth.${this.region}.amazoncognito.com/oauth2/token`;
		new CfnOutput(this, props.context.getResourceId('token_endpoint'), {
			value: this.endpoint,
		});
	}
}
