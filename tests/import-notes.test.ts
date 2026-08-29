import assert from "node:assert/strict";
import { File } from "node:buffer";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { zipSync } from "fflate";
import initSqlJs from "sql.js";
import { parseAnkiPackage } from "../lib/import-anki-package";
import { parseNoteImport } from "../lib/import-notes";
import type { SkillState } from "../lib/flow-engine";

const skills: SkillState[] = [{
  id: "general",
  name: "General",
  mastery: 0.3,
  retention: 0.3,
  expression: 0.3,
  confidence: 0.3,
}];

test("parses Anki plain-text directives before detecting the delimiter", () => {
  const source = [
    "#separator:tab",
    "#html:false",
    "#tags column:3",
    "Hello\t你好\tgreeting beginner",
    "Thank you\t谢谢\tgreeting",
  ].join("\n");

  const result = parseNoteImport(source, skills, "general", "anki", "en");

  assert.equal(result.format, "anki-text");
  assert.equal(result.cards.length, 2);
  assert.equal(result.cards[0].prompt, "Hello");
  assert.equal(result.cards[0].noteMarkdown, "你好");
  assert.deepEqual(result.cards[0].tags, ["greeting", "beginner"]);
  assert.equal(result.warnings.length, 0);
});

test("maps Anki deck and tags columns and creates a matching knowledge domain", () => {
  const source = [
    "#separator:tab",
    "#html:true",
    "#deck column:1",
    "#tags column:4",
    "Daily English\tHow are you?<br>Say it aloud\tI am well.\tdaily speaking",
  ].join("\n");

  const result = parseNoteImport(source, skills, "general", "daily", "en");

  assert.equal(result.cards.length, 1);
  assert.equal(result.newSkills.length, 1);
  assert.equal(result.newSkills[0].name, "Daily English");
  assert.equal(result.cards[0].skillId, result.newSkills[0].id);
  assert.equal(result.cards[0].prompt, "How are you?\nSay it aloud");
  assert.deepEqual(result.cards[0].tags, ["daily", "speaking"]);
});

test("supports global deck and tag directives", () => {
  const source = [
    "#separator:semicolon",
    "#deck:Algorithms",
    "#tags:anki imported",
    "What is BFS?;Breadth-first search",
  ].join("\n");

  const result = parseNoteImport(source, skills, "general", "global", "en");

  assert.equal(result.cards.length, 1);
  assert.equal(result.newSkills[0].name, "Algorithms");
  assert.deepEqual(result.cards[0].tags, ["anki", "imported"]);
});

test("keeps ordinary NoteFlow CSV imports working", () => {
  const source = [
    "title,prompt,noteMarkdown,skill,tags",
    'Queue,Explain FIFO,"First in, first out",General,"data structures"',
  ].join("\n");

  const result = parseNoteImport(source, skills, "general", "csv", "en");

  assert.equal(result.format, "noteflow-csv");
  assert.equal(result.cards.length, 1);
  assert.equal(result.cards[0].title, "Queue");
  assert.equal(result.cards[0].skillId, "general");
});

test("reads notes, decks, and tags from a legacy Anki package", async () => {
  const wasmPath = fileURLToPath(new URL("../node_modules/sql.js/dist/sql-wasm.wasm", import.meta.url));
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const database = new SQL.Database();
  database.run("CREATE TABLE col (decks TEXT)");
  database.run("CREATE TABLE notes (id INTEGER PRIMARY KEY, flds TEXT, tags TEXT)");
  database.run("CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER)");
  database.run("INSERT INTO col (decks) VALUES (?)", [JSON.stringify({ "42": { name: "Daily English" } })]);
  database.run("INSERT INTO notes (id, flds, tags) VALUES (?, ?, ?)", [1, "Hello\u001f你好", " greeting beginner "]);
  database.run("INSERT INTO cards (id, nid, did) VALUES (?, ?, ?)", [10, 1, 42]);
  const archive = zipSync({ "collection.anki21": database.export() });
  database.close();
  const file = new File([archive], "daily-english.apkg") as unknown as globalThis.File;

  const result = await parseAnkiPackage(file, skills, "general", "package", "en", wasmPath);

  assert.equal(result.format, "anki-package");
  assert.equal(result.cards.length, 1);
  assert.equal(result.cards[0].prompt, "Hello");
  assert.equal(result.cards[0].noteMarkdown, "你好");
  assert.deepEqual(result.cards[0].tags, ["greeting", "beginner"]);
  assert.equal(result.newSkills[0].name, "Daily English");
  assert.equal(result.cards[0].skillId, result.newSkills[0].id);
});
