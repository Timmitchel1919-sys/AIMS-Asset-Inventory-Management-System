export interface IctSupportContact{id:string;name:string;email:string;role?:string;department?:'ICT';status:'active'}
export const KCS_ICT_SUPPORT_EMAIL='ictsupport@kangoeroeschool.com';
export const KCS_ICT_SUPPORT_LINE='430870 / 431977 ext. 225';
export const KCS_ICT_TICKET_TARGET='/support#ticket-system';
export const KCS_ICT_SUPPORT_CONTACTS:IctSupportContact[]=[
 {id:'rohan-budhram',name:'Rohan Budhram',email:'Manager-ICT@kangoeroeschool.com',role:'ICT Manager',department:'ICT',status:'active'},
 {id:'emmy-sastropawiro',name:'Emmy Sastropawiro',email:'sastropawiroe@kangoeroeschool.com',role:'Hoofd Planning & Coördinatie ICT Afd.',department:'ICT',status:'active'},
 {id:'shaquil-alienda',name:'Shaquil Alienda',email:'aliendas@kangoeroeschool.com',role:'Junior IT Technician',department:'ICT',status:'active'},
 {id:'vicel-desperce',name:'Vicel Desperce',email:'despercev@kangoeroeschool.com',role:'Docent Informatica',department:'ICT',status:'active'},
 {id:'julian-maclean',name:'Julian Maclean',email:'macleanjv@kangoeroeschool.com',role:'IT Technician',department:'ICT',status:'active'},
 {id:'jason-sanoesi',name:'Jason Sanoesi',email:'sanoesij@kangoeroeschool.com',role:'Junior IT Technician',status:'active'}
];
