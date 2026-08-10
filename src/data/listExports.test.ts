import {describe,expect,it} from 'vitest';
import {createCsv,createPrintHtml,createSpreadsheetXml,neutralizeSpreadsheetFormula} from './listExports';

const rows=[{code:'KCSMD-1',secret:'hidden'}];
const columns=[{id:'code',label:'Code',value:(row:typeof rows[number])=>row.code},{id:'secret',label:'Secret',value:(row:typeof rows[number])=>row.secret,authorized:false}];
const metadata={title:'Assets',generatedAt:'2026-07-30',generatedBy:'Tester'};
describe('list exports',()=>{
  it('excludes unauthorized fields from every export format',()=>{
    for(const output of [createCsv(rows,columns,metadata),createSpreadsheetXml(rows,columns,metadata),createPrintHtml(rows,columns,metadata)]){
      expect(output).toContain('KCSMD-1');
      expect(output).not.toContain('hidden');
    }
  });
  it('escapes spreadsheet and print markup',()=>{
    const unsafe=[{code:'<script>',secret:''}];
    expect(createSpreadsheetXml(unsafe,columns,metadata)).not.toContain('<script>');
    expect(createPrintHtml(unsafe,columns,metadata)).toContain('&lt;script&gt;');
  });
  it('neutralizes spreadsheet formula prefixes without changing ordinary values',()=>{
    expect(neutralizeSpreadsheetFormula('=HYPERLINK("bad")')).toBe('\'=HYPERLINK("bad")');
    expect(neutralizeSpreadsheetFormula('+1+1')).toBe("'+1+1");
    expect(neutralizeSpreadsheetFormula('KCSL-152')).toBe('KCSL-152');
  });
});
