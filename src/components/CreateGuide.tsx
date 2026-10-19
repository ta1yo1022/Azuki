import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Copy, ArrowRight } from "lucide-react";
import { Brand } from "./Brand";

const OUTPUT_RULES = `【出力ルール】
・同じ英単語は重複させないでください。
・各単語に日本語の意味と、その意味で使う自然で短い英語の例文を指定数付けてください。例文には自然な日本語訳も付けてください。
・examplesは例文の配列です。各要素のtextに英文、translationにその英文の日本語訳を入れてください。同じ単語の例文は重複させず、場面を変えてください。
・以下の形式のJSONオブジェクトだけを出力してください。説明文やMarkdownのコードブロックは不要です。
・キーと文字列はダブルクォートで囲み、末尾の余分なカンマは付けないでください。
・最上位のキーはwordsだけにしてください。単語帳の名前・説明・カテゴリ・教材名・版はAzukiの画面で設定するため、JSONには含めないでください。
・wordsは1〜5,000語、examplesは1語につき1〜10件。各wordは120文字以内、meaning・text・translationはそれぞれ1,000文字以内。
・出力全体を512KB以内に収め、途中で省略せず、最後の閉じ括弧まで出力してください。
・下の単語は形式の例です。指定された内容に合わせて全体を作り直してください。

{
  "words": [
    {
      "word": "discover",
      "meaning": "発見する",
      "examples": [
        {
          "text": "We discovered a small cafe.",
          "translation": "私たちは小さなカフェを見つけました。"
        }
      ]
    }
  ]
}`;

export const DECK_PROMPT = `英単語帳アプリ「Azuki」に登録するJSONを作ってください。

【学びたい内容】
覚えたい英単語：discover, improve, choose（ここを自分の単語に書き換える）
レベル：初級
1語あたりの例文数：3件（1〜10件）
例文の場面：学校生活（好きな物語・旅行・仕事などに変更できます）

【単語の選び方】
・指定した英単語をすべて含め、指定していない単語を追加しないでください。
・具体的な単語の代わりにテーマから選んでほしい場合は、上の「覚えたい英単語」を「テーマ：自分の学びたい内容」「単語数：30語」に書き換えます。その場合は、テーマとレベルに合った単語を指定数だけ選んでください。
・意味が複数ある単語は、指定したテーマやレベルに合う代表的な意味を選んでください。

${OUTPUT_RULES}`;

export const IMAGE_PROMPT = `添付した画像から英単語を読み取り、英単語帳アプリ「Azuki」に登録するJSONを作ってください。

【読み取る範囲】
画像内の英単語一覧（必要に応じて「マーカーを引いた単語だけ」「右側の一覧だけ」などに書き換える）
例文のレベル：初級
1語あたりの例文数：3件（1〜10件）
例文の場面：日常生活（好きな場面に変更できます）

【画像の読み取りルール】
・指定した範囲にある英単語を抽出してください。画像にない単語は追加しないでください。
・日本語の意味も書かれている場合は、その意味を使ってください。意味がない場合は、画像の文脈に合う日本語の意味を付けてください。
・例文は各単語の意味に合う短い英文を新しく作ってください。
・読み取れない文字を推測して単語を作らないでください。判読できない単語は除き、はっきり読める単語だけで作ってください。
・1語も読み取れない場合はJSONを作らず、鮮明な画像を送り直すよう伝えてください。
・5,000語を超える場合は、画像の上から順に最初の5,000語を使ってください。

${OUTPUT_RULES}`;

const EXAMPLE_JSON = JSON.stringify({ words: [
  { word: "discover", meaning: "発見する", examples: [
    { text: "I discovered a small cafe near my school.", translation: "私は学校の近くで小さなカフェを見つけました。" },
    { text: "The explorer discovered a hidden door.", translation: "探検家は隠された扉を発見しました。" },
  ] },
  { word: "improve", meaning: "上達する", examples: [
    { text: "My English improves with practice.", translation: "私の英語は練習することで上達します。" },
  ] },
] }, null, 2);

