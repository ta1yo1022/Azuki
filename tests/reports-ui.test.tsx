// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { ReportButton } from "../src/components/ReportButton";
import { AdminReports } from "../src/components/AdminReports";
const mocks=vi.hoisted(()=>({send:vi.fn(),list:vi.fn(),update:vi.fn()}));
vi.mock("../src/lib/firebase",()=>({auth:{currentUser:{uid:"admin"}},googleSignIn:vi.fn()}));
vi.mock("firebase/auth",()=>({onAuthStateChanged:(_:unknown,callback:(u:unknown)=>void)=>{callback({uid:"admin"});return ()=>{};}}));
vi.mock("../src/lib/repository",()=>({reportRepository:mocks}));
it("requires a reason, submits once, and shows the receipt",async()=>{
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
  const host=document.createElement("div");document.body.appendChild(host);const root=createRoot(host);
  const click=async(text:string)=>{await act(async()=>Array.from(host.querySelectorAll("button")).find(b=>b.textContent===text)!.click());};
  try {
    await act(async()=>root.render(<ReportButton id="book" title="対象の単語帳"/>));
    await click("この単語帳を通報");await click("通報を送信");
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("理由を選択");
    expect(mocks.send).not.toHaveBeenCalled();
    await act(async()=>{const select=host.querySelector("select")!;select.value="copyright";select.dispatchEvent(new Event("change",{bubbles:true}));});
    mocks.send.mockResolvedValue({ok:true});await click("通報を送信");
    expect(mocks.send).toHaveBeenCalledWith("book","copyright","");
    expect(host.querySelector('[role="status"]')?.textContent).toContain("受け付けました");
    expect(host.querySelector("select")).toBeNull();
  } finally {await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
it("shows administrative reports and saves a changed status",async()=>{
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
  mocks.list.mockResolvedValue({reports:[{id:"report",deck_id:"book",deck_title:"対象の単語帳",reason:"spam",details:"確認してください",status:"pending",admin_note:"",created_at:"2026-10-06T00:00:00Z",updated_at:"2026-10-06T00:00:00Z",current_visibility:"public"}],nextCursor:null});
  mocks.update.mockResolvedValue({ok:true});
  const host=document.createElement("div");document.body.appendChild(host);const root=createRoot(host);
  try {
    await act(async()=>root.render(<MemoryRouter><AdminReports/></MemoryRouter>));
    expect(host.textContent).toContain("確認してください");
    await act(async()=>{const select=host.querySelector("select")!;select.value="resolved";select.dispatchEvent(new Event("change",{bubbles:true}));});
    await act(async()=>Array.from(host.querySelectorAll("button")).find(b=>b.textContent==="対応を保存")!.click());
    expect(mocks.update).toHaveBeenCalledWith("report","resolved","");
  } finally {await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
