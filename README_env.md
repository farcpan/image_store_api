# 環境構築手順

## cdk.jsonの作成

Googleが発行するシークレットなどの情報を含むため、設定ファイルはGit管理外とする。
`cdk.{env_name}.{stage_name}.json`という命名規則でJSONファイルを作成し、`src`直下に配置する。
このJSONファイルは、`src/utils/context.ts`に定義された以下interfaceに合致するように定義すること。

```typescript
export interface StageParameters {
	region: string;
    google: {
        clientId: string;
        clientSecret: string;
    };
    cloudfront: {
        publicKeyId: string;
    }
}
```

---

## 署名用公開鍵

署名付き URL 生成のため、事前に.pem形式の秘密鍵・公開鍵を作成する。

* 秘密鍵生成
    ```
    $ openssl genrsa -out private_key.pem 2048
    ```

* 生成した秘密鍵から公開鍵生成
    ```
    $ openssl rsa -pubout -in private_key.pem -out public_key.pem
    ```

AWS マネジメントコンソールのCloudFrontのページから`キー管理` > `パブリックキー`を選択し、生成した`public_key.pem`の内容を貼り付けてパブリックキーを作成する。作成後、作成したキーの`ID`を`cdk.***.json`の`cloudfront.publicKeyId`に記入する。

---

## 参考

* [OpenID Connect の JWT の署名を自力で検証してみると見えてきた公開鍵暗号の実装の話](https://qiita.com/bobunderson/items/d48f89e2b3e6ad9f9c4c)
* [OpenID Connect の署名検証](https://christina04.hatenablog.com/entry/2015/01/27/131259)

---
