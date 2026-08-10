import {Archive,Bookmark,CheckCircle2,CircleHelp,Hand,TriangleAlert,UserCheck,Wrench} from 'lucide-react';
import {assetStatusDefinition} from '../domain/assetStatus';
import {useT} from '../i18n';
export function AssetStatusBadge({status,condition,size='standard',variant='badge',showCondition=false}:{status:string;condition?:string;size?:'compact'|'standard';variant?:'badge'|'solid'|'table'|'mobile'|'print';showCondition?:boolean}){
  const t=useT(),definition=assetStatusDefinition(status);
  const Icon=definition?{check:CheckCircle2,userCheck:UserCheck,hand:Hand,bookmark:Bookmark,wrench:Wrench,tool:Wrench,alert:TriangleAlert,archive:Archive}[definition.icon]:CircleHelp;
  const statusLabel=definition?t(definition.translationKey):status;
  const conditionLabel=definition?t(definition.conditionTranslationKey):(condition?t(`condition.${condition}`):t('assets.conditionUnknown'));
  const words=statusLabel.split(/\s+/),stackStatus=status==='Under Maintenance';
  return <span className={`asset-status ${definition?.colorToken||'asset-status-unknown'} ${size} ${variant} ${stackStatus?'asset-status--stacked':''}`} aria-label={`${statusLabel}; ${t('assets.condition')}: ${conditionLabel}`}><Icon aria-hidden="true"/><span>{stackStatus?words.map(word=><span key={word}>{word}</span>):statusLabel}</span>{showCondition&&<small>{conditionLabel}</small>}</span>;
}
