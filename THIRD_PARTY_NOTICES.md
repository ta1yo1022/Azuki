# ライセンス・出典の適用範囲

ルートの [LICENSE](LICENSE) はAzuki独自のアプリコード、スクリプト、SQL、テスト、開発ドキュメントに適用します。以下の素材・データに対する権利を一括してMITで付与するものではありません。

## 教材データ

- `content/cefrj/` の原典由来の見出し語・品詞・CEFRレベルと、これらを含む `public/content/cefrj/`・`shared/cefrj-catalog.json`：**CEFR-J Wordlist Version 1.6**、東京外国語大学投野由紀夫研究室。[原典の利用条件](content/cefrj/SOURCE-README.txt)と[編集・出典情報](content/cefrj/README.md)を維持してください。MIT・CC0ではありません。適切な引用を条件とした独自の利用条件で公開されています。
- `content/official/` のEJDict由来の語彙・語義：**EJDict / CC0 1.0**。[ライセンス原文](content/official/EJDict-LICENSE.txt)、[編集記録](content/official/README.md)。
- Azukiが追加した意味・例文・教材説明は、権利を保有する範囲でMITの条件で提供します。ただし、CEFR-Jなど原典の情報と一体になったファイルの利用時には、原典の条件も引き続き適用されます。CEFR-Jによる監修・認定・公式訳を示すものではありません。
- ユーザーの投稿・非公開単語帳にはこのリポジトリのライセンスは適用されません。投稿者・元の権利者の権利と公開サービスの利用条件に従います。

## コード・依存パッケージ

- `src/vendor/page-flip.js`：StPageFlip 2.0.7、MIT。[同梱ライセンス](src/vendor/page-flip.LICENSE)、[ローカル修正](src/vendor/README.md)。
- npm依存パッケージは各パッケージのライセンスに従います。バージョンは `package-lock.json` で固定し、再配布時は該当パッケージのライセンス・通知を維持してください。

## 名称・画像・フォント

Azuki・Volta Technologiesの名称とロゴ、および `public/` 内のブランド画像は、ルートのMITライセンスの対象外です。ローカル開発・既存画面の確認のために同梱しています。独自サービスとして公開する場合は自分の名称・画像に置き換えてください。公式サービス・提携先・承認済み製品であると誤認させる使い方はできません。Googleの名称・マークの権利はGoogleに帰属します。

M PLUS Rounded 1c・NunitoはGoogle Fontsから読み込み、フォントファイルをこのリポジトリには同梱していません。フォントを自分で配信する場合は、取得元のライセンスも確認・同梱してください。

## 例文の翻訳に使用したモデル

例文の日本語訳の下訳にはMADLAD-400-3B-MT（Apache-2.0）のローカル推論を使用しています。モデルの重みや推論エンジンはこのリポジトリ・配信アプリには同梱していません。使用版・編集と確認の範囲は [作成記録](docs/example-translations.md) を参照してください。原典の出典・利用条件は引き続き適用されます。

- `content/dictionary/` の検索用英和辞書：**EJDict / CC0 1.0**。[原典・加工記録](content/dictionary/README.md)、[ライセンス](content/dictionary/LICENSE.txt)。生成例文と訳は原典の引用ではありません。

- TOONの読み書き：`@toon-format/toon` 4.4.0（MIT）。[公式実装](https://github.com/toon-format/toon)、[ライセンス](public/licenses/toon-MIT.txt)。
