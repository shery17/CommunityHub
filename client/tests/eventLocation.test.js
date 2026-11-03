import test from "node:test";
import assert from "node:assert/strict";
import { eventToForm, buildEventPayload, emptyEventForm } from "../src/eventFormTiming.js";

test("structured locations round-trip, trim and clear without leaking into legacy requests", () => {
  const event = { ...emptyEventForm, title:"Market", description:"Test", location:"Venue",
    start_date:"2028-05-10", start_time:"10:00", end_date:"2028-05-10", end_time:"12:00",
    address:" 12 Example Road ", city:" Leeds ", postcode:"LS1", country:"United Kingdom" };
  const form=eventToForm(event);
  const payload=buildEventPayload(form,true);
  assert.equal(payload.city,"Leeds");
  assert.equal(payload.address,"12 Example Road");
  assert.equal(payload.country,"United Kingdom");
  assert.equal(buildEventPayload({...form,city:"  "},true).city,null);
  assert.ok(!Object.hasOwn(buildEventPayload(form,false),"city"));
  assert.equal(eventToForm({...event,city:null}).city,"");
});
