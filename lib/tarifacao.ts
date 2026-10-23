// Tipos que espelham os schemas Pydantic da API (backend/app/schemas.py),
// que por sua vez portam as regras de equacoesRecarga.py + sistemaCobranca.py
// (Data Structures Sprint). O cálculo em si roda no backend — ver lib/api.ts.

export interface DetalheTarifa {
  tarifaHorario: number;
  tarifaDemanda: number;
  tarifaTipo: number;
  tarifaFinal: number;
}

export interface Fatura {
  clienteNome: string;
  veiculoModelo: string;
  energiaKwh: number;
  detalheTarifa: DetalheTarifa;
  totalBrl: number;
}
