import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { join } from 'path';
import { ContextParameters } from '../utils/context';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
	CognitoUserPoolsAuthorizer,
	Cors,
	EndpointType,
	LambdaIntegration,
	RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { UserPool } from 'aws-cdk-lib/aws-cognito';

interface ApiStackProps extends StackProps {
	context: ContextParameters;
	userPool: UserPool;
}

/**
 * APIGateway + Lambda
 */
export class ApiStack extends Stack {
	constructor(scope: Construct, id: string, props: ApiStackProps) {
		super(scope, id, props);

		//////////////////////////////////////////////////////////////////////////////////
		// Nodejs Lambda
		//////////////////////////////////////////////////////////////////////////////////
		const nodejsLambdaFunctionPath = join(__dirname, '../nodejs_lambdas/index.ts');

		const sampleLambdaFunctionId = props.context.getResourceId('sample-function');
		const sampleLambdaFunction = new NodejsFunction(this, sampleLambdaFunctionId, {
			functionName: sampleLambdaFunctionId,
			entry: nodejsLambdaFunctionPath,
			handler: 'handler',
			runtime: Runtime.NODEJS_20_X,
			timeout: Duration.seconds(10),
			logRetention: RetentionDays.ONE_DAY,
		});

		const authorizerId: string = props.context.getResourceId('authorizer');
		const authorizer = new CognitoUserPoolsAuthorizer(this, authorizerId, {
			authorizerName: authorizerId,
			cognitoUserPools: [props.userPool], // 事前に作成したユーザープールを設定する
		});

		//////////////////////////////////////////////////////////////////////////////////
		// APIGateway
		//////////////////////////////////////////////////////////////////////////////////
		const stageName: string = 'v1';
		const restApiId = props.context.getResourceId('rest-api');
		const restApi = new RestApi(this, restApiId, {
			restApiName: restApiId,
			deployOptions: { stageName: stageName },
			defaultCorsPreflightOptions: {
				allowOrigins: Cors.ALL_ORIGINS,
				allowMethods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
				statusCode: 200,
				allowHeaders: Cors.DEFAULT_HEADERS,
			},
			endpointTypes: [EndpointType.REGIONAL],
		});

		const sampleLambdaFunctionIntegration = new LambdaIntegration(sampleLambdaFunction);

		const getHashedPasswordApiResource = restApi.root.addResource('sample'); // /sample

		getHashedPasswordApiResource.addMethod('GET', sampleLambdaFunctionIntegration, {
			authorizer: authorizer,
		});

		//////////////////////////////////////////////////////////////////////////////////
		// API URL
		//////////////////////////////////////////////////////////////////////////////////
		const registerApiUrlId: string = props.context.getResourceId('api-base-url');
		new CfnOutput(this, registerApiUrlId, {
			value: `https://${restApi.restApiId}.execute-api.${props.env?.region ?? 'ap-northeast-1'}.amazonaws.com/${stageName}/`,
		});
	}
}
