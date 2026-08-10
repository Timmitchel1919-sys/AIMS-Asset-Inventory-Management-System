// @vitest-environment jsdom
import{cleanup,fireEvent,render,screen}from'@testing-library/react';
import{afterEach,describe,expect,it}from'vitest';
import{IctSupportDialog}from'./IctSupportDialog';

afterEach(cleanup);

describe('login ICT support dialog',()=>{
 it('opens, renders approved information and closes with Escape',()=>{
  render(<IctSupportDialog language="en"/>);
  const trigger=screen.getByRole('button',{name:'Need help? Contact ICT Support'});
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog',{name:'ICT Support'})).toBeTruthy();
  expect(screen.getByText('SUBMIT YOUR ISSUE THROUGH THE TICKET SYSTEM FIRST.').tagName).toBe('STRONG');
  expect(screen.getByText('Monday–Friday: 07:30 A.M. – 14:00 P.M.')).toBeTruthy();
  expect(screen.getByText('Internal line: 430870 / 431977 ext. 225')).toBeTruthy();
  expect(screen.getAllByRole('link').filter(x=>x.getAttribute('href')?.startsWith('mailto:'))).toHaveLength(7);
  fireEvent.keyDown(document,{key:'Escape'});
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
 });
 it('renders Dutch labels and a simulated ticket action',()=>{
  render(<IctSupportDialog language="nl"/>);
  fireEvent.click(screen.getByRole('button',{name:'Hulp nodig? Neem contact op met ICT-ondersteuning'}));
  expect(screen.getByText('DIEN UW PROBLEEM EERST IN VIA HET TICKETSYSTEEM.')).toBeTruthy();
  const ticket=screen.getByRole('link',{name:'Ondersteuningsticket indienen'});
  expect(ticket.getAttribute('href')).toBe('/support#ticket-system');
  expect(screen.getByText(/slaat geen ticket op/)).toBeTruthy();
  expect(screen.getByText(/Deel uw wachtwoord/)).toBeTruthy();
 });
});
