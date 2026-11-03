import test from "node:test";
import assert from "node:assert/strict";
import { createGeocoder } from "./geocoding.js";

test("Photon search normalizes coordinates, caches equivalent searches and limits upstream requests", async () => {
  let calls = 0;
  let time = 1000;
  const find = createGeocoder({ now: () => time, endpoint: "https://example.invalid/api/",
    fetchImpl: async url => {
      calls++;
      assert.equal(url.searchParams.get("q"), "Leeds & nearby");
      return { ok: true, json: async () => ({ features: [
        { geometry: { type: "Point", coordinates: [-1.55, 53.8] }, properties: { name: "Leeds", city: "Leeds", country: "United Kingdom" } },
        { geometry: { type: "Point", coordinates: [999, 0] }, properties: { name: "Invalid" } },
      ] }) };
    },
  });
  const places = await find(" Leeds & nearby ");
  assert.deepEqual(places, [{ latitude: 53.8, longitude: -1.55, label: "Leeds, United Kingdom" }]);
  assert.deepEqual(await find("leeds & nearby"), places);
  await assert.rejects(find("York"), { status: 429 });
  await assert.rejects(find(["Leeds"]), { status: 400 });
  assert.equal(calls, 1);
  time += 1000;
  assert.deepEqual(await find("Leeds & nearby"), places);
  assert.equal(calls, 1);
});

test("provider failures become recoverable lookup errors", async () => {
  const find = createGeocoder({ fetchImpl: async () => ({ ok: false }) });
  await assert.rejects(find("Leeds"), { status: 503 });
});
