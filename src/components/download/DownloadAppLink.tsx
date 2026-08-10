import {Download} from 'lucide-react';
import {Link,type LinkProps} from 'react-router-dom';
import {appDownloadConfig} from '../../config/appDownload.config';
import {usePwaInstall} from '../PwaStatus';

export function DownloadAppLink({className='',children='Download App',showIcon=true,...props}:Omit<LinkProps,'to'>&{children?:React.ReactNode;showIcon?:boolean}){
  const {isStandalone}=usePwaInstall();
  if(isStandalone)return null;
  return <Link {...props} className={className} to={appDownloadConfig.publicDownloadPath}>{showIcon&&<Download aria-hidden="true"/>}{children}</Link>;
}
