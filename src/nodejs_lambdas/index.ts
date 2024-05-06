import axios from 'axios';
// @ts-ignore
import { getSignedUrl as getSignedUrlOfCf } from 'aws-cloudfront-sign';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getDecodedTokenInfo, UserInfo } from './jwt';

/**
 * Googleから取得した認可コードをIDトークンと交換する
 */
export const getTokenHandler = async (event: any, context: any) => {
	const endpoint = 'https://www.googleapis.com/oauth2/v4/token';
	const clientId = process.env['clientId'];
	if (!clientId) {
		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'no clientId' }),
		};
	}
	const clientSecret = process.env['clientSecret'];
	if (!clientSecret) {
		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'no clientSecret' }),
		};
	}

	const body = event.body;
	const parsedBody = JSON.parse(body) as { code: string };

	try {
		const requestBody = JSON.stringify({
			code: parsedBody.code,
			client_id: clientId,
			client_secret: clientSecret,
			grant_type: 'authorization_code',
			redirect_uri: 'http://localhost:5173',
		});
		const headers = {
			'Content-Type': 'application/json',
		};
		const result = await axios.post<{ id_token: string }>(endpoint, requestBody, {
			headers: headers,
		});
		return {
			statusCode: 200,
			body: JSON.stringify({ idToken: result.data.id_token }),
		};
	} catch (e) {
		return {
			statusCode: 500,
			body: JSON.stringify(e),
		};
	}
};

/**
 * 画像アクセス用署名付きURLを発行する
 */
export const publishPresignedUrlForImageHandler = async (event: any, context: any) => {
	// env
	const keyBucketName = process.env['keyBucketName'];
	if (!keyBucketName) {
		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'key bucketName not defined' }),
		};
	}
	const imageBucketName = process.env['imageBucketName'];
	if (!imageBucketName) {
		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'image bucketName not defined' }),
		};
	}
	const domainName = process.env['domainName'];
	if (!domainName) {
		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'domainName not defined' }),
		};
	}
	const publicKeyId = process.env['publicKeyId'];
	if (!publicKeyId) {
		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'publicKeyId not defined' }),
		};
	}

	// IDトークン
	const userInfo: UserInfo | string = await getDecodedTokenInfo(event);
	if (typeof userInfo === 'string') {
		return {
			statusCode: 401,
			body: JSON.stringify({ message: userInfo }),
		};
	}

	const userId = userInfo.sub;

	// リクエスト
	const body = event.body;
	if (!body) {
		return {
			statusCode: 400,
			body: JSON.stringify({ message: 'empty body' }),
		};
	}
	const parsedBody = JSON.parse(body) as { objectKey: string };
	const objectKey = parsedBody.objectKey; // S3キー。ただし、 images/{userId}までは固定であるためリクエストに含めない

	// S3アクセス
	const s3Client = new S3Client();

	// 秘密鍵取得
	const privateKey = await getPrivateKey(s3Client, keyBucketName);
	if (!privateKey) {
		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'private key cannot be obtained.' }),
		};
	}

	// 署名付きURL生成
	try {
		const objectUrl = `https://${domainName}/images/${userId}/${objectKey}`;
		const signedUrl = await getSignedUrlOfCloudFront(publicKeyId, objectUrl, privateKey);
		return {
			statusCode: 200,
			body: JSON.stringify({
				url: signedUrl,
			}),
		};
	} catch (e) {
		return {
			statusCode: 500,
			body: JSON.stringify({ message: JSON.stringify(e) }),
		};
	}
};

/**
 * S3に対してアップロードを実行する署名付きURLを発行する
 */
export const getPresignedUrlHandler = async (event: any, context: any) => {
	// env
	const bucketName = process.env['bucketName'];
	if (!bucketName) {
		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'no env' }),
		};
	}

	// リクエスト
	const body = event.body;
	if (!body) {
		return {
			statusCode: 400,
			body: JSON.stringify({ message: 'body is empty.' }),
		};
	}

	// IDトークンから必要な情報を取得
	const userInfo: UserInfo | string = await getDecodedTokenInfo(event);
	if (typeof userInfo === 'string') {
		return {
			statusCode: 401,
			body: JSON.stringify({ message: userInfo }),
		};
	}

	const userId = userInfo.sub;

	// request body
	const parsedBody = JSON.parse(body) as { name: string };
	if (!parsedBody.name) {
		return {
			statusCode: 400,
			body: JSON.stringify({ message: 'name is empty.' }),
		};
	}
	const objectName = parsedBody.name;

	const s3Client = new S3Client();
	const signedUrl = await getSignedUrl(
		s3Client,
		new PutObjectCommand({
			Bucket: bucketName,
			Key: `images/${userId}/${objectName}`,
		}),
		{ expiresIn: 120 } // expired in 2 min
	);

	return {
		statusCode: 200,
		body: JSON.stringify({
			url: signedUrl,
		}),
	};
};

export const handler = async (event: any, context: any) => {
	return {
		statusCode: 200,
		body: JSON.stringify({ message: 'Hello World!' }),
	};
};

// S3から秘密鍵を取得する
const getPrivateKey = async (s3Client: S3Client, bucketName: string): Promise<string | null> => {
	try {
		const result = await s3Client.send(
			new GetObjectCommand({
				Bucket: bucketName,
				Key: 'private_key.pem',
			})
		);
		const text = result.Body?.transformToString('utf-8');
		if (!text) {
			throw new Error('body is empty.');
		}

		return text;
	} catch (e) {
		return null;
	}
};

// 署名付きURL発行
const getSignedUrlOfCloudFront = async (
	keyPairId: string,
	objectUrl: string,
	privateKeyValue: string
): Promise<string> => {
	return new Promise(async (resolve: (value: string) => void, reject: (reason: any) => void) => {
		try {
			// 秘密鍵を使って署名付きURL生成
			const signedUrl = getSignedUrlOfCf(objectUrl, {
				keypairId: keyPairId,
				expireTime: new Date().getTime() + 30000, // 30,000 [msec]
				privateKeyString: privateKeyValue,
			}) as string;

			resolve(signedUrl);
		} catch (e) {
			reject(e);
		}
	});
};
