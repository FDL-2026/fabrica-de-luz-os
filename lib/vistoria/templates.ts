// Templates de checklist da Vistoria Técnica (V.T.).
//
// Ao pré-preencher a VT, a gestão escolhe um TIPO de decoração para cada ponto
// e o sistema sugere o checklist correspondente (as "tasks" que guiam o que o
// responsável deve observar no local). Os itens ficam editáveis antes de gerar
// o link e o snapshot é persistido em vistoria_pontos.itens (JSONB).
//
// Fonte única (front + relatório). O banco só guarda o JSON com as respostas.

export type CampoTipo = "texto" | "check";

// Campo dentro de um item (ex.: Tensão/Fase, ou Gancho/Pitão/Cabo de aço).
export type CampoVT = {
  chave: string;
  label: string;
  tipo: CampoTipo;
  valor?: string; // usado quando tipo = "texto"
  marcado?: boolean; // usado quando tipo = "check"
};

// Item do checklist de um ponto.
export type ItemVT = {
  chave: string;
  label: string;
  simNao: boolean; // maioria tem resposta Sim/Não
  resposta?: "sim" | "nao" | null;
  campos: CampoVT[];
};

export type TipoDecoracao = {
  chave: string;
  nome: string;
  descricao?: string;
  itens: ItemVT[];
};

// --- Blocos reutilizáveis ---------------------------------------------------

const pontoEletrico = (): ItemVT => ({
  chave: "ponto_eletrico",
  label: "Ponto elétrico no local",
  simNao: true,
  resposta: null,
  campos: [
    { chave: "tensao", label: "Tensão", tipo: "texto", valor: "" },
    { chave: "fase", label: "Fase", tipo: "texto", valor: "" },
  ],
});

const fixacao = (): ItemVT => ({
  chave: "fixacao",
  label: "Ponto de fixação da decoração",
  simNao: true,
  resposta: null,
  campos: [
    { chave: "gancho", label: "Gancho", tipo: "check", marcado: false },
    { chave: "pitao", label: "Pitão", tipo: "check", marcado: false },
    { chave: "cabo_aco", label: "Cabo de aço", tipo: "check", marcado: false },
  ],
});

const ancoragemVida = (): ItemVT => ({
  chave: "ancoragem_vida",
  label: "Ponto de ancoragem para linha de vida",
  simNao: true,
  resposta: null,
  campos: [
    { chave: "cabo_aco", label: "Cabo de aço", tipo: "check", marcado: false },
  ],
});

const fachadaVidro = (): ItemVT => ({
  chave: "fachada_vidro",
  label: "Fachada em vidro ou ACM",
  simNao: true,
  resposta: null,
  campos: [
    { chave: "borracha", label: "Borracha", tipo: "check", marcado: false },
    {
      chave: "macarrao",
      label: "Macarrão de piscina",
      tipo: "check",
      marcado: false,
    },
  ],
});

const equipamentos = (): ItemVT => ({
  chave: "equipamentos",
  label: "Utilização de equipamentos",
  simNao: true,
  resposta: null,
  campos: [
    { chave: "munck", label: "Munck", tipo: "check", marcado: false },
    { chave: "guindaste", label: "Guindaste", tipo: "check", marcado: false },
    { chave: "plataforma", label: "Plataforma", tipo: "check", marcado: false },
  ],
});

const estaiamento = (): ItemVT => ({
  chave: "estaiamento",
  label: "Estaiamento da decoração",
  simNao: true,
  resposta: null,
  campos: [
    { chave: "ancoragem", label: "Ancoragem", tipo: "check", marcado: false },
    { chave: "contrapeso", label: "Contrapeso", tipo: "check", marcado: false },
  ],
});

const permissaoFurar = (): ItemVT => ({
  chave: "permissao_furar",
  label: "Permissão para furar",
  simNao: true,
  resposta: null,
  campos: [],
});

// --- Tipos de decoração -----------------------------------------------------

export const TIPOS_DECORACAO: TipoDecoracao[] = [
  {
    chave: "fachada",
    nome: "Fachada",
    descricao: "Fachadas em vidro/ACM e pórticos.",
    itens: [
      pontoEletrico(),
      fachadaVidro(),
      fixacao(),
      ancoragemVida(),
      estaiamento(),
      equipamentos(),
      permissaoFurar(),
    ],
  },
  {
    chave: "arvore_natal",
    nome: "Árvore de Natal",
    descricao: "Árvores e peças de grande porte com içamento.",
    itens: [
      pontoEletrico(),
      fixacao(),
      ancoragemVida(),
      estaiamento(),
      equipamentos(),
      permissaoFurar(),
    ],
  },
  {
    chave: "vegetacao",
    nome: "Vegetação",
    descricao: "Rotatórias, jardins e árvores existentes.",
    itens: [
      pontoEletrico(),
      fixacao(),
      ancoragemVida(),
      equipamentos(),
      estaiamento(),
      permissaoFurar(),
    ],
  },
  {
    chave: "pecas",
    nome: "Peças",
    descricao: "Peças e esculturas decorativas de solo.",
    itens: [
      pontoEletrico(),
      fixacao(),
      estaiamento(),
      equipamentos(),
      permissaoFurar(),
    ],
  },
  {
    chave: "outros",
    nome: "Outros",
    descricao: "Ocasiões específicas — checklist base editável.",
    itens: [
      pontoEletrico(),
      fixacao(),
      ancoragemVida(),
      estaiamento(),
      equipamentos(),
      permissaoFurar(),
    ],
  },
];

export function tipoPorChave(chave: string): TipoDecoracao | undefined {
  return TIPOS_DECORACAO.find((t) => t.chave === chave);
}

export function nomeTipo(chave: string | null | undefined): string {
  if (!chave) return "—";
  return tipoPorChave(chave)?.nome ?? chave;
}

// Cria uma cópia profunda dos itens de um tipo (para não compartilhar estado).
export function itensDoTipo(chave: string): ItemVT[] {
  const tipo = tipoPorChave(chave);
  if (!tipo) return [];
  return JSON.parse(JSON.stringify(tipo.itens)) as ItemVT[];
}

// --- Conferência inicial (uma vez por VT) -----------------------------------

export type Conferencia = {
  deposito: string; // altura x largura x comprimento
  iluminacao: "sim" | "nao" | null;
  ponto_eletrico: "sim" | "nao" | null;
  tensao: string;
  fase: string;
  risco: "sim" | "nao" | null;
  porta_deposito: string;
  porta_entrada: string;
  rotas_acesso: string;
};

export function conferenciaVazia(): Conferencia {
  return {
    deposito: "",
    iluminacao: null,
    ponto_eletrico: null,
    tensao: "",
    fase: "",
    risco: null,
    porta_deposito: "",
    porta_entrada: "",
    rotas_acesso: "",
  };
}
