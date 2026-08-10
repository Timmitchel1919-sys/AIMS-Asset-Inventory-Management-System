import {ChevronLeft,ChevronRight,Columns3,Download,Filter,Save,Search,Trash2} from 'lucide-react';
import {useId,type ReactNode} from 'react';
import {Button,Loader,State} from '../ui';
import {useT} from '../../i18n';

export interface ListColumn<T>{id:string;label:string;render:(row:T)=>ReactNode;value:(row:T)=>unknown;sortable?:boolean;required?:boolean}

export function DataPageLayout({header,alphabet,children}:{header:ReactNode;alphabet?:ReactNode;children:ReactNode}){
  return <div className="page data-page">{header}{alphabet}{children}</div>;
}

export function DataToolbar({search,onSearch,searchLabel,filterCount,onToggleFilters,savedViews,columnSelector,exportMenu}:{search:string;onSearch:(value:string)=>void;searchLabel:string;filterCount:number;onToggleFilters:()=>void;savedViews:ReactNode;columnSelector:ReactNode;exportMenu:ReactNode}){
  const t=useT();
  return <div className="data-toolbar list-toolbar">
    <label className="search"><Search size={17}/><span className="sr-only">{searchLabel}</span><input value={search} onChange={event=>onSearch(event.target.value)} placeholder={searchLabel}/></label>
    <div className="table-actions">
      <Button variant="secondary" onClick={onToggleFilters} aria-expanded={filterCount>0}><Filter/>{t('common.filters')}{filterCount?` (${filterCount})`:''}</Button>
      {savedViews}{columnSelector}{exportMenu}
    </div>
  </div>;
}

export function FilterPanel({open,children,onClear,onSave}:{open:boolean;children:ReactNode;onClear:()=>void;onSave:()=>void}){
  const t=useT();
  if(!open)return null;
  return <section className="advanced-filter-panel" aria-label={t('common.advancedFilters')}><div className="filter-grid">{children}</div><div className="filter-actions"><Button variant="secondary" onClick={onClear}>{t('common.clearAll')}</Button><Button onClick={onSave}>{t('common.save')}</Button></div></section>;
}

export function FilterField({label,value,values,onChange}:{label:string;value:string;values:(string|{value:string;label:string})[];onChange:(value:string)=>void}){
  const id=useId(),t=useT();
  return <label htmlFor={id}><span>{label}</span><select id={id} value={value} onChange={event=>onChange(event.target.value)}><option value="">{t('common.all')}</option>{values.map(item=>typeof item==='string'?<option key={item} value={item}>{item}</option>:<option key={item.value} value={item.value}>{item.label}</option>)}</select></label>;
}

export function FilterInput({label,type='text',value,onChange}:{label:string;type?:string;value:string;onChange:(value:string)=>void}){
  const id=useId();
  return <label htmlFor={id}><span>{label}</span><input id={id} type={type} value={value} onChange={event=>onChange(event.target.value)}/></label>;
}

export function ActiveFilterChips({filters,onRemove}:{filters:{field:string;label:string;value:string}[];onRemove:(field:string)=>void}){
  const t=useT();
  if(!filters.length)return null;
  return <div className="filter-chips" aria-label={t('common.activeFilters')}>{filters.map(filter=><span key={filter.field}>{filter.label}: {filter.value}<button aria-label={`${t('common.removeFilter')}: ${filter.label}`} onClick={()=>onRemove(filter.field)}>×</button></span>)}</div>;
}

export function ColumnSelector<T>({columns,visible,onChange}:{columns:ListColumn<T>[];visible:string[];onChange:(columns:string[])=>void}){
  const t=useT();
  return <details className="list-menu"><summary className="btn btn-secondary"><Columns3/>{t('common.columns')}</summary><div>{columns.map(column=><label key={column.id}><input type="checkbox" checked={visible.includes(column.id)} disabled={column.required} onChange={event=>onChange(event.target.checked?[...visible,column.id]:visible.filter(id=>id!==column.id))}/>{column.label}</label>)}</div></details>;
}

export function SavedViewSelector({views,onApply,onSave,onDelete}:{views:{id:string;name:string}[];onApply:(id:string)=>void;onSave:()=>void;onDelete:(id:string)=>void}){
  const t=useT();
  return <details className="list-menu"><summary className="btn btn-secondary"><Save/>{t('common.views')}</summary><div><Button variant="ghost" onClick={onSave}>{t('common.saveCurrentView')}</Button>{views.length===0?<small>{t('common.noSavedViews')}</small>:views.map(view=><span className="saved-view-row" key={view.id}><button onClick={()=>onApply(view.id)}>{view.name}</button><button aria-label={`${t('common.removeFilter')}: ${view.name}`} onClick={()=>onDelete(view.id)}><Trash2/></button></span>)}</div></details>;
}

export function ExportMenu({onCsv,onExcel,onPrint}:{onCsv:()=>void;onExcel:()=>void;onPrint:()=>void}){
  const t=useT();
  return <details className="list-menu"><summary className="btn btn-secondary"><Download/>{t('common.export')}</summary><div><button onClick={onCsv}>CSV</button><button onClick={onExcel}>Excel</button><button onClick={onPrint}>{t('common.printPreview')}</button></div></details>;
}

