'use client';
import {useSyncExternalStore} from 'react';
import {flushSync} from 'react-dom';
let stamp='';
const listeners=new Set<()=>void>();
function beforePrint(){flushSync(()=>{stamp=new Date().toLocaleString('pt-BR');for(const listener of listeners)listener();});}
function subscribe(listener:()=>void){
 listeners.add(listener);if(listeners.size===1)window.addEventListener('beforeprint',beforePrint);
 return ()=>{listeners.delete(listener);if(!listeners.size)window.removeEventListener('beforeprint',beforePrint);};
}
export function useReportPrintDate(){return useSyncExternalStore(subscribe,()=>stamp,()=> '');}
