import axios from 'axios';

export const getTokenHandler = async (event: any, context: any) => {
	const endpoint = process.env['endpoint'];
	if (!endpoint) {
		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'no endpoint' }),
		};
	}
	const clientId = process.env['clientId'];
	if (!clientId) {
		return {
			statusCode: 500,
			body: JSON.stringify({ message: 'no clientId' }),
		};
	}

	const body = event.body;
	const parsedBody = JSON.parse(body) as { code: string };

	try {
		const params = new URLSearchParams();
		params.append('grant_type', 'authorization_code');
		params.append('client_id', clientId);
		params.append('code', parsedBody.code);
		params.append('redirect_uri', 'http://localhost:3000');
		const result = await axios.post<{ id_token: string }>(endpoint, params);
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
	return {
		statusCode: 200,
		body: JSON.stringify({ message: 'Hello World!' }),
	};
};

export const handler = async (event: any, context: any) => {
	return {
		statusCode: 200,
		body: JSON.stringify({ message: 'Hello World!' }),
	};
};
