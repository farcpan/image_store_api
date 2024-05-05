# 環境構築手順

## cdk.jsonの作成

Googleが発行するシークレットなどの情報を含むため、設定ファイルはGit管理外とする。
`cdk.{env_name}.{stage_name}.json`という命名規則でJSONファイルを作成し、`src`直下に配置する。
このJSONファイルは、`src/utils/context.ts`に定義された以下interfaceに合致するように定義すること。

```typescript
export interface StageParameters {
	region: string;
    cognito: {
        google: {
            clientId: string;
            clientSecret: string;
        };
        domain: string;
    }
}
```

---

## 参考

* [OpenID Connect の JWT の署名を自力で検証してみると見えてきた公開鍵暗号の実装の話](https://qiita.com/bobunderson/items/d48f89e2b3e6ad9f9c4c)
* [OpenID Connect の署名検証](https://christina04.hatenablog.com/entry/2015/01/27/131259)

---
