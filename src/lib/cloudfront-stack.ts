import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ContextParameters } from '../utils/context';
import { Bucket, HttpMethods } from 'aws-cdk-lib/aws-s3';
import {
	AllowedMethods,
	CachePolicy,
	CfnDistribution,
	CfnOriginAccessControl,
	Distribution,
	HttpVersion,
	PriceClass,
	ResponseHeadersPolicy,
	ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';

interface CloudFrontStackProps extends StackProps {
	context: ContextParameters;
}

/**
 * CloudFront + S3
 */
export class CloudFrontStack extends Stack {
	webappBucket: Bucket;
	imageBucket: Bucket;
	keyBucket: Bucket;

	constructor(scope: Construct, id: string, props: CloudFrontStackProps) {
		super(scope, id, props);

		//////////////////////////////////////////////////////////////////////////////////
		// S3
		//////////////////////////////////////////////////////////////////////////////////
		const imageBucketId = props.context.getResourceId('image-bucket');
		this.imageBucket = new Bucket(this, imageBucketId, {
			bucketName: imageBucketId,
			removalPolicy: RemovalPolicy.DESTROY,
			cors: [
				{
					allowedMethods: [HttpMethods.GET, HttpMethods.PUT, HttpMethods.POST],
					allowedOrigins: ['http://localhost:3000'],
					allowedHeaders: ['*'],
				},
			],
		});
		const keyBucketId: string = props.context.getResourceId('key-bucket');
		this.keyBucket = new Bucket(this, keyBucketId, {
			bucketName: keyBucketId,
			removalPolicy: RemovalPolicy.DESTROY,
		});
		const webappBucketId = props.context.getResourceId('webapp-bucket');
		this.webappBucket = new Bucket(this, webappBucketId, {
			bucketName: webappBucketId,
			removalPolicy: RemovalPolicy.DESTROY,
		});

		//////////////////////////////////////////////////////////////////////////////////
		// OAC
		//////////////////////////////////////////////////////////////////////////////////
		const originAccessControlId = props.context.getResourceId('image-bucket-oac');
		const originAccessControl = new CfnOriginAccessControl(this, originAccessControlId, {
			originAccessControlConfig: {
				name: originAccessControlId,
				originAccessControlOriginType: 's3',
				signingBehavior: 'always',
				signingProtocol: 'sigv4',
				description: 'Access Control for Image Bucket',
			},
		});

		//////////////////////////////////////////////////////////////////////////////////
		// CloudFront
		//////////////////////////////////////////////////////////////////////////////////
		const distributionId = props.context.getResourceId('cloudfront-distribution');
		const distribution = new Distribution(this, distributionId, {
			comment: 'ImageStore API/WebUI Distribution',
			defaultRootObject: 'index.html',
			defaultBehavior: {
				origin: new S3Origin(this.webappBucket),
				allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
				cachePolicy: new CachePolicy(
					this,
					props.context.getResourceId('webapp-cache-policy'),
					{
						defaultTtl: Duration.days(1),
						minTtl: Duration.days(1),
						maxTtl: Duration.days(7),
					}
				),
				viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
				responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS,
			},
			additionalBehaviors: {
				'/images/*': {
					origin: new S3Origin(this.imageBucket),
					allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
					cachePolicy: new CachePolicy(
						this,
						props.context.getResourceId('images-cache-policy'),
						{
							defaultTtl: Duration.days(1),
							minTtl: Duration.days(1),
							maxTtl: Duration.days(30),
						}
					),
					viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
					responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS,
					// trustedKeyGroups: [keyGroup], // 署名付きURL発行用
				},
			},
			errorResponses: [
				{
					httpStatus: 403,
					responseHttpStatus: 200,
					responsePagePath: '/index.html',
					ttl: Duration.seconds(30),
				},
				{
					httpStatus: 404,
					responseHttpStatus: 200,
					responsePagePath: '/index.html',
					ttl: Duration.seconds(30),
				},
			],
			httpVersion: HttpVersion.HTTP2,
			priceClass: PriceClass.PRICE_CLASS_200,
		});

		const cfnDistribution = distribution.node.defaultChild as CfnDistribution;

		// Delete OAI
		cfnDistribution.addOverride(
			'Properties.DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity',
			''
		);
		cfnDistribution.addOverride(
			'Properties.DistributionConfig.Origins.1.S3OriginConfig.OriginAccessIdentity',
			''
		);
		// OAC does not require CustomOriginConfig
		cfnDistribution.addPropertyDeletionOverride(
			'DistributionConfig.Origins.0.CustomOriginConfig'
		);
		cfnDistribution.addPropertyDeletionOverride(
			'DistributionConfig.Origins.1.CustomOriginConfig'
		);
		// By default, the s3 WebsiteURL is set and an error occurs, so set the S3 domain name
		cfnDistribution.addPropertyOverride(
			'DistributionConfig.Origins.0.DomainName',
			this.webappBucket.bucketRegionalDomainName
		);
		cfnDistribution.addPropertyOverride(
			'DistributionConfig.Origins.0.DomainName',
			this.imageBucket.bucketRegionalDomainName
		);

		// OAC Settings
		cfnDistribution.addPropertyOverride(
			'DistributionConfig.Origins.0.OriginAccessControlId',
			originAccessControl.getAtt('Id')
		);
		cfnDistribution.addPropertyOverride(
			'DistributionConfig.Origins.1.OriginAccessControlId',
			originAccessControl.getAtt('Id')
		);

		// Bucket Policy
		const webappBucketPolicyStatement = new PolicyStatement({
			actions: ['s3:GetObject'],
			effect: Effect.ALLOW,
			principals: [new ServicePrincipal('cloudfront.amazonaws.com')],
			resources: [`${this.webappBucket.bucketArn}/*`],
			conditions: {
				StringEquals: {
					'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
				},
			},
		});
		const imagesBucketPolicyStatement = new PolicyStatement({
			actions: ['s3:GetObject'],
			effect: Effect.ALLOW,
			principals: [new ServicePrincipal('cloudfront.amazonaws.com')],
			resources: [`${this.imageBucket.bucketArn}/*`],
			conditions: {
				StringEquals: {
					'AWS:SourceArn': `arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`,
				},
			},
		});
		this.webappBucket.addToResourcePolicy(webappBucketPolicyStatement);
		this.imageBucket.addToResourcePolicy(imagesBucketPolicyStatement);
	}
}
