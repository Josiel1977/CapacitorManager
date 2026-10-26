import {ImageResponse} from 'next/og';

export const alt='CapacitorManager — Auditoria energética, gestão tarifária e bancos de capacitores. JM Eletro Service.';
export const size={width:1200,height:630};
export const contentType='image/png';

export default function OpenGraphImage(){
 return new ImageResponse(
  <div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'space-between',padding:'64px',background:'#0a2b3c',color:'#ffffff',fontFamily:'sans-serif',borderBottom:'16px solid #f39c12'}}>
   <div style={{display:'flex',alignItems:'center',fontSize:34,fontWeight:700,color:'#f39c12'}}>CapacitorManager</div>
   <div style={{display:'flex',flexDirection:'column',gap:22}}>
    <div style={{fontSize:68,fontWeight:700,lineHeight:1.08}}>Auditoria energética.</div>
    <div style={{fontSize:44,lineHeight:1.15,color:'#d9e6ee'}}>Gestão tarifária e bancos de capacitores.</div>
   </div>
   <div style={{display:'flex',justifyContent:'space-between',fontSize:24,color:'#d9e6ee'}}>
    <span>Faturas · Medições · Relatórios</span><span>JM Eletro Service</span>
   </div>
  </div>,size,
 );
}
