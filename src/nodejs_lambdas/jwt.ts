export interface UserInfo {
	iss: string; // https://accounts.google.com
	aud: string; // client_id
	exp: number; // 期限切れとなるUTC時刻（sec）, Date型と比較する場合は1,000倍する必要あり
	sub: string; // ユーザーID(UUID)
	email: string; // Gmailアドレス
}

/**
 * IDトークンを検証する
 * @param event Lambdaイベント
 * @returns ユーザー情報またはエラーメッセージ
 */
export const getDecodedTokenInfo = (event: any): UserInfo | string => {
	const clientId = process.env['clientId'];
	if (!clientId) {
		return 'invalid env';
	}

	const idToken = getIdTokenFromAuthorizationHeader(event);
	if (!idToken) {
		return 'empty id_token';
	}
	const splittedIdToken = idToken.split('.');
	if (splittedIdToken.length !== 3) {
		return 'invalid id_token format';
	}

	const decodedToken = Buffer.from(splittedIdToken[1], 'base64').toString();
	const userInfo = JSON.parse(decodedToken) as UserInfo;
	const issChecked = checkIss(userInfo.iss);
	if (issChecked) {
		return issChecked;
	}
	const expirationChecked = checkExpiration(userInfo.exp);
	if (expirationChecked) {
		return expirationChecked;
	}
	const audChecked = checkClientId(userInfo.aud, clientId);
	if (audChecked) {
		return audChecked;
	}

	return userInfo;
};

const checkIss = (iss: string): string => {
	if (iss !== 'https://accounts.google.com') {
		return 'invalid iss';
	}
	return '';
};
const checkExpiration = (exp: number): string => {
	if (exp * 1000 < new Date().getTime()) {
		return 'token is expired.';
	}
	return '';
};
const checkClientId = (aud: string, clientId: string): string => {
	if (aud !== clientId) {
		return 'invalid aud';
	}
	return '';
};

const getIdTokenFromAuthorizationHeader = (event: any): string | undefined => {
	return event.headers['Authorization'] as string | undefined;
};
