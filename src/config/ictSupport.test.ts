import{describe,expect,it}from'vitest';
import{KCS_ICT_SUPPORT_CONTACTS,KCS_ICT_SUPPORT_EMAIL,KCS_ICT_SUPPORT_LINE,KCS_ICT_TICKET_TARGET}from'./ictSupport';
import{ictSupportCopy,ictSupportHours}from'../i18n/ictSupport';
describe('approved KCS ICT support configuration',()=>{
 it('contains only the six approved contacts',()=>{expect(KCS_ICT_SUPPORT_CONTACTS).toHaveLength(6);expect(KCS_ICT_SUPPORT_CONTACTS.map(x=>x.name)).toEqual(['Rohan Budhram','Emmy Sastropawiro','Shaquil Alienda','Vicel Desperce','Julian Maclean','Jason Sanoesi']);expect(KCS_ICT_SUPPORT_CONTACTS.map(x=>x.email)).toEqual(['Manager-ICT@kangoeroeschool.com','sastropawiroe@kangoeroeschool.com','aliendas@kangoeroeschool.com','despercev@kangoeroeschool.com','macleanjv@kangoeroeschool.com','sanoesij@kangoeroeschool.com'])});
 it('uses Jason Sanoesi’s approved role',()=>{const jason=KCS_ICT_SUPPORT_CONTACTS.find(x=>x.name==='Jason Sanoesi');expect(jason?.role).toBe('Junior IT Technician')});
 it('uses exact operational contacts and placeholder route',()=>{expect(KCS_ICT_SUPPORT_EMAIL).toBe('ictsupport@kangoeroeschool.com');expect(KCS_ICT_SUPPORT_LINE).toBe('430870 / 431977 ext. 225');expect(KCS_ICT_TICKET_TARGET).toBe('/support#ticket-system')});
 it('provides English and Dutch support copy',()=>{expect(ictSupportCopy.en.ticketFirst).toBe('SUBMIT YOUR ISSUE THROUGH THE TICKET SYSTEM FIRST.');expect(ictSupportCopy.nl.ticketFirst).toBe('DIEN UW PROBLEEM EERST IN VIA HET TICKETSYSTEEM.');expect(ictSupportHours.en).toBe('Monday–Friday: 07:30 A.M. – 14:00 P.M.');expect(ictSupportHours.nl).toBe('Maandag–vrijdag: 07:30 – 14:00 uur')});
});
