// lib/energia/analiseTarifaria.ts

export const calcularReativoTransformadores = (
  transformadores: { kva: number; percentualCarga?: number }[],
): number => {
  if (!transformadores?.length) return 0;

  return transformadores.reduce((total, trafo) => {
    const carga = trafo.percentualCarga ?? 0.7;
    const kvaUtilizado = trafo.kva * carga;
    // Reativo de magnetização típico: 2% a 5% da potência nominal. Use 3% como padrão.
    return total + kvaUtilizado * 0.03;
  }, 0);
};

interface AnaliseTarifariaParams {
  grupoTarifario: 'A' | 'B';
  mediaCustoReativo: number;      // custo médio mensal da multa por reativo excedente (R$)
  mediaFP: number;                // fator de potência médio (decimal, ex: 0.85)
  targetFP: number;               // fator de potência desejado (ex: 0.92)
  mediaPotenciaAtiva: number;     // potência ativa média (kW), preferencialmente a maior demanda registrada
  transformadores: { kva: number; percentualCarga?: number }[];
  bloqueioPorQualidade: boolean;  // true = não recomendar capacitor (ex: problemas de harmônicos)
  custoMinimoMensal?: number;     // limiar mínimo de custo para recomendar (padrão: 0)
}

export const analisarGrupoTarifario = (params: AnaliseTarifariaParams) => {
  const {
    grupoTarifario,
    mediaCustoReativo,
    mediaFP,
    targetFP,
    mediaPotenciaAtiva,
    transformadores,
    bloqueioPorQualidade,
    custoMinimoMensal = 0,
  } = params;

  let precisaCapacitor = false;
  let motivo = '';
  let kvarSugerido = 0;

  // Caso especial: problemas de qualidade impedem o uso de capacitores simples
  if (bloqueioPorQualidade) {
    return {
      precisaCapacitor: false,
      motivo: 'Bloqueio por qualidade (possível presença de harmônicos). Necessário análise com filtro.',
      kvarSugerido: 0,
    };
  }

  if (grupoTarifario === 'A') {
    // No grupo A, qualquer custo de reativo já justifica a correção.
    // Mas podemos usar um limiar configurável (padrão: >0)
    precisaCapacitor = mediaCustoReativo > custoMinimoMensal;

    motivo = `Grupo A - Reativo faturado via tarifa. Custo médio: R$ ${mediaCustoReativo.toFixed(2)}`;

    if (precisaCapacitor && mediaFP < targetFP) {
      const phi1 = Math.acos(Math.min(0.99, mediaFP));
      const phi2 = Math.acos(Math.min(0.99, targetFP));
      const kvarProcesso = mediaPotenciaAtiva * (Math.tan(phi1) - Math.tan(phi2));

      // ⚠️ Atenção: Só adicione o reativo dos transformadores se você tiver certeza de que ele NÃO está incluso no FP medido.
      // Em 99% dos casos (medição na entrada da concessionária), o FP já inclui a magnetização – NÃO some.
      // Deixe esta linha comentada ou remova. Se quiser margem de segurança, use fator multiplicador (ex: *1,1).
      // const kvarTrafo = calcularReativoTransformadores(transformadores);
      const kvarTrafo = 0; // por padrão, não adiciona nada extra

      kvarSugerido = kvarProcesso + kvarTrafo;
    }
  } else {
    // Grupo B – só penaliza se FP < targetFP
    precisaCapacitor = mediaFP < targetFP;

    motivo = `Grupo B - Penalidade apenas se FP < ${targetFP}. FP atual: ${(mediaFP * 100).toFixed(1)}%`;

    if (precisaCapacitor) {
      const phi1 = Math.acos(Math.min(0.99, mediaFP));
      const phi2 = Math.acos(Math.min(0.99, targetFP));
      kvarSugerido = mediaPotenciaAtiva * (Math.tan(phi1) - Math.tan(phi2));
    }
  }

  // Arredondamento para múltiplo de 2.5 kVAr (prática comercial)
  const arredondarParaComercial = (kvar: number): number => {
    if (kvar <= 0) return 0;
    if (kvar <= 10) return Math.ceil(kvar / 2.5) * 2.5;
    return Math.ceil(kvar / 5) * 5;
  };

  return {
    precisaCapacitor,
    motivo,
    kvarSugerido: arredondarParaComercial(Math.max(0, kvarSugerido)),
  };
};