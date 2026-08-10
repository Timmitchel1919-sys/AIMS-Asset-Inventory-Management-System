export interface AppDownloadConfig {
  appName:string;
  publicDownloadPath:string;
  androidUrl?:string;
  iosUrl?:string;
  supportEmail:string;
  currentVersion:string;
}

export const appDownloadConfig:AppDownloadConfig={
  appName:'AIMS Asset & Inventory Management System',
  publicDownloadPath:'/download',
  androidUrl:import.meta.env.VITE_ANDROID_APP_URL||undefined,
  iosUrl:import.meta.env.VITE_IOS_APP_URL||undefined,
  supportEmail:'servicedesk@kangoeroeschool.com',
  currentVersion:'0.1.0',
};
