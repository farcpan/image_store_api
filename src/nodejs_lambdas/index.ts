import axios from 'axios';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
			redirect_uri: 'http://localhost:3000',
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

export const getPresignedUrlHandler = async (event: any, context: any) => {
	// env
	const bucketName = process.env['bucketName'];
	const body = event.body;
	if (!body) {
		return {
			statusCode: 400,
			body: JSON.stringify({ message: 'body is empty.' }),
		};
	}

	// authorization header
	const idToken: string | undefined = event.headers['Authorization'];
	if (!idToken) {
		return {
			statusCode: 400,
			body: JSON.stringify({ message: 'invalid id_token' }),
		};
	}
	const splittedIdToken = idToken.split('.');
	if (splittedIdToken.length !== 3) {
		return {
			statusCode: 400,
			body: JSON.stringify({ message: 'invalid id_token format' }),
		};
	}
	const decodedToken = Buffer.from(splittedIdToken[1], 'base64').toString();
	const parsedDecodedToken = JSON.parse(decodedToken) as { sub: string };
	const userId = parsedDecodedToken.sub;
	if (!userId) {
		return {
			statusCode: 400,
			body: JSON.stringify({ message: 'user_id (sub) cannot be obtained' }),
		};
	}

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
