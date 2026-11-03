import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { EVENT_CATEGORIES, categoryCheckSql } from "./eventCategories.js";

test("reset schema definitions agree with each other and the API category list", async () => {
  const [sql, script] = await Promise.all([
    readFile(new URL("./schema.sql", import.meta.url), "utf8"),
    readFile(new URL("./createTables.js", import.meta.url), "utf8"),
  ]);
  const normalize = value => value.replace(/\s+/g, " ").trim();
  for (const table of ["users", "events", "event_attendees"]) {
    const pattern = new RegExp(`CREATE TABLE ${table} \\([\\s\\S]*?\\n\\s*\\);`);
    assert.equal(normalize(sql.match(pattern)[0]), normalize(script.match(pattern)[0]));
  }
  const check = sql.match(/CONSTRAINT events_category_allowed CHECK \(([\s\S]*?)\n\s*\)/)[1];
  assert.equal(normalize(check), categoryCheckSql);
  assert.equal(EVENT_CATEGORIES.length, 7);
  assert.equal(new Set(EVENT_CATEGORIES).size, 7);
});
