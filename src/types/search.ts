export type GlobalSearchResultType='asset'|'user'|'location'|'department'|'assignment'|'maintenance'|'repair'|'category'|'subcategory';
export interface GlobalSearchResult{id:string;type:GlobalSearchResultType;title:string;subtitle?:string;code?:string;route:string;searchableText:string}
