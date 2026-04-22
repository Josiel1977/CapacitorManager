// app/api/extract-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import pdfParse from 'pdf-parse';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
    }
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await pdfParse(buffer);
    const text = data.text;
    
    // Função para extrair valores numéricos
    const extractNumber = (patterns: RegExp[]): number => {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          const value = match[1].replace(/\./g, '').replace(',', '.');
          const num = parseFloat(value);
          if (!isNaN(num) && num > 0) return num;
        }
      }
      return 0;
    };
    
    // Extrair dados da fatura
    const consumoPonta = extractNumber([
      /Consumo\s+Ponta\s+(\d+)/i,
      /Ponta\s+(\d+)\s*kWh/i,
      /(\d+)\s*kWh\s*Ponta/i,
    ]);
    
    const consumoForaPonta = extractNumber([
      /Consumo\s+F(?:ora)?\s+Ponta\s+(\d+)/i,
      /F(?:ora)?\s+Ponta\s+(\d+)\s*kWh/i,
      /(\d+)\s*kWh\s*F(?:ora)?\s*Ponta/i,
    ]);
    
    const demanda = extractNumber([
      /Demanda\s+(\d+)\s*kW/i,
      /Demanda\s+Ponta\s+(\d+)/i,
    ]);
    
    const reativaPonta = extractNumber([
      /Energia\s+Reativa\s+Exc(?:edente)?\s+Ponta\s+(\d+)/i,
      /En\s+R\s+Exc\s+Ponta\s+(\d+)/i,
      /Reativa\s+Ponta\s+(\d+)/i,
    ]);
    
    const reativaForaPonta = extractNumber([
      /Energia\s+Reativa\s+Exc(?:edente)?\s+F(?:ora)?\s+Ponta\s+(\d+)/i,
      /En\s+R\s+Exc\s+F(?:ora)?\s+Ponta\s+(\d+)/i,
      /Reativa\s+Fora\s+Ponta\s+(\d+)/i,
    ]);
    
    const totalPagar = extractNumber([
      /Valor\s+a\s+Pagar\s+R?\$?\s*([\d\.,]+)/i,
      /Total\s+a\s+pagar\s+R?\$?\s*([\d\.,]+)/i,
    ]);
    
    // Extrair mês da data de vencimento
    let mesReferencia = '';
    const dateMatch = text.match(/(\d{2})\/(\d{4})/);
    if (dateMatch) {
      mesReferencia = `${dateMatch[1]}/${dateMatch[2]}`;
    }
    
    // Se não encontrou os dados, tenta identificar números grandes
    let finalConsumoPonta = consumoPonta;
    let finalConsumoForaPonta = consumoForaPonta;
    
    if (finalConsumoPonta === 0 && finalConsumoForaPonta === 0) {
      const numbers = text.match(/\b\d{4,6}\b/g);
      if (numbers) {
        const sorted = numbers.map(Number).sort((a, b) => b - a);
        if (sorted.length >= 2) {
          finalConsumoPonta = Math.min(sorted[0], sorted[1]);
          finalConsumoForaPonta = Math.max(sorted[0], sorted[1]);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      data: {
        consumoAtivoPonta: finalConsumoPonta,
        consumoAtivoForaPonta: finalConsumoForaPonta,
        demandaPonta: demanda,
        energiaReativaExcPonta: reativaPonta,
        energiaReativaExcForaPonta: reativaForaPonta,
        totalPagar,
        mesReferencia,
      }
    });
    
  } catch (error) {
    console.error('Erro ao processar PDF:', error);
    return NextResponse.json({ error: 'Erro ao processar o arquivo' }, { status: 500 });
  }
}
