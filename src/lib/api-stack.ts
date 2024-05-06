import { CfnOutput, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { join } from 'path';
import { ContextParameters } from '../utils/context';
import { DockerImageCode, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { DockerImageFunction } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Cors, EndpointType, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { Bucket } from 'aws-cdk-lib/aws-s3';

interface ApiStackProps extends StackProps {
	context: ContextParameters;
	imageBucket: Bucket;
	keyBucket: Bucket;
	domainName: string;
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
				clientId: props.context.stageParameters.google.clientId,
				clientSecret: props.context.stageParameters.google.clientSecret,
			},
		});

		const publishPresignedUrlForImageFunctionId = props.context.getResourceId(
			'publish-presigned-url-for-image-function'
		);
		const publishPresignedUrlForImageFunction = new NodejsFunction(
			this,
			publishPresignedUrlForImageFunctionId,
			{
				functionName: publishPresignedUrlForImageFunctionId,
				entry: nodejsLambdaFunctionPath,
				handler: 'publishPresignedUrlForImageHandler',
				runtime: Runtime.NODEJS_20_X,
				timeout: Duration.seconds(10),
				logRetention: RetentionDays.ONE_DAY,
				environment: {
					keyBucketName: props.keyBucket.bucketName,
					imageBucketName: props.imageBucket.bucketName,
					domainName: props.domainName,
					publicKeyId: props.context.stageParameters.cloudfront.publicKeyId,
				},
			}
		);
		props.keyBucket.grantRead(publishPresignedUrlForImageFunction);
		props.imageBucket.grantRead(publishPresignedUrlForImageFunction);

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
		// 以下の権限を付与しないと、生成したURLでアップロードを実行できないので要注意
		props.imageBucket.grantPutAcl(getPresignedUrlFunction);
		props.imageBucket.grantPut(getPresignedUrlFunction);
		props.imageBucket.grantRead(getPresignedUrlFunction);

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
		const publishPresignedUrlForImageFunctionIntegration = new LambdaIntegration(
			publishPresignedUrlForImageFunction
		);

		const tokenResource = restApi.root.addResource('token'); // /token
		const presignedResource = restApi.root.addResource('presigned'); // /presigned
		const imageResource = restApi.root.addResource('image'); // /image

		tokenResource.addMethod('POST', getTokenLambdaFunctionIntegration); // POST: /token
		presignedResource.addMethod('POST', getPresignedUrlFunctionIntegration); // POST: /presigned
		imageResource.addMethod('POST', publishPresignedUrlForImageFunctionIntegration); // POST: /image

		//////////////////////////////////////////////////////////////////////////////////
		// API URL
		//////////////////////////////////////////////////////////////////////////////////
		const registerApiUrlId: string = props.context.getResourceId('api-base-url');
		new CfnOutput(this, registerApiUrlId, {
			value: `https://${restApi.restApiId}.execute-api.${props.env?.region ?? 'ap-northeast-1'}.amazonaws.com/${stageName}/`,
		});
	}
}
