# AzukiのFirebase・Cloudflare設定

2026年10月5日にWorkerとPagesを本番公開しました。Cloudflare D1の保存テーブルも作成済みです。画面表示、APIの正常応答、本番URLからの接続許可、未ログイン時のアクセス拒否を確認しました。Firebaseで本番ドメインが承認済みであることと、Google認証開始用URLを取得できることも確認しました。実アカウントによるログイン完了とログイン後の保存は未確認です。

| 用途 | 公開先・設定 |
| --- | --- |
| 本番サイト | https://azuki.mame-app.com |
| Worker API | https://azuki-api.mizuno-taiyo-sub.workers.dev |
| Pagesプロジェクト / 本番ブランチ | `azuki` / `main` |
| D1 | `azuki-db`（APAC） |
| Firebase | `azuki-eed67` |

Firebase管理画面で`azuki.mame-app.com`を承認済みドメインに追加済みです。既存の`azuki-4ti.pages.dev`も維持しています。

## 1. Firebaseプロジェクトを確認する

[作成済みのFirebaseプロジェクト](https://console.firebase.google.com/project/azuki-eed67/overview)を使います。新しく作り直す必要はありません。

| 設定                     | 入力内容                                       |
| ------------------------ | ---------------------------------------------- |
| プロジェクト名（表示名） | **Azuki**                                      |
| プロジェクトID           | `azuki-eed67` |
| Google Analytics         | Azukiの初期版では利用しません。SDKの初期化も不要です |
| Geminiなどの追加機能     | 初期版では不要                                 |
| 料金プラン               | **Spark（無料）**                              |

プロジェクトIDは作成後に変更できません。表示名とIDは別です。Firebase Hosting、App Hosting、Firestore、Storage、Functionsは今回使いません。BlazeやIdentity Platformへのアップグレードも初期版には不要です。

公式: [プロジェクトの作成とWebアプリ登録](https://firebase.google.com/docs/web/setup)、[料金](https://firebase.google.com/pricing)

## 2. Googleログインを有効にする

1. Firebaseプロジェクト内の **Authentication** を開き、利用を開始します。
2. **Sign-in method / ログイン方法**でGoogleを選び、有効にします。
3. サポート用メールを求められたら、ご自身が管理するメールを選択して保存します。

Webアプリはすでに登録済みです。受領した`firebaseConfig`の次の4項目を利用しています。

```text
apiKey
authDomain
projectId
appId
```

この4項目はWebアプリの接続設定です。サービスアカウントの秘密鍵・Admin SDKのJSONファイルを作る必要はありません。

公式: [Google認証](https://firebase.google.com/docs/auth/web/google-signin)、[Webアプリ設定](https://firebase.google.com/docs/web/setup)

## 3. Azuki側にFirebase設定を入れる

この作業フォルダの`.env.local`は設定済みです。別の端末やソースZIPから起動するときは、`.env.example`を`.env.local`としてコピーし、Firebaseコンソールの値を入力します。`.env.local`はGit管理・ソースZIPの対象外です。

```dotenv
VITE_FIREBASE_API_KEY=FirebaseのapiKey
VITE_FIREBASE_AUTH_DOMAIN=azuki-eed67.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=azuki-eed67
VITE_FIREBASE_APP_ID=1:759658107524:web:5677f393573459f47fa8d1
VITE_API_BASE_URL=
```

`authDomain`はFirebaseに表示された値をそのまま使います。通常は`プロジェクトID.firebaseapp.com`です。Cloudflare PagesのURLに置き換えません。

`VITE_API_BASE_URL`は`.env.local`では空欄です。本番ビルドでは`.env.production`に設定済みのWorker URLが使われます。ローカル開発は手元のDBを使い、本番サイトはCloudflare D1を使います。Firebase設定を変更したら開発サーバーの再起動と本番の再公開が必要です。

Firebaseの **Authentication → Settings / 設定 → Authorized domains / 承認済みドメイン**に、現在のプレビューで使う`127.0.0.1`を追加します。入力はホスト名のみで、`http://`や`:5173`は付けません。`localhost`は登録済みと確認できたので、追加し直す必要はありません。

ローカルでGoogleログイン後の単語帳保存まで確認する場合は、別のターミナルで`npm run db:local`を一度実行し、`npm run dev:api`を起動してください。この作業環境ではローカルDBの準備とAPIの起動は済んでいます。この段階で保存されるのは手元のDBです。別端末との同期には、以下のCloudflare設定が必要です。

公式: [承認済みドメインについて](https://firebase.google.com/docs/auth/faq-and-troubleshooting)

## 4. CloudflareのD1を作る

[Cloudflareダッシュボード](https://dash.cloudflare.com/)でFreeプランを使います。独自ドメインの購入は不要です。

受領したD1 Database IDは`781793ef-ad7d-474f-b7cf-87585e1b561a`です。`wrangler.api.jsonc`に反映済みです。Cloudflareアカウントへの接続と、DB名`azuki-db`・配置`APAC`の一致を確認しました。このIDに対応する作成済みのDBを使い、重複して作る必要はありません。公開単語帳の検索用索引と保存元ID・重複防止索引を含む4件のマイグレーションをリモートDBにも適用済みです。

| 項目           | 値                                                                           |
| -------------- | ---------------------------------------------------------------------------- |
| データベース名 | **azuki-db**                                                                 |
| 配置           | 指定なしでも開始可能。配置ヒントを選ぶなら日本に近いAsia Pacificを候補にする |
| Database ID    | `781793ef-ad7d-474f-b7cf-87585e1b561a`（設定済み） |

`wrangler.api.jsonc`の設定は次のとおりです。

```jsonc
{
  "name": "azuki-api",
  "vars": {
    "FIREBASE_PROJECT_ID": "azuki-eed67",
    "ALLOWED_ORIGINS": "http://localhost:5173,http://127.0.0.1:5173",
    "ALLOW_IMPORTS": "true",
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "azuki-db",
      "database_id": "781793ef-ad7d-474f-b7cf-87585e1b561a",
      "migrations_dir": "migrations",
    },
  ],
}
```

上は変更箇所の抜粋です。既存ファイルの`main`、`compatibility_date`などは残してください。**接続名は必ず`DB`**です。データベース名と接続名は別の設定です。

CLIから新規作成する場合は、ダッシュボードで重複して作らず、代わりに次を使えます。

```sh
npx wrangler login
npx wrangler d1 create azuki-db --config wrangler.api.jsonc
```

公式: [D1作成・接続](https://developers.cloudflare.com/d1/get-started/)

## 5. テーブルを作り、Workerを公開する

この作業環境ではログイン・テーブル作成・Worker公開まで完了しています。更新時も同じWorkerとD1を使います。別の環境で再開する場合の手順全体は次のとおりです。

Azukiのフォルダで次を実行します。

```sh
npx wrangler login
npm run db:remote
npm run deploy:api
```

`db:remote`はAzuki用D1にテーブルと索引を作成します。既存の別用途DBのIDを指定しないでください。

Worker URLは`https://azuki-api.mizuno-taiyo-sub.workers.dev`です。`.env.production`には次を設定済みです。

```dotenv
VITE_API_BASE_URL=https://azuki-api.mizuno-taiyo-sub.workers.dev
```

末尾の`/api`は付けません。アプリが付与します。

## 6. Pagesで画面を公開する

Pagesプロジェクト`azuki`を作成済みです。再公開は次だけで行えます。

```sh
npm run deploy:web
```

このコマンドはビルド後、`main`ブランチの本番環境へ`dist`をアップロードします。新規プロジェクトを作り直す必要はありません。

Firebase設定は手元の`.env.local`、本番APIのURLは`.env.production`を使います。`VITE_`の値は画面のビルド時に埋め込まれるため、値を変更したら再公開が必要です。

将来Git連携で自動公開する場合の設定は次です。

| Pagesの設定            | 値                                       |
| ---------------------- | ---------------------------------------- |
| Framework preset       | React / Vite相当                         |
| Build command          | `npm run build`                          |
| Build output directory | `dist`                                   |
| Root directory         | このプロジェクトがリポジトリ直下なら空欄 |
| Node.js                | `22.22.3`（`.nvmrc`を同梱）              |
| 環境変数               | Firebase用の4設定と本番Worker URL（合計5設定）       |

Pagesは画面の公開専用です。D1の`DB`接続はPagesではなく **azuki-api Worker** に付けます。Git連携と直接アップロードはCloudflare側のプロジェクト方式に制約があるため、切り替える場合は新しいPagesプロジェクトが必要になることがあります。

公式: [ViteのPages公開設定](https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/)、[直接アップロード](https://developers.cloudflare.com/pages/get-started/direct-upload/)

## 7. 公開URLを2か所に登録する

本番の固定URLは`https://azuki.mame-app.com`です。既存の`https://azuki-4ti.pages.dev`でも接続できます。公開ごとに発行される`https://<識別子>.azuki-4ti.pages.dev`はログイン用URLとして利用しません。

1. Firebaseの承認済みドメインに`azuki.mame-app.com`と`azuki-4ti.pages.dev`が登録済みであることを確認しました。再公開ごとの追加は不要です。
2. Workerの`ALLOWED_ORIGINS`には以下を設定・公開済みです。

```jsonc
"ALLOWED_ORIGINS": "http://localhost:5173,http://127.0.0.1:5173,https://azuki-4ti.pages.dev,https://azuki.mame-app.com"
```

FirebaseとWorkerのプロジェクトIDは両方`azuki-eed67`です。

## 8. 接続後に確認すること

- Pagesの画面からGoogleログインできる
- JSONを登録し、画面を再読み込みしても残る
- 別のブラウザ・別端末で同じGoogleアカウントにログインすると見える
- 別のGoogleアカウントではその単語帳が見えない
- インポートされた単語帳が非公開になる
- 「共有」から公開し、共有URLをログインしていないブラウザで開ける
- `/explore`で単語帳名・説明・教材タグによる検索ができる
- 非公開に戻した単語帳が公開検索と共有URLから取得できなくなる
- 別ユーザーの公開単語帳を保存すると、自分の非公開コピーとして一覧に追加される
- 同じ公開単語帳を再保存しても増えず、元が削除されても保存分が残る
- 詳細・カード学習のURLを直接開け、再読み込みと戻る・進むが使える

お試しモードの表示が残っている場合は、まずお試しモードを終了してください。お試しモードはクラウド同期の確認にはなりません。

## 無料運用の設定

FirebaseはSpark、CloudflareはFreeのまま運用します。アプリ側の上限は[README](README.md)のとおりです。`ALLOW_IMPORTS=false`を設定してWorkerを再公開すると、新規取り込みと新しいコピーの保存を停止できます。

利用が増えた場合、Workersの10万リクエスト/日・CPU上限やD1の500MB/DB・読み書き上限に達すると処理が制限されます。Cloudflareの使用量画面も確認してください。設定手順は有料プランへの変更を含みません。

公式: [Workersの料金・上限](https://developers.cloudflare.com/workers/platform/pricing/)、[D1の容量制限](https://developers.cloudflare.com/d1/platform/limits/)、[D1の料金](https://developers.cloudflare.com/d1/platform/pricing/)


## 独自ドメイン（mame-app.com）

Azukiの接続先は `https://azuki.mame-app.com`。親ドメインは今後のMameシリーズ向けです。

2026-10-05にPagesへのカスタムドメイン追加、DNSのCNAME登録、Firebaseの承認済みドメイン追加、Workerの許可元追加を完了しました。

- Cloudflare Pagesプロジェクト：`azuki`
- カスタムドメイン：`azuki.mame-app.com`
- DNS：CNAME、名前 `azuki`、宛先 `azuki-4ti.pages.dev`、TTL Auto、Proxied
- Firebase Authentication → Settings → Authorized domains：`azuki.mame-app.com` を追加
- Worker `ALLOWED_ORIGINS`：`https://azuki.mame-app.com` を追加済み
- Firebase `authDomain`：`azuki-eed67.firebaseapp.com` を維持

Pagesのドメイン・検証・証明書がすべてactiveであること、HTTPSで200応答すること、新ドメインのトップ画面と公開単語帳5冊の読み込みを確認済みです。Googleログインの承認済みドメイン追加は完了していますが、実アカウントでのログイン完了は未確認です。既存のpages.dev公開先も維持しています。

## コピー重複対策の更新（2026-10-05）

`0007_deck_lineage.sql`適用済み。既存6冊の内容指紋とコピー元の情報を補完し、公開一覧が5冊にまとまること、従来のコピー共有URLと単語取得が継続することを確認しました。データや共有IDは削除していません。

新しい環境で既存データを移行するときは、DBマイグレーション後に次を実行し、Workerを公開します。旧Workerの動作中に保存されたデータを拾うため、公開後にも再実行してください（登録内容は変更しません）。

```sh
node --experimental-strip-types scripts/backfill-lineage.mjs --remote
```

ローカルは`--remote`を省略します。運営単語帳のシードは`npm run content:build`で内容指紋も生成します。

## 日次登録枠の調整

`0008_daily_capacity.sql`で個人の日次登録枠を5,000語、全体の日次登録枠を10,000語に変更しました。20冊・保存中5,000語、全体100,000語、保存容量の上限は維持します。削除しても日次カウンターは減らず、UTC日付が変わる日本時間9時にリセットされます。APIは上限別の説明とエラーコードを返します。