export function BulkActionToolbar({count,actions,value,onChange,onRun,onClear,busy}:{count:number;actions:{id:string;label:string}[];value:string;onChange:(value:string)=>void;onRun:()=>void;onClear:()=>void;busy:boolean}){
  const t=useT();
  if(!count)return null;
  return <div className="bulk-toolbar" role="region" aria-label={t('common.bulkAction')}><strong>{count} {t('common.selected')}</strong><label><span className="sr-only">{t('common.bulkAction')}</span><select value={value} onChange={event=>onChange(event.target.value)}><option value="">{t('common.chooseAction')}</option>{actions.map(action=><option key={action.id} value={action.id}>{action.label}</option>)}</select></label><Button onClick={onRun} disabled={!value||busy}>{busy?t('common.working'):t('common.apply')}</Button><Button variant="ghost" onClick={onClear}>{t('common.clearSelection')}</Button></div>;
}

export function DataListStates({loading,error,empty,onRetry}:{loading:boolean;error:string;empty:boolean;onRetry:()=>void}){
  const t=useT();
  if(loading)return <Loader/>;
  if(error)return <State type="error" title={t('common.loadError')} description={error} action={<Button onClick={onRetry}>{t('common.tryAgain')}</Button>}/>;
  if(empty)return <State type="empty" title={t('common.noResults')} description={t('common.noResultsHelp')}/>;
  return null;
}

export function ResponsiveDataList<T>({id,rows,columns,visible,rowKey,selected,onSelection,onRowClick,onSort,sort}:{id:string;rows:T[];columns:ListColumn<T>[];visible:string[];rowKey:(row:T)=>string;selected:string[];onSelection:(ids:string[])=>void;onRowClick:(row:T)=>void;onSort:(id:string)=>void;sort?:{field:string;direction:'asc'|'desc'}}){
  const t=useT(),visibleSet=new Set(visible),selectedSet=new Set(selected),shown=columns.filter(column=>visibleSet.has(column.id));
  const allSelected=rows.length>0&&rows.every(row=>selectedSet.has(rowKey(row)));
  const toggleAll=(checked:boolean)=>onSelection(checked?[...new Set([...selected,...rows.map(rowKey)])]:selected.filter(id=>!rows.some(row=>rowKey(row)===id)));
  return <div className="data-table" data-testid={`table-${id}`}>
    <div className="table-scroll desktop-table"><table><thead><tr><th><input aria-label={t('common.selectAllPage')} type="checkbox" checked={allSelected} onChange={event=>toggleAll(event.target.checked)}/></th>{shown.map(column=><th key={column.id}>{column.sortable?<button onClick={()=>onSort(column.id)}>{column.label}{sort?.field===column.id?(sort.direction==='asc'?' ↑':' ↓'):''}</button>:column.label}</th>)}</tr></thead><tbody>{rows.map(row=>{const key=rowKey(row);return <tr key={key} className="clickable" onClick={()=>onRowClick(row)}><td onClick={event=>event.stopPropagation()}><input aria-label={`${t('common.selected')} ${key}`} type="checkbox" checked={selectedSet.has(key)} onChange={event=>onSelection(event.target.checked?[...selected,key]:selected.filter(selectedId=>selectedId!==key))}/></td>{shown.map(column=><td key={column.id}>{column.render(row)}</td>)}</tr>})}</tbody></table></div>
    <div className="mobile-records">{rows.map(row=>{const key=rowKey(row);return <article key={key} tabIndex={0} onClick={()=>onRowClick(row)} onKeyDown={event=>{if(event.key==='Enter')onRowClick(row)}}><label onClick={event=>event.stopPropagation()}><input aria-label={`${t('common.selected')} ${key}`} type="checkbox" checked={selectedSet.has(key)} onChange={event=>onSelection(event.target.checked?[...selected,key]:selected.filter(selectedId=>selectedId!==key))}/></label>{shown.map(column=><div key={column.id}><small>{column.label}</small><span>{column.render(row)}</span></div>)}</article>})}</div>
  </div>;
}

export function PaginationControls({totalCount,pageSize,hasNext,hasPrevious,onPageSize,onNext,onPrevious}:{totalCount:number;pageSize:number;hasNext:boolean;hasPrevious:boolean;onPageSize:(size:number)=>void;onNext:()=>void;onPrevious:()=>void}){
  const t=useT();
  return <nav className="pagination" aria-label={t('common.records')}><label>{t('common.rowsPerPage')} <select value={pageSize} onChange={event=>onPageSize(Number(event.target.value))}>{[5,10,25,50].map(size=><option key={size}>{size}</option>)}</select></label><span>{totalCount} {t('common.records')}</span><Button variant="secondary" onClick={onPrevious} disabled={!hasPrevious} aria-label={t('common.previous')}><ChevronLeft/>{t('common.previous')}</Button><Button variant="secondary" onClick={onNext} disabled={!hasNext} aria-label={t('common.next')}>{t('common.next')}<ChevronRight/></Button></nav>;
}
