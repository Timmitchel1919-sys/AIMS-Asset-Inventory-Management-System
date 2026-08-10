import {describe,expect,it} from 'vitest';
import {accessoryDiscrepancies,assignmentEligible,borrowEligible,canTransitionAssignment,canTransitionBorrow,conditionAssessment,daysOverdue,validDateRange} from './rules';

describe('Wave 4 assignment and borrowing rules',()=>{
  it('allows only available assets for assignment',()=>{expect(assignmentEligible('Available')).toBe(true);expect(assignmentEligible('Borrowed')).toBe(false)});
  it('validates assignment transitions and prevents reopening returns',()=>{expect(canTransitionAssignment('Active','Return requested')).toBe(true);expect(canTransitionAssignment('Returned','Active')).toBe(false)});
  it('allows reserved borrowing but blocks unavailable equipment',()=>{expect(borrowEligible('Reserved')).toBe(true);expect(borrowEligible('Under Repair')).toBe(false)});
  it('validates borrow lifecycle transitions',()=>{expect(canTransitionBorrow('Pending Approval','Approved')).toBe(true);expect(canTransitionBorrow('Rejected','Issued')).toBe(false);expect(canTransitionBorrow('Partially Returned','Returned')).toBe(true)});
  it('validates date order and derives overdue days',()=>{expect(validDateRange('2026-07-01','2026-07-02')).toBe(true);expect(daysOverdue('2026-07-01','2026-07-05')).toBe(4)});
  it('calculates accessory discrepancies explicitly',()=>expect(accessoryDiscrepancies([{name:'Charger',quantity:1,conditionAtIssue:'Good'}],[])[0]).toMatchObject({name:'Charger',missing:true}));
  it('assesses condition changes with textual outcomes',()=>{expect(conditionAssessment('Good','Good')).toBe('No deterioration');expect(conditionAssessment('Good','Poor')).toBe('Minor damage')});
});
