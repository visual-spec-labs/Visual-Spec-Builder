import { describe, expect, it } from "vitest";
import { compileTickets, validateTicket, validateProjectTicket, validateProjectTickets, validateProjectPlan, type ProjectTicket, type ProjectPlan } from "@/features/editor/ticket";
import fixture from "./fixtures/screen-relations-project.json";
import type { ScreenSpec } from "@/features/editor/schema";
const legacy = compileTickets(fixture.pages.login as ScreenSpec)[0];
const ticket: ProjectTicket = { ...legacy, version: "0.2", sourcePageId: "login", id: JSON.stringify(["login", legacy.kind, legacy.instances[0]]) };
const plan: ProjectPlan = { version:"0.2", projectId:"project", tickets:[ticket], routes:[{pageId:"login",ticketId:ticket.id}],entryPageId:"login",artifacts:[
 {id:"project:routes",kind:"routes",filePath:"runtime/Routes.ts",dependsOn:[ticket.id]},
 {id:"project:host",kind:"host",filePath:"runtime/Host.tsx",dependsOn:["project:routes"]},
 {id:"project:entry",kind:"entry",filePath:"runtime/Entry.tsx",dependsOn:["project:host"]},
],excludedPages:[] };
describe("additive project Ticket v0.2 schema",()=>{
 it("keeps the v0.1 boundary strict in both directions",()=>{
  expect(validateTicket(legacy).valid).toBe(true);
  expect(validateTicket(ticket).valid).toBe(false);
  expect(validateProjectTicket(legacy).valid).toBe(false);
  expect(validateProjectTicket(ticket).valid).toBe(true);
  expect(validateProjectTickets([ticket]).valid).toBe(true);
  expect(validateProjectPlan(plan).valid).toBe(true);
 });
 it.each([{version:"0.1"},{sourcePageId:null},{sourcePageId:"bad/id"},{instances:[]},{instances:["root","root"]},{dependsOn:["a","a"]},{extra:true}])("rejects malformed project tickets %j",patch=>{
  expect(validateProjectTicket({...ticket,...patch}).valid).toBe(false);
 });
 it.each(["version","sourcePageId"])("requires %s",key=>{
  const candidate: Record<string,unknown>={...ticket};delete candidate[key];expect(validateProjectTicket(candidate).valid).toBe(false);
 });
 it("restricts project artifacts and exclusion metadata",()=>{
  expect(validateProjectPlan({...plan,artifacts:[{...plan.artifacts[0],sourcePageId:"login"},...plan.artifacts.slice(1)]}).valid).toBe(false);
  expect(validateProjectPlan({...plan,artifacts:[{...plan.artifacts[0],filePath:"../outside.ts"},...plan.artifacts.slice(1)]}).valid).toBe(false);
  expect(validateProjectPlan({...plan,excludedPages:[{pageId:"widget",reason:"widget-not-supported-in-s1"}]}).valid).toBe(true);
  expect(validateProjectPlan({...plan,excludedPages:[{pageId:"widget",reason:"ignore-invalid"}]}).valid).toBe(false);
 });
 it("returns issues for hostile input",()=>{
  const bad=new Proxy({}, {ownKeys(){throw Error("hostile");}});
  expect(validateProjectPlan(bad).valid).toBe(false);
 });
});
