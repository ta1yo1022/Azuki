import {expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
it('widens book capacity without losing existing content, tags, lineage or quota counters',()=>{
  const db=new DatabaseSync(':memory:');
  for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql') && f<'0011_full_book_forks.sql').sort())db.exec(readFileSync(`migrations/${file}`,'utf8'));
  db.exec(`INSERT INTO users(id) VALUES ('owner');
    INSERT INTO decks(id,owner_id,title,word_count,created_at,updated_at,data_bytes,source_deck_id,source_title,source_hash,root_deck_id,is_fork) VALUES ('book','owner','保存済み',1,'now','now',100,'original','コピー元','hash','original',1);
    INSERT INTO words(id,deck_id,ordinal,word,meaning,example,tags) VALUES ('word','book',0,'book','本','Read a book.','["名詞"]');
    INSERT INTO textbook_tags(id,name,edition,chapter) VALUES ('tag','教材','第二版','1');
    INSERT INTO deck_textbook_tags(deck_id,tag_id) VALUES ('book','tag');`);
  const tables=['decks','words','deck_textbook_tags','textbook_tags','users','app_usage'];
  const before=tables.map(t=>db.prepare(`SELECT * FROM ${t}`).all());
  db.exec('BEGIN');db.exec(readFileSync('migrations/0011_full_book_forks.sql','utf8'));db.exec('COMMIT');
  expect(tables.map(t=>db.prepare(`SELECT * FROM ${t}`).all())).toEqual(before);
  expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  db.exec("UPDATE decks SET word_count=1390 WHERE id='book'");
  expect(db.prepare("SELECT word_count FROM users WHERE id='owner'").get()?.word_count).toBe(1390);
  db.exec("DELETE FROM decks WHERE id='book'");
  expect(db.prepare('SELECT * FROM words').all()).toEqual([]);
  expect(db.prepare('SELECT * FROM deck_textbook_tags').all()).toEqual([]);
  expect(db.prepare("SELECT word_count FROM users WHERE id='owner'").get()?.word_count).toBe(0);
  db.close();
});

it('keeps existing over-limit books editable while rejecting additional words after the 2,000-word migration',()=>{
  const db=new DatabaseSync(':memory:');
  try {
    for(const file of readdirSync('migrations').filter(f=>f.endsWith('.sql') && f<'0013_user_word_limit.sql').sort())db.exec(readFileSync(`migrations/${file}`,'utf8'));
    db.exec("INSERT INTO users(id) VALUES ('owner'); INSERT INTO decks(id,owner_id,title,word_count,created_at,updated_at,data_bytes) VALUES ('book','owner','保存済み',2500,'now','now',100)");
    const before=db.prepare('SELECT * FROM decks').all();
    db.exec(readFileSync('migrations/0013_user_word_limit.sql','utf8'));
    expect(db.prepare('SELECT * FROM decks').all()).toEqual(before);
    expect(()=>db.exec("UPDATE decks SET data_bytes=110 WHERE id='book'")).not.toThrow();
    expect(()=>db.exec("UPDATE decks SET word_count=2501 WHERE id='book'")).toThrow('AZUKI_WORD_LIMIT');
    db.exec("UPDATE decks SET word_count=2000 WHERE id='book'");
    expect(()=>db.exec("INSERT INTO decks(id,owner_id,title,word_count,created_at,updated_at) VALUES ('extra','owner','追加',1,'now','now')")).toThrow('AZUKI_WORD_LIMIT');
    db.exec("UPDATE decks SET word_count=1999 WHERE id='book'");
    db.exec("INSERT INTO decks(id,owner_id,title,word_count,created_at,updated_at) VALUES ('extra','owner','追加',1,'now','now')");
    expect(db.prepare("SELECT word_count FROM users WHERE id='owner'").get()?.word_count).toBe(2000);
  } finally {db.close();}
});
