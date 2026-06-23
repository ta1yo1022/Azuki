# Azuki

個人利用向けの英単語学習Webアプリです。単語帳はリポジトリ内のJSONで管理します。DB、認証、外部APIは使用しません。

## セットアップ

Node.js 20.9以降を用意してください。

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:3000` を開きます。

品質確認と静的エクスポート:

```bash
npm run lint
npm run build
```

ビルド結果は `out/` に生成されます。

## オフライン利用

本番ビルドでは`out/`内の全ページ、JavaScript、CSS、アイコンを事前キャッシュするService Workerを自動生成します。一度オンラインでアプリを開いてService Workerのインストールが完了すると、トップ、単語帳詳細、カード学習、リスト学習をオフラインで利用できます。

単語帳を変更して再デプロイすると、新しいService Workerがキャッシュを更新し、以前のキャッシュを削除します。

### iPhone / iPad

1. Safariでデプロイ済みサイトをオンラインで開きます。
2. 共有メニューから「ホーム画面に追加」を選びます。
3. ホーム画面のAzukiをオンラインのまま一度起動し、トップ画面が表示されるまで待ちます。
4. Azukiを終了して機内モードにし、ホーム画面から再起動して確認します。

既に古いAzukiをホーム画面へ追加している場合は、一度削除してから追加し直してください。`npm run dev`ではService Workerを登録しないため、オフライン確認には`npm run build`で生成した`out/`またはVercel本番環境を使用します。

## 単語帳を追加する

`data/` に単語帳ごとのJSONファイルを追加します。ファイル名が単語帳IDになります。

例: `data/toeic.json`

```json
{
  "name": "TOEIC頻出単語",
  "description": "TOEIC600点レベルの頻出単語",
  "words": [
    { "id": "w001", "en": "improve", "ja": "改善する" },
    { "id": "w002", "en": "demand", "ja": "需要" }
  ]
}
```

- ファイル名には小文字英数字、ハイフン、アンダースコアを使用します。
- `name`、`words[].id`、`words[].en`、`words[].ja`は必須です。
- `words[].id`は単語帳内で一意にしてください。
- アプリ内に登録・編集UIはありません。JSONを追加または変更し、再ビルド・再デプロイします。

## ビルド時バリデーション

`npm run build`時にすべての`data/*.json`を検証します。不正なJSON、必須項目の欠落、空文字、単語IDの重複がある場合はビルドが失敗します。

重複IDのエラー例:

```text
Error: [book validation] toeic.json: duplicate word id "w001"
```

必須項目欠落のエラー例:

```text
Error: [book validation] toeic.json: words[2].ja must be a non-empty string
```

## Vercelへデプロイ

1. このリポジトリをGitHubなどへpushします。
2. VercelでリポジトリをImportします。
3. Framework PresetはNext.js、Build Commandは`npm run build`を使用します。
4. デプロイします。環境変数は不要です。

`next.config.ts`で`output: "export"`を指定しているため、サーバー処理を含まない静的サイトとして出力されます。単語帳を変更した場合は、変更をpushして再デプロイしてください。
