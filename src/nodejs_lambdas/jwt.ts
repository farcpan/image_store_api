import axios from 'axios';

export interface UserInfo {
	iss: string; // https://accounts.google.com
	aud: string; // client_id
	exp: number; // 期限切れとなるUTC時刻（sec）, Date型と比較する場合は1,000倍する必要あり
	sub: string; // ユーザーID(UUID)
	email: string; // Gmailアドレス
}

const verficationEndpoint = 'https://www.googleapis.com/oauth2/v1/tokeninfo?id_token=';

/**
 * IDトークンを検証する
 * @param event Lambdaイベント
 * @returns ユーザー情報またはエラーメッセージ
 */
export const getDecodedTokenInfo = async (event: any): Promise<UserInfo | string> => {
	const idToken = getIdTokenFromAuthorizationHeader(event);
	if (!idToken) {
		return 'empty id_token';
	}

	// using verification endpoint of Google
	const verificationResult = await axios.post<{ email: string }>(verficationEndpoint + idToken);
	if (verificationResult.status !== 200) {
		return 'failed to verificating id_token';
	}

	const splittedIdToken = idToken.split('.');
	if (splittedIdToken.length !== 3) {
		return 'invalid id_token format';
	}

	const decodedToken = Buffer.from(splittedIdToken[1], 'base64').toString();
	const userInfo = JSON.parse(decodedToken) as UserInfo;
	const expirationChecked = checkExpiration(userInfo.exp);
	if (expirationChecked) {
		return expirationChecked;
	}

	return userInfo;
};

const checkExpiration = (exp: number): string => {
	if (exp * 1000 < new Date().getTime()) {
		return 'token is expired.';
	}
	return '';
};

const getIdTokenFromAuthorizationHeader = (event: any): string | undefined => {
	return event.headers['Authorization'] as string | undefined;
};
