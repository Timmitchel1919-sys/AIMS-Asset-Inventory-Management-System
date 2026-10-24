import { describe, expect, it } from "vitest";
import { effectiveAgentStatus, type DiscoveryAgent } from "./networkDiscovery";
const agent=(status:DiscoveryAgent["status"],lastHeartbeat:Date|null):DiscoveryAgent=>({id:"a",name:"A",site:"KCS",status,networkScope:"192.168.1.0/24",lastHeartbeat});
describe("effectiveAgentStatus",()=>{
  it("marks stale active agents offline",()=>expect(effectiveAgentStatus(agent("ACTIVE",new Date(0)),11*60_000)).toBe("OFFLINE"));
  it("preserves security states",()=>expect(effectiveAgentStatus(agent("REVOKED",null))).toBe("REVOKED"));
});
