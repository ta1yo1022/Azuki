# 開発環境と独自公開の設定

## UI・教材だけを変更する

Node.jsは `.nvmrc` の22系を使います。

```sh
npm ci
npm run dev
```

http://127.0.0.1:5173/demo を開きます。アカウントやAPIキーは不要で、変更はブラウザ内に保存されます。標準単語帳の入力データはリポジトリに含まれています。

## ログイン・APIをローカルで動かす

1. 自分のFirebaseプロジェクトでAuthenticationのGoogleログインを有効にし、Webアプリを登録します。認証の承認済みドメインに `localhost`・`127.0.0.1` を追加します。
2. `.env.example` を `.env.local` にコピーし、自分のFirebase Web設定の4項目を入力します。`VITE_API_BASE_URL` は空欄にします。Viteが `/api` をローカルWorkerの8787番へ転送します。
3. `wrangler.api.example.jsonc` を `wrangler.local.jsonc` にコピーし、`FIREBASE_PROJECT_ID` を自分のプロジェクトIDにします。メール送信と管理者権限は初期状態で無効です。
4. ローカルD1にマイグレーションを適用し、APIを起動します。

```sh
cp .env.example .env.local
cp wrangler.api.example.jsonc wrangler.local.jsonc
# コピー先のFirebase設定を編集してから実行
npx wrangler d1 migrations apply azuki-dev --local --config wrangler.local.jsonc
npx wrangler dev --config wrangler.local.jsonc --port 8787
```

別のターミナルで `npm run dev` を起動します。ローカルでもFirebaseの署名付きトークンを検証します。認証を迂回する開発用APIはありません。データはローカルD1に保存され、本番とは同期しません。

`.env.local` の `VITE_API_BASE_URL` に本番APIを指定すると、ローカル画面からの追加・編集・削除も本番データに反映されます。通常の開発では空欄のまま使ってください。既存の作業環境には個別の設定が残っている場合があるため、起動前に確認してください。

`wrangler.api.jsonc` と `.env.production` はAzuki運営の公開先を記載した設定です。フォーク先では自分の設定を作成してください。`npm run db:remote`・`deploy:api`・`deploy:web` は運営用のため、自分の公開先を設定するまで実行しないでください。

## メール送信を開発する

通常のUI・API開発ではAPIキーは不要です。実際のテスト送信が必要な場合だけ `.dev.vars.example` を `.dev.vars` にコピーし、自分のBrevo APIキーを設定します。自分の送信元ドメイン・管理者メール・配信停止URLを設定した開発用環境を使い、宛先を自分のテストアカウントに限定してください。

詳しい配信処理は [docs/update-emails.md](docs/update-emails.md) を参照してください。同文書の本番ドメイン・問い合わせ先はAzuki運営のものです。

## 独自サービスとして公開する

自分のCloudflareアカウントにD1・Worker・Pagesを作成し、Workerの `DB` バインディング、FirebaseプロジェクトID、許可するOrigin、APIのURLを自分の環境に変更します。最初は `EMAIL_ENABLED=false` とし、必要な機能だけ有効にしてください。

Firebase Web設定は公開される接続識別情報です。サービスアカウント秘密鍵・Brevo APIキー・Cloudflare APIトークンは `VITE_` 環境変数に入れず、Worker SecretまたはGitHub Secretsへ保存します。ローカルの秘密情報やDBをコミットしないでください。

既存のGitHub Actionsには運営用のデプロイ先があります。独自公開時はワークフローとWrangler設定も変更してください。テスト・ビルドのジョブは秘密情報なしで実行でき、デプロイジョブだけがGitHubのproduction環境の設定を使います。既存ワークフローが参照する項目は以下です。

- Variables：`CLOUDFLARE_ACCOUNT_ID`、`VITE_FIREBASE_API_KEY`、`VITE_FIREBASE_AUTH_DOMAIN`、`VITE_FIREBASE_PROJECT_ID`、`VITE_FIREBASE_APP_ID`
- Secrets：`CLOUDFLARE_API_TOKEN`
- Worker Secret：実メール配信を使う場合のみ `BREVO_API_KEY`

独自公開前に名称・ロゴ・連絡先・利用規約・プライバシーポリシー・計測IDも自分のサービスに合わせてください。教材の出典と [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) の条件は維持してください。
