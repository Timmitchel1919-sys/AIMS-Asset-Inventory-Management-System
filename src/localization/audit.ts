export interface LocalizationFinding{line:number;text:string}
const technicalTokens=new Set(['CSV','Excel','×']);
export function auditJsxText(source:string):LocalizationFinding[]{
  const findings:LocalizationFinding[]=[];
  const pattern=/>([^<>{}\r\n]+)</g;
  for(const match of source.matchAll(pattern)){
    const text=match[1].trim();
    if(!text||technicalTokens.has(text)||!/[A-Za-zÀ-ÿ]/.test(text)||/[=()]/.test(text))continue;
    findings.push({line:source.slice(0,match.index).split(/\r?\n/).length,text});
  }
  return findings;
}
export function translationKeysUsed(source:string){
  return[...source.matchAll(/\bt\(\s*[`'"]([^`'"]+)[`'"]\s*\)/g)].map(match=>match[1]).filter(key=>!key.includes('${'));
}
