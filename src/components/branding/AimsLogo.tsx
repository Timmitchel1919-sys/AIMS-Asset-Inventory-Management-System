import {useApp} from '../../context/AppContext';

type Props={context:'public'|'authenticated';variant?:'horizontal'|'stacked'|'symbol';surface?:'light'|'dark';className?:string;alt?:string};

export function AimsLogo({context,variant='symbol',surface='light',className,alt='AIMS logo'}:Props){
 const {effectiveTheme}=useApp();
 const emerald=context==='authenticated'&&effectiveTheme==='aimsEmeraldGloss';
 if(!emerald)return <img className={className} data-logo-theme="azure" data-logo-variant={variant} data-logo-surface={surface} src="/aims-logo-blue.png" alt={alt}/>;
 return <img className={className} data-logo-theme="emerald" data-logo-variant={variant} data-logo-surface={surface} src="/aims-logo-green.png" alt={alt}/>;
}
