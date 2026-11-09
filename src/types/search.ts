export type GlobalSearchResultType='asset'|'user'|'location'|'department'|'assignment'|'maintenance'|'repair'|'category'|'subcategory'|'codeGroup'|'movement'|'borrow';
export interface GlobalSearchResult{id:string;type:GlobalSearchResultType;title:string;subtitle?:string;code?:string;route:string;searchableText:string;searchIndex?:import('../utils/searchNormalization').SearchIndex}
