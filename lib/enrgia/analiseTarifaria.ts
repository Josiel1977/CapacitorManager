// lib/energia/analiseTarifaria.ts

export const calcularReativoTransformadores = (
  transformadores: { kva: number; percentualCarga?: number }[],
): number => {
  if (!transformadores?.length) return 0;

  return transformadores.reduce((total, trafo) => {
    const carga = trafo.percentualCarga ?? 0.7;
    const kvaUtilizado = trafo.kva * carga;

    return total + kvaUtilizado * 0.03; // 3% magnetização
  }, 0);
};

export const analisarGrupoTarifario = ({
  grupoTarifario,
  mediaCustoReativo,
  mediaFP,
  targetFP,
  mediaPotenciaAtiva,
  transformadores,
  bloqueioPorQualidade
}: {
  grupoTarifario: 'A' | 'B';
  mediaCustoReativo: number;
  mediaFP: number;
  targetFP: number;
  mediaPotenciaAtiva: number;
  transformadores: { kva: number; percentualCarga?: number }[];
  bloqueioPorQualidade: boolean;
}) => {

  let precisaCapacitor = false;
  let motivo = '';
  let kvarSugerido = 0;

  if (grupoTarifario === 'A') {
    precisaCapacitor = mediaCustoReativo > 50 && !bloqueioPorQualidade;

    motivo = `Grupo A - Reativo sempre faturado. Custo: R$ ${mediaCustoReativo.toFixed(2)}`;

    if (precisaCapacitor) {
      const phi1 = Math.acos(Math.min(0.99, mediaFP));
      const phi2 = Math.acos(targetFP);

      const kvarProcesso =
        mediaPotenciaAtiva * (Math.tan(phi1) - Math.tan(phi2));

      const kvarTrafo = calcularReativoTransformadores(transformadores);

      kvarSugerido = kvarProcesso + kvarTrafo;
    }

  } else {
    precisaCapacitor = mediaFP < targetFP;

    motivo = `Grupo B - Penalidade apenas abaixo de ${targetFP}`;

    if (precisaCapacitor) {
      const phi1 = Math.acos(Math.min(0.99, mediaFP));
      const phi2 = Math.acos(targetFP);

      kvarSugerido =
        mediaPotenciaAtiva * (Math.tan(phi1) - Math.tan(phi2));
    }
  }

  return {
    precisaCapacitor,
    motivo,
    kvarSugerido: Math.max(0, Math.round(kvarSugerido / 5) * 5)
  };
};