export function CreateGuide() {
  const [params] = useSearchParams();
  const importPath = params.get("mode") === "demo" ? "/demo/import" : "/library/import";
  const [method, setMethod] = useState<"words" | "image">("words");
  const [drafts, setDrafts] = useState({ words: DECK_PROMPT, image: IMAGE_PROMPT });
  const prompt = drafts[method];
  const [message, setMessage] = useState("");
  const exampleInput = useRef<HTMLTextAreaElement>(null);
  const [exampleMessage, setExampleMessage] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { document.title = "オリジナル英単語帳の作り方 — Azuki"; }, []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setMessage("プロンプトをコピーしました。");
    } catch {
      input.current?.focus(); input.current?.select();
      setMessage("自動でコピーできませんでした。選択された文章をコピーしてください。");
    }
  }
  async function copyExample() {
    try {
      await navigator.clipboard.writeText(EXAMPLE_JSON);
      setExampleMessage("例文付きJSONをコピーしました。自分の単語と例文に書き換えて使えます。");
    } catch {
      exampleInput.current?.focus(); exampleInput.current?.select();
      setExampleMessage("選択されたJSONをコピーしてください。");
    }
  }
  return <div className="create-guide">
    <header className="guide-header"><Link to="/" aria-label="Azukiのホームへ"><Brand /></Link><Link className="text-button" to={importPath}><ArrowLeft size={16} />作成画面に戻る</Link></header>
    <main>
      <h1>オリジナル英単語帳の作り方</h1>
      <p className="guide-intro">ChatGPTやGeminiで単語帳のデータを作り、Azukiに貼り付けて登録できます。例文の場面・件数も指定でき、英文と日本語訳を一緒に作れます。単語帳の名前とカテゴリは、登録画面で設定します。</p>
      <a className="text-button" href="#own-examples">自分で考えた単語・例文を登録する →</a>
      <section aria-labelledby="guide-step-1">
        <span className="eyebrow">STEP 01</span><h2 id="guide-step-1">プロンプトをコピーする</h2>
        <div className="guide-methods" role="group" aria-label="単語帳の作り方">
          <button className={method === "image" ? "selected" : ""} aria-pressed={method === "image"} onClick={() => { setMethod("image"); setMessage(""); }}><strong>画像から作る</strong><span>ノートや単語一覧の写真から</span></button>
          <button className={method === "words" ? "selected" : ""} aria-pressed={method === "words"} onClick={() => { setMethod("words"); setMessage(""); }}><strong>学びたい単語から作る</strong><span>単語を指定、またはテーマから選ぶ</span></button>
        </div>
        <p>例文は1語につき1〜10件。「例文の場面」を学校生活や好きな物語などに変えると、自分になじみのある英文を作れます。</p>
        <p>{method === "image" ? "ノートや単語一覧の写真を用意し、下の「読み取る範囲」を書き換えてください。画像はChatGPTやGeminiのチャットに添付します。" : "下の「覚えたい英単語」を自分の単語に書き換えてください。「テーマ：仕事のメール」「単語数：30語」のように指定して、単語を選んでもらうこともできます。"}</p>
        <label htmlFor="deck-prompt">AIに渡すプロンプト（編集できます）</label>
        <textarea id="deck-prompt" ref={input} value={prompt} onChange={e => { setDrafts({...drafts, [method]: e.target.value}); setMessage(""); }} spellCheck={false} />
        <button className="button primary" disabled={!prompt.trim()} onClick={() => void copy()}><Copy size={17} />プロンプトをコピー</button>
        {message && <p role="status">{message}</p>}
      </section>
      <section aria-labelledby="guide-step-2">
        <span className="eyebrow">STEP 02</span><h2 id="guide-step-2">ChatGPTやGeminiに送る</h2>
        <p>{method === "image" ? "チャットに画像を添付し、コピーしたプロンプトを貼り付けて一緒に送信してください。画像を読み取れるチャットを使います。" : "コピーしたプロンプトをチャットに貼り付けて送信してください。"}回答が完成したら、JSON全体をコピーします。</p>
        {method === "image" && <p>読み取り漏れや綴りの間違いがないか、元の画像と見比べてください。文字が読みにくいときは、明るい場所で撮り直すか、範囲を分けて送ります。</p>}
        <div className="guide-ai-links"><a className="button secondary" href="https://chatgpt.com/" target="_blank" rel="noreferrer">ChatGPTを開く ↗</a><a className="button secondary" href="https://gemini.google.com/" target="_blank" rel="noreferrer">Geminiを開く ↗</a></div>
        <p>回答に説明文や「```json」が付いている場合は、それらを除き、最初の「&#123;」から最後の「&#125;」までをコピーします。</p>
      </section>
      <section aria-labelledby="guide-step-3">
        <span className="eyebrow">STEP 03</span><h2 id="guide-step-3">Azukiに貼り付けて登録する</h2>
        <p>作成画面の「JSONを貼り付け」にコピーした内容を貼り、「内容を確認」を押します。単語を確認し、単語帳の名前とカテゴリを設定して登録します。「教材」を選ぶと、教材名と版も入力できます。</p>
        <p>AIが作った意味や例文には誤りが含まれることがあります。登録後も単語一覧から確認・編集できます。新しい単語帳は非公開で保存されます。</p>
        <Link className="button primary" to={`${importPath}?tab=paste`}>JSONを貼り付ける<ArrowRight size={17} /></Link>
      </section>
      <section id="own-examples" aria-labelledby="own-examples-title">
        <span className="eyebrow">自分で作る</span><h2 id="own-examples-title">オリジナルの単語と例文を登録する</h2>
        <p>マイライブラリで単語帳を開き、単語の行 →「例文を追加・編集」から、英文と日本語訳を直接入力できます。「例文を追加」で1語につき最大10件まで登録できます。JSONの編集は不要です。</p><p>単語をまとめて新規登録するときは、下のJSONもひな形として使えます。</p>
        <ol className="guide-example-steps">
          <li><strong>英単語・意味・例文を用意する</strong><p><code>word</code>に英単語、<code>meaning</code>に覚えたい日本語の意味、<code>examples</code>に例文を並べます。各例文の<code>text</code>に英文、<code>translation</code>に日本語訳を入れます。たとえば「discover／発見する」なら、「学校の近くで小さなカフェを見つけた」という場面を英文にします。</p></li>
          <li><strong>JSONをコピーして書き換える</strong><p>下のひな形をコピーし、作成画面の「JSONを貼り付け」に貼ります。単語・意味・例文の文字列を書き換えてください。単語を増やす場合は、1語分のオブジェクトをカンマで区切って追加します。</p></li>
          <li><strong>確認して保存する</strong><p>「内容を確認」を押し、単語帳の名前とカテゴリを設定して登録します。保存後は単語一覧の行をタップすると例文を確認できます。「学習する」から、単語カード・例文カード・本型の単語帳を選べます。例文カードは日本語訳付きの例文が対象で、英語→日本語・日本語→英語のどちらでも練習できます。</p></li>
        </ol>
        <label htmlFor="example-json">例文付きJSONのひな形</label>
        <textarea id="example-json" ref={exampleInput} value={EXAMPLE_JSON} readOnly spellCheck={false} />
        <div className="guide-ai-links"><button className="button secondary" onClick={() => void copyExample()}><Copy size={17} />例文付きJSONをコピー</button><Link className="button primary" to={`${importPath}?tab=paste`}>作成画面で登録する<ArrowRight size={17} /></Link></div>
        {exampleMessage && <p role="status">{exampleMessage}</p>}
        <p>従来の<code>example</code>に英文を1つ入れる形式も使えます。複数の例文や日本語訳を登録する場合は、上の<code>examples</code>形式を使ってください。</p>
        <p>例文は英語で入力します。英文が不安なときは、AIに「この単語をこの意味で使えているか、文法も確認して」と頼み、内容を確認してから登録してください。</p>
      </section>
      <section aria-labelledby="fork-guide-title">
        <span className="eyebrow">公開単語帳から作る</span><h2 id="fork-guide-title">気になる単語帳を、自分の例文に変える</h2>
        <p>公開単語帳の「その他」→「コピーして編集」で、自分用の非公開コピーを保存できます。マイライブラリで単語を開き、「例文を追加・編集」から英文・日本語訳を変更してください。</p>
        <p>AIでまとめて書き換える場合は、「その他」→「JSONを編集してフォーク」を選びます。JSONを外部AIに渡し、「英単語と意味は変えず、例文を好きな場面に書き換え、日本語訳も付けて」と頼めます。出力されたJSON全体をフォーク画面に貼り、内容を確認して保存します。</p>
        <p>コピーやフォークは自分用のデータとして保存され、元の更新は自動反映されません。編集せず学習するなら「お気に入りに登録」で、保存枠を使わずマイライブラリから開けます。</p>
        <Link className="button secondary" to="/explore">公開単語帳を探す<ArrowRight size={17}/></Link>
      </section>
      <aside className="guide-trouble"><h2>うまく登録できないとき</h2><p>回答が途中で切れていたら、単語数を減らして作り直してください。形式のエラーが出る場合は、AzukiのエラーメッセージとJSONをAIに送り、「このエラーを直して、JSON全体を出力して」と頼めます。</p><p>通常の新規登録は1冊5,000語・512KBまでです。例文を増やして上限を超えた場合は、単語数や例文数を減らしてください。個人の保存上限は20冊・合計15,000語です。保存上限のエラーが出た場合は、単語帳を減らすなど、表示された案内に従ってください。</p></aside>
    </main>
  </div>;
}
