import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { join } from 'path';
import { ContextParameters } from '../utils/context';
import { DockerImageCode, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { DockerImageFunction } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import {
	CognitoUserPoolsAuthorizer,
	Cors,
	EndpointType,
	LambdaIntegration,
	RestApi,
} from 'aws-cdk-lib/aws-apigateway';
import { UserPool } from 'aws-cdk-lib/aws-cognito';
import { Bucket } from 'aws-cdk-lib/aws-s3';

interface ApiStackProps extends StackProps {
	context: ContextParameters;
	userPool: UserPool;
	userPoolClientId: string;
	endpoint: string;
	imageBucket: Bucket;
}

/**
 * APIGateway + Lambda
 */
export class ApiStack extends Stack {
	constructor(scope: Construct, id: string, props: ApiStackProps) {
		super(scope, id, props);

		//////////////////////////////////////////////////////////////////////////////////
		// Python Lambda
		//////////////////////////////////////////////////////////////////////////////////
		const pythonLambdaFunctionId = props.context.getResourceId('python-lambda-function');
		const pythonLambdaFunction = new DockerImageFunction(this, pythonLambdaFunctionId, {
			functionName: pythonLambdaFunctionId,
			code: DockerImageCode.fromImageAsset('python_lambdas/'),
			timeout: Duration.minutes(5),
			logRetention: RetentionDays.ONE_DAY,
			environment: {
				test: 'TestEnv',
			},
		});
		props.imageBucket.grantRead(pythonLambdaFunction);

		//////////////////////////////////////////////////////////////////////////////////
		// Nodejs Lambda
		//////////////////////////////////////////////////////////////////////////////////
		const nodejsLambdaFunctionPath = join(__dirname, '../nodejs_lambdas/index.ts');

		const getTokenLambdaFunctionId = props.context.getResourceId('get-token-function');
		const getTokenLambdaFunction = new NodejsFunction(this, getTokenLambdaFunctionId, {
			functionName: getTokenLambdaFunctionId,
			entry: nodejsLambdaFunctionPath,
			handler: 'getTokenHandler',
			runtime: Runtime.NODEJS_20_X,
			timeout: Duration.seconds(10),
			logRetention: RetentionDays.ONE_DAY,
			environment: {
				endpoint: props.endpoint,
				clientId: props.userPoolClientId,
			},
		});

		const getPresignedUrlFunctionId = props.context.getResourceId('get-presigned-url-function');
		const getPresignedUrlFunction = new NodejsFunction(this, getPresignedUrlFunctionId, {
			functionName: getPresignedUrlFunctionId,
			entry: nodejsLambdaFunctionPath,
			handler: 'getPresignedUrlHandler',
			runtime: Runtime.NODEJS_20_X,
			timeout: Duration.seconds(10),
			logRetention: RetentionDays.ONE_DAY,
			environment: {
				bucketName: props.imageBucket.bucketName,
			},
		});

		//////////////////////////////////////////////////////////////////////////////////
		// APIGateway
		//////////////////////////////////////////////////////////////////////////////////
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

		const getTokenLambdaFunctionIntegration = new LambdaIntegration(getTokenLambdaFunction);
		const getPresignedUrlFunctionIntegration = new LambdaIntegration(getPresignedUrlFunction);

		const tokenResource = restApi.root.addResource('token'); // /token
		const presignedResource = restApi.root.addResource('presigned'); // /presigned

		tokenResource.addMethod('POST', getTokenLambdaFunctionIntegration); // POST: /token
		presignedResource.addMethod('POST', getPresignedUrlFunctionIntegration, {
			authorizer: authorizer,
		}); // POST: /presigned

		//////////////////////////////////////////////////////////////////////////////////
		// API URL
		//////////////////////////////////////////////////////////////////////////////////
		const registerApiUrlId: string = props.context.getResourceId('api-base-url');
		new CfnOutput(this, registerApiUrlId, {
			value: `https://${restApi.restApiId}.execute-api.${props.env?.region ?? 'ap-northeast-1'}.amazonaws.com/${stageName}/`,
		});
	}
}
