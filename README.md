# image store api

## 環境構築

### CDKデプロイ

```
$ npm run dep-env1-dev-all
```

---

### Google設定

`OAuth 2.0 クライアント ID`の構成が必要。手順については省略。

---

### Google OAuthクライアント情報登録

AWSマネジメントコンソールを開き、Cognitoのページから`サインインエクスペリエンス`タブを開く。
`フェデレーテッドアイデンティティプロバイダーのサインイン`から`Google`を選択する。

`アイデンティティプロバイダーに関する情報`の`編集`ボタンを押下し、`クライアント ID`および`クライアントシークレット`に、Googleから取得した情報を入力して保存する。

---

### Google　承認済みのリダイレクト URI設定

リダイレクト先情報として、CognitoエンドポイントをGoogle側に設定する。
本プロジェクトにおいては、Cognitoに設定したカスタムドメイン`imagestore-with-google`を含む以下エンドポイントを設定すること。
```
https://imagestore-with-google.auth.ap-northeast-1.amazoncognito.com/oauth2/idpresponse
```

---

## IDトークン取得

以下エンドポイントにアクセスすると、Googleのユーザー認証画面にリダイレクトされる。
```
https://imagestore-with-google.auth.ap-northeast-1.amazoncognito.com/oauth2/authorize?client_id=34ffo0l875hkvagvinve93eatt&response_type=code&scope=email+openid+profile&redirect_uri=http%3A%2F%2Flocalhost%3A3000
```

ここでIDとパスワードの入力など認証処理を完了すると、リダイレクトURI `http://localhost/3000`に認可コードをクエリパラメータに付与した状態でリダイレクトされる。認可コード`code`を使って、トークンエンドポイントにアクセスする。

```
curl https://imagestore-with-google.auth.ap-northeast-1.amazoncognito.com/oauth2/token \
    -X POST \
    -H 'Content-Type:application/x-www-form-urlencoded' \
    -d "grant_type=authorization_code&client_id={client_id}&code={code}&redirect_uri={redirect_uri}" | jq
```

* `client_id`: CognitoのアプリケーションクライアントのクライアントIDが該当する。Googleが発行したクライアントIDではないので注意すること
* `code`: 認可エンドポイントからリダイレクト時に付与された認可コード
* `redirect_uri`: ログイン完了時にリダイレクトされるURI `http://localhost/3000`

---
