import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Copy, ArrowRight } from "lucide-react";
import { Brand } from "./Brand";

const OUTPUT_RULES = `【出力ルール】
・同じ英単語は重複させないでください。
・各単語に日本語の意味と、その意味で使う自然で短い英語の例文を1つ付けてください。
・以下の形式のJSONオブジェクトだけを出力してください。説明文やMarkdownのコードブロックは不要です。
・キーと文字列はダブルクォートで囲み、末尾の余分なカンマは付けないでください。
・最上位のキーはwordsだけにしてください。単語帳の名前・説明・カテゴリ・教材名・版はAzukiの画面で設定するため、JSONには含めないでください。
・wordsは1〜500語。各wordは120文字以内、meaningとexampleはそれぞれ1,000文字以内。
・出力全体を512KB以内に収め、途中で省略せず、最後の閉じ括弧まで出力してください。
・下の単語は形式の例です。指定された内容に合わせて全体を作り直してください。

{
  "words": [
    {
      "word": "discover",
      "meaning": "発見する",
      "example": "We discovered a small cafe."
    }
  ]
}`;

export const DECK_PROMPT = `英単語帳アプリ「Azuki」に登録するJSONを作ってください。

【学びたい内容】
覚えたい英単語：discover, improve, choose（ここを自分の単語に書き換える）
レベル：初級

【単語の選び方】
・指定した英単語をすべて含め、指定していない単語を追加しないでください。
・具体的な単語の代わりにテーマから選んでほしい場合は、上の「覚えたい英単語」を「テーマ：自分の学びたい内容」「単語数：30語」に書き換えます。その場合は、テーマとレベルに合った単語を指定数だけ選んでください。
・意味が複数ある単語は、指定したテーマやレベルに合う代表的な意味を選んでください。

${OUTPUT_RULES}`;

export const IMAGE_PROMPT = `添付した画像から英単語を読み取り、英単語帳アプリ「Azuki」に登録するJSONを作ってください。

【読み取る範囲】
画像内の英単語一覧（必要に応じて「マーカーを引いた単語だけ」「右側の一覧だけ」などに書き換える）
例文のレベル：初級

【画像の読み取りルール】
・指定した範囲にある英単語を抽出してください。画像にない単語は追加しないでください。
・日本語の意味も書かれている場合は、その意味を使ってください。意味がない場合は、画像の文脈に合う日本語の意味を付けてください。
・例文は各単語の意味に合う短い英文を新しく作ってください。
・読み取れない文字を推測して単語を作らないでください。判読できない単語は除き、はっきり読める単語だけで作ってください。
・1語も読み取れない場合はJSONを作らず、鮮明な画像を送り直すよう伝えてください。
・500語を超える場合は、画像の上から順に最初の500語を使ってください。

${OUTPUT_RULES}`;

export function CreateGuide() {
  const [params] = useSearchParams();
  const importPath = params.get("mode") === "demo" ? "/demo/import" : "/library/import";
  const [method, setMethod] = useState<"words" | "image">("words");
  const [drafts, setDrafts] = useState({ words: DECK_PROMPT, image: IMAGE_PROMPT });
  const prompt = drafts[method];
  const [message, setMessage] = useState("");
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
  return <div className="create-guide">
    <header className="guide-header"><Link to="/" aria-label="Azukiのホームへ"><Brand /></Link><Link className="text-button" to={importPath}><ArrowLeft size={16} />作成画面に戻る</Link></header>
    <main>
      <h1>オリジナル英単語帳の作り方</h1>
      <p className="guide-intro">ChatGPTやGeminiで単語帳のデータを作り、Azukiに貼り付けて登録できます。単語帳の名前とカテゴリは、登録画面で設定します。</p>
      <section aria-labelledby="guide-step-1">
        <span className="eyebrow">STEP 01</span><h2 id="guide-step-1">プロンプトをコピーする</h2>
        <div className="guide-methods" role="group" aria-label="単語帳の作り方">
          <button className={method === "image" ? "selected" : ""} aria-pressed={method === "image"} onClick={() => { setMethod("image"); setMessage(""); }}><strong>画像から作る</strong><span>ノートや単語一覧の写真から</span></button>
          <button className={method === "words" ? "selected" : ""} aria-pressed={method === "words"} onClick={() => { setMethod("words"); setMessage(""); }}><strong>学びたい単語から作る</strong><span>単語を指定、またはテーマから選ぶ</span></button>
        </div>
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
      <aside className="guide-trouble"><h2>うまく登録できないとき</h2><p>回答が途中で切れていたら、単語数を減らして作り直してください。形式のエラーが出る場合は、AzukiのエラーメッセージとJSONをAIに送り、「このエラーを直して、JSON全体を出力して」と頼めます。</p><p>1回の登録は500語・512KBまでです。保存上限のエラーが出た場合は、単語帳を減らすなど、表示された案内に従ってください。</p></aside>
    </main>
  </div>;
}
