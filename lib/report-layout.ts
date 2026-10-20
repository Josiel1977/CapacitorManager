/** Section labels must contain letters; numeric history rows are body text. */
export function isReportHeading(text:string){
 return /[A-ZÀ-Ý]/.test(text)&&text===text.toLocaleUpperCase('pt-BR')&&text.length<180;
}
