import { Activity, Plus, Radar, RefreshCw, ShieldCheck, Wifi } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Button, Field, Loader } from "../components/ui";
import { Dialog, MutationFeedback, PageHeader } from "../components/WorkflowUi";
import { useApp } from "../context/AppContext";
import { createDiscoveryEnrollment, manageDiscoveryAgent, requestNetworkDiscovery, useNetworkDiscoveryData } from "../data/networkDiscoveryStore";
import { effectiveAgentStatus, type DiscoveryAgent } from "../domain/networkDiscovery";

type Tab = "agents" | "requests" | "devices";
export default function NetworkDiscovery() {
  const { language } = useApp(), nl = language === "nl";
  const { agents, requests, devices, loading, error } = useNetworkDiscoveryData();
  const [tab, setTab] = useState<Tab>("agents"), [enroll, setEnroll] = useState(false), [selected, setSelected] = useState<DiscoveryAgent | null>(null);
  const [token, setToken] = useState(""), [feedback, setFeedback] = useState<{status:"idle"|"loading"|"success"|"error";message:string}>({status:"idle",message:""});
  const online = useMemo(() => agents.filter(a => effectiveAgentStatus(a) === "ACTIVE").length, [agents]);
  const act = async (run: () => Promise<unknown>, message: string) => { try { setFeedback({status:"loading",message:nl?"Bezig…":"Working…"}); await run(); setFeedback({status:"success",message}); } catch (cause) { setFeedback({status:"error",message:cause instanceof Error?cause.message:String(cause)}); } };
  const submitEnrollment = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const form = new FormData(event.currentTarget); await act(async()=>{const result=await createDiscoveryEnrollment({name:String(form.get("name")),site:String(form.get("site")),scope:String(form.get("scope"))});setToken(result.enrollmentToken)}, nl?"Registratietoken aangemaakt.":"Enrollment token created."); };
  if (loading) return <Loader/>;
  return <div className="page network-discovery-page">
    <PageHeader title="Network Discovery" description="" actions={<Button onClick={()=>{setToken("");setEnroll(true)}}><Plus/>{nl?"Agent registreren":"Enroll agent"}</Button>}/>
    <section className="discovery-boundary" role="note"><ShieldCheck/><div><strong>{nl?"Alleen inventarisatie":"Discovery only"}</strong><p>{nl?"Geen remote control, automatische assetcreatie, credential scans of scans buiten de geautoriseerde CIDR-scope.":"No remote control, automatic asset creation, credential scans, or scans outside the authorized CIDR scope."}</p></div></section>
    {error&&<div className="mutation-feedback error" role="alert">{error}</div>}
    <section className="discovery-kpis" aria-label="Network Discovery summary">
      <article className="card"><Radar/><span>{nl?"Agents":"Agents"}</span><strong>{agents.length}</strong></article>
      <article className="card"><Wifi/><span>{nl?"Online":"Online"}</span><strong>{online}</strong></article>
      <article className="card"><Activity/><span>{nl?"Verzoeken":"Requests"}</span><strong>{requests.length}</strong></article>
      <article className="card"><RefreshCw/><span>{nl?"Ontdekt":"Discovered"}</span><strong>{devices.length}</strong></article>
    </section>
    <nav className="discovery-tabs" aria-label="Network Discovery views">{(["agents","requests","devices"] as Tab[]).map(id=><button key={id} className={tab===id?"active":""} onClick={()=>setTab(id)}>{id==="agents"?(nl?"Agents":"Agents"):id==="requests"?(nl?"Verzoeken":"Requests"):(nl?"Gevonden apparaten":"Discovered devices")}</button>)}</nav>
    <section className="card discovery-workspace">
      {tab==="agents"&&<div className="discovery-grid">{agents.length?agents.map(agent=>{const status=effectiveAgentStatus(agent);return <button className="discovery-agent-card" key={agent.id} onClick={()=>setSelected(agent)}><div><strong>{agent.name}</strong><span>{agent.site||"—"}</span></div><span className={`discovery-status ${status.toLowerCase()}`}>{status}</span><code>{agent.networkScope}</code><small>{agent.operatingSystem||"OS unknown"} · {agent.version||"version unknown"}</small></button>}):<p>{nl?"Nog geen agents geregistreerd.":"No agents enrolled yet."}</p>}</div>}
      {tab==="requests"&&<div className="table-scroll"><table><thead><tr><th>ID</th><th>Agent</th><th>Scope</th><th>Status</th><th>{nl?"Apparaten":"Devices"}</th></tr></thead><tbody>{requests.map(item=><tr key={item.id}><td><code>{item.id}</code></td><td>{item.agentId}</td><td>{item.scope}</td><td>{item.status}</td><td>{item.deviceCount??"—"}</td></tr>)}</tbody></table></div>}
      {tab==="devices"&&<div className="table-scroll"><table><thead><tr><th>IP</th><th>MAC</th><th>Hostname</th><th>Method</th><th>Status</th></tr></thead><tbody>{devices.map(item=><tr key={item.id}><td>{item.ipAddress}</td><td>{item.macAddress||"—"}</td><td>{item.hostname||"—"}</td><td>{item.discoveryMethod}</td><td>{item.status}</td></tr>)}</tbody></table></div>}
    </section>
    <MutationFeedback {...feedback}/>
    <Dialog open={enroll} title={nl?"Discovery-agent registreren":"Enroll discovery agent"} description={nl?"Maak een eenmalig token voor exact één private CIDR-scope.":"Create a one-time token for exactly one private CIDR scope."} onClose={()=>setEnroll(false)}>{token?<div className="token-reveal"><p>{nl?"Kopieer dit token nu. Het wordt niet opnieuw getoond.":"Copy this token now. It will not be shown again."}</p><code>{token}</code></div>:<form className="workflow-form" onSubmit={submitEnrollment}><Field name="name" label={nl?"Agentnaam":"Agent name"} required/><Field name="site" label={nl?"Locatie":"Site"} required/><Field name="scope" label="Authorized CIDR" placeholder="192.168.1.0/24" required/><Button type="submit"><Plus/>{nl?"Token maken":"Create token"}</Button></form>}</Dialog>
    <Dialog open={Boolean(selected)} title={selected?.name||"Agent"} onClose={()=>setSelected(null)}>{selected&&<div className="agent-detail"><dl><dt>Status</dt><dd>{effectiveAgentStatus(selected)}</dd><dt>Authorized scope</dt><dd><code>{selected.networkScope}</code></dd><dt>OS</dt><dd>{selected.operatingSystem||"Unknown"}</dd><dt>Version</dt><dd>{selected.version||"Unknown"}</dd><dt>Last error</dt><dd>{selected.lastError||"None"}</dd></dl><div className="actions"><Button onClick={()=>act(()=>requestNetworkDiscovery({agentId:selected.id,scope:selected.networkScope}),nl?"Discovery aangevraagd.":"Discovery requested.")}><Radar/>{nl?"Scan aanvragen":"Request scan"}</Button><Button variant="secondary" onClick={()=>act(()=>manageDiscoveryAgent({agentId:selected.id,action:selected.status==="ACTIVE"?"DISABLE":"ENABLE"}),"Agent updated.")}>{selected.status==="ACTIVE"?"Disable":"Enable"}</Button><Button variant="danger" onClick={()=>act(()=>manageDiscoveryAgent({agentId:selected.id,action:"REVOKE"}),"Agent revoked.")}>Revoke</Button></div></div>}</Dialog>
  </div>;
}

