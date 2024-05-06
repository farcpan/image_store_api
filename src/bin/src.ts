import { App } from 'aws-cdk-lib';
import { ContextParameters } from '../utils/context';
import { ApiStack } from '../lib/api-stack';
import { CloudFrontStack } from '../lib/cloudfront-stack';

const app = new App();
const context = new ContextParameters(app);

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
	imageBucket: cloudfrontStack.imageBucket,
	keyBucket: cloudfrontStack.keyBucket,
	domainName: cloudfrontStack.cloudfrontDomainName,
});
