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

