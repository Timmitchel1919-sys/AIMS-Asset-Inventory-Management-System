export const OPEN_ACCOUNT_MENU_EVENT = "aims:open-account-menu";

export function requestAccountMenuOpen() {
  window.dispatchEvent(new Event(OPEN_ACCOUNT_MENU_EVENT));
}
