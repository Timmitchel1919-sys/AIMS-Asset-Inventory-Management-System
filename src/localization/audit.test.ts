import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {resources} from '../i18n';
import {auditJsxText,translationKeysUsed} from './audit';

const files=['src/pages/Assets.tsx','src/components/data-list/ListInfrastructure.tsx'];
describe('Wave 1 localization audit',()=>{
  it.each(files)('%s has no unlocalized JSX text',file=>{
    const source=readFileSync(file,'utf8');
    expect(auditJsxText(source)).toEqual([]);
  });
  it('has complete English and Dutch parity for every static Wave 1 key',()=>{
    const used=files.flatMap(file=>translationKeysUsed(readFileSync(file,'utf8')));
    expect([...new Set(used)].filter(key=>!(key in resources.en)||!(key in resources.nl))).toEqual([]);
    expect(Object.keys(resources.en)).toEqual(Object.keys(resources.nl));
  });
});
