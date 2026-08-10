import {Camera,CameraOff,ImageUp,ScanLine,Search,X} from 'lucide-react';
import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import type {Asset} from '../domain/types';
import {resolveScannedAsset} from '../domain/qrAssetResolver';
import {Button} from './ui';
import {useApp} from '../context/AppContext';

type DetectedBarcode={rawValue:string};
type BarcodeDetectorInstance={detect:(source:CanvasImageSource)=>Promise<DetectedBarcode[]>};
type BarcodeDetectorConstructor=new(options:{formats:string[]})=>BarcodeDetectorInstance;

export function QrAssetScanner({assets,onAsset,onClose}:{assets:Asset[];onAsset:(asset:Asset)=>void;onClose:()=>void}){
  const {language}=useApp(),nl=language==='nl';
  const videoRef=useRef<HTMLVideoElement>(null),streamRef=useRef<MediaStream|null>(null),frameRef=useRef<number|undefined>(undefined);
  const imageInputRef=useRef<HTMLInputElement>(null);
  const [cameraActive,setCameraActive]=useState(false),[scanningImage,setScanningImage]=useState(false),[manualValue,setManualValue]=useState(''),[message,setMessage]=useState('');

  const stopCamera=useCallback(()=>{
    if(frameRef.current)cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach(track=>track.stop());
    streamRef.current=null;
    setCameraActive(false);
  },[]);

  const openAsset=useCallback((value:string)=>{
    const asset=resolveScannedAsset(value,assets);
    if(!asset){setMessage(nl?'Geen middel gevonden voor deze QR-code of KCS-code.':'No asset was found for this QR code or KCS code.');return false}
    stopCamera();
    onAsset(asset);
    return true;
  },[assets,nl,onAsset,stopCamera]);

  async function startCamera(){
    setMessage('');
    if(!navigator.mediaDevices?.getUserMedia){setMessage(nl?'Deze browser ondersteunt geen cameratoegang. Gebruik de KCS-code hieronder.':'This browser does not support camera access. Use the KCS code below.');return}
    const Detector=(window as typeof window&{BarcodeDetector?:BarcodeDetectorConstructor}).BarcodeDetector;
    if(!Detector){setMessage(nl?'QR-herkenning is niet beschikbaar in deze browser. Gebruik de KCS-code hieronder.':'QR recognition is unavailable in this browser. Use the KCS code below.');return}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      streamRef.current=stream;
      const video=videoRef.current;
      if(!video){stopCamera();return}
      video.srcObject=stream;
      await video.play();
      setCameraActive(true);
      const detector=new Detector({formats:['qr_code']});
      const scan=async()=>{
        if(!streamRef.current)return;
        try{const codes=await detector.detect(video);if(codes[0]?.rawValue&&openAsset(codes[0].rawValue))return}catch{/* Keep scanning transient unreadable frames. */}
        frameRef.current=requestAnimationFrame(scan);
      };
      frameRef.current=requestAnimationFrame(scan);
    }catch(error){
      stopCamera();
      const denied=error instanceof DOMException&&['NotAllowedError','PermissionDeniedError'].includes(error.name);
      setMessage(denied?(nl?'Cameratoegang is geweigerd. Sta toegang toe of voer de KCS-code in.':'Camera access was denied. Allow access or enter the KCS code.'):(nl?'De camera kon niet worden gestart. Gebruik de KCS-code hieronder.':'The camera could not be started. Use the KCS code below.'));
    }
  }

  async function scanImage(file?:File){
    if(!file)return;
    setMessage('');setScanningImage(true);
    const Detector=(window as typeof window&{BarcodeDetector?:BarcodeDetectorConstructor}).BarcodeDetector;
    if(!Detector){setMessage(nl?'QR-herkenning voor afbeeldingen is niet beschikbaar in deze browser. Gebruik de camera of voer de KCS-code in.':'QR recognition for images is unavailable in this browser. Use the camera or enter the KCS code.');setScanningImage(false);return}
    try{
      const bitmap=await createImageBitmap(file),codes=await new Detector({formats:['qr_code']}).detect(bitmap);
      bitmap.close();
      if(!codes[0]?.rawValue||!openAsset(codes[0].rawValue))setMessage(nl?'Geen geldige KCS QR-code gevonden in deze afbeelding.':'No valid KCS QR code was found in this image.');
    }catch{setMessage(nl?'De afbeelding kon niet worden gescand. Probeer een scherpere QR-afbeelding.':'The image could not be scanned. Try a clearer QR image.');}
    finally{setScanningImage(false);if(imageInputRef.current)imageInputRef.current.value='';}
  }

  useEffect(()=>stopCamera,[stopCamera]);
  function submitManual(event:FormEvent){event.preventDefault();openAsset(manualValue)}

  return <section className="card qr-scanner" aria-labelledby="qr-scanner-title">
    <header><div><ScanLine/><div><h2 id="qr-scanner-title">{nl?'QR-code scannen':'Scan QR code'}</h2><p>{nl?'Richt de camera op een KCS-middellabel.':'Point the camera at a KCS asset label.'}</p></div></div><button className="icon-button" aria-label={nl?'Scanner sluiten':'Close scanner'} onClick={()=>{stopCamera();onClose()}}><X/></button></header>
    <div className={`qr-camera ${cameraActive?'active':''}`}>
      <video ref={videoRef} muted playsInline aria-label={nl?'Live camerabeeld voor QR-scanner':'Live camera view for QR scanner'}/>
      <span className="qr-target" aria-hidden="true"/>
      {!cameraActive&&<div className="qr-camera-placeholder"><Camera/><strong>{nl?'Camera gereed':'Camera ready'}</strong><small>{nl?'Cameratoegang wordt pas gevraagd wanneer u start.':'Camera access is requested only when you start.'}</small></div>}
    </div>
    <div className="qr-scanner-actions">{cameraActive?<Button variant="secondary" onClick={stopCamera}><CameraOff/>{nl?'Camera stoppen':'Stop camera'}</Button>:<Button onClick={startCamera}><Camera/>{nl?'Camera starten':'Start camera'}</Button>}<Button variant="secondary" disabled={scanningImage} onClick={()=>imageInputRef.current?.click()}><ImageUp/>{scanningImage?(nl?'Scannen…':'Scanning…'):(nl?'QR-afbeelding':'QR image')}</Button><input ref={imageInputRef} className="sr-only" type="file" accept="image/*" capture="environment" onChange={event=>scanImage(event.target.files?.[0])}/></div>
    <div className="qr-manual-divider"><span>{nl?'of voer een code in':'or enter a code'}</span></div>
    <form className="qr-manual" onSubmit={submitManual}><label><span>{nl?'KCS-code of QR-link':'KCS code or QR link'}</span><div><Search/><input value={manualValue} onChange={event=>setManualValue(event.target.value)} placeholder="KCSMD-147" autoCapitalize="characters" autoComplete="off"/></div></label><Button type="submit" disabled={!manualValue.trim()}>{nl?'Middel openen':'Open asset'}</Button></form>
    {message&&<p className="qr-scanner-message" role="alert">{message}</p>}
  </section>;
}
