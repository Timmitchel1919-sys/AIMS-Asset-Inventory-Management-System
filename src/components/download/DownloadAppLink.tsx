import {Download} from 'lucide-react';
import type {ButtonHTMLAttributes,ReactNode} from 'react';
import {usePwaInstall} from '../PwaStatus';

export function DownloadAppLink({className='',children='Download App',showIcon=true,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{children?:ReactNode;showIcon?:boolean}){
  const {isStandalone,install}=usePwaInstall();
  if(isStandalone)return null;
  return <button {...props} type="button" className={className} onClick={async event=>{props.onClick?.(event);if(!event.defaultPrevented)await install()}}>{showIcon&&<Download aria-hidden="true"/>}{children}</button>;
}
